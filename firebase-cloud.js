// MI VIDA 360 — Firebase Web SDK modular. Sin credenciales privadas ni servicios de pago.
// Firebase se usa únicamente después de iniciar sesión; cada cuenta escribe /users/{uid}.
import { firebaseConfig, webPushVapidKey } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp, arrayUnion, arrayRemove
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
function eligibleForPush(){return !!(webPushVapidKey&&webPushVapidKey.trim()&&navigator.serviceWorker&&window.PushManager&&window.Notification&&window.isSecureContext)}
async function setupPush(){
 const user=auth.currentUser;
 if(!user)throw Error('Inicia sesión primero para asociar los avisos a tu cuenta.');
 if(!webPushVapidKey.trim())throw Error('Falta configurar la clave pública de notificaciones en Firebase.');
 if(!eligibleForPush())throw Error('En iPhone abre MI VIDA 360 desde el ícono de la pantalla de inicio, no desde una pestaña de Safari.');
 if(!(await isSupported()))throw Error('Este dispositivo no admite Firebase Messaging.');
 const registration=await navigator.serviceWorker.ready;
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('No diste permiso para mostrar notificaciones.');
 messagingInstance=messagingInstance||getMessaging(app);
 const token=await getToken(messagingInstance,{vapidKey:webPushVapidKey,serviceWorkerRegistration:registration});
 if(!token)throw Error('Firebase no entregó un identificador de notificaciones.');
 await setDoc(doc(db,'users',user.uid),{pushTokens:arrayUnion(token),pushEnabled:true,pushUpdatedAt:serverTimestamp()},{merge:true});
 if(!messageListenerSet){messageListenerSet=true;onMessage(messagingInstance,payload=>{
  if(document.visibilityState!=='visible')return;
  const heading=payload.data?.title||'MI VIDA 360';
  const detail=payload.data?.body||'Tienes un recordatorio pendiente.';
  ui?.cloudWarning(heading+' · '+detail);
 });}
 return true;
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
  logout() { return signOut(auth); },
  save(data) {
    const user = auth.currentUser;
    if (!user) return Promise.reject(new Error('No hay una sesión activa.'));
    const id = user.uid;
    const snapshot = JSON.parse(JSON.stringify(data));
    // Una cola evita que un guardado anterior sobreescriba el más reciente.
    writing = writing.catch(() => {}).then(() => {
      if (auth.currentUser?.uid !== id) throw new Error('La sesión cambió antes de guardar.');
      return setDoc(doc(db, 'users', id), {
        data: snapshot, updatedAt: serverTimestamp(), clientId: uniqueClient, schemaVersion: 1
      }, {merge:true});
    });
    return writing;
  },
  setupPush,
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
    const next = snap.data()?.data;
    if (next && typeof next === 'object') ui?.cloudRemote(next);
  }, error => ui?.cloudWarning(message(error)));
}, error => ui?.cloudWarning(message(error)));
