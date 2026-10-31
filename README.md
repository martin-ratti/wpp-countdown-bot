# ⏳ Bot de WhatsApp para Cuenta Regresiva (`/temp`)

Bot de WhatsApp en Node.js que permite configurar múltiples eventos y calcular cuentas regresivas precisas en grupos o chats privados con control de acceso por Dueño.

---

## 🔒 Control de Acceso (Solo el Dueño)

Para proteger tu privacidad y evitar que el bot responda en grupos no deseados o mensajes privados aleatorios, el bot opera con una **Lista Blanca (Whitelist)**:

- Por defecto, el bot **no responde a ningún comando** en un chat hasta que el dueño lo active.
- **`/activar`** o **`/bot on`**: Solo el número del dueño puede ejecutar este comando en el grupo/chat para encender el bot.
- **`/desactivar`** o **`/bot off`**: Desactiva el bot en ese chat.
- Si alguien que no es el dueño intenta usar `/activar`, el bot deniega el acceso.
- Si un grupo no está activado, el bot se mantiene 100% invisible y en silencio.

---

## 🚀 Comandos Disponibles (En Chats Activados)

| Comando | Ejemplo | Descripción |
| :--- | :--- | :--- |
| `/temp` | `/temp` | Muestra el tiempo restante exacto para el **evento más próximo**. |
| `/temp [arg]` | `/temp 2` o `/temp Lucas` | Muestra el tiempo para un evento específico por número o nombre. |
| `/eventos` | `/eventos` | Lista todos los eventos del grupo numerados con sus fechas y estado. |
| `/set` | `/set 15/11/2026 21:00 Cumple` | Agrega un nuevo evento al grupo (`DD/MM/AAAA HH:mm Nombre`). |
| `/set` (sin hora) | `/set 01/01/2027 Año Nuevo` | Si no indicás la hora, asume automáticamente las `00:00 hs`. |
| `/deltemp` | `/deltemp 1` o `/deltemp Lucas` | Elimina un evento específico de la lista. |
| `/cleartemp` | `/cleartemp` | Elimina **todos** los eventos del grupo actual. |
| `/ayuda` | `/ayuda` | Muestra la guía interactiva completa de comandos en el chat. |

---

## ☁️ Despliegue 24/7 en Render (100% Gratuito)

1. En [Render.com](https://render.com), creá un **Web Service** conectado a `martin-ratti/wpp-countdown-bot`.
2. Esperá a que termine el build y en la pestaña **Logs** escaneá el **código QR** desde WhatsApp.
3. Entrá al grupo donde quieras usarlo y enviá:
   ```text
   /activar
   ```
4. ¡Listo! A partir de ese momento tus amigos ya pueden usar `/temp` y `/eventos` en ese grupo.
