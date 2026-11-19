// Isolated preview: synthetic event and registrations; no database or email access.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const event = { id: 'preview', number: 'Suhbah #04', theme: 'Good company, shared purpose', date: '2026-12-19', time: '5:00 - 7:00 PM', location: 'Bengaluru', status: 'upcoming', registrationStatus: 'Open', communityGroupLink: 'https://chat.whatsapp.com/KPxySuH09vEGCReEI8F22r?s=cl&p=i&iam=2', description: 'A gathering around the Quran.' };
const pastEvents = ['When the Quran changes you', "Who's in your cave?", 'Did I think?'].map((theme, index) => ({ ...event, id: `preview-past-${index}`, number: `Suhbah #0${index + 1}`, theme, date: '2026-10-01', status: 'past', registrationStatus: 'Closed', image: ['/assets/suhbah-01-quran-changes-you-display.webp', '/assets/suhbah-02-whos-in-your-cave-display.webp', '/assets/suhbah-03-did-i-think-poster.webp'][index] }));
function createPreviewServer() {
  return http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/api/public') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ events: [event, ...pastEvents], testimonials: [], communityStats: {}, socialLinks: {} }));
    }
    if (pathname === '/api/registrations' && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ registration: { eventId: event.id, eventNumber: event.number, eventTheme: event.theme, registrationStatus: 'Open' } }));
    }
    const name = pathname.startsWith('/register/') || pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!(new Set(['index.html', 'suhbah.js', 'suhbah.css', 'quran-library.js']).has(name) || name.startsWith('assets/')) || name.includes('..')) {
      res.writeHead(404); return res.end();
    }
    try {
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' })[path.extname(name)] || 'application/octet-stream');
      let content = fs.readFileSync(path.join(root, name));
      if (name === 'index.html' && new URL(req.url, 'http://localhost').searchParams.has('contribution')) {
        // Preview-only shortcut through the real form, using synthetic data.
        content = content.toString().replace('</body>', `<script>
          const observer = new MutationObserver(() => {
            const form = document.getElementById('registrationForm');
            if (!form) return;
            observer.disconnect();
            for (const [name, value] of Object.entries({ name: 'Preview attendee', email: 'preview@example.test', phone: '9000000000', age: '25', gender: 'Female', profile: 'Student', source: 'Friend' })) form.elements[name].value = value;
            form.querySelector('[name="attendedBefore"][value="No"]').checked = true;
            if (new URL(location.href).searchParams.has('confirmation')) {
              const confirmationObserver = new MutationObserver(() => {
                const skip = document.querySelector('[data-contribution-skip]');
                if (!skip) return;
                confirmationObserver.disconnect();
                skip.click();
              });
              confirmationObserver.observe(document.getElementById('app'), { childList: true, subtree: true });
            }
            form.requestSubmit();
          });
          observer.observe(document.getElementById('app'), { childList: true, subtree: true });
        </script></body>`);
      }
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
}
module.exports = { createPreviewServer, event };
if (require.main === module) createPreviewServer().listen(4180, '127.0.0.1', () => console.log('Isolated contribution preview: http://127.0.0.1:4180/register/preview'));

