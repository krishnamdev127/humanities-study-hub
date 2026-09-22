/* Navigation map. `built` sections have their own view; the rest render an honest "not built yet"
   page until their step lands. `step` refers to the implementation order. */
const P=(id,label,step=null)=>({id,label,step});

export const SECTIONS=[
  {id:'home',label:'Home',view:'home',built:true,mobile:'tab'},
  {id:'syllabus',label:'Syllabus',view:'syllabus',built:true,mobile:'more',
   note:'Subjects, chapters and revision rounds'},
  {id:'study',label:'Study',mobile:'tab',children:[
    {...P('timer','Timer',3),built:true},{...P('notes','Notes',16),built:true},{...P('flashcards','Flashcards',12),built:true},{...P('recall','Active recall',12),built:true},{...P('revision','Spaced revision',13),built:true}]},
  {id:'practice',label:'Practice',mobile:'tab',children:[
    {...P('mcqs','MCQs',5),built:true},{...P('daily-pyq','Daily PYQ',7),built:true},{...P('pyq-bank','PYQ bank',7),built:true},P('mistakes','Mistakes',8),P('maps','Map practice'),{...P('answer-writing','Answer writing',11),built:true}]},
  {id:'tests',label:'Tests',mobile:'tab',children:[
    {...P('quick','Quick test',6),built:true},{...P('custom','Custom test',9),built:true},{...P('mock','Mock generator',9),built:true},{...P('simulator','Board simulator',10),built:true},{...P('history','Test history',6),built:true}]},
  {id:'analytics',label:'Analytics',mobile:'more',note:'Performance, study time, heatmap',children:[
    {...P('performance','Performance',14),built:true},{...P('study-time','Study time',14),built:true},{...P('progress','Progress',14),built:true},{...P('heatmap','Heatmap',14),built:true}]},
  {id:'resources',label:'Resources',mobile:'more',note:'NCERT, papers, notes, maps',children:[
    P('ncert','NCERT',16),P('papers','Papers',16),{...P('notes','Notes',16),built:true},P('maps','Maps',16)]},
  {id:'profile',label:'Profile',view:'profile',built:true,mobile:'more',note:'Account, cloud sync and data'}
];

export const TABS=[
  {id:'home',label:'HOME',ic:'<path d="M4 11l8-7 8 7M6 10v9h12v-9"/>'},
  {id:'study',label:'STUDY',ic:'<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M9.5 3h5"/>'},
  {id:'practice',label:'PRACTICE',ic:'<path d="M5 5h14v14H5zM9 10h6M9 14h4"/>'},
  {id:'tests',label:'TESTS',ic:'<path d="M7 4h10v16H7zM10 4v3h4V4M10 12l1.6 1.6L15 10"/>'},
  {id:'more',label:'MORE',ic:'<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'}
];

export const DEFAULT_ROUTE='home';
export const byId=id=>SECTIONS.find(s=>s.id===id);

/* "#/study/notes" → {section:'study', child:'notes'}. Anything else (including Supabase's OAuth
   "#access_token=…" fragment) resolves to Home WITHOUT touching the URL. */
export function parseHash(hash){
  const m=/^#\/([a-z-]+)(?:\/([a-z-]+))?/.exec(hash||'');
  const sec=m&&byId(m[1]);
  if(!sec)return {section:DEFAULT_ROUTE,child:null,known:false};
  const child=sec.children&&(sec.children.find(c=>c.id===m[2])||sec.children[0]);
  return {section:sec.id,child:sec.children?child.id:null,known:true};
}
