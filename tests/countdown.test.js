import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEventInput,
  getRemainingTime,
  formatDuration,
  buildTempResponse,
  buildEventsListResponse
} from '../src/countdown.js';
import {
  addEvent,
  getEvents,
  findEvent,
  removeEvent,
  clearAllEvents,
  isChatActive,
  activateChat,
  deactivateChat
} from '../src/storage.js';

test('parseEventInput: valida formato correcto y rechaza más de 80 caracteres', () => {
  const result = parseEventInput('25/12/2026 21:30 Fiesta de Navidad');
  assert.equal(result.valid, true);
  assert.equal(result.name, 'Fiesta de Navidad');

  const longText = 'A'.repeat(81);
  const tooLong = parseEventInput(`25/12/2026 21:30 ${longText}`);
  assert.equal(tooLong.valid, false);
  assert.match(tooLong.error, /demasiado largo/i);
});

test('buildEventsListResponse: formatea correctamente lista numerada de múltiples eventos', () => {
  const events = [
    {
      id: 1,
      name: 'Cumple de Lucas',
      targetIso: new Date(2027, 0, 15, 21, 0).toISOString(),
      formattedDate: '15/01/2027 21:00 hs'
    }
  ];

  const output = buildEventsListResponse(events, new Date(2026, 9, 31));
  assert.match(output, /Cumple de Lucas/);
  assert.match(output, /LISTA DE EVENTOS/);
});

test('storage: activación y desactivación de chats (whitelist)', () => {
  const testChat = 'whitelist-test-group@g.us';

  deactivateChat(testChat);
  assert.equal(isChatActive(testChat), false);

  const activated = activateChat(testChat);
  assert.equal(activated, true);
  assert.equal(isChatActive(testChat), true);

  const deactivated = deactivateChat(testChat);
  assert.equal(deactivated, true);
  assert.equal(isChatActive(testChat), false);
});

test('storage: soporte completo para múltiples eventos por grupo', () => {
  const testChat = 'multi-group-test@g.us';
  clearAllEvents(testChat);

  const ev1 = addEvent(testChat, {
    name: 'Asado de Fin de Año',
    targetIso: new Date(2026, 11, 31, 23, 59).toISOString(),
    formattedDate: '31/12/2026 23:59 hs'
  });
  assert.equal(ev1.total, 1);

  const ev2 = addEvent(testChat, {
    name: 'Cumple de Lucas',
    targetIso: new Date(2026, 10, 15, 21, 0).toISOString(),
    formattedDate: '15/11/2026 21:00 hs'
  });
  assert.equal(ev2.total, 2);

  const list = getEvents(testChat);
  assert.equal(list.length, 2);
  assert.equal(list[0].name, 'Cumple de Lucas');

  clearAllEvents(testChat);
  assert.equal(getEvents(testChat).length, 0);
});
