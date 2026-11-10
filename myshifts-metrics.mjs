import {createHmac,randomBytes,randomUUID} from 'node:crypto';

export const CONSENT_VERSION='2026-10-11';
export const RETENTION_DAYS=400;
export const EVENTS=['visit','engaged','dashboard_view','shift_created','shift_started','shift_finished','income_created','revenue_recorded','payment_recorded','salary_view','salary_settings_saved','report_open','goal_saved','tip_recorded','deduction_recorded','schedule_created','feedback_sent','registration'];
const ACTIVE=new Set(EVENTS.filter(e=>!['visit','engaged','registration','feedback_sent'].includes(e)));
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slug=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(v)?v.toLowerCase():'';
const analyticsDayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Qyzylorda'});
export const dayAt=t=>analyticsDayFormatter.format(new Date(t));
export const addDays=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const startOf=day=>new Date(day+'T00:00:00+05:00').toISOString();
const validDay=v=>typeof v==='string'&&/^20\d\d-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export function attribution(input={}){return {source:slug(input.source)||'direct',medium:slug(input.medium)||'',campaign:slug(input.campaign)||''};}
export const campaignKey=a=>JSON.stringify([a.source,a.medium,a.campaign]);
function reject(message){const e=Error(message);e.status=400;throw e;}
export function validateBatch(input){
 if(!input||input.consent!==CONSENT_VERSION)reject('Для аналитики необходимо добровольное согласие.');
 if(!UUID.test(input.visitor)||!UUID.test(input.session)||!Array.isArray(input.events)||!input.events.length||input.events.length>20)reject('Некорректный пакет аналитики.');
 if(Object.keys(input).some(k=>!['consent','visitor','session','attribution','events'].includes(k)))reject('Лишние данные в аналитике запрещены.');
 if(input.attribution&&(typeof input.attribution!=='object'||Object.keys(input.attribution).some(k=>!['source','medium','campaign'].includes(k))))reject('Некорректный источник перехода.');
 const events=input.events.map(e=>{if(!e||Object.keys(e).some(k=>!['id','name'].includes(k))||!UUID.test(e.id)||!EVENTS.includes(e.name)||e.name==='registration')reject('Некорректное событие аналитики.');return {id:e.id,name:e.name};});
 return {...input,events,attribution:attribution(input.attribution)};
}
export function periodRange(input,now,startedAt){
 const today=dayAt(now),period=input.period||'7';
 let from=period==='all'?dayAt(startedAt):addDays(today,period==='today'?0:period==='30'?-29:-6),to=today;
 if(period==='custom'){if(!validDay(input.from)||!validDay(input.to)||input.from>input.to||input.to>today)reject('Проверьте даты периода.');from=input.from;to=input.to;}
 else if(!['today','7','30','all'].includes(period))reject('Неизвестный период.');
 const days=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 if(days>RETENTION_DAYS)from=addDays(to,1-RETENTION_DAYS);
 const span=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
 return {period,from,to,start:startOf(from),end:startOf(addDays(to,1)),previousFrom:addDays(from,-span),previousTo:addDays(from,-1),timezone:'Asia/Qyzylorda'};
}

