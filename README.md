# ⏳ Bot de WhatsApp para Cuenta Regresiva (`/temp`)

Bot de WhatsApp en Node.js que permite registrar múltiples eventos y consultar cuentas regresivas exactas en grupos o chats privados. Incluye control de acceso por **Dueño** (modo lista blanca/sigilo) y protección anti-spam.

---

## 🍴 ¿Querés usar este bot para vos? (Creá tu propia instancia)

Cualquiera puede hacer un **Fork** de este repositorio y poner a funcionar su propio bot independiente en cuestión de minutos.

- **100% Autónomo:** No requiere claves de API pagas ni vinculación a números ajenos.
- **Dueño automático:** El número de WhatsApp que escanee el código QR se convierte automáticamente en el administrador exclusivo del bot.
- **Privacidad garantizada:** Tus credenciales de sesión (`auth_info/`) y eventos (`data/*.json`) están en `.gitignore`, por lo que nunca se comparten en GitHub.

---

## 🚀 Inicio Rápido (Local)

### 1. Clonar tu repositorio (Fork)
```bash
git clone https://github.com/<tu-usuario>/wpp-countdown-bot.git
cd wpp-countdown-bot
```

### 2. Instalar dependencias
```bash
pnpm install
# o si preferís npm: npm install
```

### 3. Iniciar el bot
```bash
pnpm start
```

### 4. Vincular WhatsApp
1. En la consola aparecerá un **código QR**.
2. Abrí WhatsApp en tu teléfono > Menú de ajustes (**Dispositivos vinculados**) > **Vincular un dispositivo**.
3. Escaneá el QR de la terminal. ¡Listo! El bot estará conectado.

---

## 🔒 Control de Acceso (Modo Sigilo / Lista Blanca)

Para proteger tu privacidad y evitar que el bot responda en grupos no deseados o mensajes directos aleatorios, opera bajo una **Lista Blanca (Whitelist)**:

- Por defecto, el bot **no responderá a ningún comando** en ningún chat hasta que el dueño lo autorice.
- **`/activar`** o **`/bot on`**: Solo el dueño (el número vinculado) puede ejecutarlo para encender el bot en un chat o grupo.
- **`/desactivar`** o **`/bot off`**: Desactiva el bot en ese chat.
- Si cualquier otra persona intenta usar `/activar`, el bot descarta la petición en silencio.

---

## 📋 Comandos Disponibles (En Chats Activados)

| Comando | Ejemplo | Descripción |
| :--- | :--- | :--- |
| `/temp` | `/temp` | Muestra el tiempo restante exacto para el **evento más próximo**. |
| `/temp [arg]` | `/temp 2` o `/temp Lucas` | Muestra el tiempo para un evento específico por número o nombre. |
| `/eventos` | `/eventos` | Lista todos los eventos del grupo ordenados cronológicamente con su estado. |
| `/set` | `/set 15/11/2026 21:00 Cumple` | Agrega un nuevo evento al grupo (`DD/MM/AAAA HH:mm Nombre`). |
| `/set` (sin hora) | `/set 01/01/2027 Año Nuevo` | Si no indicás la hora, asume automáticamente las `00:00 hs`. |
| `/deltemp` | `/deltemp 1` o `/deltemp Lucas` | Elimina un evento específico de la lista. |
| `/cleartemp` | `/cleartemp` | Elimina **todos** los eventos del grupo actual. |
| `/pausar` | `/pausar` | *(Solo Dueño)* Pausa y desconecta el bot de WhatsApp por completo. |
| `/ayuda` | `/ayuda` | Muestra la guía interactiva completa de comandos en el chat. |

> 🛡️ **Anti-Spam:** Cuenta con un tiempo de enfriamiento (cooldown) de 3 segundos por chat entre comandos.

---

## ☁️ Despliegue en la Nube 24/7

