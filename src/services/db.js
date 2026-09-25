/* Local-first database on IndexedDB. Built for offline use and for syncing later:
   - every write is validated against data/schema.js,
   - records carry id / created_at / updated_at, deletes are soft (deleted_at) so they can sync,
   - every write also appends to an `outbox` in the SAME transaction — the future sync worker just
     drains it, so nothing done offline is ever lost.
   If IndexedDB is unavailable (some private modes) `db.available` is false and the tracker keeps
   working on LocalStorage alone. */
import {COLLECTIONS,SCHEMA_VERSION,validate} from '../data/schema.js';

const DB_NAME="humanities-hub";
const META="_meta", OUTBOX="_outbox";
const now=()=>new Date().toISOString();
const uuid=()=>globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():
  "id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);

let dbp=null;
const listeners=new Map();
let channel=null;

const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const txDone=tx=>new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error("transaction aborted"));});

/* Migrations. Each entry upgrades from (index) to (index+1). Add new entries; never edit old ones. */
const MIGRATIONS=[
  function v1(idb){
    idb.createObjectStore(META,{keyPath:"key"});
    idb.createObjectStore(OUTBOX,{keyPath:"seq",autoIncrement:true});
    for(const [name,spec] of Object.entries(COLLECTIONS)){
      const store=idb.createObjectStore(name,{keyPath:"id"});
      store.createIndex("updated_at","updated_at");
      for(const ix of spec.indexes||[]){
        if(typeof ix==="string")store.createIndex(ix,ix);
        else store.createIndex(ix.name,ix.path,{multiEntry:!!ix.multiEntry});
      }
    }
  },
  function v2(idb,tx){
    const store=tx.objectStore("questions");
    if(!store.indexNames.contains("topic_id"))store.createIndex("topic_id","topic_id");
  }
];
if(MIGRATIONS.length!==SCHEMA_VERSION)throw new Error("SCHEMA_VERSION and MIGRATIONS are out of step");

export function open(){
  if(dbp)return dbp;
  dbp=new Promise((resolve,reject)=>{
    if(typeof indexedDB==="undefined"){reject(new Error("IndexedDB unavailable"));return;}
    const r=indexedDB.open(DB_NAME,SCHEMA_VERSION);
    r.onupgradeneeded=e=>{for(let v=e.oldVersion;v<SCHEMA_VERSION;v++)MIGRATIONS[v](r.result,r.transaction);};
    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
    r.onblocked=()=>reject(new Error("database upgrade blocked by another tab"));
  }).then(async idb=>{
    idb.onversionchange=()=>idb.close();
    const m=await getMeta(idb,"device_id");
    if(!m)await setMeta(idb,"device_id",uuid());
    try{channel=new BroadcastChannel("humanities-hub");channel.onmessage=e=>notify(e.data.collection,true);channel.unref?.();}catch{}
    return idb;
  });
  dbp.catch(()=>{});
  return dbp;
}
async function getMeta(idb,key){const r=await req(idb.transaction(META).objectStore(META).get(key));return r?r.value:undefined;}
async function setMeta(idb,key,value){const tx=idb.transaction(META,"readwrite");tx.objectStore(META).put({key,value});return txDone(tx);}

function notify(collection,remote){
  (listeners.get(collection)||[]).forEach(fn=>{try{fn({collection,remote:!!remote})}catch(e){console.error(e)}});
  (listeners.get("*")||[]).forEach(fn=>{try{fn({collection,remote:!!remote})}catch(e){console.error(e)}});
  if(!remote&&channel)try{channel.postMessage({collection})}catch{}
}
const live=rows=>rows.filter(r=>!r.deleted_at);

