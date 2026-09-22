import {test} from 'node:test';
import assert from 'node:assert/strict';

/* minimal localStorage shim, pre-loaded with data written by the OLD app */
const mem=new Map();
globalThis.localStorage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k)};
mem.set("class12-humanities-board-tracker-v2",JSON.stringify({
  History:[{tasks:[true,true,true,true,true],revisionRounds:2},{tasks:[true,false,false,false,false],revisionRounds:0}],
  Hindi:[{tasks:[true,true],revisionRounds:9}]        /* malformed / short row from an older build */
}));
mem.set("ledger.candidate","Aarav");mem.set("boardExamDate","2027-02-15");

const T=await import('../src/services/tracker.js');
const {SUBJECTS,SUBJ_KEYS}=await import('../src/data/syllabus.js');

test('storage keys are unchanged',()=>{
  assert.equal(T.STORE,"class12-humanities-board-tracker-v2");
  assert.equal(T.CANDKEY,"ledger.candidate");assert.equal(T.EXAMKEY,"boardExamDate");
});
test('existing progress survives init() and is repaired, not discarded',()=>{
  T.init();
  const s=T.getState();
  assert.deepEqual(s.History[0],{tasks:[true,true,true,true,true],revisionRounds:2});
  assert.deepEqual(s.History[1].tasks,[true,false,false,false,false]);
  assert.deepEqual(s.Hindi[0].tasks,[true,true,false,false,false]);   /* short row padded */
  assert.equal(s.Hindi[0].revisionRounds,3);                           /* clamped to 0..3 */
  for(const k of SUBJ_KEYS)assert.equal(s[k].length,SUBJECTS[k].length);
});
test('stats match the original maths',()=>{
  const h=T.stats("History");
  assert.equal(h.completed,1);assert.equal(h.pct,Math.round(100/12));assert.equal(h.done,6);assert.equal(h.rev,2);
  const o=T.overallStats();assert.equal(o.total,88);assert.equal(o.completed,1);
});
test('candidate and exam date still read from the old keys',()=>{
  assert.equal(T.getCandidate(),"Aarav");assert.equal(T.validExamDate(),"2027-02-15");
  T.setExamDate("");assert.equal(mem.has("boardExamDate"),false);
  assert.equal(T.examDays(),null);
});
test('old JSON exports still import (with and without the wrapper)',()=>{
  const bare=T.normalizeState({Geography:[{tasks:[true,true,true,true,true],revisionRounds:1}]});
  const wrapped=T.normalizeState({app:'class12-humanities-ledger',state:{Geography:[{tasks:[true,true,true,true,true],revisionRounds:1}]},examDate:null});
  assert.deepEqual(bare,wrapped);assert.equal(bare.Geography[0].revisionRounds,1);
  assert.equal(bare.History.length,12);
  assert.doesNotThrow(()=>T.normalizeState(null));
});
test('persist writes LocalStorage and announces the change',async()=>{
  const {bus}=await import('../src/utils/bus.js');
  let got=null;bus.on('tracker:saved',fx=>got=fx);
  T.getState().History[1].tasks[1]=true;T.persist({enter:true});
  assert.deepEqual(got,{enter:true});
  assert.equal(JSON.parse(mem.get(T.STORE)).History[1].tasks[1],true);
});
