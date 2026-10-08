'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const allowedOrigin='https://alexey-portfolio-uk1x.onrender.com';
const token=process.env.TELEGRAM_BOT_TOKEN;
const chat=process.env.TELEGRAM_CHAT_ID;
const cache=new Map(),limits=new Map();
function reply(res,status,data,origin){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin===allowedOrigin?{'Access-Control-Allow-Origin':allowedOrigin,'Vary':'Origin'}:{})});res.end(JSON.stringify(data))}
function quota(key,max,window){const now=Date.now(),entry=limits.get(key);if(!entry||entry.until<now){limits.set(key,{n:1,until:now+window});return true}if(entry.n>=max)return false;entry.n++;return true}
setInterval(()=>{const now=Date.now();for(const[k,v]of cache)if(v.until<now)cache.delete(k);for(const[k,v]of limits)if(v.until<now)limits.delete(k)},60000).unref();
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(req.method==='GET'&&req.url==='/health'){return reply(res,200,{ok:!!(token&&chat)})}
 if(req.url!=='/api/leads')return reply(res,404,{error:'Not found'});
 if(origin!==allowedOrigin)return reply(res,403,{error:'Запрос разрешён только с сайта портфолио.'});
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'});return res.end()}
 if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'},origin);
 if(!token||!chat)return reply(res,503,{error:'Отправка временно недоступна. Напишите в Telegram или WhatsApp.'},origin);
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return reply(res,415,{error:'Invalid content type'},origin);
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
 let body='',large=false;req.setTimeout(10000,()=>req.destroy());
 try{for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>7000){large=true;break}}}catch{return reply(res,400,{error:'Не удалось прочитать запрос.'},origin)}
 if(large)return reply(res,413,{error:'Запрос слишком длинный.'},origin);
 let data;try{data=JSON.parse(body)}catch{return reply(res,400,{error:'Некорректный запрос.'},origin)}
 if(!data||typeof data!=='object'||Array.isArray(data))return reply(res,400,{error:'Некорректный запрос.'},origin);
 const fields={business:160,task:1500,deadline:160,contact:200};const clean={};
 for(const[key,max]of Object.entries(fields)){if(typeof data[key]!=='string'||data[key].length>max)return reply(res,400,{error:'Проверьте заполненные поля.'},origin);clean[key]=data[key].trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'')}
 if(!clean.business||!clean.task||!clean.contact)return reply(res,400,{error:'Укажите проект, задачу и контакт для ответа.'},origin);
 if(data.website)return reply(res,400,{error:'Не удалось отправить запрос.'},origin);
 if(typeof data.requestId!=='string'||!/^[0-9a-f-]{36}$/i.test(data.requestId))return reply(res,400,{error:'Некорректный идентификатор.'},origin);
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify(clean)).digest('hex');const previous=cache.get(data.requestId);
 if(previous){if(previous.fingerprint!==fingerprint)return reply(res,409,{error:'Обновите форму и повторите отправку.'},origin);if(previous.status==='sent')return reply(res,200,{ok:true},origin);return reply(res,409,{error:previous.status==='pending'?'Заявка ещё отправляется. Подождите.':'Не удалось подтвердить доставку. Чтобы избежать повтора, напишите напрямую в Telegram или WhatsApp.'},origin)}
 if(cache.size>=2000||limits.size>=5000)return reply(res,429,{error:'Сервис занят. Попробуйте немного позже.'},origin);
 if(!quota('minute:'+ip,3,60000)||!quota('day:'+ip,15,86400000)||!quota('global',200,86400000))return reply(res,429,{error:'Слишком много запросов. Попробуйте позже или напишите напрямую.'},origin);
 const record={fingerprint,status:'pending',until:Date.now()+86400000};cache.set(data.requestId,record);
 const text='Новая заявка с портфолио\n\nПроект: '+clean.business+'\n\nЗадача: '+clean.task+'\n\nКонтакт: '+clean.contact+(clean.deadline?'\n\nСрок и бюджет: '+clean.deadline:'')+'\n\nЗаявка: '+data.requestId.slice(0,8);
 try{
  const telegram=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chat,text,link_preview_options:{is_disabled:true}}),signal:AbortSignal.timeout(15000)});
  const result=await telegram.json();if(!telegram.ok||!result.ok){cache.delete(data.requestId);return reply(res,502,{error:'Telegram не принял заявку. Попробуйте позже или напишите напрямую.'},origin)}
  record.status='sent';reply(res,200,{ok:true},origin);
 }catch{record.status='unknown';reply(res,502,{error:'Не удалось подтвердить доставку. Напишите напрямую в Telegram или WhatsApp.'},origin)}
});
server.requestTimeout=150000;server.headersTimeout=20000;
if(require.main===module)server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Portfolio leads server ready'));
module.exports={server};
