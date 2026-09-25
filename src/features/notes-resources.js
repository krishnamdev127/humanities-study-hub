import {db} from '../services/db.js';
import {bus} from '../utils/bus.js';
import {$,esc,toast} from '../utils/dom.js';
import {SUBJECTS} from '../data/syllabus.js';

const subjects=Object.keys(SUBJECTS);
const official=[
 ['CBSE Class XII Sample Papers & Marking Schemes 2025-26','Official CBSE subject-wise SQP and MS page','https://cbseacademic.nic.in/SQP_CLASSXII_2025-26.html','sample_papers'],
 ['CBSE Previous Years Question Papers','Official CBSE archive of previous examination papers','https://www.cbse.gov.in/cbsenew/question-paper.html','pyqs'],
 ['CBSE Academic Curriculum 2025-26','Official Senior Secondary curriculum and subject documents','https://cbseacademic.nic.in/curriculum_2026.html','ncert'],
 ['NCERT Textbooks','Official NCERT textbook portal','https://ncert.nic.in/textbook.php','ncert'],
 ['CBSE Sample Paper Notification 2025-26','Official notification explaining the SQP/MS release','https://cbseacademic.nic.in/web_material/Notifications/2025/66_Notification_2025.pdf','sample_papers'],
 ['CBSE Academic Main Portal','Official CBSE Academic website','https://cbseacademic.nic.in/','other']
];

async function resourcesView(){
 const root=$('#resourcesApp'); if(!root)return;
 const rows=await db.all('resources');
 const cards=official.map(r=>({title:r[0],note:r[1],url:r[2],category:r[3],official:true}));
 const user=rows.map(r=>({...r,official:false}));
 root.innerHTML=`<div class="resource-grid">${cards.map(card).join('')}${user.map(card).join('')}</div>
 <div class="resource-add"><span class="lbl">YOUR RESOURCE LIBRARY</span><p class="muted">Add links for your coaching material, teacher notes, maps, question banks or other study material. These are always marked as your own saved resources.</p>
 <div class="toolrow"><input id="resTitle" class="field" placeholder="Resource title"><input id="resUrl" class="field" placeholder="https://…"><select id="resCat" class="field">${['ncert','pyqs','sample_papers','notes','maps','question_banks','marking_schemes','other'].map(x=>`<option value="${x}">${x.replaceAll('_',' ').toUpperCase()}</option>`).join('')}</select><button class="btn solid" id="addRes">ADD RESOURCE</button></div></div>`;
 root.querySelector('#addRes').onclick=async()=>{const title=root.querySelector('#resTitle').value.trim(),url=root.querySelector('#resUrl').value.trim(),category=root.querySelector('#resCat').value;if(!title||!url){toast('Add a title and URL first');return;}try{new URL(url)}catch{toast('Enter a valid http(s) URL');return;}await db.put('resources',{title,url,category,note:'User-added resource'});toast('Resource saved locally');resourcesView();};
}
function card(r){return `<article class="study-card"><div class="cardtop"><span class="lbl">${esc((r.category||'other').replaceAll('_',' '))}</span>${r.official?'<span class="chip">OFFICIAL CBSE / NCERT</span>':'<span class="chip">YOUR RESOURCE</span>'}</div><h3>${esc(r.title)}</h3><p>${esc(r.note||'')}</p><a class="btn solid" target="_blank" rel="noopener" href="${esc(r.url)}">OPEN RESOURCE</a>${r.official?'':'<button class="btn danger" data-del="'+esc(r.id)+'">DELETE</button>'}</article>`;}

export function initNotesResources(){
 bus.on('route:changed',r=>{if(r.section==='resources')resourcesView();});
}
