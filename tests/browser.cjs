const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');

(async function () {
  const browser = await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  try {
    for (const width of [320,390,1280]) {
      const context = await browser.newContext({viewport:{width,height:844},timezoneId:'America/Lima'});
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-11-06T20:00:00Z'));
      await page.route('https://www.gstatic.com/**', route=>route.abort());
      await page.addInitScript(() => {
        localStorage.setItem('mivida360_mobile_v1',JSON.stringify({
          movements:[{id:'salary',type:'ingreso',amount:800,date:'2026-10-31',title:'Sueldo',category:'Sueldo'}],
          payments:[{id:'bill',amount:350,due:'2026-11-20',title:'Cuota',paid:false}],events:[],purchases:[],goals:[]
        }));
      });
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog', dialog=>dialog.accept());
      await page.goto('http://localhost:4173/');
      await page.locator('[data-auth-ui=local]').click();
      const money = () => page.locator('.payday .available').innerText();
      assert.match(await money(),/450[.,]00/);
      await page.locator('#nav [data-tab=pagos]').click();
      await page.getByRole('button',{name:'Pagar y registrar gasto'}).click();
      assert.equal(await page.getByText('Gasto registrado',{exact:false}).count(),1);
      const read = () => page.evaluate(()=>JSON.parse(localStorage.getItem('mivida360_mobile_v1')));
      assert.equal((await read()).movements.length,2);
      await page.getByRole('button',{name:'Volver a pendiente'}).click();
      assert.equal((await read()).movements.length,1);
      await page.getByRole('button',{name:'Solo marcar pagado'}).click();
      assert.equal((await read()).movements.length,1);
      await page.locator('#nav [data-tab=inicio]').click();
      assert.match(await money(),/800[.,]00/);
      await page.locator('#settingsBtn').click();
      assert.equal(await page.locator('[data-action=push]').count(),0);
      await page.locator('[data-action=account]').click();
      assert.ok(await page.locator('[data-auth-ui=local]').isVisible());
      await page.evaluate(async()=>{
        await window.MI360App.cloudSignedIn({uid:'mock',email:'prueba@example.invalid'},
          {movements:[],payments:[],purchases:[],goals:[],events:[]},{exists:true});
      });
      await page.locator('#settingsBtn').click();
      await page.evaluate(()=>window.MI360App.cloudStatus({checkedAt:{toDate:()=>new Date('2026-11-06T20:00:00Z')}}));
      assert.equal(await page.locator('#reminderStatus dd').count(),3);
      assert.doesNotMatch(await page.locator('#reminderStatus dd').first().innerText(),/Pendiente/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]);
      await context.close();
      console.log('Flujo de pagos, cuenta y avisos verificado en '+width+' px.');
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
