(()=>{'use strict';
 const menu=document.getElementById('site-menu'),toggle=document.querySelector('.menu-toggle');
 function closeMenu(){menu?.classList.remove('is-open');toggle?.setAttribute('aria-expanded','false');}
 toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));menu.classList.toggle('is-open',open);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
 document.addEventListener('click',e=>{if(!e.target.closest('.top'))closeMenu();});
 matchMedia('(max-width:760px)').addEventListener('change',closeMenu);
 const year=document.getElementById('year');if(year)year.textContent=new Date().getFullYear();
 const task=document.getElementById('task'),service=new URLSearchParams(location.search).get('service');
 if(task&&service&&!task.value.trim())task.value='Нужно: '+service.slice(0,160)+'. ';
 const gallery=document.getElementById('portfolio-projects'),pager=document.querySelector('.catalog-pagination');
 if(gallery&&pager){
  const cards=[...gallery.querySelectorAll('.project-card')],filters=[...document.querySelectorAll('[data-filter]')],count=document.getElementById('project-count'),position=document.getElementById('catalog-position'),prev=document.querySelector('[data-page-prev]'),next=document.querySelector('[data-page-next]');
  const params=new URLSearchParams(location.search);let category=['all','sites','apps','interactive'].includes(params.get('category'))?params.get('category'):'all',page=Math.max(1,parseInt(params.get('page'),10)||1);const size=4;
  function render(update=false){const matching=cards.filter(c=>category==='all'||c.dataset.category===category),pages=Math.max(1,Math.ceil(matching.length/size));page=Math.min(page,pages);const visible=matching.slice((page-1)*size,page*size);cards.forEach(c=>c.hidden=!visible.includes(c));filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===category)));count.textContent='Показано '+visible.length+' из '+matching.length;position.textContent='Страница '+page+' из '+pages;prev.disabled=page===1;next.disabled=page===pages;pager.hidden=pages<=1;if(update){const q=new URLSearchParams();if(category!=='all')q.set('category',category);if(page>1)q.set('page',page);history.replaceState(null,'',location.pathname+(q.size?'?'+q:''));}}
  filters.forEach(b=>b.addEventListener('click',()=>{category=b.dataset.filter;page=1;render(true);}));
  function move(offset){page+=offset;render(true);document.getElementById('work').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}
  prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));render();
 }
})();
