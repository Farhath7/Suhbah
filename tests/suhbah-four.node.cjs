const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const helper = source.slice(source.indexOf('function openSuhbahFour('), source.indexOf('async function handleApiWithDb('));
const open = vm.runInNewContext(`${helper}; openSuhbahFour`);
const dataset = () => ({ events: [{ id: 'event-7', number: 'Suhbah 03', status: 'past', registrationStatus: 'Closed' }], registrations: [{ id: 'old-registration', eventId: 'event-7' }] });

test('opens the fourth gathering with the confirmed schedule without changing old records', () => {
  const db = dataset();
  const before = structuredClone(db);
  open(db);
  const event = db.events[0];
  assert.equal(event.id, 'event-suhbah-04');
  assert.equal(event.number, 'Suhbah 04');
  assert.equal(event.date, '2026-12-06');
  assert.equal(event.time, '3:00 - 5:00 PM');
  assert.equal(event.theme, 'Theme to be announced');
  assert.equal(event.location, 'Venue to be announced');
  assert.equal(event.status, 'upcoming');
  assert.equal(event.registrationStatus, 'Open');
  assert.equal(event.communityGroupLink, '');
  assert.deepEqual(db.events[1], before.events[0]);
  assert.deepEqual(db.registrations, before.registrations);
  event.theme = 'Later admin theme';
  event.registrationStatus = 'Closed';
  open(db);
  assert.equal(db.events.length, 2);
  assert.equal(event.theme, 'Later admin theme');
  assert.equal(event.registrationStatus, 'Closed');
  db.events.shift();
  open(db);
  assert.equal(db.events.length, 1, 'Do not recreate an event deleted later by an admin');
});

test('preserves an existing fourth gathering and ignores unrelated data', () => {
  const db = dataset();
  const fourth = { id: 'existing-fourth', number: 'Suhbah #04', theme: 'Saved theme', registrationStatus: 'Closed' };
  db.events.push(fourth);
  open(db);
  assert.equal(db.events.length, 2);
  assert.equal(db.events[1], fourth);
  assert.equal(fourth.registrationStatus, 'Closed');
  const unrelated = { events: [], registrations: [] };
  open(unrelated);
  assert.deepEqual(unrelated, { events: [], registrations: [] });
});