### Opción A: Render (Web Service)
1. Hacé un Fork de este repositorio a tu cuenta de GitHub.
2. En [Render.com](https://render.com), creá un nuevo **Web Service**.
3. Conectá **tu repositorio forkeado** (`<tu-usuario>/wpp-countdown-bot`).
4. Render detectará automáticamente el archivo `render.yaml` o podés indicar:
   - **Runtime:** Node
   - **Build Command:** `npm install -g pnpm && pnpm config set minimum-release-age 0 && pnpm install`
   - **Start Command:** `pnpm start`
   - **Health Check Path:** `/health`
5. **Escanear el código QR fácilmente:**
   - Una vez desplegado, abrí la URL de tu servicio (`https://tu-servicio.onrender.com`).
   - Verás un **Dashboard Web interactivo** con el código QR vectorizado y nítido para escanear en un segundo con WhatsApp (sin sufrir la deformación de caracteres de la consola de logs).
6. Entrá a tu grupo de WhatsApp y enviá `/activar`.

> ⚠️ **Nota sobre el plan gratuito de Render:**  
> Render Free entra en suspensión (spin-down) tras 15 minutos sin peticiones HTTP entrantes y su disco es efímero. Para evitar que se duerma, podés configurar un monitor gratuito como [UptimeRobot](https://uptimerobot.com) o [cron-job.org](https://cron-job.org) para que haga un ping cada 10 minutos a tu endpoint `https://tu-servicio.onrender.com/health`.

### Opción B: Railway / Docker / VPS (Recomendado para persistencia 24/7)
Para un bot de WhatsApp 24/7 sin suspensiones y con disco persistente para no perder nunca las credenciales de sesión:
- **Railway:** Simplemente desplegá el repo. Railway utiliza el `Dockerfile` y no suspende el contenedor mientras tengas créditos.
- **Docker / Servidor propio / VPS:**
El proyecto incluye un `Dockerfile` con volúmenes definidos en `/app/auth_info` y `/app/data` para que no pierdas la sesión ni los eventos al reiniciar:

```bash
docker build -t wpp-countdown-bot .
docker run -d --name mi-bot -p 3000:3000 -v ./auth_info:/app/auth_info -v ./data:/app/data wpp-countdown-bot
```
Luego abrís `http://localhost:3000` en tu navegador para ver y escanear el QR.

---

## 🛑 Control de Encendido, Pausa y Monitoreo (Evitar "En línea" / Silenciado)

### 🔕 ¿Por qué WhatsApp puede silenciar notificaciones o mostrarte "En línea"?
Al vincular una sesión de WhatsApp Web o bot, si la librería marca la presencia como activa (`available`), los servidores de WhatsApp asumen que estás usando la aplicación en la computadora y silencian las notificaciones en el teléfono móvil para evitar duplicaciones.
**Este proyecto ya incluye protección automática:**
- `markOnlineOnConnect: false` configurado por defecto.
- Presencia reportada automáticamente en modo `unavailable` (offline / segundo plano).
- Tu teléfono **siempre recibirá y sonará las notificaciones con normalidad**, y tus contactos no te verán "En línea" cuando no estés usando el celular.

### ⏸️ Cómo pausar o apagar el bot fácilmente cuando no lo uses:

1. **Desde el Dashboard Web (Recomendado):**
   - Abrí la URL de tu servicio (`https://tu-servicio.onrender.com`).
   - Tocá el botón rojo **"⏸️ Pausar Bot (Desconectar WhatsApp)"**.
   - La conexión con WhatsApp se cierra al instante. Para volver a encenderlo, simplemente tocá **"▶️ Reanudar Bot"** (no requiere volver a escanear QR).

2. **Desde WhatsApp:**
   - Como dueño, enviá el comando `/pausar` en cualquier chat o grupo donde esté el bot.
   - El bot se despedirá y cerrará la conexión inmediatamente.

3. **Cómo apagar Render o el Monitoreo (Para que entre en reposo total):**
   - **Pausar Monitoreo (UptimeRobot / Cron-job.org):** Si usás UptimeRobot, simplemente pausá el monitor desde su app móvil o web. Al no recibir más pings en `/health`, el plan gratuito de Render entrará en reposo automáticamente tras 15 minutos sin consumir horas.
   - **Suspender el servicio en Render:** Entrá a [dashboard.render.com](https://dashboard.render.com) > tu servicio y hacé clic en **"Suspend Service"** para apagar el contenedor por completo. Cuando quieras volver a activarlo, hacé clic en **"Resume Service"**.

---

## 🧪 Pruebas Automatizadas

Podés ejecutar la suite de pruebas unitarias ejecutando:
```bash
pnpm test
```
