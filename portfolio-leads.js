(()=>{'use strict';
    const leadForm = document.getElementById('brief-form');
    if(leadForm){
    let lastLeadKey = '', lastLeadId = '';
    leadForm.addEventListener('submit', async event => {
      event.preventDefault();
      const feedback = document.getElementById('brief-feedback');
      const button = leadForm.querySelector('button[type="submit"]');
      if (button.disabled) return;
      const payload = {business: document.getElementById('business').value.trim(), task: document.getElementById('task').value.trim(), deadline: document.getElementById('deadline').value.trim(), contact: document.getElementById('reply-contact').value.trim(), website: document.getElementById('lead-website').value};
      if (!payload.business || !payload.task || !payload.contact) {feedback.textContent = 'Укажите проект, задачу и контакт для ответа.'; return;}
      const key = JSON.stringify(payload);
      if (key !== lastLeadKey || !lastLeadId) {lastLeadKey = key; lastLeadId = crypto.randomUUID();}
      payload.requestId = lastLeadId;
      button.disabled = true;
      button.textContent = 'Отправляю…';
      leadForm.setAttribute('aria-busy','true');
      feedback.textContent = 'Отправляю заявку. Первая отправка может занять около минуты — пожалуйста, дождитесь результата.';
      const fields = Array.from(leadForm.querySelectorAll('input,textarea'));
      fields.forEach(field => field.disabled = true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      try {
        const response = await fetch('https://alexey-portfolio-leads.onrender.com/api/leads', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal});
        let result; try {result = await response.json();} catch {throw new Error('Сервис временно недоступен. Попробуйте позже или напишите мне напрямую.');}
        if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось отправить заявку. Попробуйте позже.');
        feedback.textContent = 'Запрос отправлен! Program Lab ответит по указанному контакту.';
        window.dispatchEvent(new Event('pl:lead-sent'));
        leadForm.reset(); lastLeadKey = ''; lastLeadId = '';
      } catch (error) {
        feedback.textContent = error.name === 'AbortError' ? 'Не удалось подтвердить отправку. Напишите мне в Telegram или WhatsApp.' : (error.message === 'Failed to fetch' ? 'Не удалось связаться с сервером. Попробуйте позже или напишите напрямую.' : error.message);
      } finally {clearTimeout(timeout);button.disabled=false;button.textContent='Отправить запрос';leadForm.removeAttribute('aria-busy');fields.forEach(field=>field.disabled=false);}
    });
  
}
})();