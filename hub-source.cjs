'use strict';
const {neon}=require('@neondatabase/serverless');
const {summarizeAnalytics,periodRange,RETENTION_DAYS}=require('./myshifts-metrics.mjs');
const PERIODS=['1','7','30','90','180','all'];
const SOURCES=['portfolio','myshifts','between'];
const NAMES={portfolio:'Портфолио',myshifts:'Мои смены',between:'Between Lines'};
const LINKS={portfolio:'https://alexey-portfolio-uk1x.onrender.com/',myshifts:'https://moi-smeny.onrender.com/',between:'https://between-lines-lab.onrender.com/'};
const OWNER_LINKS={portfolio:'https://alexey-portfolio-leads.onrender.com/owner',myshifts:'https://moi-smeny.onrender.com/admin.html',between:'https://between-lines-lab.onrender.com/owner'};
const MAX_ROWS=50000;
function bounded(rows){if(rows.length>MAX_ROWS)throw Error('Reporting limit exceeded');return rows;}
function makeReader(uri){if(!uri)return null;const sql=neon(uri);return (text,params=[])=>sql.query(text,params);}
function createOtherReports({myshifts,between,clock=()=>Date.now()}={}){
 async function myshiftsReport(period){
  if(!myshifts)throw Error('Source unavailable');
  const now=new Date(clock()).toISOString();
  const [coverage]=await myshifts('SELECT started_at FROM pl_reporting.coverage');
  if(!coverage)throw Error('Missing reporting configuration');
  const today=new Date(clock()+5*3600000).toISOString().slice(0,10),days=Number(period);
  const input=period==='all'?{period:'all'}:period==='1'?{period:'today'}:{period:'custom',from:new Date(Date.parse(today+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10),to:today};
  const range=periodRange(input,now,coverage.started_at),cutoff=new Date(clock()-RETENTION_DAYS*86400000).toISOString();
  const [visitors,sessions,events,costs,registrations,accounts,usage]=await Promise.all([
   myshifts('SELECT id,actor,first_at,last_at,source,medium,campaign FROM pl_reporting.visitors WHERE last_at >= $1 LIMIT 50001',[cutoff]),
   myshifts('SELECT id,visitor,first_at,last_at,source,medium,campaign FROM pl_reporting.sessions WHERE first_at >= $1 LIMIT 50001',[cutoff]),
   myshifts('SELECT visitor,session,name,at,count FROM pl_reporting.events WHERE at >= $1 LIMIT 50001',[cutoff]),
   myshifts('SELECT id,date,source,medium,campaign,amount,currency,version,voided FROM pl_reporting.costs WHERE date >= $1 LIMIT 50001',[range.previousFrom]),
   myshifts('SELECT day,count FROM pl_reporting.registrations WHERE day >= $1 AND day <= $2',[range.previousFrom,range.to]),
   myshifts('SELECT total FROM pl_reporting.account_totals'),myshifts('SELECT with_shifts,with_salary FROM pl_reporting.work_usage')
  ]);
  [visitors,sessions,events,costs].forEach(bounded);
  const registered=(from,to)=>registrations.filter(r=>r.day>=from&&r.day<=to).reduce((sum,r)=>sum+Number(r.count),0);
  return summarizeAnalytics({visitors,sessions,events,costs,range,now,registeredTotal:Number(accounts[0].total),registeredPeriod:period==='all'?Number(accounts[0].total):registered(range.from,range.to),registeredPrevious:registered(range.previousFrom,range.previousTo),startedAt:coverage.started_at,snapshot:{withShifts:Number(usage[0]?.with_shifts||0),withSalary:Number(usage[0]?.with_salary||0)}});
 }
 async function betweenReport(){if(!between)throw Error('Source unavailable');const [totals]=await between('SELECT users,authors,published,returning_logins FROM pl_reporting.summary');if(!totals)throw Error('Missing reporting configuration');return {totals,scope:'all-time',updatedAt:new Date(clock()).toISOString()};}
 return {myshifts:myshiftsReport,between:betweenReport};
}
function createHub(reports,clock=()=>Date.now()){
 const cache=new Map();
 async function project(id,period){
  const cacheKey=id+':'+(id==='between'?'all':period),existing=cache.get(cacheKey);
  if(existing&&existing.until>clock())return existing.promise;
  const entry={until:clock()+45000,promise:null};
  entry.promise=(async()=>{
   const common={id,name:NAMES[id],url:LINKS[id],ownerUrl:OWNER_LINKS[id]};
   try{if(typeof reports[id]!=='function')throw Error('Source unavailable');const data=await reports[id](period);return {...common,status:'ok',data,updatedAt:new Date(clock()).toISOString()};}
   catch{return {...common,status:'unavailable',message:'Данные временно недоступны. Обновите отчёт позже; это не нулевые показатели.'};}
  })();cache.set(cacheKey,entry);return entry.promise;
 }
 return async period=>{if(!PERIODS.includes(period))throw Object.assign(Error('Некорректный период.'),{status:400});return {period,timezone:'UTC+5',generatedAt:new Date(clock()).toISOString(),cacheSeconds:45,projects:await Promise.all(SOURCES.map(id=>project(id,period)))};};
}
module.exports={createHub,createOtherReports,makeReader,PERIODS};
