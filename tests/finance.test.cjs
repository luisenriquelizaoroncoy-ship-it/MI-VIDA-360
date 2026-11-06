const test = require('node:test');
const assert = require('node:assert/strict');
require('../finance.js');
const { untilPayday, settle } = globalThis.MI360Finance;

test('Disponible incluye arrastre y vencidos y excluye movimientos futuros y vencimientos del día de cobro', () => {
  const data = {movements:[
    {date:'2026-10-31',type:'ingreso',amount:900},
    {date:'2026-11-01',type:'gasto',amount:100},
    {date:'2026-11-24',type:'ingreso',amount:1500}
  ], payments:[
    {due:'2026-11-02',amount:100},{due:'2026-11-23',amount:250},
    {due:'2026-11-24',amount:200},{due:'2026-11-05',amount:90,paid:true}
  ]};
  assert.deepEqual(untilPayday(data,'2026-11-06'),{payday:'2026-11-24',balance:800,reserved:350,available:450});
  assert.equal(untilPayday(data,'2026-12-24').payday,'2027-01-24');
});
test('Registrar un gasto es idempotente y deshacer conserva los gastos manuales', () => {
  const data={payments:[{id:'recibo',amount:90,title:'Luz',due:'2026-11-08'}],movements:[{id:'previo',type:'gasto',amount:5}]};
  assert.ok(settle(data,'recibo','expense','2026-11-06'));
  assert.equal(settle(data,'recibo','expense','2026-11-06'),false);
  assert.equal(data.movements.length,2);
  assert.equal(data.payments[0].paidAt,'2026-11-06');
  assert.ok(settle(data,'recibo','reopen','2026-11-06'));
  assert.deepEqual(data.movements.map(m=>m.id),['previo']);
  assert.ok(settle(data,'recibo','mark','2026-11-06'));
  assert.equal(data.movements.length,1);
});
