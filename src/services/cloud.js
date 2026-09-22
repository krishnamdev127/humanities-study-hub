/* Local-first cloud sync.
   Existing tracker_data(user_id, data jsonb, exam_date, updated_at) remains the only Supabase table.
   New Study Hub collections are packed under data.hub, so no new table is required for this phase.
   Local IndexedDB is authoritative while offline; sync merges records by updated_at. */
import {getState,setState,normalizeState,init,EXAMKEY,getExamDate} from './tracker.js';
import {bus} from '../utils/bus.js';
import {db} from './db.js';

const SUPABASE_URL="https://ueyhqynqxdfegzyagjsv.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_g1hbrrIjb5IL5gUVxcfE1Q_I868oMFq";
function configured(){return SUPABASE_URL.startsWith("https://")&&SUPABASE_ANON_KEY&&!SUPABASE_ANON_KEY.includes("PASTE_YOUR")}
let client=null,user=null;
if(configured()&&window.supabase)client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
export const cloud={get client(){return client},get user(){return user}};
let syncT=null,syncState="local",syncBusy=false;
function setSyncState(state){syncState=state;bus.emit("cloud:sync",{state});}
export function getSyncState(){return syncState;}

async function localPayload(){
  const collections={};
  for(const c of Object.keys((await import('../data/schema.js')).COLLECTIONS)) collections[c]=await db.all(c,{includeDeleted:true});
  return {tracker:getState(),exam_date:getExamDate()||null,hub:{schema:1,collections}};
}
async function mergeCloudPayload(payload){
  if(!payload)return;
  const tracker=payload.tracker||payload; // backwards compatible with old tracker_data rows
  if(tracker) { setState(normalizeState(tracker)); init(); }
  if(payload.exam_date)localStorage.setItem(EXAMKEY,payload.exam_date);
  const hub=payload.hub?.collections;
  if(!hub)return;
  for(const [collection,rows] of Object.entries(hub)){
    if(!Array.isArray(rows))continue;
    for(const rec of rows){try{await db.applyRemote(collection,rec)}catch(e){console.warn('Remote record skipped',collection,e)}}
  }
  bus.emit('study:changed');
}

async function fetchCloud(){
  const {data,error}=await client.from("tracker_data").select("data, exam_date, updated_at").eq("user_id",user.id).maybeSingle();
  if(error)throw error;
  return data;
}
async function writeCloud(payload){
  const {error}=await client.from("tracker_data").upsert({user_id:user.id,data:payload,exam_date:payload.exam_date||null,updated_at:new Date().toISOString()});
  if(error)throw error;
}

export async function syncCloud({force=false}={}){
  if(!client||!user){setSyncState("local");return false;}
  if(syncBusy&&!force)return false;
  setSyncState("syncing");syncBusy=true;
  try{
    const local=await localPayload();
    const remote=await fetchCloud();
    if(remote?.data){
      await mergeCloudPayload(remote.data);
      /* Re-read local after merge, then upload it. This preserves newer local records and
         fills the cloud with collections that did not exist in the old tracker row. */
    }
    const merged=await localPayload();
    await writeCloud(merged);
    await db.ackOutbox((await db.outbox()).at(-1)?.seq||0);
    setSyncState("synced");return true;
  }catch(e){console.error("Cloud sync error:",e);setSyncState(navigator.onLine?"local":"offline");return false}
  finally{syncBusy=false}
}

export async function initCloud(){
  bus.on('tracker:saved',()=>{clearTimeout(syncT);syncT=setTimeout(()=>syncCloud(),500)});
  bus.on('study:changed',()=>{clearTimeout(syncT);syncT=setTimeout(()=>syncCloud(),700)});
  window.addEventListener('online',()=>{if(user)syncCloud()});
  window.addEventListener('offline',()=>setSyncState('offline'));
  if(!client){setSyncState(navigator.onLine?'local':'offline');bus.emit('cloud:auth');return;}
  const {data}=await client.auth.getSession();user=data.session?data.session.user:null;
  client.auth.onAuthStateChange(async(_event,session)=>{
    const was=!!user;user=session?session.user:null;
    if(user){await syncCloud({force:true});if(!was)bus.emit('cloud:signedin');}
    else setSyncState(navigator.onLine?'local':'offline');
    bus.emit('cloud:auth');
  });
  if(user)await syncCloud({force:true}); else setSyncState(navigator.onLine?'local':'offline');
  bus.emit('cloud:auth');
}
export async function signIn(){if(!client)return false;await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});return true}
export async function signOut(){if(client)await client.auth.signOut()}
