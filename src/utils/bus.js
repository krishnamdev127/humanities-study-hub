/* Minimal event bus so modules don't import each other in circles. */
const map=new Map();
export const bus={
  on(evt,fn){(map.get(evt)||map.set(evt,new Set()).get(evt)).add(fn);return()=>map.get(evt)?.delete(fn);},
  emit(evt,payload){(map.get(evt)||[]).forEach(fn=>{try{fn(payload)}catch(e){console.error("[bus:"+evt+"]",e)}});}
};
