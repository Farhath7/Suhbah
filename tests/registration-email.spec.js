const { test, expect } = require('playwright/test');
const { createConfirmationSender } = require('../registration-email');

const event = { number: 'Suhbah 03', theme: 'Finding Your Way Back', date: '2026-10-24', time: '3:00 - 5:00 PM', location: 'Bangalore', communityGroupLink: 'https://chat.whatsapp.com/test-group' };
const registration = { name: 'Aisha', email: 'attendee@example.test', registrationStatus: 'Open' };

test('confirmation contains event details, the right group and sender', async () => {
  let message;
  const sender = createConfirmationSender({}, { sendMail: async (mail) => {
    message = mail;
    return { accepted: [registration.email], messageId: 'test-message' };
  } });
  await expect(sender(registration, event)).resolves.toBe('test-message');
  expect(message.from.address).toBe('suhbahconnects@gmail.com');
  expect(message.to.address).toBe(registration.email);
  for (const value of [registration.name, event.number, event.theme, event.date, event.time, event.location, event.communityGroupLink]) {
    expect(message.text).toContain(value);
  }
  expect(message.subject).toContain('Registration confirmed');
  expect(message.html).toContain('Your registration is confirmed');
  expect(message.html).toContain(`href="${event.communityGroupLink}"`);
  expect(message.html).toContain('Join WhatsApp group</a>');
  expect(message.html).toContain('View location on Google Maps</a>');
  expect(message.html).not.toContain(`>${event.communityGroupLink}`);
  await sender({ ...registration, registrationStatus: 'Waitlist' }, { ...event, communityGroupLink: 'javascript:alert(1)' });
  expect(message.subject).toContain('Waitlist confirmation');
  expect(message.text).toContain('We will contact you if a spot opens.');
  expect(message.text).not.toContain('Your spot is reserved');
  expect(message.text).not.toContain('javascript:');
  expect(message.html).toContain('You’re on the waitlist');
  expect(message.html).not.toContain('Your spot is reserved');
  expect(message.html).not.toContain('javascript:');
  expect(message.html).not.toContain('Join WhatsApp group');
});

test('HTML escapes attendee and event content and preserves safe map destinations', async () => {
  let message;
  const sender = createConfirmationSender({}, { sendMail: async (mail) => {
    message = mail;
    return { accepted: [registration.email], messageId: 'escaped-message' };
  } });
  await sender({ ...registration, name: '<img src=x onerror=alert(1)>' }, {
    ...event, theme: 'Faith & Friendship <Together>',
    mapUrl: 'https://maps.google.com/?q=venue&z=15',
  });
  expect(message.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(message.html).not.toContain('<img');
  expect(message.html).toContain('Faith &amp; Friendship &lt;Together&gt;');
  expect(message.html).toContain('href="https://maps.google.com/?q=venue&amp;z=15"');
  await sender(registration, { ...event, location: '', mapUrl: 'javascript:alert(1)', communityGroupLink: '' });
  expect(message.html).not.toContain('href=');
});

test('email is disabled without credentials and rejects unaccepted mail', async () => {
  expect(createConfirmationSender({})).toBeNull();
  const sender = createConfirmationSender({}, { sendMail: async () => ({ accepted: [] }) });
  await expect(sender(registration, event)).rejects.toThrow('not accepted');
});
