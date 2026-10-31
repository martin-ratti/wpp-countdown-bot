import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEventInput,
  getRemainingTime,
  formatDuration,
  buildTempResponse,
  buildEventsListResponse
} from '../src/countdown.js';
import { addEvent, getEvents, findEvent, removeEvent, clearAllEvents } from '../src/storage.js';

test('parseEventInput: valida formato correcto y rechaza más de 80 caracteres', () => {
  const result = parseEventInput('25/12/2026 21:30 Fiesta de Navidad');
  assert.equal(result.valid, true);
  assert.equal(result.name, 'Fiesta de Navidad');

  const longText = 'A'.repeat(81);
  const tooLong = parseEventInput(`25/12/2026 21:30 ${longText}`);
  assert.equal(tooLong.valid, false);
  assert.match(tooLong.error, /demasiado largo/i);
});

test('parseEventInput: parsea correctamente sin hora (asume 00:00)', () => {
  const result = parseEventInput('01-01-2027 Año Nuevo');
  assert.equal(result.valid, true);
  assert.equal(result.name, 'Año Nuevo');
  assert.equal(result.formattedDate, '01/01/2027 00:00 hs');
});

test('buildEventsListResponse: formatea correctamente lista numerada de múltiples eventos', () => {
  const events = [
    {
      id: 1,
      name: 'Cumple de Lucas',
      targetIso: new Date(2027, 0, 15, 21, 0).toISOString(),
      formattedDate: '15/01/2027 21:00 hs'
    },
    {
      id: 2,
      name: 'Asado',
      targetIso: new Date(2027, 0, 20, 20, 0).toISOString(),
      formattedDate: '20/01/2027 20:00 hs'
    }
  ];

  const output = buildEventsListResponse(events, new Date(2026, 9, 31));
  assert.match(output, /Cumple de Lucas/);
  assert.match(output, /Asado/);
  assert.match(output, /LISTA DE EVENTOS/);
});

test('storage: soporte completo para múltiples eventos por grupo', () => {
  const testChat = 'multi-group-test@g.us';
  clearAllEvents(testChat);

  // 1. Agregar primer evento
  const ev1 = addEvent(testChat, {
    name: 'Asado de Fin de Año',
    targetIso: new Date(2026, 11, 31, 23, 59).toISOString(),
    formattedDate: '31/12/2026 23:59 hs'
  });
  assert.equal(ev1.total, 1);

  // 2. Agregar segundo evento anterior en fecha (debe quedar #1)
  const ev2 = addEvent(testChat, {
    name: 'Cumple de Lucas',
    targetIso: new Date(2026, 10, 15, 21, 0).toISOString(),
    formattedDate: '15/11/2026 21:00 hs'
  });
  assert.equal(ev2.total, 2);

  const list = getEvents(testChat);
  assert.equal(list.length, 2);
  assert.equal(list[0].name, 'Cumple de Lucas'); // El más cercano queda #1
  assert.equal(list[1].name, 'Asado de Fin de Año');

  // 3. Buscar por número y por nombre
  const foundByNum = findEvent(testChat, '1');
  assert.equal(foundByNum.name, 'Cumple de Lucas');

  const foundByName = findEvent(testChat, 'asado');
  assert.equal(foundByName.name, 'Asado de Fin de Año');

  // 4. Eliminar uno específico
  const removeRes = removeEvent(testChat, '1');
  assert.equal(removeRes.success, true);
  assert.equal(removeRes.remainingCount, 1);

  const remaining = getEvents(testChat);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].name, 'Asado de Fin de Año');
  assert.equal(remaining[0].id, 1); // Re-indexado a 1

  // 5. Limpiar todos
  clearAllEvents(testChat);
  assert.equal(getEvents(testChat).length, 0);
});
