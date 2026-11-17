const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto');
const {createHub,createOtherReports,makeReader}=require('./hub-source.cjs');
const {createAnalytics}=require('./analytics-source.cjs');
test('One failed project stays unavailable; good projects are preserved and concurrent loads deduplicate',async()=>{
 let count=0,now=1000;const hub=createHub({portfolio:async()=>{count++;await new Promise(r=>setTimeout(r,10));return {visits:2}},shiftflow:async()=>({companies:1}),myshifts:async()=>{throw Error('secret database URI must never leak')},between:async()=>({users:3})},()=>now);
 const [a,b]=await Promise.all([hub('7'),hub('7')]);assert.equal(count,1);assert.deepEqual(a.projects,b.projects);assert.equal(a.projects[0].status,'ok');assert.equal(a.projects.find(s=>s.id==='myshifts').status,'unavailable');assert.equal('data' in a.projects.find(s=>s.id==='myshifts'),false);assert.equal(JSON.stringify(a).includes('secret database'),false);assert.equal(a.projects.find(s=>s.id==='between').status,'ok');await assert.rejects(()=>hub('injected'),/период/);now+=46000;await hub('7');assert.equal(count,2);
});
test('Unified endpoint requires the existing owner session before reading any source',async t=>{
 const token='a'.repeat(64),hash=crypto.createHash('sha256').update(token).digest('hex');let calls=0;const q=async(sql,args)=>sql.startsWith('SELECT token_hash')&&args[0]===hash?[{token_hash:hash}]:[];
 const app=createAnalytics({query:q,secret:'test-only',sendCode:async()=>{},otherReports:{portfolio:async()=>{calls++;return {visits:1}},shiftflow:async()=>{calls++;return {companies:1}},myshifts:async()=>{calls++;return {visits:2}},between:async()=>{calls++;return {users:3}}}});
 const s=http.createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>s.close(r)));const base='http://127.0.0.1:'+s.address().port;
 assert.equal((await fetch(base+'/api/owner/hub')).status,401);assert.equal(calls,0);
 assert.equal((await fetch(base+'/api/owner/hub',{headers:{Cookie:'pl_owner='+'b'.repeat(64)}})).status,401);assert.equal(calls,0);
 assert.equal((await fetch(base+'/api/owner/hub?period=500',{headers:{Cookie:'pl_owner='+token}})).status,400);assert.equal(calls,0);
 const r=await fetch(base+'/api/owner/hub?period=7',{headers:{Cookie:'pl_owner='+token}});assert.equal(r.status,200);assert.equal((await r.json()).projects.length,4);assert.equal(calls,4);assert.equal(r.headers.get('access-control-allow-origin'),null);
 assert.equal((await fetch(base+'/api/owner/hub',{method:'POST',headers:{Origin:'https://evil.test',Cookie:'pl_owner='+token}})).status,403);
});
test('Actual test branches: restricted readers see reporting views, cannot read users or content, cannot write',{skip:!process.env.MYSHIFTS_ANALYTICS_URL},async()=>{
 const my=makeReader(process.env.MYSHIFTS_ANALYTICS_URL),bl=makeReader(process.env.BETWEEN_ANALYTICS_URL);
 assert.equal((await my("SELECT current_setting('default_transaction_read_only') AS value"))[0].value,'on');
 await assert.rejects(()=>my('SELECT email,password FROM public.myshifts_users LIMIT 1'),e=>e.code==='42501');
 await assert.rejects(()=>my('SELECT body FROM public.myshifts_documents LIMIT 1'),e=>e.code==='42501');
 await assert.rejects(()=>my('SELECT secret FROM public.myshifts_analytics_config'),e=>e.code==='42501');
 await assert.rejects(()=>my("UPDATE public.myshifts_analytics_costs SET amount=amount WHERE false"),e=>['42501','25006'].includes(e.code));
 await assert.rejects(()=>bl('SELECT email FROM neon_auth."user" LIMIT 1'),e=>e.code==='42501');
 await assert.rejects(()=>bl('SELECT body FROM public.bl_works LIMIT 1'),e=>e.code==='42501');
 await assert.rejects(()=>bl('SELECT message,contact FROM public.bl_feedback LIMIT 1'),e=>e.code==='42501');
 const reports=createOtherReports({myshifts:my,between:bl});
 const m=await reports.myshifts('7');assert.ok(m.current.visitors>=0);assert.equal(m.accounts.total,Number((await my('SELECT total FROM pl_reporting.account_totals'))[0].total));assert.equal(m.retention.length,4);assert.equal(m.daily.length,7);assert.equal('visitors' in m,false);assert.ok(m.features.length>0);
 const all=await reports.myshifts('all');assert.ok(all.daily.length<=400);assert.equal(all.accounts.period,all.accounts.total);
 const b=await reports.between('7');assert.deepEqual(Object.keys(b.totals).sort(),['authors','published','returning_logins','users']);assert.equal(b.scope,'all-time');assert.ok(b.totals.authors<=b.totals.users);assert.ok(b.totals.returning_logins>=0);
});
