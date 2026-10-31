import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEventInput, getRemainingTime, formatDuration, buildTempResponse } from '../src/countdown.js';
import { setEvent, getEvent, removeEvent } from '../src/storage.js';

test('parseEventInput: parsea correctamente fecha con hora y nombre', () => {
  const result = parseEventInput('25/12/2026 21:30 Fiesta de Navidad');
  assert.equal(result.valid, true);
  assert.equal(result.name, 'Fiesta de Navidad');
  assert.equal(result.formattedDate, '25/12/2026 21:30 hs');
  assert.equal(result.targetDate.getDate(), 25);
  assert.equal(result.targetDate.getMonth(), 11); // Diciembre es 11
  assert.equal(result.targetDate.getFullYear(), 2026);
  assert.equal(result.targetDate.getHours(), 21);
  assert.equal(result.targetDate.getMinutes(), 30);
});

test('parseEventInput: parsea correctamente sin hora (asume 00:00)', () => {
  const result = parseEventInput('01-01-2027 Año Nuevo');
  assert.equal(result.valid, true);
  assert.equal(result.name, 'Año Nuevo');
  assert.equal(result.formattedDate, '01/01/2027 00:00 hs');
  assert.equal(result.targetDate.getHours(), 0);
  assert.equal(result.targetDate.getMinutes(), 0);
});

test('parseEventInput: rechaza fechas inexistentes (31 de febrero)', () => {
  const result = parseEventInput('31/02/2027 Evento Imposible');
  assert.equal(result.valid, false);
  assert.match(result.error, /no existe en el calendario/i);
});

test('parseEventInput: rechaza formatos sin nombre', () => {
  const result = parseEventInput('25/12/2026 20:00');
  assert.equal(result.valid, false);
});

test('formatDuration: formatea días, horas y minutos correctamente', () => {
  const text = formatDuration({ days: 5, hours: 3, minutes: 12, seconds: 40 });
  assert.equal(text, '5 días, 3 horas y 12 minutos');

  const textSingular = formatDuration({ days: 1, hours: 1, minutes: 1, seconds: 0 });
  assert.equal(textSingular, '1 día, 1 hora y 1 minuto');

  const onlySeconds = formatDuration({ days: 0, hours: 0, minutes: 0, seconds: 45 });
  assert.equal(onlySeconds, '45 segundos');
});

test('getRemainingTime: calcula tiempo restante y fechas pasadas', () => {
  const base = new Date(2026, 9, 31, 12, 0, 0); // 31 Oct 2026 12:00
  const future = new Date(2026, 9, 31, 15, 30, 0); // +3h 30m

  const remaining = getRemainingTime(future, base);
  assert.equal(remaining.isPast, false);
  assert.equal(remaining.hours, 3);
  assert.equal(remaining.minutes, 30);

  const past = new Date(2026, 9, 30, 12, 0, 0); // -1 día
  const remainingPast = getRemainingTime(past, base);
  assert.equal(remainingPast.isPast, true);
  assert.equal(remainingPast.days, 1);
});

test('buildTempResponse: devuelve instrucciones si no hay evento', () => {
  const response = buildTempResponse(null);
  assert.match(response, /No hay ningún evento configurado/i);
});

test('buildTempResponse: devuelve cuenta regresiva si hay evento futuro', () => {
  const now = new Date(2026, 9, 31, 12, 0, 0);
  const event = {
    name: 'Asado',
    targetIso: new Date(2026, 9, 31, 16, 0, 0).toISOString(),
    formattedDate: '31/10/2026 16:00 hs'
  };

  const response = buildTempResponse(event, now);
  assert.match(response, /Cuenta Regresiva: Asado/i);
  assert.match(response, /4 horas/i);
});

test('storage: set, get y remove funcionan correctamente', () => {
  const testChatId = 'test-group-12345@g.us';
  setEvent(testChatId, {
    name: 'Prueba de Grupo',
    targetIso: new Date(2027, 0, 1).toISOString(),
    formattedDate: '01/01/2027 00:00 hs',
    setBy: 'user-1'
  });

  const event = getEvent(testChatId);
  assert.ok(event);
  assert.equal(event.name, 'Prueba de Grupo');

  const removed = removeEvent(testChatId);
  assert.equal(removed, true);
  assert.equal(getEvent(testChatId), null);
});
