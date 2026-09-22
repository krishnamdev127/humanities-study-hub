/* Home dashboard: keeps the original Preparation Ledger masthead/band and adds a practical
   command-centre layer. All secondary metrics are local-first and read from IndexedDB. */
import {SUBJ_KEYS,SUBJECTS} from '../../data/syllabus.js';
import {overallStats,examDays,fmtDate,getCandidate,getExamDate,validExamDate} from '../../services/tracker.js';
import {db} from '../../services/db.js';
import {$,pad} from '../../utils/dom.js';
import {getStreak,getDailyMissions,updateMilestones} from './streaks.js';

const escHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isoDate=d=>new Date(d).toISOString().slice(0,10);
const today=()=>isoDate(new Date());
const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);

export function renderMast(){
  const totalCh=SUBJ_KEYS.reduce((a,s)=>a+SUBJECTS[s].length,0);
  $('#overLine').textContent=`CBSE CLASS XII · HUMANITIES · ${SUBJ_KEYS.length} SUBJECTS · ${totalCh} CHAPTERS ON RECORD`;
  $('#todayLine').textContent='TODAY — '+new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).format(new Date()).toUpperCase();
  const candidate=getCandidate(),cb=$('#candBtn'); cb.textContent=candidate||'add your name'; cb.classList.toggle('placeholder',!candidate);
  const d=validExamDate(),dbtn=$('#dateBtn'); dbtn.textContent=d?fmtDate(d,false):'set the date'; dbtn.classList.toggle('placeholder',!d);
}

export function renderBand(){
  const o=overallStats(),d=examDays(),pct=o.total?Math.round(o.completed*100/o.total):0;
  $('#daysPre').textContent=d===null?'':d>0?'D–':d<0?'D+':''; $('#daysNum').textContent=d===null?'—':Math.abs(d)===0?'0':Math.abs(d);
  const saved=validExamDate(); $('#examDateLine').textContent=saved?(d<0?fmtDate(saved,true)+' — SINCE THE EXAM':fmtDate(saved,true)):'NO DATE ON RECORD — TAP “EDIT DETAILS”';
  $('#readNum').textContent=pct; $('#rulerFill').style.width=pct+'%';
  const chip=$('#readChip'); let txt,cls=''; if(pct>=85){txt='EXAM READY';cls='ready'}else if(pct>=70){txt='ON TRACK'}else if(pct>=40){txt='IN PROGRESS'}else{txt='AT RISK';cls='risk'} chip.textContent=txt; chip.className='chip '+cls;
  $('#glDone').textContent=`${o.completed} / ${o.total}`; $('#glTasks').textContent=`${o.done} / ${o.tasks} (${o.tasks?Math.round(o.done*100/o.tasks):0}%)`; $('#glRev').textContent=o.rev; $('#glPend').textContent=o.total-o.completed;
}

export function renderTotals(){
  const o=overallStats(),d=examDays(),pct=o.total?Math.round(o.completed*100/o.total):0;
  $('#totL').innerHTML=`${pad(SUBJ_KEYS.length)} SUBJECTS<span class="sep">·</span><b>${o.total}</b> CHAPTERS<span class="sep">·</span><b>${o.completed}</b> COMPLETED<span class="sep">·</span><b>${o.done}</b> TASKS TICKED<span class="sep">·</span><b>${o.rev}</b> EXTRA REVISIONS`;
  $('#totR').innerHTML=`SYLLABUS <b>${pct}%</b><span class="sep">·</span>${d===null?'EXAM DATE NOT SET':d<0?'EXAM PASSED':`D–${d}`}`;
}

