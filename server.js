const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'suhbah-db.json');
const ASSETS_DIR = path.join(ROOT, 'assets');
const SPEECH_DIR = path.join(ASSETS_DIR, 'speeches');
const SESSION_COOKIE = 'suhbah_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const DEMO_ADMIN_EMAIL = 'admin@suhbah.local';
const DEMO_ADMIN_PASSWORD_HASH = 'f9446b93b773c95118d6dcd454839738844f600264c10a2a474b0c55f2da30f3';
const adminEmail = process.env.ADMIN_EMAIL || DEMO_ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(24).toString('base64url');
const adminPasswordHash = hash(adminPassword);

const sessions = new Map();

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
      theme: 'Finding Your Way Back',
      date: '2026-10-17',
      time: '5:00 PM - 7:30 PM',
      location: 'Bangalore',
      description:
        'A space to pause, reflect, and explore what the Quran has to say about finding direction when life feels uncertain.',
      status: 'upcoming',
      registrationStatus: 'Open',
      image: '',
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

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    migrateSpeechLinks(initialDb);
    writeDb(initialDb);
    return;
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  let changed = migrateSpeechLinks(db);
  const demoAdmin = db.adminUsers?.find(
    (admin) => admin.email === DEMO_ADMIN_EMAIL && admin.passwordHash === DEMO_ADMIN_PASSWORD_HASH,
  );
  if (demoAdmin) {
    demoAdmin.email = adminEmail;
    demoAdmin.passwordHash = adminPasswordHash;
    changed = true;
  }

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const primaryAdmin = db.adminUsers?.find((admin) => admin.id === 'admin-1') || db.adminUsers?.[0];
    if (primaryAdmin && (primaryAdmin.email !== adminEmail || primaryAdmin.passwordHash !== adminPasswordHash)) {
      primaryAdmin.email = adminEmail;
      primaryAdmin.passwordHash = adminPasswordHash;
      changed = true;
    }
  }

  if (changed) writeDb(db);
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
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

function saveSpeechPdf(dataUrl, eventId) {
  if (!String(dataUrl || '').startsWith('data:application/pdf;base64,')) return dataUrl || '';
  if (!fs.existsSync(SPEECH_DIR)) fs.mkdirSync(SPEECH_DIR, { recursive: true });
  const base64 = dataUrl.split(',', 2)[1] || '';
  const fileName = `${safeFilePart(eventId)}-${Date.now()}.pdf`;
  fs.writeFileSync(path.join(SPEECH_DIR, fileName), Buffer.from(base64, 'base64'));
  return `/assets/speeches/${fileName}`;
}

function migrateSpeechLinks(db) {
  let changed = false;
  for (const event of db.events || []) {
    if (String(event.speechLink || '').startsWith('data:application/pdf;base64,')) {
      event.speechLink = saveSpeechPdf(event.speechLink, event.id);
      changed = true;
    }
  }
  return changed;
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

function getSession(req) {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  const session = getSession(req);
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
  const db = readDb();

  if (req.method === 'GET' && url.pathname === '/api/public') {
    sendJson(res, 200, publicDb(db));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/login') {
    const body = await parseBody(req);
    const user = db.adminUsers.find((admin) => admin.email === body.email);
    if (!user || user.passwordHash !== hash(body.password || '')) {
      sendJson(res, 401, { error: 'Invalid credentials' });
      return;
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
    );
    sendJson(res, 200, { ok: true, user: { id: user.id, name: user.name, email: user.email } });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/logout') {
    const token = getCookie(req, SESSION_COOKIE);
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/registrations') {
    const body = await parseBody(req);
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
    const registration = {
      id: uid('reg'),
      eventId: body.eventId,
      name: body.name,
      email: body.email,
      phone: body.phone,
      age: body.age,
      gender: body.gender,
      profile: body.profile,
      attendedBefore: body.attendedBefore,
      receivedQuran: body.receivedQuran,
      source: body.source,
      message: body.message || '',
      createdAt: new Date().toISOString(),
    };
    db.registrations.unshift(registration);
    writeDb(db);
    sendJson(res, 201, { registration });
    return;
  }

  if (url.pathname === '/api/admin') {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, db);
    return;
  }

  if (url.pathname === '/api/admin/events') {
    if (!requireAdmin(req, res)) return;
    const body = await parseBody(req);
    if (req.method === 'POST') {
      const event = { ...body, id: uid('event'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      event.speechLink = saveSpeechPdf(event.speechLink, event.id);
      db.events.unshift(event);
      writeDb(db);
      sendJson(res, 201, { event });
      return;
    }
    if (req.method === 'PUT') {
      body.speechLink = saveSpeechPdf(body.speechLink, body.id);
      db.events = db.events.map((event) =>
        event.id === body.id ? { ...event, ...body, updatedAt: new Date().toISOString() } : event,
      );
      writeDb(db);
      sendJson(res, 200, { events: db.events });
      return;
    }
    if (req.method === 'DELETE') {
      db.events = db.events.filter((event) => event.id !== body.id);
      writeDb(db);
      sendJson(res, 200, { events: db.events });
      return;
    }
  }

  if (url.pathname === '/api/admin/testimonials') {
    if (!requireAdmin(req, res)) return;
    const body = await parseBody(req);
    if (req.method === 'POST') {
      const testimonial = { ...body, id: uid('test'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.testimonials.unshift(testimonial);
      writeDb(db);
      sendJson(res, 201, { testimonial });
      return;
    }
    if (req.method === 'PUT') {
      db.testimonials = db.testimonials.map((testimonial) =>
        testimonial.id === body.id
          ? { ...testimonial, ...body, updatedAt: new Date().toISOString() }
          : testimonial,
      );
      writeDb(db);
      sendJson(res, 200, { testimonials: db.testimonials });
      return;
    }
    if (req.method === 'DELETE') {
      db.testimonials = db.testimonials.filter((testimonial) => testimonial.id !== body.id);
      writeDb(db);
      sendJson(res, 200, { testimonials: db.testimonials });
      return;
    }
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/statistics') {
    if (!requireAdmin(req, res)) return;
    db.communityStats = { ...(await parseBody(req)), updatedAt: new Date().toISOString() };
    writeDb(db);
    sendJson(res, 200, { communityStats: db.communityStats });
    return;
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/social') {
    if (!requireAdmin(req, res)) return;
    db.socialLinks = { ...(await parseBody(req)), updatedAt: new Date().toISOString() };
    writeDb(db);
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

    let filePath;
    if (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/') {
      filePath = path.join(ROOT, 'index.html');
    } else {
      filePath = path.join(ROOT, decodeURIComponent(url.pathname));
    }

    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    serveFile(res, resolved);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

ensureDb();
server.listen(PORT, () => {
  console.log(`Suhbah running at http://localhost:${PORT}`);
});