// This pure calculation operates exclusively on pseudonyms and allowlisted event names.
// No user documents, amounts, contacts, IP addresses or user agents enter it.
export function summarizeAnalytics({visitors,sessions,events,costs,range,now,registeredTotal,registeredPeriod,registeredPrevious,startedAt,snapshot={withShifts:0,withSalary:0}}){
 const aliases=new Map(visitors.map(v=>[v.id,v.actor||v.id])),actor=id=>aliases.get(id)||id;
 const people=new Map(),visitRows=sessions.map(s=>({...s,actor:actor(s.visitor)})),sessionById=new Map(visitRows.map(s=>[s.id,s]));
 for(const v of visitors){const id=actor(v.id),old=people.get(id);if(!old||v.first_at<old.first_at)people.set(id,{...v,id});}
 const ev=events.map(e=>({...e,actor:actor(e.visitor),count:Number(e.count||1)}));
 const activeActors=new Set(ev.filter(e=>ACTIVE.has(e.name)).map(e=>e.actor)),registeredActors=new Set(ev.filter(e=>e.name==='registration').map(e=>e.actor)),sessionsPerActor=new Map();
 for(const s of visitRows){if(!sessionsPerActor.has(s.actor))sessionsPerActor.set(s.actor,new Set());sessionsPerActor.get(s.actor).add(s.id);}
 const between=(at,from=range.from,to=range.to)=>dayAt(at)>=from&&dayAt(at)<=to;
 const uniq=rows=>new Set(rows.map(r=>r.actor)).size;
 function metrics(from,to){const visits=visitRows.filter(s=>between(s.first_at,from,to)),inside=ev.filter(e=>between(e.at,from,to)),ids=new Set([...visits.map(s=>s.actor),...inside.map(e=>e.actor)]),newCount=[...ids].filter(id=>between(people.get(id).first_at,from,to)).length;
  const mature=visits.filter(s=>Date.parse(s.first_at)<=Date.parse(now)-1800000),eventSessions=new Set(ev.filter(e=>e.name==='engaged'||ACTIVE.has(e.name)).map(e=>e.session));
  return {visitors:ids.size,newVisitors:newCount,returningVisitors:ids.size-newCount,visits:visits.length,active:uniq(inside.filter(e=>ACTIVE.has(e.name))),shiftUsers:uniq(inside.filter(e=>['shift_created','shift_started'].includes(e.name))),salaryUsers:uniq(inside.filter(e=>e.name==='salary_view')),registered:inside.filter(e=>e.name==='registration').reduce((n,e)=>n+e.count,0),bounces:mature.filter(s=>!eventSessions.has(s.id)).length,finalizedSessions:mature.length,pendingSessions:visits.length-mature.length};
 }
 const current=metrics(range.from,range.to),previous=range.period==='all'?null:metrics(range.previousFrom,range.previousTo);
 const activeDays=new Map(),visitDays=new Map();
 for(const s of visitRows){if(!visitDays.has(s.actor))visitDays.set(s.actor,new Set());visitDays.get(s.actor).add(dayAt(s.first_at));}
 for(const e of ev){if(!visitDays.has(e.actor))visitDays.set(e.actor,new Set());visitDays.get(e.actor).add(dayAt(e.at));if(ACTIVE.has(e.name)){if(!activeDays.has(e.actor))activeDays.set(e.actor,new Set());activeDays.get(e.actor).add(dayAt(e.at));}}
 const endDay=range.to,activeWindow=n=>[...activeDays.values()].filter(ds=>[...ds].some(d=>d>=addDays(endDay,1-n)&&d<=endDay)).length;
 const retention=[1,3,7,30].map(n=>{const eligible=[...people.values()].filter(p=>between(p.first_at)&&addDays(dayAt(p.first_at),n)<=dayAt(now));const returned=eligible.filter(p=>visitDays.get(p.id)?.has(addDays(dayAt(p.first_at),n))).length;return {day:n,eligible:eligible.length,returned,percent:eligible.length?returned/eligible.length*100:null};});
 const matureActivated=[...activeDays.entries()].filter(([,days])=>[...days].sort()[0]<=addDays(endDay,-7));
 const continuing=matureActivated.filter(([,days])=>[...days].some(d=>d>=addDays(endDay,-6)&&d<=endDay)).length;
 const features=EVENTS.filter(n=>ACTIVE.has(n)||n==='feedback_sent').map(name=>{const rows=ev.filter(e=>e.name===name&&between(e.at));return {name,events:rows.reduce((n,e)=>n+e.count,0),users:uniq(rows)};}).sort((a,b)=>b.users-a.users||b.events-a.events);
 const sourceMap=new Map();for(const s of visitRows.filter(s=>between(s.first_at))){if(!sourceMap.has(s.source))sourceMap.set(s.source,{source:s.source,visits:0,people:new Set()});const row=sourceMap.get(s.source);row.visits++;row.people.add(s.actor);}for(const e of ev.filter(e=>between(e.at))){const source=sessionById.get(e.session)?.source||'direct';if(!sourceMap.has(source))sourceMap.set(source,{source,visits:0,people:new Set()});sourceMap.get(source).people.add(e.actor);}const sources=[...sourceMap.values()].map(({people,...s})=>({...s,visitors:people.size})).sort((a,b)=>b.visitors-a.visitors);
 const keys=new Map();for(const p of people.values())keys.set(campaignKey(p),attribution(p));for(const c of costs)keys.set(campaignKey(c),attribution(c));for(const s of visitRows)if(between(s.first_at))keys.set(campaignKey(s),attribution(s));
 const campaigns=[...keys.entries()].map(([key,a])=>{const cohort=[...people.values()].filter(p=>between(p.first_at)&&campaignKey(p)===key),arrivals=visitRows.filter(s=>between(s.first_at)&&campaignKey(s)===key);const activated=cohort.filter(p=>activeActors.has(p.id)).length,registered=cohort.filter(p=>registeredActors.has(p.id)).length,returned=cohort.filter(p=>(sessionsPerActor.get(p.id)?.size||0)>1).length;
  const expenses=costs.filter(c=>!c.voided&&between(c.date+'T12:00:00+05:00')&&campaignKey(c)===key);const spend=[...new Set(expenses.map(c=>c.currency))].map(currency=>{const amount=expenses.filter(c=>c.currency===currency).reduce((s,c)=>s+Number(c.amount),0);return {currency,amount,perVisitor:cohort.length?amount/cohort.length:null,perActivated:activated?amount/activated:null,perRegistration:registered?amount/registered:null};});
  return {key,...a,visitors:uniq(arrivals),newVisitors:cohort.length,visits:arrivals.length,activated,registered,returned,spend};}).filter(c=>c.visitors||c.newVisitors||c.spend.length).sort((a,b)=>b.visitors-a.visitors);
 const dailyMap=new Map();for(let day=range.from;day<=range.to;day=addDays(day,1))dailyMap.set(day,{date:day,visitorSet:new Set(),activeSet:new Set(),visits:0,newVisitors:0,registrations:0});
 for(const s of visitRows){const d=dailyMap.get(dayAt(s.first_at));if(d){d.visitorSet.add(s.actor);d.visits++;}}
 for(const e of ev){const d=dailyMap.get(dayAt(e.at));if(d){d.visitorSet.add(e.actor);if(ACTIVE.has(e.name))d.activeSet.add(e.actor);if(e.name==='registration')d.registrations+=e.count;}}
 for(const p of people.values()){const d=dailyMap.get(dayAt(p.first_at));if(d)d.newVisitors++;}
 const daily=[...dailyMap.values()].map(({visitorSet,activeSet,...d})=>({...d,visitors:visitorSet.size,active:activeSet.size}));
 return {range,current,previous,daily,sources,features,campaigns,retention,engagement:{dau:activeWindow(1),wau:activeWindow(7),mau:activeWindow(30),eligible:matureActivated.length,continuing,percent:matureActivated.length?continuing/matureActivated.length*100:null},accounts:{total:registeredTotal,period:registeredPeriod,previous:registeredPrevious,...snapshot},coverage:{startedAt,retentionDays:RETENTION_DAYS,pseudonymous:true,consentOnly:true,allVisitors:people.size,allVisits:visitRows.length},costs:costs.filter(c=>!c.voided&&between(c.date+'T12:00:00+05:00')).sort((a,b)=>b.date.localeCompare(a.date)).map(c=>({...c,amount:Number(c.amount),version:Number(c.version)}))};
}


