/* Hash router + navigation chrome (desktop top nav, mobile tab bar, "More" sheet). */
import {SECTIONS,TABS,byId,parseHash} from './routes.js';
import {$,esc,icon,openOverlay,closeOverlay} from '../../utils/dom.js';
import {bus} from '../../utils/bus.js';

let current=null,first=true;

function buildNav(){
  $('#topnav').innerHTML=SECTIONS.map(s=>`<a href="#/${s.id}" data-nav="${s.id}">${esc(s.label.toUpperCase())}</a>`).join('');
  $('#tabbar').innerHTML=TABS.map(t=>t.id==='more'
    ?`<button type="button" data-nav="more" aria-haspopup="dialog">${icon(t.ic,20)}<span>${t.label}</span></button>`
    :`<a href="#/${t.id}" data-nav="${t.id}">${icon(t.ic,20)}<span>${t.label}</span></a>`).join('');
  $('#moreList').innerHTML=SECTIONS.filter(s=>s.mobile==='more')
    .map(s=>`<a href="#/${s.id}" data-nav="${s.id}">${esc(s.label)}<span>${esc((s.note||'').toUpperCase())}</span></a>`).join('');
  $('#tabbar').addEventListener('click',e=>{if(e.target.closest('[data-nav="more"]'))openOverlay('#mMore');});
  $('#moreList').addEventListener('click',e=>{if(e.target.closest('a'))closeOverlay('#mMore');});
}

function renderStub(sec,childId){
  const child=sec.children.find(c=>c.id===childId)||sec.children[0];
  const when=child.step?`Planned for step ${child.step} of the build.`:'Planned; not yet scheduled in the build order.';
  $('#stub').innerHTML=`
    <span class="lbl">${esc(sec.label.toUpperCase())}</span>
    <h2 class="pane-title">${esc(child.label)}</h2>
    <div class="subtabs" role="tablist" aria-label="${esc(sec.label)} pages">
      ${sec.children.map(c=>`<a class="chip fchip" href="#/${sec.id}/${c.id}"${c.id===child.id?' aria-current="page"':''}>${esc(c.label.toUpperCase())}</a>`).join('')}
    </div>
    <div class="empty">
      <h3>This page isn’t built yet</h3>
      <p>${esc(when)} Nothing you do in the syllabus ledger is affected, and this page will fill in without any data migration.</p>
      <a class="btn" href="#/syllabus" style="align-self:flex-start;text-decoration:none">GO TO THE SYLLABUS LEDGER</a>
    </div>`;
}

function markActive(sectionId){
  const moreIds=SECTIONS.filter(s=>s.mobile==='more').map(s=>s.id);
  document.querySelectorAll('[data-nav]').forEach(a=>{
    const id=a.dataset.nav;
    const on=id===sectionId||(id==='more'&&moreIds.includes(sectionId)&&a.tagName==='BUTTON');
    if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
}

export function route(){
  const r=parseHash(location.hash),sec=byId(r.section);
  const childObj=sec.children?.find(c=>c.id===r.child);
  const childBuilt=!!childObj?.built;
  const viewName=sec.built?sec.view:(childBuilt?`${sec.id}-${r.child}`:'stub');
  if(!sec.built&&!childBuilt)renderStub(sec,r.child);
  document.querySelectorAll('[data-view]').forEach(v=>{v.hidden=v.dataset.view!==viewName;});
  markActive(sec.id);
  const title=sec.built?sec.label:`${byId(sec.id).children.find(c=>c.id===r.child).label} — ${sec.label}`;
  document.title=`${title} · Humanities Study Hub`;
  if(!first&&(current!==sec.id+'/'+r.child)){window.scrollTo(0,0);$('#view').focus({preventScroll:true});}
  current=sec.id+'/'+r.child;first=false;
  bus.emit('route:changed',r);
}

export function initRouter(){
  buildNav();
  window.addEventListener('hashchange',route);
  route();
}
