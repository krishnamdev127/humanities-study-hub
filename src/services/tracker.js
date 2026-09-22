/* The original tracker's data layer, moved out of the monolith with the same behaviour.
   Storage keys are UNCHANGED, so every existing device keeps its progress:
     class12-humanities-board-tracker-v2  → { [subject]: [{ tasks:[5 bools], revisionRounds:0..3 }] }
     ledger.candidate                     → candidate name
     boardExamDate                        → YYYY-MM-DD                                            */
import {SUBJECTS,SUBJ_KEYS} from '../data/syllabus.js';
import {bus} from '../utils/bus.js';

export const STORE="class12-humanities-board-tracker-v2";
export const CANDKEY="ledger.candidate";
export const EXAMKEY="boardExamDate";
const ISO=/^\d{4}-\d{2}-\d{2}$/;

let state=(function(){try{return JSON.parse(localStorage.getItem(STORE)||"{}")||{}}catch(e){return{}}})();

export const getState=()=>state;
export function setState(next){state=next;localStorage.setItem(STORE,JSON.stringify(state));}

export function init(){
  for(const subject of SUBJ_KEYS){
    if(!state[subject])state[subject]=[];
    SUBJECTS[subject].forEach((_,i)=>{
      if(!state[subject][i])state[subject][i]={tasks:[false,false,false,false,false],revisionRounds:0};
      const r=state[subject][i];
      if(!Array.isArray(r.tasks)||r.tasks.length!==5)r.tasks=[0,1,2,3,4].map(j=>!!(r.tasks&&r.tasks[j]));
      if(typeof r.revisionRounds!=="number"||isNaN(r.revisionRounds))r.revisionRounds=0;
      r.revisionRounds=Math.max(0,Math.min(3,r.revisionRounds));
    });
  }
}

/* Write to LocalStorage, then tell everyone (cloud sync, UI) that the record changed. */
export function persist(fx){
  localStorage.setItem(STORE,JSON.stringify(state));
  bus.emit('tracker:saved',fx||{});
}

export function normalizeState(raw){
  const src=raw&&typeof raw==='object'&&raw.state&&typeof raw.state==='object'?raw.state:raw;
  const out={};
  for(const s of SUBJ_KEYS){
    out[s]=SUBJECTS[s].map((_,i)=>{
      const r=Array.isArray(src&&src[s])?(src[s][i]||{}):{};
      const t=Array.isArray(r.tasks)?r.tasks:[];
      return {tasks:[0,1,2,3,4].map(j=>!!t[j]),revisionRounds:Math.max(0,Math.min(3,+r.revisionRounds||0))};
    });
  }
  return out;
}

export function stats(subject){
  const rows=state[subject],total=rows.length;
  const completed=rows.filter(r=>r.tasks[4]).length;
  const done=rows.reduce((a,r)=>a+r.tasks.filter(Boolean).length,0);
  const rev=rows.reduce((a,r)=>a+r.revisionRounds,0);
  return {total,completed,done,all:total*5,pct:total?Math.round(completed*100/total):0,taskPct:total?Math.round(done*100/(total*5)):0,rev};
}
export function overallStats(){
  const all=SUBJ_KEYS.map(stats);
  return {
    total:all.reduce((a,x)=>a+x.total,0),
    completed:all.reduce((a,x)=>a+x.completed,0),
    done:all.reduce((a,x)=>a+x.done,0),
    tasks:all.reduce((a,x)=>a+x.all,0),
    rev:all.reduce((a,x)=>a+x.rev,0)
  };
}

/* candidate + exam date */
export const getCandidate=()=>localStorage.getItem(CANDKEY)||"";
export function setCandidate(v){if(v)localStorage.setItem(CANDKEY,v);else localStorage.removeItem(CANDKEY);}
export const getExamDate=()=>localStorage.getItem(EXAMKEY)||"";
export const validExamDate=()=>{const d=getExamDate();return ISO.test(d)?d:"";};
export function setExamDate(v){if(v)localStorage.setItem(EXAMKEY,v);else localStorage.removeItem(EXAMKEY);}

export function examDays(){
  const d=getExamDate();
  if(!d||!ISO.test(d))return null;
  const t=new Date(d+"T00:00:00");const today=new Date();today.setHours(0,0,0,0);
  return Math.round((t-today)/864e5);
}
export function fmtDate(iso,long){
  const [y,m,d]=iso.split('-').map(Number);const dt=new Date(y,m-1,d);
  return new Intl.DateTimeFormat('en-GB',long
    ?{weekday:'long',day:'numeric',month:'long',year:'numeric'}
    :{day:'numeric',month:'short',year:'numeric'}).format(dt).toUpperCase();
}
