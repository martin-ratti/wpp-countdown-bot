/**
 * Parsea una cadena de texto para extraer fecha, hora y nombre de evento.
 * Formatos aceptados:
 * - "25/12/2026 20:30 Fiesta de Fin de Año"
 * - "25/12/2026 Navidad" (asume 00:00 hs)
 * - "25-12-2026 20:30 Fiesta"
 *
 * @param {string} text
 * @returns {{ valid: boolean, error?: string, targetDate?: Date, targetIso?: string, formattedDate?: string, name?: string }}
 */
export function parseEventInput(text) {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: 'Texto vacío o no válido.' };
  }

  const trimmed = text.trim();

  // 1. Extraer la fecha (DD/MM/AAAA o DD-MM-AAAA)
  const dateMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/s);
  if (!dateMatch) {
    return {
      valid: false,
      error: 'Formato incorrecto. La fecha debe comenzar con DD/MM/AAAA.\nEjemplo: */set 25/12/2026 21:00 Asado*'
    };
  }

  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);
  const remainder = dateMatch[4].trim();

  if (!remainder) {
    return {
      valid: false,
      error: 'Debes indicar el nombre del evento después de la fecha.\nEjemplo: */set 25/12/2026 21:00 Asado*'
    };
  }

  // 2. Comprobar si hay hora (HH:mm o HH:mm:ss) al inicio del resto del texto
  const timeMatch = remainder.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(.*)$/s);
  let hour = 0;
  let minute = 0;
  let second = 0;
  let name = '';

  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
    second = timeMatch[3] !== undefined ? parseInt(timeMatch[3], 10) : 0;
    name = timeMatch[4].trim();
  } else {
    name = remainder;
  }

  if (!name) {
    return {
      valid: false,
      error: 'Debes ingresar un nombre para el evento después de la fecha/hora.\nEjemplo: */set 25/12/2026 21:00 Asado*'
    };
  }

  // Validación de longitud máxima (Seguridad contra ReDoS/Memoria)
  if (name.length > 80) {
    return {
      valid: false,
      error: `El nombre del evento es demasiado largo (${name.length} caracteres). El máximo permitido es 80 caracteres.`
    };
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: 'El mes debe estar entre 1 y 12.' };
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return { valid: false, error: 'La hora o minutos no son válidos (00:00 a 23:59).' };
  }

  // Crear objeto Date local
  const dateObj = new Date(year, month - 1, day, hour, minute, second);

  // Validar que el día pertenezca al mes (ej: rechazar 31/02)
  if (
    dateObj.getFullYear() !== year ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getDate() !== day
  ) {
    return { valid: false, error: 'La fecha ingresada no existe en el calendario.' };
  }

  const pad = (n) => String(n).padStart(2, '0');
  const formattedDate = `${pad(day)}/${pad(month)}/${year} ${pad(hour)}:${pad(minute)} hs`;

  return {
    valid: true,
    targetDate: dateObj,
    targetIso: dateObj.toISOString(),
    formattedDate,
    name
  };
}

/**
 * Calcula la diferencia de tiempo entre ahora y una fecha objetivo
 * @param {Date | string} target
 * @param {Date} [now=new Date()]
 * @returns {{ isPast: boolean, diffMs: number, days: number, hours: number, minutes: number, seconds: number }}
 */
export function getRemainingTime(target, now = new Date()) {
  const targetDate = typeof target === 'string' ? new Date(target) : target;
  const diffMs = targetDate.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const absDiff = Math.abs(diffMs);

  const seconds = Math.floor((absDiff / 1000) % 60);
  const minutes = Math.floor((absDiff / (1000 * 60)) % 60);
  const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  return {
    isPast,
    diffMs,
    days,
    hours,
    minutes,
    seconds
  };
}

/**
 * Formatea una duración en texto en español ("X días, Y horas y Z minutos")
 * @param {{ days: number, hours: number, minutes: number, seconds: number }} time
 * @returns {string}
 */
export function formatDuration({ days, hours, minutes, seconds }) {
  const parts = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  }
  if (days === 0 && seconds > 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`);
  }

  if (parts.length === 0) {
    return '0 segundos';
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const lastPart = parts.pop();
  return `${parts.join(', ')} y ${lastPart}`;
}

/**
 * Construye el mensaje completo de respuesta para el comando /temp
 * @param {{ id?: number, name: string, targetIso: string, formattedDate: string } | null} event
 * @param {Date} [now=new Date()]
 * @param {number} [totalEvents=1]
 * @returns {string}
 */
export function buildTempResponse(event, now = new Date(), totalEvents = 1) {
  if (!event) {
    return (
      'ℹ️ *No hay ningún evento activo en este grupo.*\n\n' +
      'Podés crear uno con:\n' +
      '👉 */set DD/MM/AAAA HH:mm Nombre del evento*\n' +
      'Ejemplo: */set 31/12/2026 23:59 Fin de Año*'
    );
  }

  const { isPast, days, hours, minutes, seconds } = getRemainingTime(event.targetIso, now);

  const eventTitle = event.id ? `[#${event.id}] ${event.name}` : event.name;

  if (isPast) {
    const elapsedText = formatDuration({ days, hours, minutes, seconds });
    return (
      `🎉 ¡El evento *${eventTitle}* ya se cumplió!\n` +
      `📅 Fecha programada: ${event.formattedDate}\n` +
      `⏱️ Pasó hace: *${elapsedText}*.\n\n` +
      `Podés ver los demás con */eventos* o agregar uno con */set*.`
    );
  }

  const remainingText = formatDuration({ days, hours, minutes, seconds });
  let msg =
    `⏳ *Cuenta Regresiva: ${eventTitle}*\n\n` +
    `Faltan: *${remainingText}*\n` +
    `📅 Fecha objetivo: ${event.formattedDate}`;

  if (totalEvents > 1) {
    msg += `\n\n💡 _Hay ${totalEvents} eventos registrados. Usá */eventos* para ver la lista completa._`;
  }

  return msg;
}

/**
 * Construye la lista de eventos para el comando /eventos
 * @param {Array<{ id: number, name: string, targetIso: string, formattedDate: string }>} events
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function buildEventsListResponse(events, now = new Date()) {
  if (!events || events.length === 0) {
    return (
      'ℹ️ *No hay eventos registrados en este grupo.*\n\n' +
      'Para registrar uno, usa:\n' +
      '👉 */set DD/MM/AAAA HH:mm Nombre del evento*'
    );
  }

  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  let text = `📅 *LISTA DE EVENTOS DEL GRUPO (${events.length})*\n\n`;

  events.forEach((evt, idx) => {
    const numIcon = idx < numberEmojis.length ? numberEmojis[idx] : `#${evt.id}`;
    const { isPast, days, hours, minutes, seconds } = getRemainingTime(evt.targetIso, now);

    text += `${numIcon} *${evt.name}*\n`;
    text += `   📅 ${evt.formattedDate}\n`;

    if (isPast) {
      text += `   ✅ _Ya finalizó hace ${formatDuration({ days, hours, minutes, seconds })}_\n\n`;
    } else {
      text += `   ⏳ _Faltan ${formatDuration({ days, hours, minutes, seconds })}_\n\n`;
    }
  });

  text += `💡 *Comandos útiles:*\n`;
  text += `• */temp [número o nombre]* para ver uno en detalle\n`;
  text += `• */deltemp [número]* para borrar un evento específico\n`;
  text += `• */cleartemp* para borrar todos los eventos del grupo`;

  return text;
}