export const db={
  open,
  async available(){try{await open();return true}catch{return false}},
  async deviceId(){return getMeta(await open(),"device_id");},

  /* Create or replace one record. Pass an id to update; omit it to create. */
  async put(collection,input){
    const idb=await open();
    const id=input.id||uuid();
    const tx=idb.transaction([collection,OUTBOX],"readwrite");
    const store=tx.objectStore(collection);
    const prev=await req(store.get(id));
    const t=now();
    const rec={...input,id,created_at:prev?prev.created_at:(input.created_at||t),updated_at:t};
    delete rec.deleted_at;
    validate(collection,rec);   /* throws ValidationError before anything is written */
    store.put(rec);
    tx.objectStore(OUTBOX).add({collection,id,op:"put",at:t});
    await txDone(tx);
    notify(collection);
    return rec;
  },

  /* Merge changes into an existing record. */
  async update(collection,id,patch){
    const cur=await this.get(collection,id);
    if(!cur)throw new Error(`${collection}/${id} not found`);
    return this.put(collection,{...cur,...patch,id});
  },

  async get(collection,id){
    const idb=await open();
    const r=await req(idb.transaction(collection).objectStore(collection).get(id));
    return r&&!r.deleted_at?r:undefined;
  },

  async all(collection,{includeDeleted=false}={}){
    const idb=await open();
    const rows=await req(idb.transaction(collection).objectStore(collection).getAll());
    return includeDeleted?rows:live(rows);
  },

  /* by: index name. value: exact key, or {gte,lte} for a range. */
  async query(collection,by,value){
    const idb=await open();
    const ix=idb.transaction(collection).objectStore(collection).index(by);
    const range=value&&typeof value==="object"&&!Array.isArray(value)
      ?(value.gte!==undefined&&value.lte!==undefined?IDBKeyRange.bound(value.gte,value.lte)
        :value.gte!==undefined?IDBKeyRange.lowerBound(value.gte):IDBKeyRange.upperBound(value.lte))
      :IDBKeyRange.only(value);
    return live(await req(ix.getAll(range)));
  },

  async count(collection){return(await this.all(collection)).length;},

  /* Soft delete: keeps a tombstone so the deletion can sync. */
  async remove(collection,id){
    const idb=await open();
    const tx=idb.transaction([collection,OUTBOX],"readwrite");
    const store=tx.objectStore(collection);
    const rec=await req(store.get(id));
    if(!rec||rec.deleted_at){tx.abort?.();return false;}
    const t=now();
    store.put({...rec,deleted_at:t,updated_at:t});
    tx.objectStore(OUTBOX).add({collection,id,op:"delete",at:t});
    await txDone(tx);
    notify(collection);
    return true;
  },

  /* ---- sync hooks (used by the cloud step later) ---- */
  async outbox(){const idb=await open();return req(idb.transaction(OUTBOX).objectStore(OUTBOX).getAll());},
  async ackOutbox(upToSeq){
    const idb=await open();const tx=idb.transaction(OUTBOX,"readwrite");
    tx.objectStore(OUTBOX).delete(IDBKeyRange.upperBound(upToSeq));return txDone(tx);
  },
  /* Insert a record that came from the cloud, keeping the newer copy. Does not enter the outbox. */
  async applyRemote(collection,rec){
    const idb=await open();const tx=idb.transaction(collection,"readwrite");const store=tx.objectStore(collection);
    const cur=await req(store.get(rec.id));
    if(cur&&cur.updated_at>=rec.updated_at){await txDone(tx);return false;}
    store.put(rec);await txDone(tx);notify(collection);return true;
  },

  /* ---- backup ---- */
  async exportAll(){
    const out={app:"humanities-hub",schema:SCHEMA_VERSION,exportedAt:now(),collections:{}};
    for(const c of Object.keys(COLLECTIONS))out.collections[c]=await this.all(c,{includeDeleted:true});
    return out;
  },
  async importAll(dump,{merge=true}={}){
    if(!dump||dump.app!=="humanities-hub"||typeof dump.collections!=="object")throw new Error("Not a Study Hub backup");
    const idb=await open();let n=0;
    for(const [c,rows] of Object.entries(dump.collections)){
      if(!COLLECTIONS[c]||!Array.isArray(rows))continue;
      for(const rec of rows){
        try{validate(c,rec)}catch{continue}     /* skip anything that doesn't fit the schema */
        const tx=idb.transaction(c,"readwrite");const store=tx.objectStore(c);
        const cur=await req(store.get(rec.id));
        if(!merge||!cur||cur.updated_at<rec.updated_at){store.put(rec);n++;}
        await txDone(tx);
      }
      notify(c);
    }
    return n;
  },
  async clearAll(){
    const idb=await open();
    const names=[...Object.keys(COLLECTIONS),OUTBOX];
    const tx=idb.transaction(names,"readwrite");
    names.forEach(n=>tx.objectStore(n).clear());
    await txDone(tx);
    Object.keys(COLLECTIONS).forEach(c=>notify(c));
  },

  subscribe(collection,fn){
    (listeners.get(collection)||listeners.set(collection,new Set()).get(collection)).add(fn);
    return()=>listeners.get(collection)?.delete(fn);
  },
  newId:uuid
};
