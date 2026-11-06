// MI VIDA 360 — reglas de recordatorios, sin conexiones externas ni escritura de datos.
'use strict';
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
// Recuperar la revisión de la mañana si el programador se retrasa; cada clave se envía una vez.
function isMorning(now,manual=false){return manual||(now.minutes>=9*60&&now.minutes<22*60);}
function collect(data,old,now,manual=false){
 const tasks=[];
 function add(key,type,priority){if(!old[key])tasks.push({key,type,priority});}
 const morning=isMorning(now,manual);
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
    // Se envía desde la hora elegida, en la siguiente revisión del mismo día.
    if(now.minutes>=scheduled)add('agenda_time_'+item.id+'_'+item.date+'_'+item.time,'actividad',0);
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
module.exports={limaNow,utcDay,deltaDays,appointmentMinutes,isMorning,collect,registeredTokens};
