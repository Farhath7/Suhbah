function createConfirmationSender(env = process.env, transport) {
  const user = env.GMAIL_USER || 'suhbah.connect@gmail.com';
  const password = String(env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
  if (!password && !transport) return null;
  const mailer = transport || require('nodemailer').createTransport({
    service: 'gmail',
    auth: { user, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return async (registration, event) => {
    const waitlist = registration.registrationStatus === 'Waitlist';
    const eventName = `${event.number}: ${event.theme}`;
    let groupLink = '';
    try {
      const url = new URL(event.communityGroupLink);
      if (['https:', 'http:'].includes(url.protocol)) groupLink = url.href;
    } catch {}
    let mapUrl = event.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}` : '';
    try {
      const exact = new URL(event.mapUrl);
      if (['https:', 'http:'].includes(exact.protocol)) mapUrl = exact.href;
    } catch {}
    const text = [
      `Assalamu alaikum ${registration.name},`,
      '',
      waitlist ? `You are on the waitlist for ${eventName}. We will contact you if a spot opens.` : `Your spot is reserved for ${eventName}.`,
      '',
      `Date: ${event.date}`,
      `Time: ${event.time}`,
      `Location: ${event.location}`,
      ...(mapUrl ? [`Google Maps: ${mapUrl}`] : []),
      ...(groupLink ? ['', `Join this Suhbah's WhatsApp group for updates and reminders: ${groupLink}`, 'Open the invite and tap Join in WhatsApp.'] : []),
      '',
      'Questions? Reply to this email.',
      '',
      'The Suhbah team',
    ].join('\n');
    const result = await mailer.sendMail({
      from: { name: 'Suhbah', address: user },
      to: { address: registration.email },
      replyTo: user,
      subject: `${waitlist ? 'Waitlist confirmation' : 'Registration confirmed'} — ${eventName}`.replace(/[\r\n]/g, ' '),
      text,
    });
    if (!result.accepted?.length) throw new Error('Email was not accepted by the mail server');
    return result.messageId;
  };
}

module.exports = { createConfirmationSender };
