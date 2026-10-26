const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { createConfirmationSender } = require('./registration-email');
const { createStore, uploadPdf, downloadPdf, storageConfig } = require('./storage');
const { waitUntil } = require('@vercel/functions');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) process.loadEnvFile(envPath);
const sendConfirmation = createConfirmationSender();

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.SUHBAH_DATA_DIR || path.join(ROOT, 'data'));
const DB_PATH = path.join(DATA_DIR, 'suhbah-db.json');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SPEECH_DIR = path.join(ASSETS_DIR, 'speeches');
const SESSION_COOKIE = 'suhbah_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const DEMO_ADMIN_EMAIL = 'admin@suhbah.local';
const DEMO_ADMIN_PASSWORD_HASH = 'f9446b93b773c95118d6dcd454839738844f600264c10a2a474b0c55f2da30f3';
const adminEmail = (process.env.ADMIN_EMAIL || DEMO_ADMIN_EMAIL).trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(24).toString('base64url');
const adminPasswordHash = hash(adminPassword);


const initialDb = {
  adminUsers: [
    {
      id: 'admin-1',
      name: 'Suhbah Admin',
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'owner',
      createdAt: '2026-09-28T00:00:00.000Z',
    },
  ],
  events: [
    {
      id: 'event-7',
      number: 'Suhbah 03',
      theme: 'Trials That Define US',
      date: '2026-11-01',
      time: '3:00 - 5:00 PM',
      location: 'Aspire Tutorials, #46, 4th Main “A” Cross, behind R.T. Nagar Old Police Station, Kousar Nagar, Bangalore – 560032',
      mapUrl: 'https://www.google.com/maps/place/Al+Noor,+123%2F1,+10th+Cross+St,+Kauser+Nagar,+Dinnur,+Hebbal,+Bengaluru,+Karnataka+560032/@13.0269684,77.5953935,20.14z/data=!4m6!3m5!1s0x3bae17bb262479e3:0x31fa4b696c672705!8m2!3d13.026833!4d77.5955563!16s%2Fg%2F11y3sywh_m?entry=ttu&g_ep=EgoyMDI2MTAxOS4wIKXMDSoASAFQAw%3D%3D',
      description:
        "The well, the prison, and the long waiting did not write Yusuf's (A.S) ending; Allah did, and He is writing yours too.",
      speaker: 'Zaina Malak',
      status: 'upcoming',
      registrationStatus: 'Open',
      image: '/assets/suhbah-03-trials-that-define-us.webp',
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
    {
      id: 'event-1',
      number: 'Suhbah #01',
      theme: 'How the Quran changes you',
      date: '2026-04-18',
      time: '5:00 PM - 7:00 PM',
      location: 'Bangalore',
      speaker: 'Suhbah Team',
      description: 'An honest first gathering on direction, return, and hope.',
      recap:
        'This first Suhbah explored how the Quran changes the way we think, respond, and see ourselves. The conversation centered on letting Quranic guidance move beyond recitation into daily choices, character, and a more honest relationship with Allah.',
      speechLink: '',
      status: 'past',
      registrationStatus: 'Closed',
      image: '/assets/suhbah-01-quran-changes-you.png',
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
    {
      id: 'event-2',
      number: 'Suhbah #02',
      theme: "Who's in your Cave?",
      date: '2026-05-16',
      time: '5:00 PM - 7:00 PM',
      location: 'Bangalore',
      speaker: 'Suhbah Team',
      description: 'A conversation about belonging, identity, and the Quranic lens.',
      recap:
        'This session reflected on companionship through the story of the People of the Cave. We spoke about the people we keep close, the spaces that protect our faith, and how sincere company can help us stay grounded when the world pulls elsewhere.',
      speechLink: '',
      status: 'past',
      registrationStatus: 'Closed',
      image: '/assets/suhbah-02-whos-in-your-cave.png',
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
  ],
  registrations: [],
  testimonials: [
    {
      id: 'test-1',
      quote: 'I came expecting a talk. I left with questions I actually wanted to think about.',
      name: 'Suhbah attendee',
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
    {
      id: 'test-2',
      quote: 'Suhbah made the Quran feel much more relevant to the things I was going through.',
      name: 'Community member',
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
    {
      id: 'test-3',
      quote:
        'It was refreshing to sit with other young people and have honest conversations about faith.',
      name: 'Monthly participant',
      createdAt: '2026-09-28T00:00:00.000Z',
      updatedAt: '2026-09-28T00:00:00.000Z',
    },
  ],
  communityStats: {
    members: '100+',
    gatherings: '12',
    community: '1',
    other: 'Growing community',
    updatedAt: '2026-09-28T00:00:00.000Z',
  },
  socialLinks: {
    instagram: 'https://www.instagram.com/suhbah.connect',
    whatsapp: 'https://wa.me/910000000000',
    youtube: 'https://youtube.com/@suhbah',
    updatedAt: '2026-09-28T00:00:00.000Z',
  },
};

const store = createStore({ filePath: DB_PATH, seed: initialDb, prepare: prepareDb });

function prepareDb(db) {
  const demoAdmin = db.adminUsers?.find(
    (admin) => admin.email === DEMO_ADMIN_EMAIL && admin.passwordHash === DEMO_ADMIN_PASSWORD_HASH,
  );
  // Never activate a known demo password in production.
  if (demoAdmin && (!store.persistent || (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD))) {
    demoAdmin.email = adminEmail;
    demoAdmin.passwordHash = adminPasswordHash;
  }
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const admin = db.adminUsers?.find((item) => item.id === 'admin-1') || db.adminUsers?.[0];
    if (admin) {
      admin.email = adminEmail;
      admin.passwordHash = adminPasswordHash;
    }
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}

function safeFilePart(value) {
  return String(value || 'speech')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'speech';
}

async function saveSpeechPdf(dataUrl, eventId) {
  if (!String(dataUrl || '').startsWith('data:application/pdf;base64,')) return dataUrl || '';
  const bytes = Buffer.from(dataUrl.split(',', 2)[1] || '', 'base64');
  if (bytes.length > 3_000_000) throw new Error('PDF must be smaller than 3 MB');
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Please upload a valid PDF');
  const fileName = `${safeFilePart(eventId)}-${crypto.randomUUID()}.pdf`;
  if (storageConfig()) return uploadPdf(bytes, fileName);
  if (store.persistent) throw new Error('PDF storage is not configured');
  fs.mkdirSync(SPEECH_DIR, { recursive: true });
  fs.writeFileSync(path.join(SPEECH_DIR, fileName), bytes);
  return `/assets/speeches/${fileName}`;
}

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  return header
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1];
}

function getSession(db, req) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const session = db.sessions?.[hash(token)];
  if (!session || session.expiresAt < Date.now()) {
    if (db.sessions) delete db.sessions[hash(token)];
    return null;
  }
  return session;
}

function requireAdmin(db, req, res) {
  const session = getSession(db, req);
  if (!session) {
    sendJson(res, 401, { error: 'Authentication required' });
    return null;
  }
  return session;
}

function publicDb(db) {
  return {
    events: db.events,
    testimonials: db.testimonials,
    communityStats: db.communityStats,
    socialLinks: db.socialLinks,
  };
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
  };
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  // Read slow request bodies before taking the row lock.
  const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await parseBody(req) : {};
  const pending = { status: 200, headers: {}, body: '' };
  const afterCommit = [];
  const deferred = {
    setHeader: (name, value) => { pending.headers[name] = value; },
    writeHead: (status, headers) => { pending.status = status; Object.assign(pending.headers, headers); },
    end: (value) => { pending.body = value; },
  };
  await store.withDb((db) => handleApiWithDb(req, deferred, url, db, body, afterCommit), {
    write: !['GET', 'HEAD'].includes(req.method),
  });
  // Do not report success until the database has committed.
  res.writeHead(pending.status, pending.headers);
  res.end(pending.body);
  for (const task of afterCommit) waitUntil(task().catch(() => console.warn('Confirmation email processing failed')));
}

async function handleApiWithDb(req, res, url, db, body, afterCommit) {

  if (req.method === 'GET' && url.pathname === '/api/public') {
    sendJson(res, 200, publicDb(db));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    if (store.persistent && db.adminUsers.every((admin) => admin.email === DEMO_ADMIN_EMAIL)) {
      const missing = ['ADMIN_EMAIL', 'ADMIN_PASSWORD'].filter((key) => !process.env[key]?.trim());
      if (missing.length) {
        sendJson(res, 503, { error: `Admin setup is incomplete: ${missing.join(' and ')} is missing from this deployment. Add the value in Vercel Production and redeploy.` });
        return;
      }
    }
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.adminUsers.find((admin) => admin.email.toLowerCase() === email);
    if (!user || user.passwordHash !== hash(body.password || '') ||
        (store.persistent && user.email === DEMO_ADMIN_EMAIL && user.passwordHash === DEMO_ADMIN_PASSWORD_HASH)) {
      sendJson(res, 401, { error: 'Invalid credentials' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions ||= {};
    for (const [key, session] of Object.entries(db.sessions)) {
      if (session.expiresAt < Date.now()) delete db.sessions[key];
    }
    db.sessions[hash(token)] = { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS };
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${process.env.VERCEL ? '; Secure' : ''}`,
    );
    sendJson(res, 200, { ok: true, user: { id: user.id, name: user.name, email: user.email } });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const token = getCookie(req, SESSION_COOKIE);
    if (token && db.sessions) delete db.sessions[hash(token)];
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/registrations') {
    const event = db.events.find((item) => item.id === body.eventId);
    if (!event) {
      sendJson(res, 404, { error: 'This Suhbah was not found.' });
      return;
    }
    if (event.status !== 'upcoming' || !['Open', 'Waitlist'].includes(event.registrationStatus)) {
      sendJson(res, 409, { error: `Registration for ${event.number} is closed.` });
      return;
    }
    const required = [
      'eventId',
      'name',
      'email',
      'phone',
      'age',
      'gender',
      'profile',
      'attendedBefore',
      'receivedQuran',
      'source',
    ];
    if (required.some((field) => !String(body[field] || '').trim())) {
      sendJson(res, 400, { error: 'Missing required registration fields' });
      return;
    }
    if (typeof body.email !== 'string' || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(body.email.trim())) {
      sendJson(res, 400, { error: 'Please enter a valid email address.' });
      return;
    }
    const registration = {
      id: uid('reg'),
      eventId: body.eventId,
      eventNumber: event.number,
      eventTheme: event.theme,
      registrationStatus: event.registrationStatus,
      name: body.name,
      email: body.email.trim(),
      phone: body.phone,
      age: body.age,
      gender: body.gender,
      profile: body.profile,
      attendedBefore: body.attendedBefore,
      receivedQuran: body.receivedQuran,
      source: body.source,
      message: body.message || '',
      createdAt: new Date().toISOString(),
      confirmationEmailStatus: sendConfirmation ? 'pending' : 'not_configured',
    };
    db.registrations.unshift(registration);

    sendJson(res, 201, { registration });
    if (sendConfirmation) {
      // Email delivery must never prevent a saved registration or the WhatsApp redirect.
      afterCommit.push(async () => {
        let status;
        try {
          await sendConfirmation(registration, event);
          status = 'sent';
        } catch {
          status = 'failed';
          console.warn(`Confirmation email failed for registration ${registration.id}`);
        }
        await store.withDb((latest) => {
          const saved = latest.registrations.find((item) => item.id === registration.id);
          if (saved) {
            saved.confirmationEmailStatus = status;
            saved.confirmationEmailUpdatedAt = new Date().toISOString();
          }
        });
      });
    }
    return;
  }

  if (url.pathname === '/api/admin') {
    if (!requireAdmin(db, req, res)) return;
    const { adminUsers, sessions, ...dashboardDb } = db;
    sendJson(res, 200, dashboardDb);
    return;
  }

  if (url.pathname === '/api/admin/events') {
    if (!requireAdmin(db, req, res)) return;
    if (req.method === 'POST') {
      const event = { ...body, id: uid('event'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      event.speechLink = await saveSpeechPdf(event.speechLink, event.id);
      db.events.unshift(event);

      sendJson(res, 201, { event });
      return;
    }
    if (req.method === 'PUT') {
      if (Object.hasOwn(body, 'speechLink')) body.speechLink = await saveSpeechPdf(body.speechLink, body.id);
      db.events = db.events.map((event) =>
        event.id === body.id ? { ...event, ...body, updatedAt: new Date().toISOString() } : event,
      );

      sendJson(res, 200, { events: db.events });
      return;
    }
    if (req.method === 'DELETE') {
      db.events = db.events.filter((event) => event.id !== body.id);

      sendJson(res, 200, { events: db.events });
      return;
    }
  }

  if (url.pathname === '/api/admin/testimonials') {
    if (!requireAdmin(db, req, res)) return;
    if (req.method === 'POST') {
      const testimonial = { ...body, id: uid('test'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.testimonials.unshift(testimonial);

      sendJson(res, 201, { testimonial });
      return;
    }
    if (req.method === 'PUT') {
      db.testimonials = db.testimonials.map((testimonial) =>
        testimonial.id === body.id
          ? { ...testimonial, ...body, updatedAt: new Date().toISOString() }
          : testimonial,
      );

      sendJson(res, 200, { testimonials: db.testimonials });
      return;
    }
    if (req.method === 'DELETE') {
      db.testimonials = db.testimonials.filter((testimonial) => testimonial.id !== body.id);

      sendJson(res, 200, { testimonials: db.testimonials });
      return;
    }
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/statistics') {
    if (!requireAdmin(db, req, res)) return;
    db.communityStats = { ...body, updatedAt: new Date().toISOString() };

    sendJson(res, 200, { communityStats: db.communityStats });
    return;
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/social') {
    if (!requireAdmin(db, req, res)) return;
    db.socialLinks = { ...body, updatedAt: new Date().toISOString() };

    sendJson(res, 200, { socialLinks: db.socialLinks });
    return;
  }

  sendJson(res, 404, { error: 'Unknown API route' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    if (url.pathname.startsWith('/uploads/speeches/')) {
      const name = decodeURIComponent(url.pathname.slice('/uploads/speeches/'.length));
      if (!/^[a-zA-Z0-9_-]+\.pdf$/.test(name)) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const response = await downloadPdf(name);
      if (!response.ok) {
        res.writeHead(response.status === 404 ? 404 : 502); res.end('PDF unavailable'); return;
      }
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }

    let filePath;
    if (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/' || /^\/bookmarks\/?$/.test(url.pathname) || /^\/register\/[^/]+\/?$/.test(url.pathname)) {
      filePath = path.join(ROOT, 'index.html');
    } else {
      filePath = path.join(ROOT, decodeURIComponent(url.pathname));
    }

    const resolved = path.resolve(filePath);
    const relative = path.relative(ROOT, resolved).split(path.sep).join('/');
    const publicFiles = new Set(['index.html', 'suhbah.js', 'suhbah.css', 'quran-library.js']);
    if (relative.startsWith('../') || path.isAbsolute(relative) ||
        (!publicFiles.has(relative) && !relative.startsWith('assets/'))) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    serveFile(res, resolved);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Suhbah running at http://localhost:${PORT}`);
  if (!sendConfirmation) console.log('Confirmation emails are disabled until GMAIL_APP_PASSWORD is configured.');
});
