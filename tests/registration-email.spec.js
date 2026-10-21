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
  expect(message.from.address).toBe('suhbah.connect@gmail.com');
  expect(message.to.address).toBe(registration.email);
  for (const value of [registration.name, event.number, event.theme, event.date, event.time, event.location, event.communityGroupLink]) {
    expect(message.text).toContain(value);
  }
  expect(message.subject).toContain('Registration confirmed');
  await sender({ ...registration, registrationStatus: 'Waitlist' }, { ...event, communityGroupLink: 'javascript:alert(1)' });
  expect(message.subject).toContain('Waitlist confirmation');
  expect(message.text).toContain('We will contact you if a spot opens.');
  expect(message.text).not.toContain('Your spot is reserved');
  expect(message.text).not.toContain('javascript:');
});

test('email is disabled without credentials and rejects unaccepted mail', async () => {
  expect(createConfirmationSender({})).toBeNull();
  const sender = createConfirmationSender({}, { sendMail: async () => ({ accepted: [] }) });
  await expect(sender(registration, event)).rejects.toThrow('not accepted');
});
