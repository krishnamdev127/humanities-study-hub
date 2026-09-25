/* Local database schema (IndexedDB). One source of truth for collections, indexes and validation.
   Mirrors the planned Supabase tables 1:1 — every record carries id / created_at / updated_at /
   deleted_at so it can be synced later without reshaping.

   Design notes
   - One `questions` collection holds MCQs and written questions; PYQs are simply questions with
     source = "official_pyq". Fewer tables, and attempts/bookmarks/mistakes all point at one id.
   - Chapter and subject references use stable ids from data/syllabus.js (e.g. "polsci-07").
   - The tracker's own progress (task ticks, revision rounds, candidate, exam date) stays in the
     original LocalStorage keys; nothing here duplicates it.                                       */
import {SUBJ_KEYS,chapterById} from './syllabus.js';

export const SCHEMA_VERSION=2;

export const SOURCES=["official_pyq","ai_generated","practice","user_created"];
export const DIFFICULTY=["easy","medium","hard"];
export const QTYPES=["standard","assertion_reason","case_based","conceptual","application"];
export const FORMATS=["mcq","short","long"];
export const ACTIVITIES=["reading","notes","pyqs","revision","mcqs","answer_writing","other"];
export const SELF_RATING=["didnt_know","partial","knew","excellent"];
export const CARD_RATING=["forgot","difficult","good","easy"];
export const BOOKMARK_CATS=["important","must_do","frequently_asked","weak_area"];
export const RESOURCE_CATS=["ncert","pyqs","sample_papers","notes","maps","question_banks","marking_schemes","other"];
export const CONTEXTS=["practice","daily_pyq","test","mistake_retry","simulator"];

/* field spec: {type, required, enum, min, max, of, maxLen}
   types: string number integer boolean date iso array object any                                      */
const S=(o={})=>({type:"string",...o}), N=(o={})=>({type:"number",...o}), I=(o={})=>({type:"integer",...o});
const B=(o={})=>({type:"boolean",...o}), D=(o={})=>({type:"date",...o}), T=(o={})=>({type:"iso",...o});
const A=(o={})=>({type:"array",...o}), O=(o={})=>({type:"object",...o});
const SUBJECT=(o={})=>S({enum:SUBJ_KEYS,...o});
const CHAPTER=(o={})=>S({...o});

const checkChapter=r=>{
  const e=[];
  if(r.chapter_id!=null){
    const ch=chapterById(r.chapter_id);
    if(!ch)e.push(`chapter_id "${r.chapter_id}" is not in the syllabus`);
    else if(r.subject&&r.subject!==ch.subject)e.push(`chapter_id "${r.chapter_id}" belongs to ${ch.subject}, not ${r.subject}`);
  }
  return e;
};

