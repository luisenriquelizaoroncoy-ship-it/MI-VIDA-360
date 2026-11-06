const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../firebase-cloud.js'),'utf8').replace(/^import\s+(?:[^;]*?\s+from\s+)?'[^']+';/gm,'');
test('Salir de una cuenta anterior retira solamente el token de este dispositivo',async()=>{
 const records=[];
 const uid='persona-a',token='token-anterior',user={uid};
 const registration={pushManager:{getSubscription:async()=>({unsubscribe:async()=>{records.push('unsubscribe');return true}})}, getNotifications:async()=>[]};
 const ctx={firebaseConfig:{},webPushVapidKey:'public',initializeApp(){},getAuth:()=>({currentUser:user}),getFirestore(){},
  window:{Notification:{permission:'granted'},caches:{}},crypto:{},onAuthStateChanged(){},navigator:{onLine:true,serviceWorker:{getRegistration:async()=>registration}},
  MI360Device:{bind:async id=>records.push(['bind',id])},localStorage:{getItem:()=>null,removeItem(){}},
  getMessaging(){},getToken:async()=>token,doc:(db,collection,id)=>id,arrayRemove:t=>[t],
  setDoc:async(target,patch)=>records.push([target,patch]),signOut:async()=>records.push('logout')};
 vm.runInNewContext(source,ctx);
 await ctx.window.MI360Cloud.logout();
 assert.deepEqual(JSON.parse(JSON.stringify(records)),[['bind',null],'unsubscribe',[uid,{pushTokens:[token]}],'logout']);
});
test('El worker respeta la cuenta del dispositivo y la salida explícita, y admite registros anteriores',async()=>{
 let binding=null,displayed=0;
 const listeners={};
 const ctx={importScripts(){},self:{addEventListener:(name,fn)=>listeners[name]=fn,registration:{scope:'https://example.test/app/',showNotification:async()=>{displayed++}}},
  MI360Device:{binding:async()=>binding},URL};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../service-worker.js'),'utf8'),ctx);
 async function push(owner){let ack;listeners.push({data:{json:()=>({data:{owner,title:'Aviso'}})},waitUntil:p=>{ack=p}});await ack}
 await push('a');binding={uid:null};await push('a');binding={uid:'b'};await push('a');await push('b');assert.equal(displayed,2);
});
test('Ediciones de otros dispositivos conservan el estado pagado y los movimientos nuevos',()=>{
 const sourceFn=source.slice(source.indexOf('function mergeChanges('),source.indexOf('const uniqueClient'));
 const before={payments:[{id:'a',paid:false,title:'Luz'}],movements:[]};
 const after={payments:[{id:'a',paid:false,title:'Recibo de luz'}],movements:[]};
 const remote={payments:[{id:'a',paid:true,title:'Luz',paidAt:'2026-11-06'}],movements:[{id:'payment-a',amount:90}]};
 const result=vm.runInNewContext(sourceFn+';mergeChanges(remote,before,after)',{remote,before,after});
 assert.equal(result.payments[0].paid,true);assert.equal(result.payments[0].title,'Recibo de luz');assert.equal(result.movements.length,1);
});
