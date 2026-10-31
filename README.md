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
| `/ayuda` | `/ayuda` | Muestra la guía interactiva completa de comandos en el chat. |

> 🛡️ **Anti-Spam:** Cuenta con un tiempo de enfriamiento (cooldown) de 3 segundos por chat entre comandos.

---

## ☁️ Despliegue en la Nube 24/7

### Opción A: Render (Web Service)
1. Hacé un Fork de este repositorio a tu cuenta de GitHub.
2. En [Render.com](https://render.com), creá un nuevo **Web Service**.
3. Conectá **tu repositorio forkeado** (`<tu-usuario>/wpp-countdown-bot`).
4. Render detectará automáticamente la configuración o podés indicar:
   - **Runtime:** Node
   - **Build Command:** `npm install -g pnpm && pnpm config set minimum-release-age 0 && pnpm install`
   - **Start Command:** `pnpm start`
5. En la pestaña **Logs** de Render, escaneá el **código QR** desde WhatsApp.
6. Entrá a tu grupo y enviá `/activar`.

### Opción B: Railway / Docker (Recomendado para persistencia)
El proyecto incluye un `Dockerfile` con volúmenes definidos en `/app/auth_info` y `/app/data` para que no pierdas la sesión ni los eventos al reiniciar el contenedor:

```bash
docker build -t wpp-countdown-bot .
docker run -d --name mi-bot -v ./auth_info:/app/auth_info -v ./data:/app/data wpp-countdown-bot
```

---

## 🧪 Pruebas Automatizadas

Podés ejecutar la suite de pruebas unitarias ejecutando:
```bash
pnpm test
```
