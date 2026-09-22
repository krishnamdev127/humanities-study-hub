/* Profile: cloud sign-in panel + export / import / reset of the ledger record. Behaviour unchanged. */
import {getState,setState,init,persist,normalizeState,getExamDate,setExamDate} from '../../services/tracker.js';
import {cloud,signIn,signOut} from '../../services/cloud.js';
import {$,pad,toast,askConfirm} from '../../utils/dom.js';
import {db} from '../../services/db.js';

export function updateAuthUI(){
  const dot=$('#cdot'),st=$('#cloudStatus'),hint=$('#cloudHint'),li=$('#signInBtn'),lo=$('#signOutBtn');
  if(!st)return;
  if(!cloud.client){
    dot.className='cdot';st.textContent='NOT CONNECTED';
    hint.textContent='Add your Supabase URL and anon key to sync this ledger across devices with Google sign-in. Everything works locally meanwhile.';
    li.classList.remove('hidden');$('#signInTxt').textContent='SETUP REQUIRED';
    lo.classList.add('hidden');
  }else if(cloud.user){
    dot.className='cdot on';st.textContent='SYNC ACTIVE';
    hint.textContent='Signed in as '+(cloud.user.email||'your account')+' — every tick syncs to your cloud record.';
    li.classList.add('hidden');lo.classList.remove('hidden');
  }else{
    dot.className='cdot idle';st.textContent='LOCAL ONLY';
    hint.textContent='Sign in with Google to keep a cloud copy of this ledger across all your devices.';
    li.classList.remove('hidden');$('#signInTxt').textContent='SIGN IN — GOOGLE';
    lo.classList.add('hidden');
  }
}

function doExport(){
  const payload={app:'class12-humanities-ledger',exportedAt:new Date().toISOString(),
    state:getState(),examDate:getExamDate()||null};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'),d=new Date();
  a.download=`class12-humanities-ledger-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}.json`;
  a.href=URL.createObjectURL(blob);a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('Ledger exported — check your downloads');
}

function doReset(){
  /* Only the tick/revision record is reset. When study data exists (later steps) this dialog and
     handler must say so and offer to clear it separately. */
  setState({});init();persist({enter:true});
  toast('Record reset — every tick and revision cleared');
}

async function enableNotifications(){
  if(!('Notification' in window)){toast('Notifications are not supported in this browser');return;}
  const permission=await Notification.requestPermission();
  if(permission==='granted'){await db.put('settings',{id:'notifications_enabled',value:true});toast('Browser reminders enabled — you can disable them in browser settings');}
  else toast('Notification permission was not granted');
}

export function initProfile(){
  $('#enableNotifications')?.addEventListener('click',enableNotifications);
  $('#signInBtn').addEventListener('click',async()=>{
    if(!cloud.client){toast('Cloud sync isn\u2019t configured yet — add your Supabase keys first');return;}
    await signIn();
  });
  $('#signOutBtn').addEventListener('click',async()=>{
    await signOut();
    toast('Signed out — your local progress stays on this device');
  });
  $('#fileInput').addEventListener('change',async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    try{
      const parsed=JSON.parse(await f.text());
      const norm=normalizeState(parsed);
      setState(norm);
      if(parsed&&parsed.examDate&&/^\d{4}-\d{2}-\d{2}$/.test(parsed.examDate))setExamDate(parsed.examDate);
      init();persist({enter:true});
      toast('Data imported — every tick and revision restored');
    }catch(err){toast('That file doesn\u2019t look like a ledger export');}
  });
  $('#app').addEventListener('click',e=>{
    const a=e.target.closest('[data-act]');if(!a)return;
    const act=a.dataset.act;
    if(act==='export')doExport();
    else if(act==='import')$('#fileInput').click();
    else if(act==='reset')askConfirm('RESET RECORD',
      'This clears every tick and revision round on this device, and replaces the cloud copy if you\u2019re signed in. Export first if you want a backup.',
      'RESET',doReset);
  });
}
