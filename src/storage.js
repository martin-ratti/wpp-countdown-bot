import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const FILE_PATH = path.join(DATA_DIR, 'events.json');

// Asegurar directorio y archivo
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(FILE_PATH)) {
  fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2), 'utf-8');
}

/**
 * Normaliza los eventos asegurando que siempre sean un array ordenado por fecha
 * @param {Array | Object} raw
 * @returns {Array<{ id: number, name: string, targetIso: string, formattedDate: string, setBy?: string, createdAt: string }>}
 */
function normalizeEventsList(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];

  // Ordenar por fecha cronológica ascendente
  list.sort((a, b) => new Date(a.targetIso).getTime() - new Date(b.targetIso).getTime());

  // Asignar IDs secuenciales (1, 2, 3...)
  return list.map((evt, idx) => ({
    ...evt,
    id: idx + 1
  }));
}

/**
 * Lee la base de datos de eventos
 */
export function getAllData() {
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error al leer events.json:', error);
    return {};
  }
}

/**
 * Guarda los datos en disco
 */
export function saveData(data) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Obtiene todos los eventos de un chat/grupo específico
 * @param {string} chatId
 */
export function getEvents(chatId) {
  const data = getAllData();
  return normalizeEventsList(data[chatId]);
}

/**
 * Agrega un nuevo evento al grupo y reordena la lista por fecha
 * @param {string} chatId
 * @param {{ name: string, targetIso: string, formattedDate: string, setBy?: string }} eventData
 */
export function addEvent(chatId, eventData) {
  const data = getAllData();
  const currentList = normalizeEventsList(data[chatId]);

  currentList.push({
    ...eventData,
    createdAt: new Date().toISOString()
  });

  const updatedList = normalizeEventsList(currentList);
  data[chatId] = updatedList;
  saveData(data);

  // Retorna el evento recién agregado con su nuevo ID
  const saved = updatedList.find((e) => e.targetIso === eventData.targetIso && e.name === eventData.name) || updatedList[updatedList.length - 1];
  return { event: saved, total: updatedList.length };
}

/**
 * Busca un evento por índice/número o por texto del nombre
 * @param {string} chatId
 * @param {string} [query]
 */
export function findEvent(chatId, query) {
  const events = getEvents(chatId);
  if (events.length === 0) return null;

  if (!query || query.trim() === '') {
    // Si no se especifica búsqueda, devuelve el próximo evento futuro más cercano
    const now = Date.now();
    const upcoming = events.find((e) => new Date(e.targetIso).getTime() >= now);
    return upcoming || events[0];
  }

  const q = query.trim();
  const num = parseInt(q, 10);

  // Búsqueda por número (#1, #2...)
  if (!isNaN(num) && num > 0) {
    return events.find((e) => e.id === num) || null;
  }

  // Búsqueda por coincidencia de nombre (insensible a mayúsculas/minúsculas)
  const lower = q.toLowerCase();
  return events.find((e) => e.name.toLowerCase().includes(lower)) || null;
}

/**
 * Elimina un evento específico (por ID o nombre)
 * @param {string} chatId
 * @param {string} query
 * @returns {{ success: boolean, removed?: object, remainingCount: number }}
 */
export function removeEvent(chatId, query) {
  const data = getAllData();
  const events = normalizeEventsList(data[chatId]);
  if (events.length === 0) return { success: false, remainingCount: 0 };

  const target = findEvent(chatId, query);
  if (!target) {
    return { success: false, remainingCount: events.length };
  }

  const filtered = events.filter((e) => e.id !== target.id);
  const updated = normalizeEventsList(filtered);

  if (updated.length === 0) {
    delete data[chatId];
  } else {
    data[chatId] = updated;
  }

  saveData(data);
  return { success: true, removed: target, remainingCount: updated.length };
}

/**
 * Elimina todos los eventos de un grupo
 * @param {string} chatId
 */
export function clearAllEvents(chatId) {
  const data = getAllData();
  if (!data[chatId]) return false;
  delete data[chatId];
  saveData(data);
  return true;
}
