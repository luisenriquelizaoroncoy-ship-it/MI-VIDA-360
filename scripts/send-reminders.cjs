// GitHub Actions: recordatorios seguros para MI VIDA 360.
// Requiere el secreto FIREBASE_SERVICE_ACCOUNT_JSON en GitHub Actions.
const admin = require('firebase-admin');
const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!credential) { console.error('Falta FIREBASE_SERVICE_ACCOUNT_JSON en GitHub Secrets.'); process.exit(1); }
let serviceAccount;
try { serviceAccount = JSON.parse(credential); } catch { console.error('No es JSON válido.'); process.exit(1); }
if (serviceAccount.project_id !== 'mi-vida-360-9b9ab') {
  console.error('Las credenciales no corresponden al proyecto MI VIDA 360.'); process.exit(1);
}
admin.initializeApp({credential:admin.credential.cert(serviceAccount)});
const db=admin.firestore(), messaging=admin.messaging();
function limaDate(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const p=type=>parts.find(x=>x.type===type)?.value;
 return p('year')+'-'+p('month')+'-'+p('day');
}
function utcDay(s){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return NaN;
 const [y,m,d]=s.split('-').map(Number), t=Date.UTC(y,m-1,d);
 if(new Date(t).toISOString().slice(0,10)!==s)return NaN;
 return t;
}
async function run(){
 const today=limaDate(), todayTime=utcDay(today), users=await db.collection('users').get();
 let sent=0,skipped=0,failures=0;
 for(const record of users.docs){
  const document=record.data();
  const payments=Array.isArray(document.data?.payments)?document.data.payments:[];
  const tokens=Array.isArray(document.pushTokens)?[...new Set(document.pushTokens.filter(x=>typeof x==='string'&&x))]:[];
  if(document.pushEnabled!==true||!tokens.length){skipped++;continue;}
  const old=document.sentReminders&&typeof document.sentReminders==='object'?document.sentReminders:{};
  const due=payments.filter(p=>{
   if(!p||p.paid||!p.id)return false;
   const days=(utcDay(p.due)-todayTime)/86400000;
   return [3,1,0].includes(days)&&!old[p.id+'_'+p.due+'_'+days];
  });
  if(!due.length){skipped++;continue;}
  try{
   const result=await messaging.sendEachForMulticast({
    tokens,
    data:{
     title:'MI VIDA 360 · Recordatorio',
     body:due.length===1?'Tienes un pago próximo o que vence hoy.':'Tienes '+due.length+' pagos que requieren atención.',
     url:'https://luisenriquelizaoroncoy-ship-it.github.io/MI-VIDA-360/'
    },
    webpush:{headers:{Urgency:'normal',TTL:'86400'}}
   });
   if(result.successCount){
    const next={};
    for(const p of due){const days=(utcDay(p.due)-todayTime)/86400000;next[p.id+'_'+p.due+'_'+days]=today;}
    for(const [key,date] of Object.entries(old)){
     const age=(todayTime-utcDay(date))/86400000;
     if(Number.isFinite(age)&&age>=0&&age<=45)next[key]=date;
    }
    await record.ref.set({sentReminders:next},{merge:true});
    sent+=result.successCount;
   }else failures++;
   const expired=result.responses.flatMap((r,i)=>{
    const code=r.error?.code||'';
    return !r.success&&(code.includes('registration-token-not-registered')||code.includes('invalid-registration-token'))?[tokens[i]]:[];
   });
   if(expired.length)await record.ref.update({pushTokens:admin.firestore.FieldValue.arrayRemove(...expired)});
  }catch(e){failures++;console.error('Error al notificar usuario',record.id,e.message);}
 }
 console.log(JSON.stringify({date:today,users:users.size,sent,skipped,failures}));
}
run().catch(e=>{console.error(e);process.exitCode=1});
