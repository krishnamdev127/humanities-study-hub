/* Boot: wires the tracker, cloud sync, shell and local database together. */
import {init as initTracker,getCandidate,getExamDate,setCandidate,setExamDate,persist} from './services/tracker.js';
import {initCloud} from './services/cloud.js';
import {db} from './services/db.js';
import {bus} from './utils/bus.js';
import {$,toast,openOverlay,closeOverlay,initOverlays} from './utils/dom.js';
import {renderMast,renderBand,renderTotals,renderHubDashboard} from './features/dashboard/dashboard.js';
import {renderIndex,renderBoard,initSyllabus,resetFilter} from './features/syllabus/syllabus.js';
import {initProfile,updateAuthUI} from './features/profile/profile.js';
import {initRouter} from './features/shell/router.js';
import {initTimer} from './features/timer/timer.js';
import {initMCQ} from './features/mcq/mcq.js';
import {initTimedTest} from './features/tests/timed.js';
import {initMockTest} from './features/tests/mock.js';
import {initPYQ} from './features/pyq/pyq.js';
import {initAnswerWriting} from './features/answer-writing.js';
import {initFlashcards} from './features/flashcards/flashcards.js';
import {initRevision} from './features/revision/revision.js';
import {initAnalytics,renderTestHistory} from './features/analytics/analytics.js';
import {initNotesResources} from './features/notes-resources.js';
import {initSearch} from './features/search.js';
import {initMapPractice} from './features/map-practice.js';

function renderAll(fx){renderMast();renderBand();renderIndex();renderBoard(fx||{});renderTotals();renderHubDashboard();}
function flashSave(){const sn=$('#saveNote');sn.classList.add('ping');setTimeout(()=>sn.classList.remove('ping'),900);}

/* record changed on this device (tick, revision, details, import, reset) */
bus.on('tracker:saved',fx=>{flashSave();renderAll(fx);});
/* record replaced from the cloud */
bus.on('tracker:replaced',fx=>{resetFilter();renderAll(fx);});
bus.on('cloud:auth',()=>{updateAuthUI();renderAll();});
bus.on('cloud:signedin',()=>toast('Signed in — cloud sync is active'));
bus.on('study:changed',()=>{renderAll();renderTestHistory();});
bus.on('cloud:sync',({state})=>{const el=$('#saveStatus');if(el)el.textContent=state==='syncing'?'SYNCING…':state==='synced'?'CLOUD SYNCED':'SAVED LOCALLY';});

/* candidate name + exam date */
function openSettings(){
  $('#fCand').value=getCandidate();
  $('#fDate').value=getExamDate();
  openOverlay('#mSettings');
}
function initSettings(){
  ['#editDetails','#candBtn','#dateBtn'].forEach(s=>$(s).addEventListener('click',openSettings));
  $('#saveSettings').addEventListener('click',()=>{
    setCandidate($('#fCand').value.trim());
    setExamDate($('#fDate').value);
    closeOverlay('#mSettings');
    persist();
    toast('Details saved — syncing to your cloud record if signed in');
  });
}

initOverlays();
(function(){const r=$('#ruler');for(let i=1;i<10;i++){const t=document.createElement('i');t.className='tick';t.style.left=i*10+'%';r.appendChild(t);}})();

function showBootError(err){
  console.error('Humanities Study Hub boot error:',err);
  const view=$('#view');
  if(!view)return;
  view.querySelectorAll('[data-view]').forEach(v=>{v.hidden=true;});
  const section=document.createElement('section');
  section.className='pane';
  section.setAttribute('data-view','boot-error');
  section.innerHTML='<span class="lbl">STARTUP ERROR</span><h2 class="pane-title">The study hub could not finish loading.</h2><p class="timer-intro">Your existing local progress has not been deleted. Refresh once; if the problem remains, open the browser console and send the red error message.</p><pre style="white-space:pre-wrap;overflow:auto;border:1px solid var(--line,#ccc);padding:12px">'+String(err?.stack||err?.message||err)+'</pre><button class="btn solid" type="button" id="bootReload">RELOAD HUB</button>';
  view.appendChild(section);
  $('#bootReload')?.addEventListener('click',()=>location.reload());
}

async function boot(){
  try{
    /* Keep the shell first: navigation must remain usable even if an optional feature
       has a database/API problem during startup. */
    initTracker();
    initSyllabus();
    initProfile();
    initSettings();
    initTimer();
    initRouter();

    /* Secondary modules are independent; one failure must not prevent the shell. */
    const jobs=[
      ['PYQ',initPYQ],
      ['Answer writing',initAnswerWriting],
      ['Flashcards',initFlashcards],
      ['Revision',initRevision],
      ['Analytics',initAnalytics],
      ['Notes/resources',initNotesResources],
      ['Search',initSearch],
      ['Map practice',initMapPractice],
      ['Test history',renderTestHistory],
      ['Mock test',initMockTest],
      ['MCQ',initMCQ],
      ['Timed test',initTimedTest]
    ];
    /* Paint the ledger immediately. Database-backed modules can finish in the background. */
    renderAll({enter:true});

    const results=await Promise.allSettled(jobs.map(([,fn])=>fn()));
    results.forEach((r,i)=>{if(r.status==='rejected')console.error(jobs[i][0]+' startup failed:',r.reason);});

    renderAll();
    initCloud();
    db.available().then(ok=>{if(!ok)console.info("Local study database unavailable; the ledger still works.");});
  }catch(err){
    showBootError(err);
  }
}

boot();
