import {db} from '../../services/db.js';
import {bus} from '../../utils/bus.js';

const today=()=>new Date().toISOString().slice(0,10);
const keyOffset=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};

export async function getStreak(){
  const rows=await db.all('daily_activity').catch(()=>[]);
  const active=new Set(rows.filter(r=>(r.study_sec||0)>0||(r.questions||0)>0||(r.pyqs||0)>0||(r.revisions||0)>0||(r.tests||0)>0).map(r=>r.date));
  let current=0;
  for(let i=0;i<366;i++){if(active.has(keyOffset(-i)))current++;else if(i===0)continue;else break;}
  let longest=0,run=0;
  const dates=[...active].sort();
  let prev=null;
  for(const d of dates){if(prev&&Math.round((new Date(d)-new Date(prev))/864e5)===1)run++;else run=1;longest=Math.max(longest,run);prev=d;}
  return {current,longest,lastActive:active.has(today())?today():(dates.at(-1)||null)};
}

export async function recordAchievement(key){
  if(await db.get('achievements',key))return false;
  await db.put('achievements',{id:key,key,unlocked_at:new Date().toISOString()});
  bus.emit('achievement:unlocked',{key});
  return true;
}

export async function updateMilestones(){
  const s=await getStreak();
  for(const n of [3,7,14,30,50,100])if(s.longest>=n)await recordAchievement(`streak-${n}`);
  const attempts=await db.all('attempts').catch(()=>[]);
  const study=await db.all('study_sessions').catch(()=>[]);
  if(attempts.length>=100)await recordAchievement('100-questions');
  if(attempts.length>=500)await recordAchievement('500-questions');
  const hours=study.reduce((a,x)=>a+(x.duration_sec||0),0)/3600;
  if(hours>=25)await recordAchievement('25-hours');
  const tests=await db.all('test_attempts').catch(()=>[]);
  if(tests.length>=1)await recordAchievement('first-mock');
  if(tests.length>=10)await recordAchievement('10-tests');
  const correct=attempts.filter(a=>a.correct).length;
  if(attempts.length>=20&&correct/attempts.length>=.9)await recordAchievement('90-accuracy');
  return s;
}

export async function getDailyMissions(){
  const d=today();
  const existing=await db.get('daily_missions',d).catch(()=>undefined);
  const sessions=await db.all('study_sessions').catch(()=>[]);
  const attempts=await db.all('attempts').catch(()=>[]);
  const activity=await db.get('daily_activity',d).catch(()=>undefined);
  const study=Math.round((activity?.study_sec||sessions.filter(x=>x.date===d).reduce((a,x)=>a+(x.duration_sec||0),0))/60);
  const questions=attempts.filter(x=>x.date===d).length;
  const missions=[
    {id:'study',title:'Study for 60 minutes',progress:Math.min(60,study),target:60,unit:'min'},
    {id:'questions',title:'Answer 10 practice questions',progress:Math.min(10,questions),target:10,unit:'questions'},
    {id:'revision',title:'Revise one chapter',progress:Math.min(1,activity?.revisions||0),target:1,unit:'revision'},
    {id:'pyq',title:"Complete today’s PYQ",progress:Math.min(1,activity?.pyqs||0),target:1,unit:'PYQ'}
  ];
  if(existing){
    const merged=missions.map(m=>({...m,done:existing.missions.find(x=>x.id===m.id)?.done||m.progress>=m.target}));
    return {id:d,date:d,missions:merged};
  }
  const rec={id:d,date:d,missions:missions.map(m=>({...m,done:m.progress>=m.target}))};
  await db.put('daily_missions',rec).catch(()=>{});
  return rec;
}
