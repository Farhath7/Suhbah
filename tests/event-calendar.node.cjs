const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../suhbah.js'), 'utf8');
const helper = source.slice(source.indexOf('  function googleCalendarUrl('), source.indexOf('  function eventCalendarOption('));
const makeUrl = vm.runInNewContext(`(${helper.trim()})`, {
  URL, URLSearchParams,
  window: { location: { origin: 'https://suhbah-connect.vercel.app' } },
  registrationUrl: (event) => `/register/${event.id}`,
});
const event = { id: 'event-7', number: 'Suhbah 03', theme: 'Trials & Reflection', date: '2026-11-01', time: '3:00 - 5:00 PM', location: 'Aspire Tutorials, Bengaluru', description: 'A gathering around the Quran.', mapUrl: 'https://maps.google.com/?q=Aspire' };

test('uses the event schedule in India time and includes public event details', () => {
  const url = new URL(makeUrl(event));
  assert.equal(url.origin, 'https://calendar.google.com');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('dates'), '20261101T150000/20261101T170000');
  assert.equal(url.searchParams.get('ctz'), 'Asia/Kolkata');
  assert.equal(url.searchParams.get('text'), 'Suhbah 03: Trials & Reflection');
  assert.equal(url.searchParams.get('location'), event.location);
  assert.ok(url.searchParams.get('details').includes('https://suhbah-connect.vercel.app/register/event-7'));
  assert.ok(url.searchParams.get('details').includes(event.mapUrl));
});

test('handles noon, midnight, 24-hour schedules, and overnight month rollover', () => {
  for (const [time, date, expected] of [
    ['11 - 1 PM', '2026-11-01', '20261101T110000/20261101T130000'],
    ['12 AM - 2 AM', '2026-11-01', '20261101T000000/20261101T020000'],
    ['12 PM – 2 PM', '2026-11-01', '20261101T120000/20261101T140000'],
    ['15:00 - 17:30', '2026-11-01', '20261101T150000/20261101T173000'],
    ['11 PM - 1 AM', '2026-12-31', '20261231T230000/20270101T010000'],
  ]) assert.equal(new URL(makeUrl({ ...event, time, date })).searchParams.get('dates'), expected);
});

test('omits a misleading link for invalid or incomplete schedules', () => {
  for (const time of ['To be announced', '5 PM', '25:00 - 26:00', '3:99 - 5 PM', '5 PM - 5 PM']) {
    assert.equal(makeUrl({ ...event, time }), '');
  }
  assert.equal(makeUrl({ ...event, date: '2026-02-30' }), '');
  assert.equal(makeUrl(undefined), '');
});
