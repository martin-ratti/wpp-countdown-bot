import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Asegurar directorio y archivos base
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(EVENTS_FILE)) {
  fs.writeFileSync(EVENTS_FILE, JSON.stringify({}, null, 2), 'utf-8');
}

if (!fs.existsSync(SETTINGS_FILE)) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ activeChats: [] }, null, 2), 'utf-8');
}

/**
 * Lee la configuración general (chats activados)
 */
export function getSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { activeChats: [] };
  }
}

/**
 * Guarda la configuración general
 */
export function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Verifica si un chat o grupo tiene el bot activado
 * @param {string} chatId
 * @returns {boolean}
 */
export function isChatActive(chatId) {
  const settings = getSettings();
  return Array.isArray(settings.activeChats) && settings.activeChats.includes(chatId);
}

/**
 * Activa el bot en un chat o grupo (Solo permitido por el dueño)
 * @param {string} chatId
 * @returns {boolean}
 */
export function activateChat(chatId) {
  const settings = getSettings();
  if (!Array.isArray(settings.activeChats)) {
    settings.activeChats = [];
  }
  if (!settings.activeChats.includes(chatId)) {
    settings.activeChats.push(chatId);
    saveSettings(settings);
    return true;
  }
  return false; // Ya estaba activo
}

/**
 * Desactiva el bot en un chat o grupo
 * @param {string} chatId
 * @returns {boolean}
 */
export function deactivateChat(chatId) {
  const settings = getSettings();
  if (!Array.isArray(settings.activeChats)) return false;

  const initialLen = settings.activeChats.length;
  settings.activeChats = settings.activeChats.filter((id) => id !== chatId);
  saveSettings(settings);
  return settings.activeChats.length < initialLen;
}

/**
 * Normaliza los eventos asegurando que siempre sean un array ordenado por fecha
 */
function normalizeEventsList(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];

  list.sort((a, b) => new Date(a.targetIso).getTime() - new Date(b.targetIso).getTime());

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
    const raw = fs.readFileSync(EVENTS_FILE, 'utf-8');
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
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
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

  const saved = updatedList.find((e) => e.targetIso === eventData.targetIso && e.name === eventData.name) || updatedList[updatedList.length - 1];
  return { event: saved, total: updatedList.length };
}

/**
 * Busca un evento por índice/número o por texto del nombre
 */
export function findEvent(chatId, query) {
  const events = getEvents(chatId);
  if (events.length === 0) return null;

  if (!query || query.trim() === '') {
    const now = Date.now();
    const upcoming = events.find((e) => new Date(e.targetIso).getTime() >= now);
    return upcoming || events[0];
  }

  const q = query.trim();
  const num = parseInt(q, 10);

  if (!isNaN(num) && num > 0) {
    return events.find((e) => e.id === num) || null;
  }

  const lower = q.toLowerCase();
  return events.find((e) => e.name.toLowerCase().includes(lower)) || null;
}

/**
 * Elimina un evento específico (por ID o nombre)
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
 */
export function clearAllEvents(chatId) {
  const data = getAllData();
  if (!data[chatId]) return false;
  delete data[chatId];
  saveData(data);
  return true;
}
