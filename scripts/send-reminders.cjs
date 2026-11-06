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
const manual=process.env.GITHUB_EVENT_NAME==='workflow_dispatch';
function limaNow(){
 const parts=new Intl.DateTimeFormat('en-GB',{
  timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(new Date());
 const p=type=>parts.find(x=>x.type===type)?.value;
 return {date:p('year')+'-'+p('month')+'-'+p('day'),minutes:Number(p('hour'))*60+Number(p('minute'))};
}
function utcDay(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return NaN;
 const parts=s.split('-').map(Number);
 const t=Date.UTC(parts[0],parts[1]-1,parts[2]);
 return new Date(t).toISOString().slice(0,10)===s?t:NaN;
}
function deltaDays(d,today){
 const stamp=utcDay(d);
 return Number.isFinite(stamp)?(stamp-utcDay(today))/86400000:NaN;
}
function appointmentMinutes(s){
 if(!/^\d\d:\d\d$/.test(s||''))return null;
 const [h,m]=s.split(':').map(Number);
 return h<24&&m<60?h*60+m:null;
}
function isMorning(now){return manual||(now.minutes>=9*60&&now.minutes<10*60);}
function collect(data,old,now){
 const tasks=[];
 function add(key,type,priority){if(!old[key])tasks.push({key,type,priority});}
 const morning=isMorning(now);
 for(const p of Array.isArray(data.payments)?data.payments:[]){
  if(!p||p.paid||!p.id)continue;
  const days=deltaDays(p.due,now.date);
  if(!Number.isFinite(days)||!morning)continue;
  if([3,1,0].includes(days))add('pay_'+p.id+'_'+p.due+'_'+days,'pago',days===0?0:1);
  if(days<0)add('pay_overdue_'+p.id+'_'+now.date,'pago vencido',0);
 }
 for(const item of Array.isArray(data.events)?data.events:[]){
  if(!item||!item.id||item.completed)continue;
  const days=deltaDays(item.date,now.date);
  if(!Number.isFinite(days))continue;
  const scheduled=appointmentMinutes(item.time);
  if(days===1&&morning)add('agenda_tomorrow_'+item.id+'_'+item.date,'actividad',1);
  if(days===0){
   if(scheduled===null){
    if(morning)add('agenda_today_'+item.id+'_'+item.date,'actividad',0);
   } else {
    // Con el margen de 30 minutos previos y 90 posteriores se toleran retrasos de Actions.
    const difference=scheduled-now.minutes;
    if(difference<=30&&difference>=-90)add('agenda_time_'+item.id+'_'+item.date+'_'+item.time,'actividad',0);
   }
  }
  if(days<0&&days>=-7&&morning)add('agenda_overdue_'+item.id+'_'+now.date,'actividad pendiente',0);
 }
 let genericPurchases=0;
 for(const item of Array.isArray(data.purchases)?data.purchases:[]){
  if(!item||!item.id||item.bought)continue;
  if(!item.due){genericPurchases++;continue;}
  const days=deltaDays(item.due,now.date);
  if(!Number.isFinite(days)||!morning)continue;
  if([3,1,0].includes(days))add('buy_'+item.id+'_'+item.due+'_'+days,'compra pendiente',days===0?0:1);
  if(days<0)add('buy_overdue_'+item.id+'_'+now.date,'compra atrasada',0);
 }
 // Los pendientes sin fecha se resumen una vez por semana, sin avisos diarios.
 const sunday=new Date(utcDay(now.date)).getUTCDay()===0;
 if(genericPurchases&&(sunday||manual)&&morning)add('weekly_purchases_'+now.date,'compra pendiente',2);
 return tasks.sort((a,b)=>a.priority-b.priority);
}
function registeredTokens(record){
 if(record.pushEnabled!==true||!Array.isArray(record.pushTokens))return [];
 return [...new Set(record.pushTokens.filter(token=>typeof token==='string'&&token.length>20))];
}
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
   title:'MI VIDA 360 · Aviso de prueba',
   body:'Tu prueba de Mi Vida 360 llegó. Toca para abrir tu agenda.'
  },
  webpush:{headers:{Urgency:'high',TTL:'900'}}
 });
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
  if(!tokens.length){unregistered++;continue;}
  const old=record.sentReminders&&typeof record.sentReminders==='object'?record.sentReminders:{};
  const tasks=collect(record.data||{},old,now);
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
    await user.ref.set({sentReminders:updated},{merge:true});
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