export const COLLECTIONS={
  /* key-value app settings; id is the setting key */
  settings:{fields:{value:{type:"any"}}},

  /* per-chapter facts the tracker itself does not hold */
  chapter_meta:{indexes:["subject"],
    fields:{subject:SUBJECT({required:true}),chapter_id:CHAPTER({required:true}),last_studied:T(),last_revised:T()},
    check:checkChapter},

  study_sessions:{indexes:["date","chapter_id","subject"],
    fields:{date:D({required:true}),started_at:T({required:true}),ended_at:T({required:true}),
      duration_sec:I({required:true,min:1,max:86400}),
      mode:S({required:true,enum:["pomodoro","deep_focus","custom","stopwatch"]}),
      activity:S({required:true,enum:ACTIVITIES}),subject:SUBJECT(),chapter_id:CHAPTER()},
    check:checkChapter},

  /* MCQs, short and long questions — the only place question text lives */
  questions:{indexes:["subject","chapter_id","source","year","topic_id",{name:"tags",path:"tags",multiEntry:true}],
    fields:{format:S({required:true,enum:FORMATS}),text:S({required:true,maxLen:4000}),
      options:A({of:"string"}),correct_index:I({min:0,max:3}),answer:S({maxLen:8000}),explanation:S({maxLen:4000}),
      subject:SUBJECT({required:true}),chapter_id:CHAPTER({required:true}),topic_id:S({maxLen:120}),
      difficulty:S({required:true,enum:DIFFICULTY}),qtype:S({required:true,enum:QTYPES}),
      marks:N({required:true,min:0.5,max:100}),
      source:S({required:true,enum:SOURCES}),
      year:I(),board:S(),reference:S({maxLen:500}),source_title:S({maxLen:300}),source_url:S({maxLen:2000}),syllabus_version:S({maxLen:40}),verified_at:T(),verified:B(),tags:A({of:"string"})},
    check:r=>{
      const e=checkChapter(r);
      if(r.format==="mcq"){
        if(!Array.isArray(r.options)||r.options.length!==4||r.options.some(o=>typeof o!=="string"||!o.trim()))e.push("an MCQ needs exactly four non-empty options");
        if(!Number.isInteger(r.correct_index))e.push("an MCQ needs correct_index (0-3)");
      }
      /* Question provenance: an official year must never be invented. */
      if(r.verified!=null&&typeof r.verified!=="boolean")e.push("verified must be boolean");
      if(r.source==="official_pyq"){
        if(!Number.isInteger(r.year)||r.year<1990||r.year>2100)e.push("official_pyq needs a real board year");
        if(!r.reference||!String(r.reference).trim())e.push("official_pyq needs a source/reference");
      }else{
        if(r.year!=null)e.push(`year is only allowed on official_pyq (source is ${r.source})`);
        if(r.board!=null)e.push(`board is only allowed on official_pyq (source is ${r.source})`);
      }
      return e;
    }},

  attempts:{indexes:["question_id","chapter_id","subject","date","test_attempt_id"],
    fields:{question_id:S({required:true}),date:D({required:true}),subject:SUBJECT({required:true}),chapter_id:CHAPTER({required:true}),
      context:S({required:true,enum:CONTEXTS}),test_attempt_id:S(),
      selected:{type:"any"},               /* option index for MCQs, null if skipped */
      correct:B(),                         /* MCQs: computed; written: from self rating */
      self_rating:S({enum:SELF_RATING}),time_sec:N({min:0,max:86400})},
    check:checkChapter},

  /* generated / saved test definitions */
  tests:{indexes:["type"],
    fields:{name:S({required:true,maxLen:120}),type:S({required:true,enum:["quick","custom","mock","simulator","mistakes"]}),
      config:O(),question_ids:A({required:true,of:"string"}),duration_sec:I({min:0}),total_marks:N({min:0})}},

  test_attempts:{indexes:["test_id","submitted_at"],
    fields:{test_id:S({required:true}),started_at:T({required:true}),submitted_at:T(),
      status:S({required:true,enum:["in_progress","submitted","auto_submitted"]}),
      answers:O(),flagged:A({of:"string"}),time_taken_sec:I({min:0}),score:N(),max_score:N({min:0}),
      simulated:B({required:true})}},       /* always true: results are practice, never official marks */

  mistakes:{indexes:["question_id","chapter_id","subject"],
    fields:{question_id:S({required:true}),subject:SUBJECT({required:true}),chapter_id:CHAPTER({required:true}),
      times_wrong:I({required:true,min:0}),correct_streak:I({required:true,min:0}),
      last_attempted:T(),mastered:B({required:true})},
    check:checkChapter},

  /* kind "card" = flashcard, "recall" = active-recall prompt; SRS fields drive spaced revision */
  flashcards:{indexes:["subject","chapter_id","next_review",{name:"tags",path:"tags",multiEntry:true}],
    fields:{kind:S({required:true,enum:["card","recall"]}),front:S({required:true,maxLen:2000}),back:S({required:true,maxLen:4000}),
      difficulty:S({enum:DIFFICULTY}),subject:SUBJECT({required:true}),chapter_id:CHAPTER({required:true}),tags:A({of:"string"}),
      review_count:I({required:true,min:0}),interval_days:N({required:true,min:0}),ease:N({required:true,min:1.3,max:4}),
      last_reviewed:T(),next_review:D()},
    check:checkChapter},

  flashcard_reviews:{indexes:["card_id","date"],
    fields:{card_id:S({required:true}),date:D({required:true}),rating:S({required:true,enum:CARD_RATING})}},

  notes:{indexes:["subject","chapter_id",{name:"tags",path:"tags",multiEntry:true}],
    fields:{title:S({required:true,maxLen:200}),body:S({maxLen:100000}),subject:SUBJECT(),chapter_id:CHAPTER(),
      tags:A({of:"string"}),pinned:B(),favourite:B()},
    check:checkChapter},

  bookmarks:{indexes:["question_id","category"],
    fields:{question_id:S({required:true}),category:S({required:true,enum:BOOKMARK_CATS})}},

  /* answer-writing practice */
  answers:{indexes:["question_id","date"],
    fields:{question_id:S({required:true}),date:D({required:true}),text:S({maxLen:20000}),word_count:I({required:true,min:0}),
      time_sec:I({min:0}),attempt_no:I({required:true,min:1}),
      checklist:O(),self_score:N({min:0}),self_rating:S({enum:SELF_RATING})}},

  /* one record per calendar day; id = the date. Feeds streaks and the heatmap cheaply. */
  daily_activity:{indexes:["date"],
    fields:{date:D({required:true}),study_sec:I({required:true,min:0}),questions:I({required:true,min:0}),
      correct:I({required:true,min:0}),pyqs:I({required:true,min:0}),revisions:I({required:true,min:0}),
      tests:I({required:true,min:0}),missions_done:I({required:true,min:0})}},

  daily_missions:{indexes:["date"],
    fields:{date:D({required:true}),missions:A({required:true,of:"object"})}},

  achievements:{fields:{key:S({required:true}),unlocked_at:T({required:true})}},

  resources:{indexes:["category","subject","chapter_id"],
    fields:{title:S({required:true,maxLen:200}),url:S({required:true,maxLen:2000}),category:S({required:true,enum:RESOURCE_CATS}),
      subject:SUBJECT(),chapter_id:CHAPTER(),note:S({maxLen:1000})},
    check:r=>{
      const e=checkChapter(r);
      try{const u=new URL(r.url);if(!/^https?:$/.test(u.protocol))e.push("url must be http(s)");}catch{e.push("url is not valid");}
      return e;
    }},

  /* Progress on map locations. The location catalogue itself is added later from verified data. */
  map_progress:{indexes:["map","category"],
    fields:{location_id:S({required:true}),map:S({required:true,enum:["india","world"]}),category:S({required:true}),
      attempts:I({required:true,min:0}),correct:I({required:true,min:0}),mastered:B({required:true})}}
};

