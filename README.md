# ⏳ Bot de WhatsApp para Cuenta Regresiva (`/temp`)

Bot de WhatsApp en Node.js que permite configurar eventos y calcular cuentas regresivas precisas en grupos o chats privados.

---

## 🚀 Comandos Disponibles

| Comando | Ejemplo | Descripción |
| :--- | :--- | :--- |
| `/temp` | `/temp` | Muestra el tiempo restante exacto para el evento configurado en el grupo. |
| `/set` | `/set 25/12/2026 21:00 Navidad` | Configura o actualiza el evento (`DD/MM/AAAA HH:mm Nombre`). |
| `/set` (sin hora) | `/set 01/01/2027 Año Nuevo` | Si no indicás la hora, asume automáticamente las `00:00 hs`. |
| `/cleartemp` | `/cleartemp` | Elimina la cuenta regresiva del grupo actual. |
| `/ayuda` | `/ayuda` | Muestra la guía de comandos en el chat. |

> 💡 **Nota:** Cada grupo de WhatsApp tiene su propia cuenta regresiva independiente. Lo que configures en un grupo no afectará a los demás.

---

## 💻 Opción 1: Ejecutarlo en tu PC Local

### Requisitos
- Node.js versión 18 o superior instalado.
- pnpm instalado (`npm install -g pnpm`).

### Pasos
1. Abrí una terminal o consola de comandos en esta carpeta (`wpp-countdown-bot`).
2. Instalás las dependencias:
   ```bash
   pnpm install
   ```
3. Iniciás el bot:
   ```bash
   pnpm start
   ```
4. En la terminal se mostrará un **código QR**.
5. Abrí WhatsApp en tu teléfono:
   - Andá a **Ajustes / Configuración** > **Dispositivos vinculados**.
   - Tocá en **Vincular un dispositivo** y escaneá el código QR de la terminal.
6. ¡Listo! Ya podés agregar el número a cualquier grupo y probar `/temp`.

---

## ☁️ Opción 2: Desplegarlo en la Nube 24/7 (Railway)

Para que funcione sin necesidad de tener tu computadora encendida:

1. El repositorio ya está configurado con Docker y `pnpm` para desplegar automáticamente en Railway.
2. En Railway:
   - Creá un nuevo proyecto y seleccioná **"Deploy from GitHub repo"** conectando este repositorio.
   - En la sección **"Deployments"** > **"View Logs"**, escaneá el código QR desde tu WhatsApp.
   - En los settings del servicio en Railway, agrega un **Volume** montado en `/app/auth_info` y `/app/data` para persistir la sesión.

---

## 🧪 Pruebas Unitarias

Para verificar que todos los cálculos matemáticos de fechas, validaciones y persistencia funcionan sin errores:

```bash
pnpm test
```
