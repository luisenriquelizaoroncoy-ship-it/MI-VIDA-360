# MI VIDA 360 — conexión con Firebase

La aplicación actual sigue funcionando sin cuenta mientras se configura la nube. **No borres datos del teléfono.**

## Configuración manual pendiente (solo propietario de Firebase)

1. Firebase Console → MI VIDA 360 → **Configuración del proyecto** → **Tus aplicaciones** → icono **Web (</>)** → nombre `mi-vida-360-web`. No es necesario activar Firebase Hosting (seguimos con GitHub Pages).
2. Copia **firebaseConfig** (apiKey, authDomain, projectId, appId, etc.). Son identificadores públicos de la aplicación web, no una clave privada de servidor. Pásaselos al asistente para integrarlos en `firebase-config.js`. **No compartas credenciales de cuenta, contraseñas ni claves de cuenta de servicio.**
3. Firebase Console → **Authentication** → **Sign-in method** → habilita **Correo electrónico/Contraseña**.
4. Firebase Console → **Firestore Database** → crear base de datos con ubicación elegida; establecer reglas de seguridad como el archivo `firestore.rules` de este repositorio y **Publicar**.
5. Firebase Authentication → **Settings → Authorized domains** → añade el dominio de la página donde se aloja la app, por ejemplo `luisenriquelizaoroncoy-ship-it.github.io`, si no está.
6. Prueba con una cuenta nueva y verifica que los datos aparezcan en otro dispositivo antes de migrar tus registros de uso habitual.

## Seguridad y costos

- No activar el modo de prueba público en Firestore para almacenar datos personales.
- Usar reglas que restringen el documento de cada usuario a su propio UID.
- Firebase Spark y GitHub Pages son opciones gratuitas sujetas a sus políticas y límites actuales.
- El respaldo JSON de la app sigue siendo importante.
- Notificaciones de pago *en la app* están disponibles; notificaciones push con la app cerrada requieren configuración adicional y pruebas en iPhone.
