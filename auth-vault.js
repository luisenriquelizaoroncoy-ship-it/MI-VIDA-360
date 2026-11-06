/* MI VIDA 360: cuentas locales con bóveda cifrada. Sin servidor ni sincronización entre dispositivos. */
(function(){
'use strict';
const USERS_KEY='mivida360_auth_users_v1';
const VAULT_PREFIX='mivida360_auth_vault_v1_';
const marker='MI_VIDA_360_VALIDATION_V1';
const encoder=new TextEncoder(),decoder=new TextDecoder();
let activeEmail=null,activeKey=null,saveQueue=Promise.resolve();
function users(){try{return JSON.parse(localStorage.getItem(USERS_KEY)||'{}')||{}}catch(e){return {}}}
function normalizeEmail(email){return String(email||'').trim().toLowerCase()}
function vaultKey(email){return VAULT_PREFIX+encodeURIComponent(email)}
function toB64(data){let bytes=new Uint8Array(data),out='';for(let i=0;i<bytes.length;i+=16384){out+=String.fromCharCode(...bytes.subarray(i,i+16384))}return btoa(out)}
function fromB64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function derive(password,salt){const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function seal(key,plain){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(plain));return {iv:toB64(iv),data:toB64(cipher)}}
async function open(key,packed){const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(packed.iv)},key,fromB64(packed.data));return decoder.decode(plain)}
function supported(){return !!(window.isSecureContext&&window.crypto&&crypto.subtle&&window.localStorage)}
async function register(email,password,data){
 if(!supported())throw Error('Para crear una cuenta, abre la aplicación con HTTPS en un navegador compatible.');
 email=normalizeEmail(email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Escribe un correo válido.');
 if(password.length<8)throw Error('La contraseña debe tener al menos 8 caracteres.');
 const all=users();if(Object.prototype.hasOwnProperty.call(all,email))throw Error('Este correo ya tiene una cuenta en este dispositivo.');
 const salt=crypto.getRandomValues(new Uint8Array(16));const key=await derive(password,salt);
 const verifier=await seal(key,marker),snapshot=await seal(key,JSON.stringify(data));
 localStorage.setItem(vaultKey(email),JSON.stringify(snapshot));
 all[email]={salt:toB64(salt),verifier,createdAt:new Date().toISOString()};
 localStorage.setItem(USERS_KEY,JSON.stringify(all));activeEmail=email;activeKey=key;saveQueue=Promise.resolve();
 return data;
}
async function login(email,password){
 if(!supported())throw Error('Este navegador no permite abrir una cuenta segura.');
 email=normalizeEmail(email);const record=users()[email];
 if(!record)throw Error('Correo o contraseña incorrectos.');
 try{
  const key=await derive(password,fromB64(record.salt));
  const checked=await open(key,record.verifier);if(checked!==marker)throw Error('Bad password');
  const packed=JSON.parse(localStorage.getItem(vaultKey(email))||'null');
  if(!packed)throw Error('missing vault');
  const data=JSON.parse(await open(key,packed));
  activeEmail=email;activeKey=key;saveQueue=Promise.resolve();
  return data;
 }catch(e){throw Error('No se pudo abrir esta cuenta. Revisa el correo y la contraseña o la copia de tus datos.')}
}
function save(data){
 if(!activeEmail||!activeKey)return Promise.reject(Error('No has iniciado sesión.'));
 const email=activeEmail,key=activeKey,snapshot=JSON.stringify(data);
 const next=saveQueue.then(async()=>{const packed=await seal(key,snapshot);localStorage.setItem(vaultKey(email),JSON.stringify(packed));return true});
 saveQueue=next.catch(()=>{});return next;
}
async function logout(){await saveQueue;activeEmail=null;activeKey=null}
window.MVAuth={register,login,save,logout,supported,hasUsers:()=>Object.keys(users()).length>0,current:()=>activeEmail};
})();
