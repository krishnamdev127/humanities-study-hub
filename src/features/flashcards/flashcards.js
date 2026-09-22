import {db} from '../../services/db.js';
import {bus} from '../../utils/bus.js';
import {esc,$,toast} from '../../utils/dom.js';
import {SUBJECTS} from '../../data/syllabus.js';

const today=()=>new Date().toISOString().slice(0,10);
const addDays=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const interval=(card,rating)=>{const base=Math.max(1,Number(card.interval_days||1)); if(rating==='forgot')return 1;if(rating==='difficult')return Math.max(2,Math.round(base*1.5));if(rating==='good')return Math.max(3,Math.round(base*2));return Math.max(7,Math.round(base*2.7));};
function subjName(id){return SUBJECTS.find(s=>s.id===id)?.name||id||'—'}

export async function initFlashcards(){
  const root=$('#flashcardsApp'); if(!root)return;
  root.addEventListener('click',async e=>{
    const b=e.target.closest('[data-card-action]'); if(!b)return;
    const card=await db.get('flashcards',b.dataset.id); if(!card)return;
    const action=b.dataset.cardAction;
    if(action==='review'){
      const rating=b.dataset.rating; const days=interval(card,rating);
      await db.put('flashcard_reviews',{card_id:card.id,date:today(),rating});
      await db.update('flashcards',card.id,{review_count:(card.review_count||0)+1,last_reviewed:new Date().toISOString(),next_review:addDays(today(),days),interval_days:days,ease:Math.min(4,Math.max(1.3,(card.ease||2.5)+(rating==='forgot'?-0.2:rating==='easy'?0.15:0.05))) });
      toast(`Reviewed — next review in ${days} day${days===1?'':'s'}.`); render(); bus.emit('study:changed');
    }
  });
  render();
}
async function render(){
 const root=$('#flashcardsApp'); if(!root)return;
 const cards=await db.all('flashcards').catch(()=>[]); const due=cards.filter(c=>!c.next_review||c.next_review<=today());
 if(!cards.length){root.innerHTML=`<div class="empty"><h3>No flashcards yet.</h3><p>Create flashcards in the next study pass; cards will appear here with spaced review scheduling.</p></div>`;return;}
 root.innerHTML=`<div class="stats-grid"><div><span class="lbl">TOTAL CARDS</span><b>${cards.length}</b></div><div><span class="lbl">DUE TODAY</span><b>${due.length}</b></div><div><span class="lbl">REVIEWED</span><b>${cards.filter(c=>c.review_count>0).length}</b></div></div><div class="card-list">${due.slice(0,12).map(c=>`<article class="study-card"><span class="lbl">${esc(subjName(c.subject))} · ${esc(c.chapter_id||'')}</span><h3>${esc(c.front)}</h3><details><summary>REVEAL ANSWER</summary><p>${esc(c.back)}</p></details><div class="actions"><button class="btn" data-card-action="review" data-rating="forgot" data-id="${c.id}">FORGOT</button><button class="btn" data-card-action="review" data-rating="difficult" data-id="${c.id}">DIFFICULT</button><button class="btn" data-card-action="review" data-rating="good" data-id="${c.id}">GOOD</button><button class="btn solid" data-card-action="review" data-rating="easy" data-id="${c.id}">EASY</button></div></article>`).join('')}</div>`;
}
