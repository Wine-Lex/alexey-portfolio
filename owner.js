'use strict';
const $=id=>document.getElementById(id),status=$('status');
const names={shiftflow:'ShiftFlow','my-shifts':'Мои смены',north:'NORTH',sever:'СЕВЕР','between-lines':'Between Lines',terra:'TERRA',signal:'СИГНАЛ',forma:'FORMA',turbo:'TURBO',wave:'ВОЛНА',atlas:'ATLAS',telegram:'Telegram',whatsapp:'WhatsApp',direct:'Прямой / не определён',instagram:'Instagram',headhunter:'HeadHunter',olx:'OLX',github:'GitHub',google:'Google',bing:'Bing',other:'Другой источник'};
const label=x=>names[x]||x,dt=x=>new Date(x).toLocaleString('ru-RU',{timeZone:'Asia/Qyzylorda',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
async function api(url,data){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(90000)});let d;try{d=await r.json()}catch{throw Error('Сервер запускается. Попробуйте ещё раз через минуту.')}if(!r.ok){if(r.status===401){$('login').hidden=false;$('dashboard').hidden=true;}throw Error(d.error||'Попробуйте ещё раз.')}return d;}
function cell(row,value,small){const td=document.createElement('td');td.textContent=value??'—';if(small){const s=document.createElement('small');s.textContent=small;td.append(s)}row.append(td);return td;}
function table(id,rows,fill){const el=$(id);el.replaceChildren();if(!rows.length){const tr=document.createElement('tr'),td=cell(tr,'Пока нет данных за этот период.');td.colSpan=6;el.append(tr);return;}for(const r of rows){const tr=document.createElement('tr');fill(tr,r);el.append(tr)}}
function rows(id,items,value){const el=$(id);el.replaceChildren();if(!items.length){el.textContent='Пока нет данных.';return;}for(const r of items){const div=document.createElement('div'),s=document.createElement('span'),b=document.createElement('strong');s.textContent=label(r.source||r.target);b.textContent=value(r);div.append(s,b);el.append(div)}}
function render(d){
 $('login').hidden=true;$('dashboard').hidden=false;
 $('coverage').textContent='Обновлено '+dt(new Date())+' · только с согласия посетителей · '+(d.startedAt?'первые сохранённые данные: '+dt(d.startedAt):'сбор подключён, посещений пока нет');
 const t=d.totals,stats=[['Браузеры',t.browsers],['Визиты',t.visits],['Просмотры',t.views],['Новые браузеры',t.new_browsers],['Вернувшиеся браузеры',t.returning_browsers],['Переходы к проектам',t.project_clicks],['Нажатия на связь',t.contact_clicks],['Отправленные заявки',t.leads]];
 $('stats').replaceChildren(...stats.map(([title,n])=>{const a=document.createElement('div'),b=document.createElement('strong'),s=document.createElement('span');a.className='stat';b.textContent=n;s.textContent=title;a.append(b,s);return a}));
 const days=[],byDate=new Map(d.daily.map(r=>[r.day,r]));for(let i=0;i<d.days;i++){const date=new Date(Date.parse(d.from)+i*86400000+5*3600000).toISOString().slice(0,10);days.push(byDate.get(date)||{day:date,visits:0,browsers:0,views:0})}
 $('chart').replaceChildren();const max=Math.max(1,...days.map(r=>r.visits));for(const r of days){const bar=document.createElement('i');bar.style.setProperty('--height',Math.max(1,130*r.visits/max)+'px');bar.title=r.day+': '+r.visits+' визитов';bar.setAttribute('aria-label',bar.title);$('chart').append(bar)}
 table('daily',days.slice().reverse(),(tr,r)=>{cell(tr,r.day);cell(tr,r.browsers);cell(tr,r.visits);cell(tr,r.views)});
 table('projects',d.projects,(tr,r)=>{cell(tr,label(r.target));cell(tr,r.clicks);cell(tr,r.browsers)});
 rows('sources',d.sources,r=>r.visits+' визитов');rows('contacts',d.contacts,r=>r.clicks+' нажатий');
 table('visitors',d.visitors,(tr,r)=>{cell(tr,'Браузер '+r.visitor,r.device.replace('mobile','телефон').replace('desktop','компьютер / широкий экран'));cell(tr,dt(r.first_at),dt(r.last_at));cell(tr,r.visits+' / '+r.views);cell(tr,r.projects?r.projects.split(', ').map(label).join(', '):'—');cell(tr,r.contacts?r.contacts.split(', ').map(label).join(', '):'—','Заявки: '+r.leads)});
}
let loading=false;
async function load(){if(loading)return;loading=true;$('refresh').disabled=true;status.textContent='Загружаю статистику…';try{render(await api('/api/owner/summary?days='+$('period').value));status.textContent='';}catch(e){status.textContent=e.name==='TimeoutError'?'Сервер запускается. Повторите через минуту.':e.message}finally{loading=false;$('refresh').disabled=false}}
$('request-code').onclick=async()=>{const b=$('request-code');b.disabled=true;status.textContent='Отправляю код…';try{await api('/api/owner/login/request',{});status.textContent='Код отправлен в Telegram. Введите 8 цифр.';$('code').focus()}catch(e){status.textContent=e.message}finally{b.disabled=false}};
$('login-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await api('/api/owner/login/verify',{code:$('code').value.trim()});$('code').value='';await load()}catch(e){status.textContent=e.message}finally{b.disabled=false}};
$('period').onchange=load;$('refresh').onclick=load;
$('logout').onclick=async()=>{try{await api('/api/owner/logout',{});$('dashboard').hidden=true;$('login').hidden=false;status.textContent='Вы вышли.'}catch(e){status.textContent=e.message}};
load();

