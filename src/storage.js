import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'events.json');

// Asegura que el directorio exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inicializa el archivo si no existe
if (!fs.existsSync(FILE_PATH)) {
  fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2), 'utf-8');
}

/**
 * Lee todos los eventos guardados
 * @returns {Record<string, { name: string, targetIso: string, formattedDate: string, setBy?: string, createdAt: string }>}
 */
export function getAllEvents() {
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error al leer events.json:', error);
    return {};
  }
}

/**
 * Obtiene el evento configurado para un grupo o chat específico
 * @param {string} chatId
 */
export function getEvent(chatId) {
  const events = getAllEvents();
  return events[chatId] || null;
}

/**
 * Guarda o actualiza el evento de un grupo
 * @param {string} chatId
 * @param {{ name: string, targetIso: string, formattedDate: string, setBy?: string }} eventData
 */
export function setEvent(chatId, eventData) {
  const events = getAllEvents();
  events[chatId] = {
    ...eventData,
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(FILE_PATH, JSON.stringify(events, null, 2), 'utf-8');
  return events[chatId];
}

/**
 * Elimina el evento de un grupo
 * @param {string} chatId
 * @returns {boolean} true si fue eliminado, false si no existía
 */
export function removeEvent(chatId) {
  const events = getAllEvents();
  if (!events[chatId]) {
    return false;
  }
  delete events[chatId];
  fs.writeFileSync(FILE_PATH, JSON.stringify(events, null, 2), 'utf-8');
  return true;
}
