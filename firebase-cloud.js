// MI VIDA 360 — Firebase Web SDK modular. Sin credenciales privadas ni servicios de pago.
// Firebase se usa únicamente después de iniciar sesión; cada cuenta escribe /users/{uid}.
import './push-device.js?v=12';
import { firebaseConfig, webPushVapidKey } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, runTransaction, onSnapshot, serverTimestamp, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { getMessaging, getToken, isSupported, onMessage } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ui = window.MI360App;
let unsubscribe = null;
let revision = 0;
let writing = Promise.resolve();
let messagingInstance = null;
let messageListenerSet = false;
let pendingPush = null;
let loggingOut = false;
const tokenKey = uid => 'mi360.push.' + uid;
function savedToken(uid){try{return localStorage.getItem(tokenKey(uid))}catch{return null}}
function storeToken(uid,token){try{if(token)localStorage.setItem(tokenKey(uid),token);else localStorage.removeItem(tokenKey(uid))}catch{}}
function eligibleForPush(){return !!(webPushVapidKey&&webPushVapidKey.trim()&&navigator.serviceWorker&&window.PushManager&&window.Notification&&window.isSecureContext)}
async function setupPush(){
 const user=auth.currentUser;
 if(!user)throw Error('Inicia sesión primero para asociar los avisos a tu cuenta.');
 if(!webPushVapidKey.trim())throw Error('Falta configurar la clave pública de notificaciones en Firebase.');
 if(!eligibleForPush())throw Error('En iPhone abre MI VIDA 360 desde el ícono de la pantalla de inicio, no desde una pestaña de Safari.');
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')throw Error('No diste permiso para mostrar notificaciones.');
 if(!(await isSupported()))throw Error('Este dispositivo no admite Firebase Messaging.');
 const registration=await navigator.serviceWorker.ready;
 messagingInstance=messagingInstance||getMessaging(app);
 const token=await getToken(messagingInstance,{vapidKey:webPushVapidKey,serviceWorkerRegistration:registration});
 if(!token)throw Error('Firebase no entregó un identificador de notificaciones.');
 await setDoc(doc(db,'users',user.uid),{pushTokens:arrayUnion(token),pushEnabled:true,pushUpdatedAt:serverTimestamp()},{merge:true});
 await MI360Device.bind(user.uid);
 storeToken(user.uid,token);
 if(!messageListenerSet){messageListenerSet=true;onMessage(messagingInstance,payload=>{
  if(!auth.currentUser||payload.data?.owner&&payload.data.owner!==auth.currentUser.uid)return;
  if(document.visibilityState!=='visible')return;
  const heading=payload.data?.title||'MI VIDA 360';
  const detail=payload.data?.body||'Tienes un recordatorio pendiente.';
  ui?.cloudWarning(heading+' · '+detail);
 });}
 return true;
}
async function detachDevice(user){
 const reg=await navigator.serviceWorker?.getRegistration();
 const subscription=await reg?.pushManager?.getSubscription();
 let token=savedToken(user.uid);
 // Las versiones anteriores no guardaban el token en este dispositivo.
 if(!token&&subscription&&navigator.onLine&&window.Notification?.permission==='granted'){
  try{token=await getToken(getMessaging(app),{vapidKey:webPushVapidKey,serviceWorkerRegistration:reg})}catch{}
 }
 if('caches' in window)await MI360Device.bind(null);
 if(subscription){
  try{await subscription.unsubscribe()}catch{if(!('caches' in window))throw Error('No se pudieron desactivar los avisos de este dispositivo.')}
 }
 if(reg?.getNotifications){
  const visible=await reg.getNotifications().catch(()=>[]);
  visible.forEach(notice=>notice.close());
 }
 if(token&&navigator.onLine){
  try{await setDoc(doc(db,'users',user.uid),{pushTokens:arrayRemove(token)},{merge:true})}catch{}
 }
 storeToken(user.uid,null);
}

function mergeChanges(remote,before,after){
 const merged={...remote};
 for(const key of Object.keys(after)){
  if(!Array.isArray(after[key])||JSON.stringify(before[key])===JSON.stringify(after[key]))continue;
  const previous=new Map((before[key]||[]).map(item=>[item.id,item]));
  const next=new Map(after[key].map(item=>[item.id,item]));
  const values=new Map((remote[key]||[]).map(item=>[item.id,item]));
  for(const id of previous.keys())if(!next.has(id))values.delete(id);
  for(const [id,item] of next){
   const old=previous.get(id);
   if(!old){values.set(id,item);continue}
   if(!values.has(id)||JSON.stringify(old)===JSON.stringify(item))continue;
   const updated={...values.get(id)};
   for(const field of Object.keys(old))if(!(field in item))delete updated[field];
   for(const field of Object.keys(item))if(JSON.stringify(old[field])!==JSON.stringify(item[field]))updated[field]=item[field];
   values.set(id,updated);
  }
  merged[key]=[...values.values()];
 }
 return merged;
}

const uniqueClient = crypto.randomUUID?.() || String(Date.now());

