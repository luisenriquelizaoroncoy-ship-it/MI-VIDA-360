# MI VIDA 360 — Firebase conectado al código

## Estado
- Proyecto Firebase: `mi-vida-360-9b9ab` (plan Spark).
- App Web: configurada en `firebase-config.js` (identificadores públicos).
- Authentication: correo/contraseña y Google, habilitados en la consola según capturas del propietario.
- Firestore: base `(default)` creada; reglas de `firestore.rules` publicadas según captura del propietario.
- Código: Firebase Authentication + sincronización en el documento `users/{uid}`.
- Hosting: GitHub Pages; el sitio publicado debe habilitarse/configurarse en los ajustes de Pages del repositorio.

## Paso pendiente: dominio de autenticación
Para usar el botón «Continuar con Google», abre:
Firebase Console → Authentication → Configuración → Dominios autorizados → Agregar dominio:
`luisenriquelizaoroncoy-ship-it.github.io`

Guarda los cambios. No incluyas `https://` ni la ruta `/MI-VIDA-360/` en ese campo.

## Publicación GitHub Pages
En el repositorio, abre Settings → Pages. En «Build and deployment», selecciona «GitHub Actions». El archivo `.github/workflows/publish-pages.yml` se encarga de publicar cada cambio en main.
Dirección esperada: https://luisenriquelizaoroncoy-ship-it.github.io/MI-VIDA-360/

## Cuentas y recuperación
- El usuario registra email y contraseña (mínimo 6 caracteres) o utiliza Google.
- La opción «¿Olvidaste tu contraseña?» envía un correo desde Firebase Authentication.
- Cada usuario tiene documento propio en `/users/{uid}`.
- Al iniciar una cuenta nueva y si existen registros locales anteriores en el mismo navegador, se ofrece importarlos. No se eliminan automáticamente los registros anteriores.
- En ajustes puede exportarse un respaldo JSON. El modo «sin cuenta» conserva datos solo en ese navegador y no los sincroniza.
- Para comparar sincronización, registra un gasto de prueba en laptop, entra con la MISMA cuenta en el iPhone y comprueba el gasto.
- No borres la app instalada antes de exportar un respaldo.

## Limitaciones
- Las notificaciones del navegador se comprueban al abrir la app; todavía no hay push con la app cerrada.
- Las escrituras simultáneas en varios dispositivos usan el último guardado confirmado; para uso personal evita editar el mismo registro al mismo tiempo en dos equipos.
- La cuenta en la nube necesita Internet. Existe una copia local de respaldo en el mismo navegador.
- El código no contiene credenciales de administrador ni contraseñas del usuario.
- Spark y GitHub Pages tienen límites de uso y pueden cambiar; revisa su política si aumentan usuarios o tráfico.
