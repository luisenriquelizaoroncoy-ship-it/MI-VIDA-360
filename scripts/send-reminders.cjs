// MI VIDA 360 — recordatorios de pagos, agenda y compras.
// No publicar claves privadas: usar FIREBASE_SERVICE_ACCOUNT_JSON en GitHub Secrets.
'use strict';
const admin=require('firebase-admin');
let credential;
try { credential=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''); }
catch { console.error('Falta FIREBASE_SERVICE_ACCOUNT_JSON o su JSON es inválido.'); process.exit(1); }
if(credential.project_id!=='mi-vida-360-9b9ab'){
 console.error('Las credenciales no corresponden al proyecto MI VIDA 360.');process.exit(1);
}
admin.initializeApp({credential:admin.credential.cert(credential)});
const db=admin.firestore(),messaging=admin.messaging();
const manual=process.env.GITHUB_EVENT_NAME==='workflow_dispatch'&&process.env.MI360_RESPECT_TIME!=='true';
const {limaNow,deltaDays,collect,registeredTokens}=require('./reminder-rules.cjs');
async function removeExpired(ref,tokens,responses){
 const expired=tokens.filter((token,i)=>{
  const code=responses[i].error?.code;
  return code==='messaging/registration-token-not-registered'||code==='messaging/invalid-registration-token';
 });
 if(expired.length)await ref.update({pushTokens:admin.firestore.FieldValue.arrayRemove(...expired)});
 return expired.length;
}
async function sendTest(){
 // Esta prueba de mantenimiento es exclusiva de una instalación personal.
 const users=await db.collection('users').select('pushEnabled','pushTokens').limit(2).get();
 if(users.size!==1)throw new Error('La prueba requiere una única cuenta en esta instalación.');
 const tokens=registeredTokens(users.docs[0].data());
 if(!tokens.length)throw new Error('La cuenta todavía no tiene dispositivos registrados.');
 const result=await messaging.sendEachForMulticast({
  tokens,
  data:{
   owner:users.docs[0].id,
   title:'MI VIDA 360 · Aviso de prueba',
   body:'Tu prueba de Mi Vida 360 llegó. Toca para abrir tu agenda.'
  },
  webpush:{headers:{Urgency:'high',TTL:'900'}}
 });
 if(result.successCount)await users.docs[0].ref.update({'reminderStatus.sentAt':admin.firestore.FieldValue.serverTimestamp()});
 const codes=result.responses.filter(response=>!response.success)
  .map(response=>response.error?.code||'unknown');
 const removed=await removeExpired(users.docs[0].ref,tokens,result.responses);
 console.log(JSON.stringify({test:true,registered:tokens.length,accepted:result.successCount,failed:result.failureCount,removed,codes}));
 if(!result.successCount||result.failureCount>removed)process.exitCode=1;
}
async function run(){
 if(process.env.MI360_TEST_PUSH==='true')return sendTest();
 const now=limaNow(),users=await db.collection('users').get();
 let sent=0,failed=0,eligible=0;
 let unregistered=0,nothingDue=0,removed=0,validated=0;
 const deliveryErrors=new Map();
 function countError(error){
  const code=String(error?.code||'unknown');
  deliveryErrors.set(code,(deliveryErrors.get(code)||0)+1);
 }
 for(const user of users.docs){
  const record=user.data(),tokens=registeredTokens(record);
  const stamp=admin.firestore.FieldValue.serverTimestamp();
  const status={'reminderStatus.checkedAt':stamp};
  if(process.env.GITHUB_EVENT_NAME==='schedule')status['reminderStatus.scheduledAt']=stamp;
  await user.ref.update(status);
  if(!tokens.length){unregistered++;continue;}
  const old=record.sentReminders&&typeof record.sentReminders==='object'?record.sentReminders:{};
  const tasks=collect(record.data||{},old,now,manual);
  if(!tasks.length){
   nothingDue++;
   // Al desplegar el envío, valida los registros sin mostrar avisos de prueba.
   if(process.env.GITHUB_EVENT_NAME==='push'){
    const result=await messaging.sendEachForMulticast({tokens,data:{type:'validation'}},true);
    validated+=result.successCount;
    const expired=await removeExpired(user.ref,tokens,result.responses);
    removed+=expired;
    failed+=result.failureCount-expired;
    for(const response of result.responses)if(!response.success)countError(response.error);
   }
   continue;
  }
  eligible++;
  const count={};
  for(const task of tasks)count[task.type]=(count[task.type]||0)+1;
  const description=Object.entries(count).map(([type,n])=>n+' '+type+(n!==1?'(s)':'')).join(', ');
  try{
   const result=await messaging.sendEachForMulticast({
    tokens,
    data:{
     owner:user.id,
     title:'MI VIDA 360 · Tienes pendientes',
     body:description+'. Abre la app para revisarlos.',
     url:'https://luisenriquelizaoroncoy-ship-it.github.io/MI-VIDA-360/'
    },
    webpush:{headers:{Urgency:'normal',TTL:'86400'}}
   });
   if(result.successCount>0){
    const updated={};
    for(const [key,date] of Object.entries(old)){
     const age=deltaDays(date,now.date);
     if(Number.isFinite(age)&&age<=0&&age>=-45)updated[key]=date;
    }
    for(const task of tasks)updated[task.key]=now.date;
    await user.ref.update({sentReminders:updated,'reminderStatus.sentAt':stamp,'reminderStatus.sentBy':process.env.GITHUB_EVENT_NAME||'manual'});
    sent+=result.successCount;
   }
   failed+=result.failureCount;
   for(const response of result.responses){
    if(!response.success)countError(response.error);
   }
   removed+=await removeExpired(user.ref,tokens,result.responses);
  }catch(error){failed++;countError(error);}
 }
 console.log(JSON.stringify({date:now.date,minuteOfDay:now.minutes,manual,users:users.size,eligible,sent,skipped:unregistered+nothingDue,unregistered,nothingDue,validated,removed,failures:failed,deliveryErrors:Object.fromEntries(deliveryErrors)}));
 if(failed>0)process.exitCode=1;
}
run().catch(error=>{console.error('Error de recordatorios:',error.message);process.exitCode=1});
