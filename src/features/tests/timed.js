import {db} from '../../services/db.js';
import {SUBJ_KEYS} from '../../data/syllabus.js';
import {$,esc,toast} from '../../utils/dom.js';

let questions=[];
const state={test:null,attempt:null,answers:{},flagged:new Set(),index:0,timer:null,startedAt:null,remaining:0};
const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const shuffle=a=>[...a].sort(()=>Math.random()-.5);

async function load(){questions=await db.all('questions');}
function pool(){return questions.filter(q=>q.format==='mcq' && (!state.test?.subject || q.subject===state.test.subject));}
function renderSetup(root){root.innerHTML=`
<div class="test-toolbar"><div><span class="lbl">TIMED MCQ TEST</span><h3 class="test-title">Build a focused test and work against the clock.</h3></div></div>
<div class="test-config">
<label><span class="lbl">SUBJECT</span><select data-subject><option value="">All subjects</option>${SUBJ_KEYS.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label>
<label><span class="lbl">QUESTIONS</span><select data-count><option>5</option><option selected>10</option><option>15</option><option>20</option></select></label>
<label><span class="lbl">DIFFICULTY</span><select data-difficulty><option value="">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
<label><span class="lbl">TIME LIMIT</span><select data-time><option value="300">5 min</option><option value="600" selected>10 min</option><option value="900">15 min</option><option value="1800">30 min</option></select></label>
</div><div class="test-preview" data-preview></div>
<button class="btn solid" data-start>START TIMED TEST</button>`;
const update=()=>{const subject=root.querySelector('[data-subject]').value,diff=root.querySelector('[data-difficulty]').value;const n=Number(root.querySelector('[data-count]').value);const avail=questions.filter(q=>q.format==='mcq'&&(!subject||q.subject===subject)&&(!diff||q.difficulty===diff)).length;root.querySelector('[data-preview]').textContent=`${avail} questions available · ${Math.min(n,avail)} will be selected · options will be randomized`};
root.querySelectorAll('select').forEach(x=>x.onchange=update);update();root.querySelector('[data-start]').onclick=()=>start(root);}
async function start(root){
 const subject=root.querySelector('[data-subject]').value,diff=root.querySelector('[data-difficulty]').value,n=Number(root.querySelector('[data-count]').value),duration=Number(root.querySelector('[data-time]').value);
 const pool=questions.filter(q=>q.format==='mcq'&&(!subject||q.subject===subject)&&(!diff||q.difficulty===diff));
 if(!pool.length){toast('No MCQs match these settings');return;} if(pool.length<n){toast(`Only ${pool.length} matching questions are available`);}
 const ids=shuffle(pool).slice(0,n).map(q=>q.id); state.test={name:`Timed MCQ — ${subject||'All Subjects'}`,type:'quick',config:{subject,difficulty:diff,count:ids.length,duration_sec:duration},question_ids:ids,duration_sec:duration,total_marks:ids.length};
 state.attempt=await db.put('test_attempts',{test_id:db.newId(),started_at:new Date().toISOString(),status:'in_progress',answers:{},flagged:[],time_taken_sec:0,max_score:ids.length,score:0,simulated:true});
 state.test.id=state.attempt.test_id; await db.put('tests',state.test);state.answers={};state.flagged=new Set();state.index=0;state.startedAt=Date.now();state.remaining=duration;clearInterval(state.timer);state.timer=setInterval(()=>{state.remaining--;renderTimer(root);if(state.remaining<=0)submit(root,true)},1000);renderTest(root);}
