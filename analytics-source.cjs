'use strict';
const {neon,neonConfig}=require('@neondatabase/serverless');
const {createHmac,createHash,randomBytes,randomInt}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const PORTFOLIO='https://alexey-portfolio-uk1x.onrender.com';
const BACKEND='https://alexey-portfolio-leads.onrender.com';
const PROJECTS=['shiftflow','my-shifts','north','sever','between-lines','terra','signal','forma','turbo','wave','atlas'];
const SOURCES=['direct','telegram','instagram','headhunter','olx','github','google','bing','other'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=v=>createHash('sha256').update(v).digest('hex');
function validEvent(d){return d&&typeof d==='object'&&!Array.isArray(d)&&Object.keys(d).every(k=>['id','visitor','session','kind','target','source','device','consent'].includes(k))&&d.consent==='2026-11-06'&&[d.id,d.visitor,d.session].every(v=>typeof v==='string'&&UUID.test(v))&&['mobile','desktop'].includes(d.device)&&SOURCES.includes(d.source)&&((d.kind==='view'&&d.target==='')||(d.kind==='project'&&PROJECTS.includes(d.target))||(d.kind==='contact'&&['telegram','whatsapp'].includes(d.target))||(d.kind==='lead'&&d.target===''));}
function createAnalytics({query,secret,sendCode,publicOrigin=PORTFOLIO,ownerOrigin=BACKEND,clock=()=>Date.now(),secure=true}={}){
 const q=query, key=(label,value)=>createHmac('sha256',secret).update(label+':'+value).digest('hex');
 const limits=new Map();let cleanupAt=0;
 function limit(k,n,ms){const now=clock();for(const [id,r]of limits)if(r.until<now)limits.delete(id);if(limits.size>5000)return false;const r=limits.get(k)||{n:0,until:now+ms};limits.set(k,r);return ++r.n<=n;}
 const security={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
 function respond(res,status,data,origin,extra={}){res.writeHead(status,{...security,'Content-Type':'application/json; charset=utf-8',...(origin===publicOrigin?{'Access-Control-Allow-Origin':publicOrigin,'Vary':'Origin'}:{}),...extra});res.end(JSON.stringify(data));}
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(Error('Нужен JSON.'),{status:415});let s='';req.setTimeout(10000,()=>req.destroy());for await(const chunk of req){s+=chunk;if(Buffer.byteLength(s)>2048)throw Object.assign(Error('Слишком большой запрос.'),{status:413});}try{return JSON.parse(s)}catch{throw Object.assign(Error('Некорректный запрос.'),{status:400})}}
 const cookie=(value,age)=>'pl_owner='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(secure?'; Secure':'');
 async function authenticated(req){const match=String(req.headers.cookie||'').match(/(?:^|;\s*)pl_owner=([a-f0-9]{64})(?:;|$)/);if(!match)return null;const h=hash(match[1]);const rows=await q('SELECT token_hash FROM pl_owner_sessions WHERE token_hash=$1 AND expires > $2',[h,new Date(clock()).toISOString()]);return rows.length?h:null;}
 async function report(days){
  const today=new Date(clock()+5*3600000).toISOString().slice(0,10);const from=new Date(Date.parse(today+'T00:00:00+05:00')-(days-1)*86400000).toISOString(),to=new Date(clock()+1000).toISOString();
  const args=[from,to],inside='at >= $1 AND at < $2';
  const [totals,daily,projects,contacts,visitors,sources]=await Promise.all([
   q(`WITH p AS (SELECT * FROM pl_events WHERE ${inside}), firsts AS (SELECT visitor,min(at) AS first_at FROM pl_events GROUP BY visitor) SELECT count(DISTINCT p.visitor)::int AS browsers,count(DISTINCT session)::int AS visits,count(*) FILTER(WHERE kind='view')::int AS views,count(*) FILTER(WHERE kind='project')::int AS project_clicks,count(*) FILTER(WHERE kind='contact')::int AS contact_clicks,count(*) FILTER(WHERE kind='lead')::int AS leads,count(DISTINCT p.visitor) FILTER(WHERE firsts.first_at >= $1)::int AS new_browsers,count(DISTINCT p.visitor) FILTER(WHERE EXISTS(SELECT 1 FROM pl_events old WHERE old.visitor=p.visitor AND old.session<>p.session AND old.at<p.at))::int AS returning_browsers FROM p JOIN firsts USING(visitor)`,args),
   q(`SELECT (at AT TIME ZONE 'Asia/Qyzylorda')::date::text AS day,count(DISTINCT visitor)::int AS browsers,count(DISTINCT session)::int AS visits,count(*) FILTER(WHERE kind='view')::int AS views FROM pl_events WHERE ${inside} GROUP BY 1 ORDER BY 1`,args),
   q(`SELECT target,count(*)::int AS clicks,count(DISTINCT visitor)::int AS browsers FROM pl_events WHERE ${inside} AND kind='project' GROUP BY target ORDER BY clicks DESC`,args),
   q(`SELECT target,count(*)::int AS clicks FROM pl_events WHERE ${inside} AND kind='contact' GROUP BY target ORDER BY clicks DESC`,args),
   q(`WITH active AS (SELECT visitor,count(DISTINCT session)::int AS visits,count(*) FILTER(WHERE kind='view')::int AS views,max(at) AS last_at,string_agg(DISTINCT target,', ') FILTER(WHERE kind='project') AS projects,string_agg(DISTINCT target,', ') FILTER(WHERE kind='contact') AS contacts,count(*) FILTER(WHERE kind='lead')::int AS leads,string_agg(DISTINCT device,', ') AS device FROM pl_events WHERE ${inside} GROUP BY visitor ORDER BY last_at DESC LIMIT 100) SELECT active.*, (SELECT min(at) FROM pl_events all_events WHERE all_events.visitor=active.visitor) AS first_at FROM active ORDER BY last_at DESC`,args),
   q(`SELECT source,count(DISTINCT session)::int AS visits,count(DISTINCT visitor)::int AS browsers FROM pl_events WHERE ${inside} GROUP BY source ORDER BY visits DESC`,args)
  ]);
  const [coverage]=await q('SELECT min(at) AS started_at FROM pl_events');
  return {totals:totals[0],daily,projects:PROJECTS.map(id=>({target:id,clicks:0,browsers:0,...projects.find(p=>p.target===id)})).sort((a,b)=>b.clicks-a.clicks),contacts,visitors:visitors.map(v=>({...v,visitor:v.visitor.slice(0,12)})),sources,from,to,days,timezone:'UTC+5',retentionDays:180,startedAt:coverage.started_at};
 }
 return async function route(req,res){
  const url=new URL(req.url,ownerOrigin),p=url.pathname,origin=req.headers.origin;
  if(!['/owner','/owner/','/owner.js','/owner.css','/api/analytics/event'].includes(p)&&!p.startsWith('/api/owner/'))return false;
  try{
   if(['/owner','/owner/','/owner.js','/owner.css'].includes(p)){
    if(req.method!=='GET'){respond(res,405,{error:'Method not allowed'});return true;}
    const file=p.endsWith('.js')?'owner.js':p.endsWith('.css')?'owner.css':'owner.html',type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
    res.writeHead(200,{...security,'Content-Type':type+'; charset=utf-8'});res.end(fs.readFileSync(path.join(__dirname,file)));return true;
   }
   if(p==='/api/analytics/event'){
    if(origin!==publicOrigin){respond(res,403,{error:'Forbidden'});return true;}
    if(req.method==='OPTIONS'){res.writeHead(204,{...security,'Access-Control-Allow-Origin':publicOrigin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'});res.end();return true;}
    if(req.method!=='POST'){respond(res,405,{error:'Method not allowed'},origin);return true;}
    const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0];
    if(!limit(key('rate',ip),180,60000)||!limit('global',2000,60000)){respond(res,429,{error:'Попробуйте позже.'},origin);return true;}
    const d=await body(req);if(!validEvent(d)){respond(res,400,{error:'Invalid event'},origin);return true;}
    await q('INSERT INTO pl_events(id,visitor,session,kind,target,source,device,at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO NOTHING',[d.id,key('visitor',d.visitor),key('session',d.visitor+':'+d.session),d.kind,d.target,d.source,d.device,new Date(clock()).toISOString()]);
    respond(res,200,{ok:true},origin);
    if(clock()-cleanupAt>86400000){cleanupAt=clock();void q("DELETE FROM pl_events WHERE at < now() - interval '180 days'").then(()=>q('DELETE FROM pl_owner_sessions WHERE expires < now()')).catch(()=>{});}
    return true;
   }
   if(req.method==='POST'&&origin!==ownerOrigin){respond(res,403,{error:'Forbidden'});return true;}
   if(p==='/api/owner/login/request'&&req.method==='POST'){
    await body(req);
    const code=String(randomInt(10000000,100000000));const now=new Date(clock()).toISOString();
    const rows=await q("INSERT INTO pl_login(id,code_hash,expires,attempts,sent_at,request_day) VALUES(1,$1,$2,0,$3,($3::timestamptz AT TIME ZONE 'Asia/Qyzylorda')::date) ON CONFLICT(id) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires=EXCLUDED.expires,attempts=0,sent_at=EXCLUDED.sent_at,request_day=EXCLUDED.request_day,requests=CASE WHEN pl_login.request_day=EXCLUDED.request_day THEN pl_login.requests+1 ELSE 1 END WHERE pl_login.sent_at < $3::timestamptz - interval '5 minutes' AND (pl_login.request_day<>EXCLUDED.request_day OR pl_login.requests<12) RETURNING id",[key('otp',code),new Date(clock()+10*60000).toISOString(),now]);
    if(!rows.length){respond(res,429,{error:'Новый код можно запросить через 5 минут. Лимит — 12 кодов в сутки.'});return true;}
    await sendCode(code);respond(res,200,{ok:true});return true;
   }
   if(p==='/api/owner/login/verify'&&req.method==='POST'){
    const d=await body(req);if(typeof d.code!=='string'||!/^\d{8}$/.test(d.code)){respond(res,400,{error:'Введите 8 цифр.'});return true;}
    // Atomic attempt reservation. Concurrent guesses can never exceed five attempts.
    const [r]=await q('UPDATE pl_login SET attempts=attempts+1 WHERE id=1 AND expires>$1 AND attempts<5 RETURNING code_hash',[new Date(clock()).toISOString()]);
    if(!r||r.code_hash!==key('otp',d.code)){respond(res,401,{error:'Код неверен, истёк или исчерпаны попытки.'});return true;}
    const used=await q('UPDATE pl_login SET expires=$1 WHERE id=1 AND code_hash=$2 AND expires>$1 RETURNING id',[new Date(clock()).toISOString(),r.code_hash]);
    if(!used.length){respond(res,401,{error:'Код уже использован.'});return true;}
    const session=randomBytes(32).toString('hex');await q('INSERT INTO pl_owner_sessions(token_hash,expires) VALUES($1,$2)',[hash(session),new Date(clock()+7*86400000).toISOString()]);
    respond(res,200,{ok:true},null,{'Set-Cookie':cookie(session,7*86400)});return true;
   }
   const session=await authenticated(req);if(!session){respond(res,401,{error:'Требуется вход.'});return true;}
   if(p==='/api/owner/logout'&&req.method==='POST'){await q('DELETE FROM pl_owner_sessions WHERE token_hash=$1',[session]);respond(res,200,{ok:true},null,{'Set-Cookie':cookie('',0)});return true;}
   if(p==='/api/owner/summary'&&req.method==='GET'){const days=Number(url.searchParams.get('days')||7);if(![1,7,30,90,180].includes(days)){respond(res,400,{error:'Некорректный период.'});return true;}respond(res,200,await report(days));return true;}
   respond(res,404,{error:'Not found'});return true;
  }catch(e){respond(res,e.status||503,{error:e.status?e.message:'Статистика временно недоступна. Попробуйте позже.'},origin===publicOrigin?origin:null);return true;}
 };
}
let production;
function route(req,res){
 if(!process.env.ANALYTICS_DATABASE_URL||!process.env.ANALYTICS_SECRET){if(req.url.startsWith('/api/analytics/')||req.url.startsWith('/api/owner/')||req.url.startsWith('/owner')){res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"Analytics not configured"}');return Promise.resolve(true)}return Promise.resolve(false);}
 if(!production){
  neonConfig.fetchFunction=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)});
  const sql=neon(process.env.ANALYTICS_DATABASE_URL);
  production=createAnalytics({query:(text,params=[])=>sql.query(text,params),secret:process.env.ANALYTICS_SECRET,sendCode:async code=>{
   const r=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:'Program Lab · вход в аналитику\n\nКод: '+code+'\nДействует 10 минут, только для вас. Никому не передавайте код.\nЕсли вы не запрашивали вход, проигнорируйте сообщение.'}),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok||!d.ok)throw Error('Telegram delivery failed');
  }});
 }
 return production(req,res);
}
module.exports={route,createAnalytics,validEvent,PROJECTS};

