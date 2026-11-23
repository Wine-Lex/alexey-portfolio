/* Progressive enhancement only. All project links and Lex's development notice work without this file. */
(()=>{'use strict';
 const stage=document.querySelector('.project-stage');
 if(!stage)return;
 const projects={
  shiftflow:{name:'ShiftFlow',address:'shiftflow-xmpy.onrender.com',description:'График команды и рабочие чек-листы',url:'https://shiftflow-xmpy.onrender.com/'},
  'my-shifts':{name:'Мои смены',address:'moi-smeny.onrender.com',description:'Смены, время и заработок в одном месте',url:'https://moi-smeny.onrender.com/'},
  storio:{name:'Storio',address:'storio-pjof.onrender.com',description:'Истории, которые создают вместе',url:'https://storio-pjof.onrender.com/'},
  'between-lines':{name:'Between Lines',address:'between-lines-lab.onrender.com',description:'Авторская мастерская и библиотека читателя',url:'https://between-lines-lab.onrender.com/'}
 };
 const buttons=[...stage.querySelectorAll('[data-showcase-button]')];
 function show(id){
  const project=projects[id];if(!project)return;
  stage.dataset.showcase=id;
  buttons.forEach(b=>{const active=b.dataset.showcaseButton===id;b.setAttribute('aria-pressed',String(active));document.getElementById(b.getAttribute('aria-controls')).hidden=!active;});
  document.getElementById('showcase-name').textContent=project.name;
  document.getElementById('showcase-address').textContent=project.address;
  document.getElementById('showcase-description').textContent=project.description;
  const open=document.getElementById('showcase-open');open.href=project.url;open.dataset.projectTarget=id;open.setAttribute('aria-label','Открыть '+project.name);
 }
 buttons.forEach((b,i)=>{b.addEventListener('click',()=>show(b.dataset.showcaseButton));b.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%buttons.length;if(e.key==='ArrowLeft')next=(i-1+buttons.length)%buttons.length;if(e.key==='Home')next=0;if(e.key==='End')next=buttons.length-1;if(next!==undefined){e.preventDefault();buttons[next].focus();show(buttons[next].dataset.showcaseButton);}});});
 show(stage.dataset.showcase);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)');
 stage.addEventListener('pointermove',e=>{if(reduced.matches||!fine.matches)return;const r=stage.getBoundingClientRect();stage.style.setProperty('--stage-rx',((.5-(e.clientY-r.top)/r.height)*2)+'deg');stage.style.setProperty('--stage-ry',(((e.clientX-r.left)/r.width-.5)*2)+'deg');});
 stage.addEventListener('pointerleave',()=>{stage.style.setProperty('--stage-rx','0deg');stage.style.setProperty('--stage-ry','0deg');});
})();
