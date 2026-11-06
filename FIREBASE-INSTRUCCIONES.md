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

## Notificaciones push de pagos con la app cerrada (pendiente de activación)

El código del iPhone, la suscripción FCM y el envío diario a las **09:07 hora de Lima** ya están preparados. **No funciona todavía** hasta completar ambos pasos siguientes. Los recordatorios comprueban pagos impagos que vencen en 3 días, 1 día o el mismo día. Cada usuario recibe como máximo un mensaje al día por los vencimientos detectados. No aparecen montos sensibles en las notificaciones.

### A. Clave pública para el teléfono (no es secreta)

1. Firebase → Configuración del proyecto (engrane) → **Cloud Messaging** → **Configuración web** → **Certificados push web**.
2. Pulsa **Generar par de claves** (si todavía no existe).
3. Copia solo la **CLAVE PÚBLICA VAPID**. Puedes compartirla con el asistente o colocarla entre las comillas de `webPushVapidKey` en `firebase-config.js`. **NO compartas ninguna clave privada.**

### B. Credencial privada del servidor (NUNCA enviarla por chat ni subirla al repositorio)

1. Firebase → Configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**. Descarga JSON.
2. GitHub → este repositorio → **Settings → Secrets and variables → Actions → New repository secret**.
3. Nombre exacto: `FIREBASE_SERVICE_ACCOUNT_JSON`; valor: contenido **completo** del JSON privado. Almacénalo solo en **GitHub Secrets**.
4. Elimina el archivo descargado de la carpeta Descargas cuando confirmes que el secreto está guardado. No lo adjuntes al chat, no lo agregues a ningún commit.
5. GitHub → **Actions → Recordatorios MI VIDA 360 → Run workflow** para ejecutar prueba manual y revisar errores. También se ejecuta diariamente a las 14:07 UTC, aproximadamente 09:07 en Lima. GitHub puede retrasar las ejecuciones programadas.

### C. Activar en iPhone

1. Abre MI VIDA 360 desde el ícono de la pantalla de inicio del iPhone.
2. Inicia sesión con Firebase.
3. Abre ⚙ → **Activar recordatorios con la app cerrada** → **Permitir** notificaciones si el sistema lo pide.
4. Registra un pago de prueba con vencimiento para hoy, mañana o dentro de 3 días; ejecuta el flujo manual de GitHub para verificar que llegue una notificación.

### Advertencias importantes

- La app solicita permiso al tocar el botón; el aviso previo de «Avisos activados» para comprobación local NO significa que las push estén habilitadas.
- Las push solo funcionarán al completar A y B. No se pueden activar desde GitHub con solo el código público.
- Firebase Cloud Messaging no tiene costo; GitHub Actions tiene límites, y los workflows programados de repositorios públicos se desactivan tras unos 60 días sin actividad en el repositorio. No es garantía de funcionamiento para siempre.
- Nunca establezcas `allow read, write: if true` en Firestore.