function message(err) {
  const code = String(err?.code || '');
  const messages = {
    'auth/email-already-in-use': 'Ese correo ya está registrado. Prueba Iniciar sesión.',
    'auth/invalid-email': 'Escribe un correo válido.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Intenta de nuevo más tarde.',
    'auth/unauthorized-domain': 'Debes agregar el dominio de GitHub Pages a los dominios autorizados de Firebase Authentication.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Permite ventanas emergentes o ingresa con correo.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
    'auth/operation-not-allowed': 'Activa este método de acceso en Firebase Authentication.',
    'permission-denied': 'Firestore rechazó el acceso. Revisa que estén publicadas las reglas privadas por usuario.',
    'unavailable': 'No hay conexión con Firebase. Revisa Internet e inténtalo de nuevo.'
  };
  return messages[code] || String(err?.message || 'No se pudo completar la operación.');
}

const api = {
  register(email, password) { return createUserWithEmailAndPassword(auth, email.trim(), password); },
  login(email, password) { return signInWithEmailAndPassword(auth, email.trim(), password); },
  google() { return signInWithPopup(auth, new GoogleAuthProvider()); },
  reset(email) { return sendPasswordResetEmail(auth, email.trim()); },
  async logout() {
    if(loggingOut)return;
    loggingOut=true;
    try{
      await pendingPush?.catch(()=>{});
      if(auth.currentUser)await detachDevice(auth.currentUser);
      await signOut(auth);
    }finally{loggingOut=false}
  },
  save(data,previous=null) {
    const user=auth.currentUser;
    if(!user)return Promise.reject(new Error('No hay una sesión activa.'));
    const target=doc(db,'users',user.uid);
    const meta={clientId:uniqueClient,schemaVersion:1};
    writing=writing.catch(()=>{}).then(async()=>{
      if(auth.currentUser?.uid!==user.uid)throw Error('La sesión cambió antes de guardar.');
      if(!previous||!navigator.onLine){
        const changed=previous?Object.fromEntries(Object.entries(data).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(previous[k]))):data;
        return setDoc(target,{data:changed,...meta,updatedAt:serverTimestamp()},{merge:true});
      }
      return runTransaction(db,async tx=>{
        const snap=await tx.get(target);
        const remote=snap.data()?.data;
        tx.set(target,{data:remote?mergeChanges(remote,previous,data):data,...meta,updatedAt:serverTimestamp()},{merge:true});
      });
    });
    return writing;
  },
  settlePayment(id,action,date) {
    const uid=auth.currentUser?.uid;
    const target=doc(db,'users',uid);
    writing=writing.catch(()=>{}).then(()=>runTransaction(db,async tx=>{
      if(auth.currentUser?.uid!==uid)throw Error('La sesión cambió antes de guardar el pago.');
      const snap=await tx.get(target), data=snap.data()?.data;
      if(!Array.isArray(data?.payments)||!Array.isArray(data?.movements))throw Error('No se pudieron leer tus pagos.');
      if(MI360Finance.settle(data,id,action,date)){
        tx.set(target,{data:{payments:data.payments,movements:data.movements},updatedAt:serverTimestamp(),clientId:uniqueClient},{merge:true});
      }
      return data;
    }));
    return writing;
  },
  setupPush() {
    if(loggingOut)return Promise.reject(Error('Espera a que termine el cierre de sesión.'));
    if(!pendingPush)pendingPush=setupPush().finally(()=>{pendingPush=null});
    return pendingPush;
  },
  pushConfigured: () => Boolean(webPushVapidKey&&webPushVapidKey.trim()),
  explain: message
};

window.MI360Cloud = api;
ui?.cloudReady(api);

onAuthStateChanged(auth, async user => {
  const session = ++revision;
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (!user) {
    ui?.cloudSignedOut();
    return;
  }
  const target = doc(db, 'users', user.uid);
  let remote = null, offline = false, exists = false;
  try {
    const snap = await getDoc(target);
    if (session !== revision) return;
    exists = snap.exists();
    remote = exists ? snap.data()?.data ?? null : null;
  } catch (error) {
    offline = true;
    ui?.cloudWarning('No se pudo consultar la nube. Usaré una copia local si existe. ' + message(error));
  }
  if (session !== revision) return;
  const dataToCreate = await ui?.cloudSignedIn(user, remote, { exists, offline });
  if (session !== revision) return;
  if (!exists && !offline && dataToCreate) {
    try { await api.save(dataToCreate); }
    catch (error) { ui?.cloudWarning('No se pudieron subir los primeros datos: ' + message(error)); }
  }
  if (session !== revision) return;
  unsubscribe = onSnapshot(target, snap => {
    if (session !== revision || !snap.exists() || snap.metadata.hasPendingWrites) return;
    ui?.cloudStatus(snap.data()?.reminderStatus);
    const next = snap.data()?.data;
    if (next && typeof next === 'object') ui?.cloudRemote(next);
  }, error => ui?.cloudWarning(message(error)));
}, error => ui?.cloudWarning(message(error)));
