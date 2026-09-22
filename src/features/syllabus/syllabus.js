/* Syllabus ledger — the original subject index + chapter board, unchanged in look and behaviour. */
import {SUBJECTS,TASKS,TASK_SHORT,SUBJ_KEYS} from '../../data/syllabus.js';
import {getState,stats,persist} from '../../services/tracker.js';
import {touchChapter} from '../../services/chapterMeta.js';
import {$,esc,pad} from '../../utils/dom.js';

let selected=SUBJ_KEYS[0],filter="all";
export function resetFilter(){filter="all";}

export function renderIndex(){
  $('#subjList').innerHTML=SUBJ_KEYS.map((s,i)=>{
    const x=stats(s);
    return `<div class="sitem${s===selected?' on':''}" data-subj="${esc(s)}" role="button" tabindex="0">
      <span class="snum">${pad(i+1)}</span>
      <div class="srow"><span class="sname">${esc(s)}</span></div>
      <span class="spct">${x.pct}%</span>
      <div class="sbar"><i style="width:${x.pct}%"></i></div>
      <div class="smeta">${x.completed}/${x.total} CHAPTERS · ${x.rev} EXTRA REVS</div>
    </div>`;
  }).join('');
}

function rowHTML(name,i,row,fx,n){
  const complete=row.tasks[4],done=row.tasks.filter(Boolean).length;
  const delay=fx.enter?` style="animation-delay:${Math.min(n*24,300)}ms"`:'';
  const tasks=TASKS.map((t,j)=>{
    const on=row.tasks[j];
    const anim=fx.task&&fx.task.ch===i&&fx.task.j===j&&on;
    return `<div class="tk">
      <button class="tick${j===4?' tdone':''}${on?' on':''}" data-task="${i}" data-j="${j}"
        title="${esc(t)} — ${on?'ticked':'not ticked'}" aria-pressed="${on}">
        <svg viewBox="0 0 18 18" width="17" height="17" aria-hidden="true">
          <rect x="1.4" y="1.4" width="15.2" height="15.2" fill="none" stroke="currentColor" stroke-width="1.5"/>
          ${on?`<path class="ck${anim?' pre':''}" d="M4.4 9.7 7.9 13 13.9 4.9" pathLength="1" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`:''}
        </svg></button>
      <span class="tkl">${TASK_SHORT[j]}</span></div>`;
  }).join('');
  const rev=row.revisionRounds;
  const sticks=[1,2,3].map(k=>{
    const on=rev>=k,anim=fx.rev&&fx.rev.ch===i&&fx.rev.n===k&&on;
    const x1=(3.5+k*1.6).toFixed(1),x2=(8.5+k*1.9).toFixed(1);
    return `<button class="rstick${on?' on':''}" data-rev="${i}" data-round="${k}"
      title="Extra revision round ${k} of 3${on?' — logged':' — tap to log'}" aria-pressed="${on}">
      <svg width="15" height="24" viewBox="0 0 15 24" aria-hidden="true">
        <line x1="${x1}" y1="3.5" x2="${x2}" y2="20.5" pathLength="1"${anim?' class="pre"':''}/>
      </svg></button>`;
  }).join('');
  return `<div class="row" data-ch="${i}"${delay}>
    <span class="c-num">${pad(i+1)}</span>
    <div class="c-name"><span class="nm" title="${esc(name)}">${esc(name)}</span>${complete?`<span class="stamp${fx.stamp===i?' in':''}">DONE</span>`:''}<span class="cfrac">${done}/5</span></div>
    <div class="c-tasks">${tasks}</div>
    <div class="c-rev">${sticks}</div>
  </div>`;
}

export function renderBoard(fx){
  const board=$('#board'),state=getState();
  const s=selected,st=stats(s),idx=SUBJ_KEYS.indexOf(s);
  let rows='',n=0;
  SUBJECTS[s].forEach((name,i)=>{
    const row=state[s][i],complete=row.tasks[4];
    if(filter==='pending'&&complete)return;
    if(filter==='complete'&&!complete)return;
    rows+=rowHTML(name,i,row,fx||{},++n);
  });
  const body=rows||`<div class="nofilter">Nothing matches this filter.</div>`;
  board.innerHTML=`
    <div class="subj-head">
      <div>
        <span class="lbl">SUBJECT ${pad(idx+1)} OF ${pad(SUBJ_KEYS.length)} · ${st.total} CHAPTERS</span>
        <h2>${esc(s)}</h2>
      </div>
      <div class="sstats">
        <div class="sstat"><b>${st.pct}<i>%</i></b><span>COMPLETED</span></div>
        <div class="sstat"><b>${st.taskPct}<i>%</i></b><span>TASKS TICKED</span></div>
        <div class="sstat"><b>${st.rev}</b><span>EX. REVISIONS</span></div>
      </div>
    </div>
    <div class="filters">
      <span class="lbl">SHOW</span>
      ${['all','pending','complete'].map(f=>`<button class="chip fchip${filter===f?' on':''}" data-f="${f}">${f==='complete'?'COMPLETED':f.toUpperCase()}</button>`).join('')}
      <span class="fhint hint">TICK: NCERT READ · NOTES · QUESTIONS / PYQs · REVISION · COMPLETED — TAP A STROKE TO LOG EXTRA REVISIONS</span>
    </div>
    <div class="thead">
      <span class="th-num">#</span><span class="th-name">CHAPTER</span>
      <span class="th-tasks">${TASK_SHORT.map((t,j)=>`<span title="${esc(TASKS[j])}">${t}</span>`).join('')}</span>
      <span class="th-rev">EXTRA ×3</span>
    </div>
    ${body}`;
  board.classList.toggle('enter',!!(fx&&fx.enter));
  requestAnimationFrame(()=>board.querySelectorAll('.pre').forEach(el=>el.classList.add('drawn')));
}

function selectSubject(s){
  if(s&&s!==selected){selected=s;filter="all";renderIndex();renderBoard({enter:true});}
}

export function initSyllabus(){
  $('#subjList').addEventListener('click',e=>{
    const it=e.target.closest('[data-subj]');if(it)selectSubject(it.dataset.subj);
  });
  $('#subjList').addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('sitem')){
      e.preventDefault();selectSubject(e.target.dataset.subj);
    }
  });
  $('#board').addEventListener('click',e=>{
    const fbtn=e.target.closest('[data-f]');
    if(fbtn){filter=fbtn.dataset.f;renderBoard({enter:true});return;}
    const t=e.target.closest('[data-task]');
    if(t){
      const i=+t.dataset.task,j=+t.dataset.j,r=getState()[selected][i];
      r.tasks[j]=!r.tasks[j];
      const fx={task:{ch:i,j}};
      if(j===4&&r.tasks[4])fx.stamp=i;                 /* the DONE stamp moment */
      persist(fx);
      if(r.tasks[j])touchChapter(selected,i,{revised:j===3});
      return;
    }
    const rv=e.target.closest('[data-rev]');
    if(rv){
      const i=+rv.dataset.rev,k=+rv.dataset.round,r=getState()[selected][i];
      const old=r.revisionRounds;
      r.revisionRounds=(old===k?k-1:k);                /* same toggle rule as the original */
      persist(r.revisionRounds>old?{rev:{ch:i,n:r.revisionRounds}}:{});
      if(r.revisionRounds>old)touchChapter(selected,i,{revised:true});
    }
  });
}
