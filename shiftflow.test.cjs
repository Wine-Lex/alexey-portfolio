'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createOtherReports,makeReader}=require('./hub-source.cjs');
test('ShiftFlow periods start at UTC+5 midnight; all history has no arbitrary lower cutoff',async()=>{
 const seen=[],clock=()=>Date.parse('2026-11-16T20:15:00Z');
 const reader=async(sql,params)=>{seen.push({sql,params});return [{report:{totals:{users:1,companies:1},current:{activeCompanies:1},daily:[]}}]};
 const report=createOtherReports({shiftflow:reader,clock}).shiftflow;
 await report('1');await report('7');const all=await report('all');
 assert.deepEqual(seen[0].params,['2026-11-16T19:00:00.000Z','2026-11-16T20:15:00.000Z']);
 assert.equal(seen[1].params[0],'2026-11-10T19:00:00.000Z');assert.equal(seen[2].params[0],'-infinity');assert.equal(all.from,null);assert.equal(all.scope,'operational');assert.equal(all.includesTestData,true);
 await assert.rejects(()=>createOtherReports({}).shiftflow('7'),/unavailable/);
});
test('ShiftFlow restricted reader exposes aggregates, cannot read identities, audit content or write',{skip:!process.env.SHIFTFLOW_ANALYTICS_URL},async()=>{
 const read=makeReader(process.env.SHIFTFLOW_ANALYTICS_URL);
 assert.equal((await read('SHOW default_transaction_read_only'))[0].default_transaction_read_only,'on');
 for(const sql of ['SELECT email,"passwordHash" FROM public."User" LIMIT 1','SELECT "tokenHash" FROM public."Session" LIMIT 1','SELECT "newValue" FROM public."AuditLog" LIMIT 1','SELECT name FROM public."Company" LIMIT 1'])await assert.rejects(()=>read(sql),e=>e.code==='42501');
 await assert.rejects(()=>read('UPDATE public."User" SET name=name WHERE false'),e=>['42501','25006'].includes(e.code));
 const data=await createOtherReports({shiftflow:read}).shiftflow('30');
 assert.deepEqual(Object.keys(data.totals).sort(),['companies','employees','locations','users']);
 assert.equal(data.current.activeCompanies<=data.totals.companies,true);assert.equal(data.current.activeUsers<=data.totals.users,true);
 assert.ok(Array.isArray(data.shifts));assert.ok(Array.isArray(data.checklists));assert.ok(data.daily.length<=400);
 const serialized=JSON.stringify(data);assert.equal(/password|tokenHash|@|oldValue|newValue|companyId|userId|earningsMinor/.test(serialized),false);
});
test('Isolated ShiftFlow branch: range boundaries, distinct actors and UTC+5 days agree with stored events',{
 skip:!process.env.SF_TEST_OWNER_URL||process.env.SF_TEST_BRANCH_ID!=='br-tiny-haze-b1y1vl4n'
},async()=>{
 const owner=makeReader(process.env.SF_TEST_OWNER_URL),read=makeReader(process.env.SHIFTFLOW_ANALYTICS_URL);
 const from='2100-01-02T19:00:00.000Z',to='2100-01-03T19:00:00.000Z',at=['2100-01-02T18:59:59.999Z',from,'2100-01-03T18:59:59.999Z',to];
 const report=async()=> (await read('SELECT pl_reporting.shiftflow_report($1::timestamptz,$2::timestamptz) AS report',[from,to]))[0].report;
 const before=await report(),users=at.map(()=>randomUUID()),companies=[randomUUID(),randomUUID()];
 for(let i=0;i<4;i++)await owner('INSERT INTO public."User"(id,name,email,"passwordHash","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$5)',[users[i],'Analytics fixture',users[i]+'@example.invalid','invalid-no-login-hash',at[i]]);
 for(let i=0;i<2;i++)await owner('INSERT INTO public."Company"(id,name,"inviteCode","createdBy","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$5)',[companies[i],'Analytics fixture',randomUUID(),users[1],i===0?from:to]);
 for(const [i,time]of [[1,from],[1,from],[2,at[2]],[0,at[0]],[3,to]])await owner('INSERT INTO public."AuditLog"(id,"companyId","userId",action,"entityType","entityId","createdAt") VALUES ($1,$2,$3,$4,$5,$2,$6)',[randomUUID(),companies[0],users[i],'ANALYTICS_TEST','Company',time]);
 const after=await report();
 for(const [key,delta]of Object.entries({newUsers:2,newCompanies:1,actions:3,activeUsers:2,activeCompanies:1}))assert.equal(after.current[key]-before.current[key],delta,key);
 assert.deepEqual(after.daily.map(r=>r.day),['2100-01-03']);
 assert.equal(after.daily[0].users-(before.daily[0]?.users||0),2);assert.equal(after.daily[0].actions-(before.daily[0]?.actions||0),3);
});
