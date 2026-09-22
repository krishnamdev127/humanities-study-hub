/* Records when a chapter was last studied / revised. Written by the syllabus ledger whenever a
   box is ticked or a revision round is logged. Failure here must never affect the ledger itself. */
import {db} from './db.js';
import {chapterId} from '../data/syllabus.js';

export async function touchChapter(subject,index,{revised=false}={}){
  try{
    const id=chapterId(subject,index);
    if(!id||!(await db.available()))return;
    const cur=await db.get('chapter_meta',id);
    const t=new Date().toISOString();
    const rec={id,subject,chapter_id:id,last_studied:t};
    const lastRev=revised?t:cur&&cur.last_revised;
    if(lastRev)rec.last_revised=lastRev;
    await db.put('chapter_meta',rec);
  }catch(e){console.warn("chapter_meta not saved:",e.message);}
}
