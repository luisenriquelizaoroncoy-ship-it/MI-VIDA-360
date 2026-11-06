const admin = require('firebase-admin');
const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if(credential.project_id!=='mi-vida-360-9b9ab')throw Error('Proyecto incorrecto');
const identity = admin.credential.cert(credential);
admin.initializeApp({credential:identity});
const db = admin.firestore();
const sleep = ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function checkKeys(){
 try{
  const auth=await identity.getAccessToken();
  const url='https://iam.googleapis.com/v1/projects/-/serviceAccounts/'+encodeURIComponent(credential.client_email)+'/keys?keyTypes=USER_MANAGED';
  const res=await fetch(url,{headers:{Authorization:'Bearer '+auth.access_token},signal:AbortSignal.timeout(8000)});
  if(!res.ok){console.log('KEY_REVIEW unavailable '+res.status);return}
  const active=((await res.json()).keys||[]).filter(k=>!k.disabled&&new Date(k.validBeforeTime)>new Date());
  const current=active.find(k=>k.name.endsWith('/'+credential.private_key_id));
  const cutoff=Date.parse('2026-11-06T19:36:00Z');
  console.log('KEY_REVIEW '+JSON.stringify({active:active.length,older:active.filter(k=>Date.parse(k.validAfterTime)<=cutoff).length,currentAfter:current?Date.parse(current.validAfterTime)>cutoff:null}));
 }catch{console.log('KEY_REVIEW unavailable')}
}
async function run(){
 await checkKeys();
 const accounts=await db.collection('users').select('pushEnabled','pushTokens').limit(2).get();
 if(accounts.size!==1||!accounts.docs[0].data().pushEnabled||!accounts.docs[0].data().pushTokens?.length)throw Error('Se requiere la cuenta única con avisos activos');
 const ref=accounts.docs[0].ref;
 const target=new Date(Math.ceil((Date.now()+90000)/60000)*60000);
 const local=new Date(target.getTime()-5*3600000).toISOString();
 const event={id:'mi360-prueba-'+process.env.GITHUB_RUN_ID,title:'Prueba de agenda automática',category:'Personal',date:local.slice(0,10),time:local.slice(11,16),completed:false};
 const key='agenda_time_'+event.id+'_'+event.date+'_'+event.time;
 const fv=admin.firestore.FieldValue;
 await ref.update({'data.events':fv.arrayUnion(event)});
 console.log('AGENDA_PROGRAMADA '+event.date+' '+event.time+' Lima');
 try{
  const read=async()=>(await db.getAll(ref,{fieldMask:['sentReminders','reminderStatus']}))[0].data();
  // El cron normal tiene prioridad. Si se retrasa, una ejecución en cola comprueba el mismo vencimiento.
  let dispatched=false;
  const deadline=target.getTime()+12*60000;
  while(Date.now()<deadline){
   const data=await read();
   if(data.sentReminders?.[key]){
    const status=data.reminderStatus||{};
    const sent=status.sentAt?.toMillis?.()||0;
    console.log('AGENDA_ENVIADA '+JSON.stringify({cron:status.sentBy==='schedule',acceptedAt:sent?new Date(sent).toISOString():null}));
    return;
   }
   if(!dispatched&&Date.now()>target.getTime()+75000){
    const {execFileSync}=require('node:child_process');
    execFileSync('gh',['workflow','run','reminders.yml','--ref','main','-f','revisar_hora=true'],{stdio:'ignore',env:{...process.env,FIREBASE_SERVICE_ACCOUNT_JSON:''}});
    dispatched=true;console.log('REVISION_PROGRAMADA activada por temporizador');
   }
   await sleep(10000);
  }
  throw Error('Todavía no se confirmó el envío de la agenda');
 }finally{
  await ref.update({'data.events':fv.arrayRemove(event)});
  console.log('AGENDA_TEMPORAL retirada');
 }
}
run().catch(e=>{console.error('Verificación: '+(e.code||e.message));process.exitCode=1});
