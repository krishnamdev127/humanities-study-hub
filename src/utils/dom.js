/* DOM helpers, toasts and modals — carried over from the original tracker unchanged. */
export const $=s=>document.querySelector(s);
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pad=n=>String(n).padStart(2,'0');
export const icon=(d,s=13)=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const IC={
  gear:'<path d="M4 7h9m5 0h2M4 17h2m5 0h9"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="8.5" cy="17" r="2.3"/>',
  down:'<path d="M12 4v11m0 0 4.2-4.2M12 15l-4.2-4.2M5 20h14"/>',
  up  :'<path d="M12 15V4m0 0 4.2 4.2M12 4 7.8 8.2M5 20h14"/>',
  x   :'<path d="M6 6l12 12M18 6 6 18"/>'
};

export function toast(msg,ms){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>{t.classList.add('bye');setTimeout(()=>t.remove(),260);},ms||3600);
}
export const openOverlay=id=>$(id).classList.add('open');
export const closeOverlay=id=>$(id).classList.remove('open');

let cfFn=null;
export function askConfirm(title,body,ok,fn){
  $('#cfTitle').textContent=title;$('#cfBody').textContent=body;$('#cfOk').textContent=ok;
  cfFn=fn;openOverlay('#mConfirm');
}
export function initOverlays(){
  document.querySelectorAll('.overlay').forEach(o=>{
    o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');});
    o.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>o.classList.remove('open')));
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')document.querySelectorAll('.overlay.open').forEach(o=>o.classList.remove('open'));
  });
  $('#cfOk').addEventListener('click',()=>{closeOverlay('#mConfirm');const f=cfFn;cfFn=null;f&&f();});
  document.querySelectorAll('[data-ic]').forEach(el=>el.insertAdjacentHTML('afterbegin',icon(IC[el.dataset.ic])));
}
