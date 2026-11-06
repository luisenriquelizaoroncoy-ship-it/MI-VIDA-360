/* Pantalla de acceso de MI VIDA 360. Funciona aunque Firebase tarde o falle. */
(function(){
'use strict';
const root=document.getElementById('authRoot');
let formMode='login',busy=false;
function safe(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ready(){return Boolean(window.MI360Cloud)}
function render(){
 const signup=formMode==='signup';
 root.innerHTML='<section class="auth-screen"><div class="auth-panel">'+
 '<div class="auth-symbol">360</div><div class="auth-eyebrow">MI VIDA 360</div>'+
 '<h1>'+(signup?'Crea tu cuenta':'Bienvenido de nuevo')+'</h1>'+
 '<p class="auth-desc">'+(signup?'Guarda tus gastos, ahorros y pagos en tu cuenta.':'Inicia sesión para ver tus datos desde iPhone o laptop.')+'</p>'+
 '<form id="cloudLoginForm" class="auth-form">'+
 '<label>Correo electrónico<input type="email" name="email" placeholder="tucorreo@correo.com" autocomplete="username" maxlength="180" required></label>'+
 '<label>Contraseña<input type="password" name="password" placeholder="Mínimo 6 caracteres" autocomplete="'+(signup?'new-password':'current-password')+'" minlength="6" required></label>'+
 (signup?'<label>Confirmar contraseña<input type="password" name="repeat" placeholder="Repite la contraseña" minlength="6" autocomplete="new-password" required></label>':'')+
 '<button type="submit" class="auth-primary" '+(!ready()||busy?'disabled':'')+'>'+(signup?'Crear cuenta':'Iniciar sesión')+'</button></form>'+
 '<button class="auth-google" type="button" data-auth-ui="google" '+(!ready()||busy?'disabled':'')+'>Continuar con Google</button>'+
 '<button class="auth-link" type="button" data-auth-ui="switch">'+(signup?'Ya tengo cuenta · Iniciar sesión':'Crear una cuenta nueva')+'</button>'+
 (!signup?'<button class="auth-link" type="button" data-auth-ui="reset">¿Olvidaste tu contraseña?</button>':'')+
 '<button class="auth-offline" type="button" data-auth-ui="local">Abrir sin cuenta (solo en este dispositivo)</button>'+
 '<p class="auth-footnote" id="authHint">'+(ready()?'Conectado a Firebase.': 'Cargando conexión a Firebase…')+
 ' Tus datos en la nube necesitan Internet. Puedes entrar sin cuenta y conservar datos locales.</p>'+
 '</div></section>';
}
async function action(type){
 const api=window.MI360Cloud;
 if(type==='switch'){formMode=formMode==='login'?'signup':'login';render();return}
 if(type==='local'){window.MI360App?.useLocal();return}
 if(!api){alert('Firebase no está disponible. Revisa Internet o usa la opción sin cuenta.');return}
 try{
  if(type==='google'){await api.google();return}
  if(type==='reset'){
   const email=prompt('¿A qué correo enviamos el enlace para restablecer tu contraseña?');
   if(!email)return;
   await api.reset(email);
   alert('Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso.');
  }
 }catch(error){alert(api.explain(error))}
}
root.addEventListener('click',e=>{const el=e.target.closest('[data-auth-ui]');if(el)action(el.dataset.authUi)});
root.addEventListener('submit',async e=>{
 if(e.target.id!=='cloudLoginForm')return;
 e.preventDefault();
 if(busy)return;
 const api=window.MI360Cloud;
 if(!api)return alert('Firebase no está listo. Comprueba Internet.');
 const form=e.target,values=Object.fromEntries(new FormData(form).entries());
 if(formMode==='signup'&&values.password!==values.repeat)return alert('Las contraseñas no coinciden.');
 busy=true;const button=form.querySelector('button[type=submit]');button.disabled=true;button.textContent='Conectando…';
 try{if(formMode==='signup')await api.register(values.email,values.password);else await api.login(values.email,values.password)}
 catch(error){alert(api.explain(error));busy=false;render()}
});
window.MI360AuthUI={
 show(){busy=false;document.body.classList.add('auth-locked');render()},
 hide(){busy=false;document.body.classList.remove('auth-locked')},
 updateReady(){if(document.body.classList.contains('auth-locked'))render()},
 failed(error){if(document.body.classList.contains('auth-locked')){render();const hint=document.getElementById('authHint');if(hint)hint.textContent='Firebase no cargó: '+safe(error)+'. Puedes seguir sin cuenta.'}}
};
render();
})();