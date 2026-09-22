import {db} from '../services/db.js';
import {$,esc,toast} from '../utils/dom.js';

// Starter catalogue is deliberately labelled practice data, not an official CBSE map list.
const LOCATIONS=[
 {id:'india-ganga',name:'Ganga River',category:'rivers',map:'india',hint:'Major river of northern India.'},
 {id:'india-yamuna',name:'Yamuna River',category:'rivers',map:'india',hint:'Major tributary of the Ganga.'},
 {id:'india-narmada',name:'Narmada River',category:'rivers',map:'india',hint:'Major west-flowing peninsular river.'},
 {id:'india-mumbai',name:'Mumbai',category:'ports',map:'india',hint:'Major port city on the western coast.'},
 {id:'india-kolkata',name:'Kolkata',category:'ports',map:'india',hint:'Major port city on the eastern side of India.'},
 {id:'india-jamshedpur',name:'Jamshedpur',category:'industries',map:'india',hint:'Major iron and steel industrial centre.'}
];
let state={mode:'learn',pool:LOCATIONS,current:null};
async function progress(id){return (await db.all('map_progress')).find(x=>x.location_id===id)||null;}
async function save(loc,ok){const old=await progress(loc.id);await db.put('map_progress',{id:old?.id||db.newId(),location_id:loc.id,map:loc.map,category:loc.category,attempts:(old?.attempts||0)+1,correct:(old?.correct||0)+(ok?1:0),mastered:!!(old?.mastered||ok)});}
function pick(){state.current=state.pool[Math.floor(Math.random()*state.pool.length)];}
export async function initMapPractice(){const root=$('#mapPracticeApp');if(!root)return;pick();render();}
async function render(){const root=$('#mapPracticeApp');if(!root)return;const mastered=(await db.all('map_progress')).filter(x=>x.mastered).length;root.innerHTML=`<div class="map-tools"><div><span class="lbl">MODE</span><div class="seg"><button class="btn ${state.mode==='learn'?'solid':''}" data-map-mode="learn">LEARN</button><button class="btn ${state.mode==='practice'?'solid':''}" data-map-mode="practice">PRACTICE</button><button class="btn ${state.mode==='test'?'solid':''}" data-map-mode="test">TEST</button></div></div><div class="map-stat"><span class="lbl">MASTERED</span><strong>${mastered}/${state.pool.length}</strong></div></div>${state.mode==='learn'?learn():practice()}`;
 root.querySelectorAll('[data-map-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mapMode;pick();render();});
 root.querySelectorAll('[data-map-answer]').forEach(b=>b.onclick=async()=>{const ok=b.dataset.mapAnswer===state.current.id;await save(state.current,ok);toast(ok?'Correct — location mastered.':'Not quite — review the clue and try again.');pick();render();});
}
function learn(){return `<div class="map-card"><span class="lbl">STARTER PRACTICE LOCATION</span><h3>${esc(state.current.name)}</h3><p>${esc(state.current.hint)}</p><small>This catalogue is practice content, not an official CBSE map list.</small></div>`;}
function practice(){const opts=[state.current,...state.pool.filter(x=>x.id!==state.current.id).sort(()=>Math.random()-.5).slice(0,3)].sort(()=>Math.random()-.5);return `<div class="map-card"><span class="lbl">IDENTIFY THE LOCATION</span><h3>${esc(state.current.category.toUpperCase())}</h3><p>Which location matches this clue?</p><strong>${esc(state.current.hint)}</strong><div class="map-options">${opts.map(o=>`<button class="btn" data-map-answer="${esc(o.id)}">${esc(o.name)}</button>`).join('')}</div></div>`;}
