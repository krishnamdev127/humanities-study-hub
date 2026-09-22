/* Step 3 — Focus timer + durable study sessions. Local-first, chapter-linked and ledger-friendly. */
import {SUBJ_KEYS,SUBJECTS,chapterId} from '../../data/syllabus.js';
import {db} from '../../services/db.js';
import {$,esc,toast} from '../../utils/dom.js';
import {bus} from '../../utils/bus.js';

const MODES={pomodoro:{label:'Pomodoro',study:25*60,break:5*60},deep_focus:{label:'Deep Focus',study:50*60,break:10*60}};
let state={mode:'pomodoro',running:false,phase:'study',elapsed:0,total:MODES.pomodoro.study,startedAt:null,subject:'',chapterId:'',activity:'reading',timer:null};
const today=()=>new Date().toISOString().slice(0,10);
const fmt=s=>{s=Math.max(0,Math.floor(s));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
const chaptersFor=s=>SUBJECTS[s]||[];

function render(){
  const root=$('#timerApp');if(!root)return;
  const mode=state.mode==='custom'?'Custom':state.mode==='stopwatch'?'Stopwatch':MODES[state.mode].label;
  const remaining=state.mode==='stopwatch'?state.elapsed:Math.max(0,state.total-state.elapsed);
  root.querySelector('[data-timer-time]').textContent=fmt(remaining);
  root.querySelector('[data-timer-phase]').textContent=state.mode==='stopwatch'?'STOPWATCH':`${mode.toUpperCase()} · ${state.phase.toUpperCase()}`;
  root.querySelector('[data-start]').textContent=state.running?'PAUSE':(state.elapsed?'RESUME':'START SESSION');
  root.querySelector('[data-start]').disabled=false;
  root.querySelector('[data-stop]').disabled=!state.elapsed&&!state.running;
  const pct=state.total?Math.min(100,state.elapsed/state.total*100):0;
  root.querySelector('[data-progress]').style.width=pct+'%';
}
function selectedChapter(){return state.chapterId?state.chapterId:null}
async function saveSession(){
  if(!state.startedAt||state.elapsed<1)return;
  const end=new Date();
  const duration=Math.max(1,Math.floor(state.elapsed));
  const rec=await db.put('study_sessions',{date:today(),started_at:state.startedAt,ended_at:end.toISOString(),duration_sec:duration,mode:state.mode,activity:state.activity,subject:state.subject||undefined,chapter_id:selectedChapter()||undefined}).catch(e=>{toast('Could not save the study session');console.error(e);});
  if(rec){
    const cur=await db.get('daily_activity',today()).catch(()=>undefined);
    const base=cur||{id:today(),date:today(),study_sec:0,questions:0,correct:0,pyqs:0,revisions:0,tests:0,missions_done:0};
    await db.put('daily_activity',{...base,study_sec:(base.study_sec||0)+duration}).catch(console.error);
    toast(`Session saved — ${fmt(duration)}`);
    bus.emit('study:session-saved',rec);
  }
}
function reset(){clearInterval(state.timer);state.timer=null;state={...state,running:false,phase:'study',elapsed:0,startedAt:null,total:state.mode==='custom'?state.total:(MODES[state.mode]?.study||0)};render();}
async function tick(){if(!state.running)return;state.elapsed+=1;if(state.mode!=='stopwatch'&&state.elapsed>=state.total){
  state.elapsed=state.total;state.running=false;clearInterval(state.timer);state.timer=null;
  if(state.phase==='study'&&state.mode!=='custom'){await saveSession();state.phase='break';state.elapsed=0;state.total=MODES[state.mode].break;state.startedAt=null;state.running=true;state.timer=setInterval(tick,1000);toast('Focus complete — 5/10 minute break started.');}
  else {await saveSession();reset();toast('Focus session complete.');}
  render();return;
}render();}
function toggle(){if(state.running){state.running=false;clearInterval(state.timer);state.timer=null;render();return;}if(!state.startedAt)state.startedAt=new Date().toISOString();state.running=true;state.timer=setInterval(tick,1000);render();}
function bind(root){
  root.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{if(state.running)return;state.mode=b.dataset.mode;state.phase='study';state.elapsed=0;state.startedAt=null;state.total=state.mode==='custom'?Number(root.querySelector('[data-custom-min]').value||30)*60:state.mode==='stopwatch'?0:MODES[state.mode].study;root.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',x===b));render();}));
  root.querySelector('[data-custom-min]').addEventListener('change',e=>{if(!state.running&&state.mode==='custom'){state.total=Math.max(1,Number(e.target.value||30))*60;state.elapsed=0;render();}});
  root.querySelector('[data-subject]').addEventListener('change',e=>{state.subject=e.target.value;const ch=root.querySelector('[data-chapter]');ch.innerHTML='<option value="">No chapter selected</option>'+chaptersFor(state.subject).map((n,i)=>`<option value="${chapterId(state.subject,i)}">${esc(n)}</option>`).join('');});
  root.querySelector('[data-chapter]').addEventListener('change',e=>state.chapterId=e.target.value);
  root.querySelector('[data-activity]').addEventListener('change',e=>state.activity=e.target.value);
  root.querySelector('[data-start]').addEventListener('click',toggle);
  root.querySelector('[data-stop]').addEventListener('click',async()=>{if(state.running){state.running=false;clearInterval(state.timer);state.timer=null;}await saveSession();reset();});
  root.querySelector('[data-reset]').addEventListener('click',reset);
}

export function initTimer(){
  const root=$('#timerApp');if(!root)return;
  root.innerHTML=`<div class="timer-layout"><section class="timer-card"><div class="timer-modes"><button class="chip timer-mode" data-mode="pomodoro" aria-pressed="true">POMODORO · 25</button><button class="chip timer-mode" data-mode="deep_focus" aria-pressed="false">DEEP FOCUS · 50</button><button class="chip timer-mode" data-mode="custom" aria-pressed="false">CUSTOM</button><button class="chip timer-mode" data-mode="stopwatch" aria-pressed="false">STOPWATCH</button></div><div class="timer-face"><span class="lbl" data-timer-phase>POMODORO · STUDY</span><strong data-timer-time>25:00</strong><div class="timer-track"><i data-progress></i></div></div><div class="timer-actions"><button class="btn solid" data-start>START SESSION</button><button class="btn" data-stop disabled>SAVE & STOP</button><button class="btn" data-reset>RESET</button></div></section><aside class="timer-side"><span class="lbl">SESSION RECORD</span><label>SUBJECT<select data-subject><option value="">Choose a subject</option>${SUBJ_KEYS.map(s=>`<option>${esc(s)}</option>`).join('')}</select></label><label>CHAPTER<select data-chapter><option value="">No chapter selected</option></select></label><label>STUDY TYPE<select data-activity><option value="reading">Reading</option><option value="notes">Notes</option><option value="pyqs">PYQs</option><option value="revision">Revision</option><option value="mcqs">MCQs</option><option value="answer_writing">Answer Writing</option><option value="other">Other</option></select></label><label>CUSTOM MINUTES<input data-custom-min type="number" min="1" max="240" value="30"></label><p class="timer-note">Sessions are saved locally first. Cloud sync can pick them up later, and the dashboard counts saved study time.</p></aside></div>`;
  bind(root);render();
}
