import {db} from '../services/db.js';
import {$,esc} from '../utils/dom.js';
import {SUBJECTS} from '../data/syllabus.js';

const labels={questions:'Questions',notes:'Notes',resources:'Resources',mistakes:'Mistakes',tests:'Tests',flashcards:'Flashcards'};
const fields={questions:r=>[r.text,r.subject,r.chapter_id,r.tags?.join(' ')],notes:r=>[r.title,r.body,r.subject,r.chapter_id,r.tags?.join(' ')],resources:r=>[r.title,r.note,r.url,r.category,r.subject,r.chapter_id],mistakes:r=>[r.question_id,r.subject,r.chapter_id],tests:r=>[r.name,r.type],flashcards:r=>[r.front,r.back,r.subject,r.chapter_id,r.tags?.join(' ')]};
export function initSearch(){
  const input=$('#globalSearch'),panel=$('#searchResults'); if(!input||!panel)return;
  let timer;
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>run(input.value),120);});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select();}});
  panel.addEventListener('click',e=>{const a=e.target.closest('[data-search-href]');if(a){location.hash=a.dataset.searchHref;panel.hidden=true;input.value='';}});
}
async function run(raw){
 const q=raw.trim().toLowerCase(),panel=$('#searchResults'); if(!q){panel.hidden=true;panel.innerHTML='';return;}
 const cols=['questions','notes','resources','mistakes','tests','flashcards']; const groups=[];
 for(const c of cols){const rows=await db.all(c);const hits=rows.filter(r=>fields[c](r).filter(Boolean).join(' ').toLowerCase().includes(q)).slice(0,5);if(hits.length)groups.push({c,hits});}
 if(!groups.length){panel.innerHTML='<div class="search-empty">No matching study material found.</div>';panel.hidden=false;return;}
 panel.innerHTML=groups.map(g=>`<section><span class="lbl">${labels[g.c].toUpperCase()}</span>${g.hits.map(r=>{const title=r.title||r.name||r.text||r.front||r.question_id||'Untitled';const href=g.c==='questions'?'#/practice/mcqs':g.c==='notes'?'#/study/notes':g.c==='resources'?'#/resources/ncert':g.c==='tests'?'#/tests/history':g.c==='flashcards'?'#/study/flashcards':'#/practice/mistakes';return `<a data-search-href="${href}" href="${href}"><b>${esc(String(title).slice(0,100))}</b><small>${esc(r.subject||r.category||r.type||'Study record')}</small></a>`}).join('')}</section>`).join('');panel.hidden=false;
}
