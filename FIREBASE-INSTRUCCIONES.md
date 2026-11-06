# MI VIDA 360 — Firebase conectado al código

> **Estado actualizado (6 de noviembre de 2026):** los avisos push de pagos, agenda y compras están configurados y la entrega de una prueba al iPhone se confirmó por el propietario. GitHub Actions comprueba recordatorios cada 15 minutos, pero las ejecuciones programadas pueden retrasarse o cancelarse. La prueba automática de reglas es local y no escribe citas de prueba en tu cuenta. Los datos se sincronizan con Firebase y se pueden descargar desde **Ajustes → Guardar copia de seguridad (.json)**; para recuperarlos, usa **Ajustes → Recuperar una copia (.json)**. Descargar un respaldo real requiere hacerlo desde la app iniciando sesión, no desde GitHub. Al cerrar sesión se desasocian las notificaciones push de ese dispositivo y es necesario activarlas de nuevo después de iniciar sesión. **Si la clave privada Firebase se compartió previamente, revócala y actualiza el secreto de GitHub.**

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
- Las notificaciones push pueden llegar con la app cerrada si están activadas y la sesión sigue iniciada. Su recepción puede variar por conectividad, permisos y retrasos del programador.
- Las escrituras simultáneas en varios dispositivos usan el último guardado confirmado; para uso personal evita editar el mismo registro al mismo tiempo en dos equipos.
- La cuenta en la nube necesita Internet. Existe una copia local de respaldo en el mismo navegador.
- El código no contiene credenciales de administrador ni contraseñas del usuario.
- Spark y GitHub Pages tienen límites de uso y pueden cambiar; revisa su política si aumentan usuarios o tráfico.

## Configuración y mantenimiento de las notificaciones push

La configuración actual usa Firebase Cloud Messaging y comprobaciones aproximadamente cada **15 minutos**. Los pasos siguientes explican cómo volver a configurarla si cambias de dispositivo o reemplazas las credenciales. La primera notificación real de prueba ya fue confirmada en iPhone; los avisos posteriores dependen de que haya tareas vencidas y de las condiciones del dispositivo. No aparecen montos sensibles en las notificaciones.

### A. Clave pública para el teléfono (no es secreta)

1. Firebase → Configuración del proyecto (engrane) → **Cloud Messaging** → **Configuración web** → **Certificados push web**.
2. Pulsa **Generar par de claves** (si todavía no existe).
3. Copia solo la **CLAVE PÚBLICA VAPID**. Puedes compartirla con el asistente o colocarla entre las comillas de `webPushVapidKey` en `firebase-config.js`. **NO compartas ninguna clave privada.**

### B. Credencial privada del servidor (NUNCA enviarla por chat ni subirla al repositorio)

1. Firebase → Configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**. Descarga JSON.
2. GitHub → este repositorio → **Settings → Secrets and variables → Actions → New repository secret**.
3. Nombre exacto: `FIREBASE_SERVICE_ACCOUNT_JSON`; valor: contenido **completo** del JSON privado. Almacénalo solo en **GitHub Secrets**.
4. Elimina el archivo descargado de la carpeta Descargas cuando confirmes que el secreto está guardado. No lo adjuntes al chat, no lo agregues a ningún commit.
5. GitHub → **Actions → Recordatorios MI VIDA 360 → Run workflow** para ejecutar prueba manual y revisar errores. También se ejecuta aproximadamente cada 15 minutos, aunque GitHub puede retrasar o saltar ejecuciones. GitHub puede retrasar las ejecuciones programadas.

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

## Recordatorios unificados — actualización

El sistema revisa cada 15 minutos a través de GitHub Actions:
- **Pagos:** 3 días antes, 1 día antes, el día del vencimiento y, si sigue pendiente, una vez cada mañana después del vencimiento.
- **Agenda:** para actividades con hora, una notificación a partir de la hora fijada en la siguiente revisión del mismo día; para actividades sin hora, un recordatorio la mañana del día; también aviso el día anterior y recordatorio matutino de actividades atrasadas, hasta 7 días.
- **Compras:** si tienen una fecha límite, igual que los pagos; si no tienen fecha, resumen semanal el domingo por la mañana.
- **Completadas:** marca una actividad como «Marcar completado» para dejar de recibir avisos; las compras marcadas como compradas y los pagos marcados como pagados también dejan de notificarse.
- **Sin duplicados:** cada evento de recordatorio guarda un identificador en la cuenta para impedir reenvíos por ejecuciones repetidas.

GitHub Actions puede retrasarse o no ejecutarse a la hora prevista: **no equivale a una alarma exacta de reloj**, especialmente para una cita crítica. Para citas críticas, conviene mantener además una alarma nativa de iPhone.

### Prueba
1. En el iPhone, entra en MI VIDA 360 desde el icono de pantalla de inicio y activa los avisos push en Ajustes.
2. Registra una actividad pendiente en Agenda para dentro de aproximadamente 15 a 30 minutos. Debe tener fecha y hora, y no estar completada.
3. GitHub → Actions → «Recordatorios MI VIDA 360» → Run workflow; o espera a una ejecución programada.
4. En el log, revisa `eligible`, `sent`, `skipped` y `failures`. Solo `sent > 0` confirma que Firebase aceptó el envío. La recepción final debe comprobarse en el iPhone.

**Seguridad:** si alguna clave privada de servicio fue compartida en una conversación o archivo accesible, revócala y sustituye el secreto `FIREBASE_SERVICE_ACCOUNT_JSON` de GitHub por una clave nueva, sin enviarla por chat.
