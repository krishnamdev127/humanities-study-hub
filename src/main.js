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
initTracker();
initPYQ();
initAnswerWriting();
initFlashcards();
initRevision();
initAnalytics();
initNotesResources();
initSearch();
initMapPractice();
renderTestHistory();
initMockTest();
initSyllabus();initProfile();initSettings();initTimer();initMCQ();initTimedTest();
renderAll({enter:true});
initRouter();
initCloud();
db.available().then(ok=>{if(!ok)console.info("Local study database unavailable; the ledger still works.");});
