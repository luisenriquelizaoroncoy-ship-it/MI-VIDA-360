'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {collect,deltaDays,appointmentMinutes,registeredTokens,limaNow}=require('../scripts/reminder-rules.cjs');
const empty=(v={})=>({payments:[],events:[],purchases:[],...v});
const clock=(date,hm)=>({date,minutes:Number(hm.slice(0,2))*60+Number(hm.slice(3))});
const keys=(data,now,old={},manual=false)=>collect(data,old,now,manual).map(item=>item.key);

test('Agenda con hora: avisa al llegar la hora y no antes',()=>{
 const event={id:'test-agenda',title:'Cita',date:'2026-11-06',time:'16:03',completed:false};
 const data=empty({events:[event]});
 const expected='agenda_time_test-agenda_2026-11-06_16:03';
 assert.equal(keys(data,clock('2026-11-06','16:02')).includes(expected),false);
 assert.equal(keys(data,clock('2026-11-06','16:04')).includes(expected),true);
 assert.equal(keys(data,clock('2026-11-06','16:04'),{[expected]:'2026-11-06'}).length,0);
 event.completed=true;
 assert.equal(keys(data,clock('2026-11-06','16:04')).length,0);
});

test('Agenda sin hora: aviso matutino y actividad del día siguiente',()=>{
 const event={id:'cita',date:'2026-11-07',completed:false};
 assert.deepEqual(keys(empty({events:[event]}),clock('2026-11-06','10:00')),['agenda_tomorrow_cita_2026-11-07']);
 assert.deepEqual(keys(empty({events:[event]}),clock('2026-11-07','10:00')),['agenda_today_cita_2026-11-07']);
});

test('Pago impago: tres días, uno, vencimiento y atraso; pagado: ninguno',()=>{
 const payment={id:'cuota',due:'2026-11-09',paid:false,amount:90};
 assert.ok(keys(empty({payments:[payment]}),clock('2026-11-06','10:00')).includes('pay_cuota_2026-11-09_3'));
 assert.ok(keys(empty({payments:[payment]}),clock('2026-11-08','10:00')).includes('pay_cuota_2026-11-09_1'));
 assert.ok(keys(empty({payments:[payment]}),clock('2026-11-09','10:00')).includes('pay_cuota_2026-11-09_0'));
 assert.ok(keys(empty({payments:[payment]}),clock('2026-11-10','10:00')).includes('pay_overdue_cuota_2026-11-10'));
 payment.paid=true;
 assert.deepEqual(keys(empty({payments:[payment]}),clock('2026-11-10','10:00')),[]);
});

test('Compras: vencimientos y compras sin fecha una vez el domingo',()=>{
 const purchase={id:'compra',due:'2026-11-09',bought:false};
 assert.ok(keys(empty({purchases:[purchase]}),clock('2026-11-06','09:00')).includes('buy_compra_2026-11-09_3'));
 purchase.bought=true;
 assert.deepEqual(keys(empty({purchases:[purchase]}),clock('2026-11-06','09:00')),[]);
 const undated={id:'p-sinfecha',bought:false};
 assert.deepEqual(keys(empty({purchases:[undated]}),clock('2026-11-08','11:00')),['weekly_purchases_2026-11-08']);
 assert.deepEqual(keys(empty({purchases:[undated]}),clock('2026-11-09','11:00')),[]);
});

test('Identificadores inválidos y avisos no registrados no producen falsos positivos',()=>{
 assert.equal(Number.isNaN(deltaDays('2026-02-30','2026-11-06')),true);
 assert.equal(appointmentMinutes('25:03'),null);
 assert.deepEqual(registeredTokens({pushEnabled:false,pushTokens:['A'.repeat(30)]}),[]);
 assert.deepEqual(registeredTokens({pushEnabled:true,pushTokens:['A'.repeat(30),'A'.repeat(30),'x']}),['A'.repeat(30)]);
});

test('El programador conserva su cadencia de 15 minutos sin acceso a datos reales',()=>{
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/reminders.yml'),'utf8');
 assert.match(workflow,/cron:\s*['"]3,18,33,48 \* \* \* \*['"]/);
 assert.match(workflow,/node scripts\/send-reminders\.cjs/);
 const time=limaNow();
 assert.match(time.date,/^\d{4}-\d\d-\d\d$/);
 assert.ok(time.minutes>=0&&time.minutes<1440);
});
