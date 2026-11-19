const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const helper = source.slice(source.indexOf('function addSuhbahFourWhatsapp('), source.indexOf('async function handleApiWithDb('));
const apply = vm.runInNewContext(`${helper}; addSuhbahFourWhatsapp`);
test('adds the supplied group only to Suhbah 04 and preserves later admin edits', () => {
  const event = { id: 'event-suhbah-04', number: 'Suhbah 04', communityGroupLink: '' };
  const other = { id: 'event-7', number: 'Suhbah #03', communityGroupLink: '' };
  const db = { events: [event, other], registrations: [{ id: 'unchanged' }] };
  apply(db);
  assert.equal(event.communityGroupLink, 'https://chat.whatsapp.com/KPxySuH09vEGCReEI8F22r?s=cl&p=i&iam=2');
  assert.equal(other.communityGroupLink, '');
  assert.deepEqual(db.registrations, [{ id: 'unchanged' }]);
  event.communityGroupLink = '';
  apply(db);
  assert.equal(event.communityGroupLink, '', 'Do not undo a later removal by the admin');
});
test('preserves existing group links and does not affect unrelated datasets', () => {
  const event = { id: 'event-suhbah-04', number: 'Suhbah #04', communityGroupLink: 'https://chat.whatsapp.com/later-group' };
  apply({ events: [event] });
  assert.equal(event.communityGroupLink, 'https://chat.whatsapp.com/later-group');
  const db = { events: [{ id: 'unrelated', number: 'Suhbah 04' }] };
  const before = structuredClone(db);
  apply(db);
  assert.deepEqual(db, before);
});
