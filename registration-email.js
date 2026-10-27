function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function createConfirmationSender(env = process.env, transport) {
  const user = env.GMAIL_USER || 'suhbahconnects@gmail.com';
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
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f5f4ef;color:#243d32;font-family:Arial,sans-serif;line-height:1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e8e1;border-radius:16px;">
      <tr><td style="padding:32px 24px;">
        <p style="margin:0 0 20px;font-size:14px;font-weight:bold;letter-spacing:3px;">SUHBAH</p>
        <h1 style="margin:0 0 20px;font-size:26px;line-height:1.3;">${waitlist ? 'You’re on the waitlist' : 'Your registration is confirmed'}</h1>
        <p style="margin:0 0 12px;">Assalamu alaikum ${escapeHtml(registration.name)},</p>
        <p style="margin:0 0 24px;">${waitlist ? 'We will contact you if a spot opens.' : 'Your spot is reserved. We look forward to welcoming you.'}</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f7f2;border-radius:10px;">
          <tr><td style="padding:20px;">
            <h2 style="margin:0 0 16px;font-size:19px;line-height:1.4;">${escapeHtml(eventName)}</h2>
            <p style="margin:0 0 8px;"><strong>Date</strong><br>${escapeHtml(event.date)}</p>
            <p style="margin:0 0 8px;"><strong>Time</strong><br>${escapeHtml(event.time)}</p>
            <p style="margin:0;"><strong>Location</strong><br>${escapeHtml(event.location)}</p>
            ${mapUrl ? `<p style="margin:12px 0 0;"><a href="${escapeHtml(mapUrl)}" style="color:#315b41;text-decoration:underline;">View location on Google Maps</a></p>` : ''}
          </td></tr>
        </table>
        ${groupLink ? `<p style="margin:24px 0 14px;">Join the event group for updates and reminders.</p>
        <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#315b41" style="border-radius:8px;text-align:center;mso-padding-alt:14px 22px;">
          <a href="${escapeHtml(groupLink)}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;">Join WhatsApp group</a>
        </td></tr></table>` : ''}
        <p style="margin:28px 0 0;font-size:14px;color:#606c63;">Questions? Reply to this email.</p>
        <p style="margin:12px 0 0;font-size:14px;">The Suhbah team</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
    const result = await mailer.sendMail({
      from: { name: 'Suhbah', address: user },
      to: { address: registration.email },
      replyTo: user,
      subject: `${waitlist ? 'Waitlist confirmation' : 'Registration confirmed'} — ${eventName}`.replace(/[\r\n]/g, ' '),
      text,
      html,
    });
    if (!result.accepted?.length) throw new Error('Email was not accepted by the mail server');
    return result.messageId;
  };
}

module.exports = { createConfirmationSender };
