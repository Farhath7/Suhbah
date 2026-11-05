const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const helper = source.slice(source.indexOf('function archiveSuhbahThree('), source.indexOf('async function handleApiWithDb('));
const { archiveSuhbahThree: archive, addSuhbahThreeImage: addImage } = vm.runInNewContext(`${helper}; ({ archiveSuhbahThree, addSuhbahThreeImage })`);

test('archives the existing third session without duplicating it or changing other records', () => {
  const event = { id: 'event-7', number: 'Suhbah 03', theme: 'A Matter of Choice', status: 'upcoming', registrationStatus: 'Open',
    description: 'Old topic', image: '/assets/suhbah-03-trials-that-define-us.webp', date: '2026-11-01', speechLink: '/saved.pdf' };
  const other = { id: 'event-2', theme: "Who's in your Cave?", status: 'past' };
  const db = { events: [event, other], registrations: [{ eventId: 'event-7' }] };
  const before = structuredClone(db);
  archive(db);
  assert.equal(event.theme, 'Did I think ?');
  assert.equal(event.status, 'past');
  assert.equal(event.registrationStatus, 'Closed');
  assert.equal(event.image, '');
  assert.equal(event.date, before.events[0].date);
  assert.equal(event.speechLink, '/assets/speeches/suhbah-03-did-i-think.pdf');
  assert.equal(event.recap.split('\n').length, 10);
  assert.ok(event.recap.includes('Switch off autopilot.'));
  assert.equal(db.events.length, 2);
  assert.deepEqual(other, before.events[1]);
  assert.deepEqual(db.registrations, before.registrations);
  const saved = JSON.parse(JSON.stringify(db));
  saved.events[0].theme = 'Later admin edit';
  saved.events[0].recap = 'Later summary edit';
  saved.events[0].speechLink = '/later.pdf';
  archive(saved);
  assert.equal(saved.events[0].theme, 'Later admin edit');
  assert.equal(saved.events[0].recap, 'Later summary edit');
  assert.equal(saved.events[0].speechLink, '/later.pdf');
});

test('leaves unrelated databases and a repurposed event alone', () => {
  for (const events of [[], [{ id: 'event-7', number: 'Suhbah 04', status: 'upcoming' }]]) {
    const db = { events };
    const before = structuredClone(db);
    archive(db);
    addImage(db);
    assert.deepEqual(db, before);
  }
});

test('adds matching artwork without resetting saved session content or later image edits', () => {
  const event = { id: 'event-7', number: 'Suhbah 03', theme: 'Did I think ?', image: '', recap: 'Saved recap', speechLink: '/saved.pdf', status: 'past' };
  const db = { events: [event], contentMigrations: ['archive-suhbah-03-did-i-think-session-document'] };
  addImage(db);
  assert.equal(event.image, '/assets/suhbah-03-did-i-think-poster.webp');
  assert.equal(event.recap, 'Saved recap');
  assert.equal(event.speechLink, '/saved.pdf');
  event.image = '/later-admin-upload.webp';
  addImage(db);
  assert.equal(event.image, '/later-admin-upload.webp');
});
