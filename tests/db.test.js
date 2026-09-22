import 'fake-indexeddb/auto';
import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {db} from '../src/services/db.js';
import {ValidationError,SCHEMA_VERSION,COLLECTIONS} from '../src/data/schema.js';

const day="2026-09-22";
const mcq=(o={})=>({format:"mcq",text:"Which of these?",options:["a","b","c","d"],correct_index:1,subject:"Political Science",
  chapter_id:"polsci-07",difficulty:"easy",qtype:"standard",marks:1,source:"practice",...o});

before(async()=>{assert.equal(await db.available(),true);});

test('creates every collection and index from the schema',async()=>{
  const idb=await db.open();
  for(const c of Object.keys(COLLECTIONS))assert.ok(idb.objectStoreNames.contains(c),c);
  assert.equal(idb.version,SCHEMA_VERSION);
  const ix=idb.transaction('questions').objectStore('questions').indexNames;
  for(const n of ['subject','chapter_id','source','year','tags'])assert.ok(ix.contains(n),n);
});

test('put/get/update assigns id and timestamps and keeps created_at',async()=>{
  const q=await db.put('questions',mcq());
  assert.ok(q.id&&q.created_at&&q.updated_at);
  const u=await db.update('questions',q.id,{difficulty:"hard"});
  assert.equal(u.difficulty,"hard");assert.equal(u.created_at,q.created_at);
  assert.equal((await db.get('questions',q.id)).difficulty,"hard");
});

test('official PYQs need a real year and reference; others may not carry a year',async()=>{
  await assert.rejects(()=>db.put('questions',mcq({source:"official_pyq"})),ValidationError);
  await assert.rejects(()=>db.put('questions',mcq({source:"official_pyq",year:2023})),/reference/);
  await assert.rejects(()=>db.put('questions',mcq({source:"ai_generated",year:2023})),/only allowed on official_pyq/);
  await assert.rejects(()=>db.put('questions',mcq({source:"practice",board:"CBSE"})),/board/);
  const ok=await db.put('questions',mcq({source:"official_pyq",year:2023,board:"CBSE",reference:"CBSE Class XII Political Science 2023, Set 1"}));
  assert.equal(ok.year,2023);
});

test('rejects bad questions, unknown fields and mismatched chapters',async()=>{
  await assert.rejects(()=>db.put('questions',mcq({options:["a","b"]})),/four/);
  await assert.rejects(()=>db.put('questions',mcq({correct_index:undefined})),/correct_index/);
  await assert.rejects(()=>db.put('questions',mcq({chapter_id:"history-01"})),/belongs to History/);
  await assert.rejects(()=>db.put('questions',mcq({chapter_id:"nope-99"})),/not in the syllabus/);
  await assert.rejects(()=>db.put('questions',mcq({difficulty:"brutal"})),/difficulty/);
  await assert.rejects(()=>db.put('questions',mcq({typo_field:1})),/unknown field/);
});

test('rejects invalid calendar dates',async()=>{
  await assert.rejects(()=>db.put('daily_activity',{date:"2026-13-40",study_sec:0,questions:0,correct:0,pyqs:0,revisions:0,tests:0,missions_done:0}),/date/);
});

test('query by index, range and multiEntry tags',async()=>{
  const a=await db.put('questions',mcq({chapter_id:"history-02",subject:"History",tags:["kings","towns"]}));
  const hist=await db.query('questions','chapter_id','history-02');
  assert.ok(hist.some(r=>r.id===a.id));
  const tagged=await db.query('questions','tags','towns');
  assert.ok(tagged.some(r=>r.id===a.id));
  await db.put('study_sessions',{date:"2026-09-20",started_at:"2026-09-20T10:00:00.000Z",ended_at:"2026-09-20T10:25:00.000Z",duration_sec:1500,mode:"pomodoro",activity:"reading"});
  await db.put('study_sessions',{date:"2026-09-22",started_at:"2026-09-22T10:00:00.000Z",ended_at:"2026-09-22T10:50:00.000Z",duration_sec:3000,mode:"deep_focus",activity:"pyqs",subject:"Geography",chapter_id:"geography-12"});
  const range=await db.query('study_sessions','date',{gte:"2026-09-21",lte:"2026-09-30"});
  assert.equal(range.length,1);assert.equal(range[0].duration_sec,3000);
});