/* ---------------- validation ---------------- */
const isDate=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v));
const isIso=v=>typeof v==="string"&&!isNaN(Date.parse(v))&&v.includes("T");
function typeOk(t,v){
  switch(t){
    case"string":return typeof v==="string";
    case"number":return typeof v==="number"&&Number.isFinite(v);
    case"integer":return Number.isInteger(v);
    case"boolean":return typeof v==="boolean";
    case"date":return isDate(v);
    case"iso":return isIso(v);
    case"array":return Array.isArray(v);
    case"object":return v!==null&&typeof v==="object"&&!Array.isArray(v);
    default:return true;
  }
}
export const SYSTEM_FIELDS=["id","created_at","updated_at","deleted_at"];
export class ValidationError extends Error{
  constructor(collection,errors){super(`Invalid ${collection} record: ${errors.join("; ")}`);this.name="ValidationError";this.collection=collection;this.errors=errors;}
}
export function validate(collection,rec){
  const spec=COLLECTIONS[collection];
  if(!spec)throw new Error(`Unknown collection "${collection}"`);
  const errors=[];
  for(const k of Object.keys(rec))if(!(k in spec.fields)&&!SYSTEM_FIELDS.includes(k))errors.push(`unknown field "${k}"`);
  for(const [k,f] of Object.entries(spec.fields)){
    const v=rec[k];
    if(v===undefined||v===null){if(f.required)errors.push(`${k} is required`);continue;}
    if(!typeOk(f.type,v)){errors.push(`${k} must be a ${f.type}`);continue;}
    if(f.enum&&!f.enum.includes(v))errors.push(`${k} must be one of ${f.enum.join("/")}`);
    if(typeof v==="number"){
      if(f.min!=null&&v<f.min)errors.push(`${k} must be ≥ ${f.min}`);
      if(f.max!=null&&v>f.max)errors.push(`${k} must be ≤ ${f.max}`);
    }
    if(typeof v==="string"&&f.maxLen&&v.length>f.maxLen)errors.push(`${k} is too long`);
    if(f.type==="array"&&f.of&&f.of!=="object"&&v.some(x=>typeof x!==f.of))errors.push(`${k} must contain only ${f.of}s`);
  }
  if(spec.check)errors.push(...spec.check(rec));
  if(errors.length)throw new ValidationError(collection,errors);
}
