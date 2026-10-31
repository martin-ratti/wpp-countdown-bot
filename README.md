# ⏳ Bot de WhatsApp para Cuenta Regresiva (`/temp`)

Bot de WhatsApp en Node.js que permite configurar múltiples eventos y calcular cuentas regresivas precisas en grupos o chats privados.

---

## 🚀 Comandos Disponibles

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

> 🛡️ **Seguridad:** Cooldown anti-spam de 3 segundos por chat y límite de 80 caracteres por evento para evitar saturaciones.

---

## ☁️ Despliegue 24/7 en Render (100% Gratuito)

Este proyecto está configurado para desplegarse como un **Free Web Service** en Render:

1. Entrá a [Render.com](https://render.com) e iniciá sesión con tu cuenta de GitHub.
2. Hacé clic en **"New +"** (arriba a la derecha) y seleccioná **"Web Service"**.
3. Conectá el repositorio **`martin-ratti/wpp-countdown-bot`**.
4. Completá los campos:
   - **Name:** `wpp-countdown-bot`
   - **Runtime:** `Node`
   - **Build Command:** `npm install -g pnpm && pnpm install --frozen-lockfile`
   - **Start Command:** `pnpm start`
   - **Plan:** `Free`
5. Hacé clic en **"Create Web Service"**.
6. En la pestaña **"Logs"** de Render, verás aparecer el **código QR**.
7. En tu teléfono, abrí WhatsApp > **Dispositivos vinculados** > **Vincular un dispositivo** y escaneá el QR desde la pantalla.
8. ¡Listo! El bot quedará conectado y respondiendo en tus grupos 24/7.

---

## 💻 Ejecutarlo Localmente en tu PC

```bash
# 1. Instalar dependencias
pnpm install

# 2. Iniciar el bot
pnpm start

# 3. Correr pruebas
pnpm test
```