test('soft delete hides the record, keeps a tombstone, and can be resurrected',async()=>{
  const n=await db.put('notes',{title:"Globalisation",body:"x",subject:"Political Science",chapter_id:"polsci-07",tags:["gl"]});
  assert.equal(await db.remove('notes',n.id),true);
  assert.equal(await db.get('notes',n.id),undefined);
  assert.ok((await db.all('notes',{includeDeleted:true})).find(r=>r.id===n.id).deleted_at);
  assert.equal(await db.remove('notes',n.id),false);
  await db.put('notes',{...n,title:"Back again"});
  assert.equal((await db.get('notes',n.id)).title,"Back again");
});

test('every write lands in the outbox, in the same transaction',async()=>{
  const before=(await db.outbox()).length;
  const n=await db.put('bookmarks',{question_id:"q1",category:"must_do"});
  await db.remove('bookmarks',n.id);
  await assert.rejects(()=>db.put('bookmarks',{question_id:"q1",category:"bogus"}));
  const box=await db.outbox();
  assert.equal(box.length,before+2);                 /* failed write left nothing behind */
  assert.deepEqual(box.slice(-2).map(x=>x.op),["put","delete"]);
  await db.ackOutbox(box.at(-1).seq);
  assert.equal((await db.outbox()).length,0);
});

test('applyRemote keeps the newer copy and skips the outbox',async()=>{
  const n=await db.put('settings',{id:"theme",value:"paper"});
  const outbox=(await db.outbox()).length;
  assert.equal(await db.applyRemote('settings',{...n,value:"old",updated_at:"2000-01-01T00:00:00.000Z"}),false);
  assert.equal(await db.applyRemote('settings',{...n,value:"newer",updated_at:"2999-01-01T00:00:00.000Z"}),true);
  assert.equal((await db.get('settings','theme')).value,"newer");
  assert.equal((await db.outbox()).length,outbox);
});

test('subscribe fires on writes',async()=>{
  let hits=0;const off=db.subscribe('resources',()=>hits++);
  const r=await db.put('resources',{title:"NCERT Ch 7",url:"https://ncert.nic.in/",category:"ncert",subject:"Political Science",chapter_id:"polsci-07"});
  await db.remove('resources',r.id);off();
  await db.put('resources',{title:"again",url:"https://ncert.nic.in/",category:"ncert"});
  assert.equal(hits,2);
  await assert.rejects(()=>db.put('resources',{title:"bad",url:"javascript:alert(1)",category:"ncert"}),/http/);
});

test('export → clear → import restores data and skips invalid rows',async()=>{
  const q=await db.put('questions',mcq({text:"round trip"}));
  const dump=await db.exportAll();
  dump.collections.questions.push({id:"bad",format:"mcq"});     /* invalid row must be skipped */
  await db.clearAll();
  assert.equal(await db.get('questions',q.id),undefined);
  await db.importAll(dump);
  assert.equal((await db.get('questions',q.id)).text,"round trip");
  assert.equal(await db.get('questions',"bad"),undefined);
  await assert.rejects(()=>db.importAll({app:"other"}),/backup/);
});

test('data written before a reopen is still there (persistence)',async()=>{
  const q=await db.put('questions',mcq({text:"persist me"}));
  const idb=await db.open();idb.close();
  /* fresh handle to the same database */
  const again=await new Promise((res,rej)=>{const r=indexedDB.open("humanities-hub");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
  const got=await new Promise(res=>{const g=again.transaction('questions').objectStore('questions').get(q.id);g.onsuccess=()=>res(g.result);});
  assert.equal(got.text,"persist me");again.close();
});