export async function renderHubDashboard(){
  const root=$('#hubDashboard'); if(!root)return;
  const [sessions,attempts,testAttempts,mistakes,activity,streak,missions]=await Promise.all([
    db.all('study_sessions').catch(()=>[]),db.all('attempts').catch(()=>[]),db.all('test_attempts').catch(()=>[]),db.all('mistakes').catch(()=>[]),db.all('daily_activity').catch(()=>[]),getStreak().catch(()=>({current:0,longest:0})),getDailyMissions().catch(()=>({missions:[]}))
  ]);
  updateMilestones().catch(()=>{});
  const weekAgo=Date.now()-7*864e5;
  const studyToday=sum(sessions.filter(s=>s.date===today()),'duration_sec');
  const studyWeek=sum(sessions.filter(s=>new Date(s.started_at).getTime()>=weekAgo),'duration_sec');
  const qAttempts=attempts.filter(a=>a.correct!==undefined&&a.correct!==null);
  const correct=qAttempts.filter(a=>a.correct).length, accuracy=qAttempts.length?Math.round(correct*100/qAttempts.length):0;
  const completedTests=testAttempts.filter(t=>t.status!=='in_progress');
  const avgScore=completedTests.length?Math.round(completedTests.reduce((a,t)=>a+(Number(t.score)||0),0)/completedTests.length):0;
  const weak=mistakes.filter(m=>!m.mastered).sort((a,b)=>(b.times_wrong||0)-(a.times_wrong||0)).slice(0,3);
  const subjectStats=SUBJ_KEYS.map(s=>({s,pct:Math.round((overallStatsSubject(s).completed||0)*100/(SUBJECTS[s].length||1))})).sort((a,b)=>a.pct-b.pct);
  const recommendation=weak[0]?`Retry your mistakes in ${weak[0].subject} — accuracy work here has the clearest immediate payoff.`:subjectStats[0]?`Continue ${subjectStats[0].s}: its syllabus completion is currently ${subjectStats[0].pct}%.`:'Start with one focused study session today.';
  const doneM=missions.missions?.filter(m=>m.done).length||0;
  root.innerHTML=`
    <div class="hub-head"><div><span class="lbl">COMMAND CENTRE</span><h2>Today’s preparation, at a glance.</h2><p>Keep the ledger for completion; use this layer to decide what to do next.</p></div><a class="btn solid" href="#/study/timer">START A FOCUS SESSION</a></div>
    <div class="hub-grid hub-kpis">
      ${kpi('STUDY TODAY',fmtMin(studyToday),'minutes logged today')}
      ${kpi('STUDY THIS WEEK',fmtHours(studyWeek),'across all sessions')}
      ${kpi('CURRENT STREAK',`${streak.current} DAY${streak.current===1?'':'S'}`,`longest: ${streak.longest} days`)}
      ${kpi('QUESTION ACCURACY',`${accuracy}%`,`${qAttempts.length} answered`) }
      ${kpi('MOCKS / TESTS',`${completedTests.length}`,'completed attempts')}
      ${kpi('MISSIONS',`${doneM}/${missions.missions?.length||0}`,'today completed')}
    </div>
    <div class="hub-grid hub-panels">
      <section class="hub-panel"><span class="lbl">WHAT SHOULD I STUDY NOW?</span><h3>${escHtml(recommendation)}</h3><p class="muted">Suggestions adapt to your local progress, mistakes and recent activity.</p><a class="textlink" href="#/syllabus">OPEN SYLLABUS →</a></section>
      <section class="hub-panel"><span class="lbl">TODAY’S MISSIONS · ${doneM}/${missions.missions?.length||0}</span>${(missions.missions||[]).map((m,i)=>`<div class="mission"><span>${String(i+1).padStart(2,'0')}</span><div><b>${escHtml(m.title)}</b><small>${m.progress}/${m.target} ${escHtml(m.unit)}</small></div><i class="${m.done?'done':''}"></i></div>`).join('')}</section>
      <section class="hub-panel"><span class="lbl">SUBJECT PROGRESS</span>${subjectStats.map(x=>`<div class="subject-line"><span>${escHtml(x.s)}</span><b>${x.pct}%</b><div class="mini-bar"><i style="width:${x.pct}%"></i></div></div>`).join('')}</section>
      <section class="hub-panel"><span class="lbl">STREAK</span><h3>${streak.current} day${streak.current===1?'':'s'} current · ${streak.longest} longest</h3><p class="muted">Meaningful activity includes focused study, questions, PYQs, revisions or tests. Missing a day simply resets the current run; your longest streak remains.</p></section>
      <section class="hub-panel"><span class="lbl">WEAK AREAS</span>${weak.length?weak.map(m=>`<div class="weak-line"><span>${escHtml(m.subject)}</span><b>${escHtml(m.chapter_id)}</b><small>${m.times_wrong||0} repeated mistake${m.times_wrong===1?'':'s'}</small></div>`).join(''):'<div class="empty-lite"><b>No mistakes yet.</b><span>Incorrect questions will appear here automatically once practice begins.</span></div>'}</section>
      <section class="hub-panel"><span class="lbl">LOCAL-FIRST RECORD</span><h3>Your study data is saved on this device.</h3><p class="muted">Google/Supabase sync is optional. If sign-in or internet is unavailable, the Hub continues working locally and can be backed up with JSON export.</p><a class="textlink" href="#/profile">VIEW SYNC STATUS →</a></section>
    </div>`;
}

function overallStatsSubject(subject){
  const rows=JSON.parse(localStorage.getItem('class12-humanities-board-tracker-v2')||'{}')[subject]||[];
  return {completed:rows.filter(r=>Array.isArray(r.tasks)&&r.tasks[4]).length};
}
function kpi(label,value,sub){return `<div class="hub-kpi"><span class="lbl">${label}</span><strong>${value}</strong><small>${sub}</small></div>`}
function fmtMin(sec){return `${Math.round(sec/60)} min`}
function fmtHours(sec){return sec<3600?`${Math.round(sec/60)} min`:`${(sec/3600).toFixed(1)} h`}