function current(){return questions.find(q=>q.id===state.test.question_ids[state.index]);}
function renderTimer(root){const el=root.querySelector('[data-timer]');if(el)el.textContent=fmt(Math.max(0,state.remaining));}
function renderTest(root){const q=current(),answers=state.answers;root.innerHTML=`
<div class="test-live"><div><span class="lbl">QUESTION ${state.index+1} / ${state.test.question_ids.length}</span><h2>${esc(q.text)}</h2><span class="chip">${esc(q.subject)} · ${q.difficulty.toUpperCase()}</span></div><div class="test-clock"><span class="lbl">TIME LEFT</span><strong data-timer>${fmt(state.remaining)}</strong></div></div>
<div class="test-palette">${state.test.question_ids.map((id,i)=>`<button class="palette ${answers[id]!=null?'answered':''} ${state.flagged.has(id)?'flagged':''} ${i===state.index?'current':''}" data-jump="${i}">${i+1}</button>`).join('')}</div>
<div class="mcq-options test-options">${q.options.map((o,i)=>`<button class="mcq-option ${answers[q.id]===i?'selected':''}" data-option="${i}"><b>${String.fromCharCode(65+i)}</b><span>${esc(o)}</span></button>`).join('')}</div>
<div class="test-actions"><button class="btn" data-prev ${state.index===0?'disabled':''}>PREVIOUS</button><button class="btn" data-skip>SKIP</button><button class="btn" data-flag>${state.flagged.has(q.id)?'UNMARK':'MARK FOR REVIEW'}</button>${state.index===state.test.question_ids.length-1?'<button class="btn solid" data-submit>SUBMIT TEST</button>':'<button class="btn solid" data-next>NEXT</button>'}</div>`;
root.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{state.index=Number(b.dataset.jump);renderTest(root)});
root.querySelector('[data-prev]').onclick=()=>{if(state.index>0){state.index--;renderTest(root)}};
root.querySelector('[data-skip]').onclick=()=>{if(state.index<state.test.question_ids.length-1){state.index++;renderTest(root)}};
root.querySelector('[data-next]')?.addEventListener('click',()=>{state.index++;renderTest(root)});
root.querySelector('[data-flag]').onclick=()=>{const id=q.id;state.flagged.has(id)?state.flagged.delete(id):state.flagged.add(id);renderTest(root)};
root.querySelector('[data-submit]')?.addEventListener('click',()=>submit(root,false));
root.querySelector('.test-options').addEventListener('click',e=>{const b=e.target.closest('[data-option]');if(!b)return;state.answers[q.id]=Number(b.dataset.option);renderTest(root)});
}
async function submit(root,auto){clearInterval(state.timer);const ids=state.test.question_ids;let score=0,correct=0,wrong=0,unattempted=0;for(const id of ids){const q=questions.find(x=>x.id===id),sel=state.answers[id];const ok=sel!=null&&sel===q.correct_index;if(sel==null)unattempted++;else if(ok){score++;correct++;}else wrong++;if(sel!=null)await db.put('attempts',{question_id:id,date:new Date().toISOString().slice(0,10),subject:q.subject,chapter_id:q.chapter_id,context:'test',test_attempt_id:state.attempt.id,selected:sel,correct:ok,time_sec:0});}
const taken=Math.round((Date.now()-state.startedAt)/1000);await db.update('test_attempts',state.attempt.id,{status:auto?'auto_submitted':'submitted',submitted_at:new Date().toISOString(),answers:state.answers,flagged:[...state.flagged],time_taken_sec:taken,score,max_score:ids.length});
const day=new Date().toISOString().slice(0,10),cur=await db.get('daily_activity',day);await db.put('daily_activity',{id:day,date:day,study_sec:cur?.study_sec||0,questions:(cur?.questions||0)+ids.length,correct:(cur?.correct||0)+correct,pyqs:cur?.pyqs||0,revisions:cur?.revisions||0,tests:(cur?.tests||0)+1,missions_done:cur?.missions_done||0});
root.innerHTML=`<section class="test-result"><span class="lbl">${auto?'TIME EXPIRED · AUTO-SUBMITTED':'TIMED TEST RESULT'}</span><strong>${score} / ${ids.length}</strong><span class="result-percent">${Math.round(score/ids.length*100)}%</span><div class="result-grid"><div><b>${correct}</b><small>CORRECT</small></div><div><b>${wrong}</b><small>INCORRECT</small></div><div><b>${unattempted}</b><small>UNATTEMPTED</small></div><div><b>${fmt(taken)}</b><small>TIME USED</small></div></div><button class="btn solid" data-again>TAKE ANOTHER TEST</button></section>`;root.querySelector('[data-again]').onclick=()=>renderSetup(root);toast('Test saved to your history');}
export async function initTimedTest(){const root=$('#timedTestApp');if(!root)return;await load();renderSetup(root);}
