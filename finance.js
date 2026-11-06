(function () {
  'use strict';
  const cents = value => Math.round((Number(value) || 0) * 100);

  function untilPayday(data, today) {
    const [year, month, day] = today.split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1 + Number(day >= 24), 24));
    const payday = next.toISOString().slice(0, 10);
    let balance = 0;
    let reserved = 0;
    for (const entry of data.movements) {
      if (!entry.date || entry.date > today) continue;
      if (entry.type === 'ingreso') balance += cents(entry.amount);
      if (entry.type === 'gasto') balance -= cents(entry.amount);
    }
    for (const bill of data.payments) {
      if (!bill.paid && bill.due && bill.due < payday) reserved += cents(bill.amount);
    }
    return { payday, balance: balance / 100, reserved: reserved / 100, available: (balance - reserved) / 100 };
  }

  // Ambos cambios forman una sola operación. Solamente se deshace el gasto generado por este pago.
  function settle(data, paymentId, action, date) {
    const bill = data.payments.find(item => item.id === paymentId);
    if (!bill) return false;
    const linked = data.movements.findIndex(item => item.paymentId === paymentId);
    if (action === 'reopen') {
      if (!bill.paid) return false;
      if (linked !== -1) data.movements.splice(linked, 1);
      delete bill.paidAt;
      bill.paid = false;
      return true;
    }
    if (bill.paid || !['expense', 'mark'].includes(action)) return false;
    if (action === 'expense' && linked === -1) {
      data.movements.push({id: 'payment-' + paymentId, paymentId, type: 'gasto',
        title: bill.title, amount: bill.amount, category: 'Otros', date});
    }
    bill.paid = true;
    bill.paidAt = date;
    return true;
  }

  globalThis.MI360Finance = { untilPayday, settle };
})();
