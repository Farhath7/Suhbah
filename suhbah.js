(function () {
  'use strict';

  const app = document.getElementById('app');
  let db = { events: [], testimonials: [], registrations: [], communityStats: {}, socialLinks: {} };
  let adminTab = 'events';
  let editing = {};
  let countdownTimer;
  let registrationEventId = '';

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function html(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form));
  }

  function dateLabel(date) {
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${date}T00:00:00`));
  }

  function shortDate(date) {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }

  function upcomingEvent() {
    return (
      db.events
        .filter((event) => event.status === 'upcoming')
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0]
    );
  }

  function isAdmin() {
    return window.location.pathname.replace(/\/$/, '') === '/admin';
  }

  function registrationUrl(event) {
    return event ? `/register/${encodeURIComponent(event.id)}` : '/#register';
  }

  function registrationIsOpen(event) {
    return event?.status === 'upcoming' && ['Open', 'Waitlist'].includes(event.registrationStatus);
  }

  function homeAnchor(hash) {
    return window.location.pathname === '/' ? hash : `/${hash}`;
  }

  async function route(path) {
    window.history.pushState({}, '', path);
    await render();
    const target = document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadPublic() {
    db = await api('/api/public');
  }

  async function loadAdmin() {
    db = await api('/api/admin');
  }

  function header(showAdmin = false) {
    return `
      <header class="header">
        <nav class="container nav" aria-label="Primary navigation">
          <a class="brand" href="/" data-route><img class="brand-logo" src="/assets/suhbah-logo.png" alt="Suhbah" /></a>
          <div class="nav-links" id="navLinks">
            <a class="nav-link" href="${homeAnchor('#home')}">Home</a>
            <a class="nav-link" href="${homeAnchor('#about')}">About</a>
            <a class="nav-link" href="${homeAnchor('#events')}">Events</a>
            <a class="nav-link" href="${homeAnchor('#community')}">Community</a>
            <a class="nav-link" href="${homeAnchor('#quran-library')}">Quran</a>
            <a class="nav-link" href="/bookmarks" data-route>Bookmarks</a>
            <a class="nav-link" href="${homeAnchor('#testimonials')}">Voices</a>
            ${showAdmin ? '<a class="nav-link" href="/admin" data-route>Admin</a>' : ''}
          </div>
          <div class="nav-actions"><a class="button primary" href="${registrationUrl(upcomingEvent())}" data-route>Join Next Suhbah</a></div>
          <button class="menu-button" type="button" aria-label="Open menu" aria-controls="navLinks" aria-expanded="false"><span class="menu-icon"></span></button>
        </nav>
      </header>
    `;
  }

  function publicShell() {
    const registrationPath = window.location.pathname.match(/^\/register\/([^/]+)\/?$/);
    const event = registrationPath ? db.events.find((item) => item.id === decodeURIComponent(registrationPath[1])) : null;
    const main = registrationPath
      ? `<main class="registration-page">${event ? registrationSection(event, true) : '<section class="section white"><div class="container"><h1>Suhbah not found</h1><p>This registration link is no longer available.</p><a class="button secondary" href="/" data-route>Back to Suhbah</a></div></section>'}</main>`
      : /^\/bookmarks\/?$/.test(window.location.pathname) ? bookmarkPanel() : publicMain();
    return `<div class="site">${header()}${main}${footer()}</div>`;
  }

  function bookmarkPanel() {
    return `<main class="bookmark-page"><section class="section"><div class="container">
      <div class="section-head"><span class="eyebrow">A little something for your next chapter</span><h1>Your name. Your bookmark.</h1><p class="lead">Choose a design and make it yours with your name in Arabic.</p></div>
      <div class="bookmark-layout">
        <form class="bookmark-controls" id="bookmarkForm">
          <h2>Make it yours</h2>
          <fieldset class="bookmark-templates"><legend>Choose your template</legend>
            <label><input type="radio" name="bookmarkTemplate" value="palestine" checked /><span class="bookmark-template-card"><span class="bookmark-swatch bookmark-swatch-palestine"></span>Palestine</span></label>
            <label><input type="radio" name="bookmarkTemplate" value="heritage" /><span class="bookmark-template-card"><span class="bookmark-swatch bookmark-swatch-heritage"></span>Olive &amp; heritage</span></label>
            <label><input type="radio" name="bookmarkTemplate" value="jerusalem" /><span class="bookmark-template-card"><span class="bookmark-swatch bookmark-swatch-jerusalem"></span>Jerusalem stories</span></label>
            <label><input type="radio" name="bookmarkTemplate" value="watermelon" /><span class="bookmark-template-card"><span class="bookmark-swatch bookmark-swatch-watermelon"></span>Watermelon &amp; keffiyeh</span></label>
            <label><input type="radio" name="bookmarkTemplate" value="olive" /><span class="bookmark-template-card"><span class="bookmark-swatch bookmark-swatch-olive"></span>Olive garden</span></label>
            <label><input type="radio" name="bookmarkTemplate" value="midnight" /><span class="bookmark-template-card"><span class="bookmark-swatch bookmark-swatch-midnight"></span>Midnight gold</span></label>
            <label><input type="radio" name="bookmarkTemplate" value="rose" /><span class="bookmark-template-card"><span class="bookmark-swatch bookmark-swatch-rose"></span>Rose arch</span></label>
          </fieldset>
          <label class="field" for="bookmarkName"><span>Your name in Arabic</span><input id="bookmarkName" type="text" lang="ar" dir="rtl" maxlength="48" placeholder="اسمك هنا" autocomplete="off" required aria-describedby="bookmarkHint" /></label>
          <p class="bookmark-hint" id="bookmarkHint">Type or paste your Arabic name. It runs vertically through the design.</p>
          <label class="field" for="bookmarkFont"><span>Name style</span><select id="bookmarkFont"><option value="serif">Classic</option><option value="sans-serif">Simple</option></select></label>
          <label class="field" for="bookmarkSize"><span>Name size <output id="bookmarkSizeValue" for="bookmarkSize">84</output></span><input id="bookmarkSize" type="range" min="40" max="120" step="2" value="84" /></label>
          <label class="field" for="bookmarkColor"><span>Name colour</span><input id="bookmarkColor" type="color" value="#762f2c" /></label>
          <button class="button primary" id="bookmarkDownload" type="submit" disabled>Download bookmark · PNG</button>
          <p class="bookmark-hint">Your name stays in your browser. Long names resize automatically to fit.</p>
          <p class="bookmark-status" id="bookmarkStatus" role="status" aria-live="polite">Loading your design…</p>
        </form>
        <figure class="bookmark-preview"><div class="bookmark-preview-heading"><span>Live preview</span><span id="bookmarkTemplateLabel">Palestine</span></div><canvas id="bookmarkCanvas" role="img" aria-label="Bookmark preview with a sample Arabic name"></canvas><figcaption>Your design, ready for the pages you love.</figcaption></figure>
      </div>
    </div></section></main>`;
  }

  function bindBookmark() {
    const canvas = document.getElementById('bookmarkCanvas');
    if (!canvas) return;
    const form = document.getElementById('bookmarkForm');
    const name = document.getElementById('bookmarkName');
    const font = document.getElementById('bookmarkFont');
    const size = document.getElementById('bookmarkSize');
    const color = document.getElementById('bookmarkColor');
    const download = document.getElementById('bookmarkDownload');
    const status = document.getElementById('bookmarkStatus');
    const context = canvas.getContext('2d');
    const templates = {
      palestine: { title: 'Palestine', color: '#762f2c', image: '/assets/bookmark-palestine.jpg' },
      heritage: { title: 'Olive & heritage', color: '#3f593e', image: '/assets/bookmark-olive-heritage.png' },
      jerusalem: { title: 'Jerusalem stories', color: '#762f2c', image: '/assets/bookmark-jerusalem-stories.png' },
      watermelon: { title: 'Watermelon & keffiyeh', color: '#762f2c', image: '/assets/bookmark-watermelon-keffiyeh.png' },
      olive: { title: 'Olive garden', color: '#3f593e' },
      midnight: { title: 'Midnight gold', color: '#e9cb86' },
      rose: { title: 'Rose arch', color: '#833f51' },
    };
    const artworks = {};
    let selectedTemplate = 'palestine';
    canvas.width = 487;
    canvas.height = 1280;
    function paintTemplate(template) {
      const w = canvas.width, h = canvas.height;
      context.save();
      context.scale(w / 487, h / 1280);
      if (template === 'olive') {
        context.fillStyle = '#f6f3e6';
        context.fillRect(0, 0, 487, 1280);
        context.strokeStyle = '#a8b48d';
        context.lineWidth = 2;
        context.strokeRect(24, 24, 439, 1232);
        for (const bottom of [false, true]) {
          context.save();
          if (bottom) { context.translate(487, 1280); context.rotate(Math.PI); }
          for (const right of [false, true]) {
            context.save();
            if (right) { context.translate(487, 0); context.scale(-1, 1); }
            context.strokeStyle = '#65784e';
            context.lineWidth = 4;
            context.beginPath(); context.moveTo(45, 45); context.quadraticCurveTo(160, 115, 62, 345); context.stroke();
            for (let i = 0; i < 7; i++) {
              const y = 75 + i * 37, x = 82 + Math.sin(i / 2) * 24;
              context.fillStyle = i % 2 ? '#87966b' : '#526b49';
              context.beginPath(); context.ellipse(x - 18, y, 12, 30, -.65, 0, Math.PI * 2); context.fill();
              context.beginPath(); context.ellipse(x + 24, y + 15, 12, 30, .7, 0, Math.PI * 2); context.fill();
            }
            context.restore();
          }
          context.restore();
        }
      } else if (template === 'midnight') {
        context.fillStyle = '#172c3b'; context.fillRect(0, 0, 487, 1280);
        context.strokeStyle = '#b99a56'; context.lineWidth = 2;
        context.strokeRect(24, 24, 439, 1232); context.strokeRect(35, 35, 417, 1210);
        for (const y of [135, 255, 1025, 1145]) {
          for (const x of [85, 243.5, 402]) {
            context.beginPath();
            for (let i = 0; i < 16; i++) {
              const angle = i * Math.PI / 8, radius = i % 2 ? 23 : 46;
              const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
              if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
            }
            context.closePath(); context.stroke();
          }
        }
        context.beginPath(); context.moveTo(243.5, 335); context.lineTo(243.5, 380); context.moveTo(243.5, 900); context.lineTo(243.5, 945); context.stroke();
      } else {
        context.fillStyle = '#f5e5e5'; context.fillRect(0, 0, 487, 1280);
        context.fillStyle = '#fff8ef';
        context.beginPath(); context.roundRect(67, 85, 353, 1110, 176); context.fill();
        context.strokeStyle = '#b8818d'; context.lineWidth = 3; context.stroke();
        context.beginPath(); context.roundRect(84, 103, 319, 1074, 159); context.stroke();
        for (const y of [255, 1025]) {
          context.fillStyle = '#b8818d';
          for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            context.beginPath(); context.ellipse(243.5 + Math.cos(angle) * 25, y + Math.sin(angle) * 25, 11, 22, angle + Math.PI / 2, 0, Math.PI * 2); context.fill();
          }
          context.fillStyle = '#d9b369'; context.beginPath(); context.arc(243.5, y, 12, 0, Math.PI * 2); context.fill();
        }
      }
      context.restore();
    }
    const arabicLetters = /[\u0620-\u063f\u0641-\u064a\u066e-\u066f\u0671-\u06d3\u06fa-\u06fc\u0750-\u077f\u08a0-\u08c9]/u;
    function draw() {
      const template = form.elements.bookmarkTemplate.value;
      if (template !== selectedTemplate) { color.value = templates[template].color; selectedTemplate = template; }
      const artwork = artworks[template];
      const imageTemplate = Boolean(templates[template].image);
      const ready = !imageTemplate || Boolean(artwork?.naturalWidth);
      document.getElementById('bookmarkTemplateLabel').textContent = templates[template].title;
      document.getElementById('bookmarkSizeValue').value = size.value;
      const text = name.value.trim();
      const valid = text.length > 0 && arabicLetters.test(text) && /^[\p{Script_Extensions=Arabic}\s\-]+$/u.test(text);
      name.setCustomValidity(text && !valid ? 'Please enter your name using Arabic letters.' : '');
      download.disabled = !valid || !ready;
      canvas.width = ready && imageTemplate ? artwork.naturalWidth : 487;
      canvas.height = ready && imageTemplate ? artwork.naturalHeight : 1280;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (imageTemplate) {
        if (!ready) {
          status.textContent = artwork?.dataset.failed ? 'The design could not load. Please choose another template or refresh.' : 'Loading your design…';
          return;
        }
        context.drawImage(artwork, 0, 0, canvas.width, canvas.height);
      } else paintTemplate(template);
      context.direction = 'rtl';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = color.value;
      const label = text || 'اسمك هنا';
      let pixels = Number(size.value) * canvas.width / 487;
      const family = font.value === 'serif' ? '"Times New Roman", serif' : 'Tahoma, Arial, sans-serif';
      context.font = `${pixels}px ${family}`;
      while (context.measureText(label).width > canvas.height * 0.48 && pixels > 6) {
        pixels -= 1;
        context.font = `${pixels}px ${family}`;
      }
      context.save();
      context.translate(canvas.width * (imageTemplate ? 0.30 : 0.50), canvas.height * (imageTemplate ? 0.48 : 0.50));
      context.rotate(-Math.PI / 2);
      context.fillText(label, 0, 0);
      context.restore();
      canvas.setAttribute('aria-label', text ? `Bookmark preview for ${text}` : 'Bookmark preview with a sample Arabic name');
      status.textContent = text && !valid ? 'Please use Arabic letters for your name.' : valid ? 'Your bookmark is ready to download.' : 'Enter your Arabic name to download your bookmark.';
    }
    form.addEventListener('input', draw);
    form.addEventListener('change', draw);
    Object.entries(templates).forEach(([key, template]) => {
      if (!template.image) return;
      const artwork = new Image();
      artworks[key] = artwork;
      artwork.onload = () => { if (selectedTemplate === key) draw(); };
      artwork.onerror = () => { artwork.dataset.failed = 'true'; if (selectedTemplate === key) draw(); };
      artwork.src = template.image;
    });
    draw();
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (download.disabled || !form.reportValidity()) return;
      draw();
      download.disabled = true;
      canvas.toBlob((blob) => {
        if (!blob) {
          draw();
          status.textContent = 'The download could not be created. Please try again.';
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `suhbah-bookmark-${selectedTemplate}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        draw();
      }, 'image/png');
    });
  }

  function publicMain() {
    const event = upcomingEvent();
    const past = db.events.filter((item) => item.status === 'past').slice(0, 4);
    const stats = db.communityStats;

    return `
      <main>
        <section class="tagline-band" aria-label="Quranic community tagline">
          <div class="container tagline-inner fade-in">
            <span class="tagline-reference">Quran 81:26</span>
            <p class="tagline-transliteration">Fa’ayna Tadhhaboon</p>
            <p class="tagline-translation">Where are you headed?</p>
          </div>
        </section>
        <section class="hero" id="home">
          <div class="container hero-grid">
            <div class="hero-copy fade-in">
              <span class="eyebrow hero-eyebrow"><span class="dot"></span> Monthly Quran Gathering</span>
              <h1>Reconnect with the Quran.<span class="hero-heading-line">Reconnect with yourself.</span></h1>
              <p class="lead">Suhbah is a community of young people coming together every month to explore the Quran, ask questions, reflect on its message, and build a lasting connection with it.</p>
              <div class="hero-actions">
                <a class="button primary" href="${registrationUrl(event)}" data-route>Join the Next Suhbah</a>
                <a class="button ghost" href="#about">Learn About Suhbah</a>
              </div>
            </div>
            ${eventCard(event)}
          </div>
        </section>
        <section class="section about-section" id="about">
          <div class="container">
            <div class="section-head fade-in">
              <h2>What is Suhbah?</h2>
              <p class="lead">Suhbah is more than an event. It is a space for young people to slow down, ask meaningful questions, and rediscover their relationship with the Quran.</p>
            </div>
            <div class="card-grid">
              ${feature('Pause', 'Reflect', 'Slow down with verses that speak to real questions, struggles, choices, and hopes.')}
              ${feature('Gather', 'Connect', 'Sit with people who are also trying to understand the Quran and live with more purpose.')}
              ${feature('Carry', 'Grow', 'Leave with one thought, habit, or reminder to take into the rest of your month.')}
            </div>
          </div>
        </section>
        <section class="section navy" id="why">
          <div class="container conversation-panel fade-in">
            <div class="conversation-copy">
              <p class="conversation-label">Why Suhbah exists</p>
              <h2>Suhbah creates a space where these conversations can happen.</h2>
              <p class="lead">The Quran is not just something we read. It is something we live.</p>
            </div>
            <div class="reflection-list">
              ${[
                'I want to understand the Quran better.',
                "I don't know where to start.",
                'I read it, but I struggle to connect with it.',
                'I want a community that helps me grow.',
                "I have questions I don't know who to ask.",
              ].map((text) => `<div class="reflection-prompt"><span></span><p>${html(text)}</p></div>`).join('')}
            </div>
          </div>
        </section>
        <section class="section cream" id="experience">
          <div class="container">
            <div class="section-head fade-in"><h2>What happens at Suhbah?</h2></div>
            <div class="timeline">
              ${timeline('01', 'Gather', 'Meet other young people and settle into the space.')}
              ${timeline('02', 'Explore', 'Dive into a Quranic theme and selected verses.')}
              ${timeline('03', 'Reflect', 'Think about what the Quran is saying and how it relates to our lives.')}
              ${timeline('04', 'Discuss', 'Share thoughts, questions, perspectives and experiences.')}
              ${timeline('05', 'Take It Forward', 'Leave with something practical to carry into the month.')}
            </div>
          </div>
        </section>
        <section class="section white" id="events">
          <div class="container">
            ${upcomingEventCards()}
            <div class="section-head fade-in"><h2>Previous Suhbahs</h2></div>
            <div class="past-grid">${past.map(pastCard).join('')}</div>
          </div>
        </section>
        <section class="section stat-band" id="community">
          <div class="container fade-in">
            <h2>Come for the Quran.<br />Stay for the community.</h2>
            <div class="stats-grid">
              ${stat(stats.members, 'Young people connected')}
              ${stat(stats.gatherings, 'Monthly gatherings')}
              ${stat(stats.community, stats.other || 'Growing community')}
            </div>
          </div>
        </section>
        <section class="section cream" id="testimonials">
          <div class="container">
            <div class="section-head fade-in"><h2>What the community says</h2></div>
            <div class="testimonials">${db.testimonials.map(testimonial).join('')}</div>
          </div>
        </section>
        <section class="section reflection">
          <div class="container fade-in">
            <h2>A moment to reflect</h2>
            <div class="arabic" lang="ar" dir="rtl">أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ</div>
            <p class="translation">"Indeed, in the remembrance of Allah do hearts find rest."</p>
            <p class="muted">Quran 13:28</p>
            <a class="button secondary" href="#quran-library">Explore the Quran</a>
          </div>
        </section>
        <section class="section quran-library" id="quran-library">
          <div class="container">
            <div class="quran-library-intro">
              <div class="quran-library-head">
                <span class="quran-eyebrow">Read. Reflect. Reconnect.</span>
                <h2>Quran Library</h2>
                <p>A little time with the Quran.<br />A meaningful part of your day.</p>
                <div class="quran-library-stats"><span>30 Juz</span><span>114 Surahs</span></div>
              </div>
              <figure class="quran-hadith">
              <blockquote lang="ar" dir="rtl">عَنْ عُثْمَانَ ـ رضى الله عنه ـ عَنِ النَّبِيِّ صلى الله عليه وسلم قَالَ "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ"</blockquote>
              <figcaption>
                <span class="hadith-translation">Narrated Uthman: The Prophet (ﷺ) said, "The best among you are those who learn the Qur'an and teach it."</span>
                <span class="hadith-source">Sahih al-Bukhari 5027</span>
              </figcaption>
              </figure>
            </div>
            <div class="quran-browse-bar">
              <div><h3>Find your place</h3><p>Choose a Juz to explore its surahs, or open the full PDF.</p></div>
              <label class="quran-search" for="quranSearch">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
                <input id="quranSearch" type="search" placeholder="Search Juz or surah" aria-label="Search by Juz number or surah name" autocomplete="off" />
              </label>
            </div>
            <p class="quran-results" id="quranResults" role="status" aria-live="polite" aria-atomic="true">Showing all 30 Juz</p>
            <div class="quran-grid">
              ${quranParaLinks()}
            </div>
            <div class="quran-empty" id="quranEmpty" hidden><h3>No matching Juz found</h3><p>Try a Juz number from 1 to 30 or a surah name, such as Al-Kahf.</p><button type="button" id="quranClear">Clear search</button></div>
          </div>
        </section>
        <section class="section cta">
          <div class="container fade-in">
            <h2>Your next step starts here.</h2>
            <p class="lead">You don't need to know everything about the Quran.<br />You just need to show up.</p>
            <div class="cta-row">
              <a class="button secondary" href="${registrationUrl(event)}" data-route>Join the Next Suhbah</a>
              <a class="button ghost" href="${html(db.socialLinks.whatsapp)}" target="_blank" rel="noreferrer">Join the Community</a>
            </div>
          </div>
        </section>
        ${registrationSection(event)}
      </main>
    `;
  }

  function upcomingEventCards() {
    const events = db.events.filter((event) => event.status === 'upcoming').sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!events.length) return '';
    return `<div class="section-head fade-in"><h2>Upcoming Suhbahs</h2><p class="lead">Choose your gathering to view its registration.</p></div>
      <div class="upcoming-registration-grid">${events.map((event) => `<article class="admin-card fade-in">
        <span class="event-kicker">${html(event.number)} · ${html(event.registrationStatus)}</span>
        <h3>${html(event.theme)}</h3><p class="muted">${html(dateLabel(event.date))} · ${html(event.time)} · ${html(event.location)}</p>
        <a class="button secondary" href="${registrationUrl(event)}" data-route>${registrationIsOpen(event) ? (event.registrationStatus === 'Waitlist' ? 'Join Waitlist' : 'Register for this Suhbah') : 'View Suhbah'}</a>
      </article>`).join('')}</div>`;
  }

  function registrationSection(event, standalone = false) {
    if (!event) return `<section class="section white" id="register"><div class="container"><h2>Registrations will open soon</h2><p class="lead">Check back for the next Suhbah.</p></div></section>`;
    return `<section class="section white" id="register">
          ${standalone ? '<div class="container registration-back"><a href="/#events">← All Suhbahs</a></div>' : ''}
          <div class="container registration-grid">
            <div class="registration-story">
            <div class="registration-copy fade-in">
              <p class="registration-label-text">Event registration</p>
              <h2 class="registration-brand">Suhbah</h2>
              <p class="registration-subtitle">${registrationIsOpen(event) ? (event.registrationStatus === 'Waitlist' ? 'Join the waitlist' : 'Reserve your spot') : 'Registrations closed'}</p>
              <${standalone ? 'h1' : 'h3'} class="lead registration-event-title">${html(event.number)}: ${html(event.theme)}</${standalone ? 'h1' : 'h3'}>
              <div class="registration-event-strip">
                <span>${html(dateLabel(event.date))}</span>
                <span>${html(event.time)}</span>
                <span>${html(event.location)}</span>
              </div>
              <div class="registration-note" aria-label="What to expect at Suhbah">
                <span class="registration-note-kicker">Inside the gathering</span>
                <h3>What to expect</h3>
                <p class="registration-note-intro">A slow evening with reminders, reflection, and people who are also finding their way back.</p>
                <ul>
                  <li>Reflective Quran reminders made for young hearts.</li>
                  <li>Honest conversations in a calm, welcoming space.</li>
                  <li>Time to meet people walking a similar path.</li>
                  <li>Please carry a bag so you can take your Quran back with you safely.</li>
                </ul>
                <p class="registration-note-closing">Come as you are. Bring a notebook if you like, and bring a friend if someone comes to mind.</p>
              </div>
            </div>
            <div class="registration-art" aria-hidden="true"><img src="/assets/registration-still-life.png" alt="" loading="eager" fetchpriority="high" /></div>
            </div>
            <div id="registrationMount" class="fade-in">${registrationForm(event)}</div>
          </div>
        </section>
    `;
  }

  function eventCard(event) {
    if (!event) return '<article class="event-card fade-in"><div class="event-card-body"><h2>The next Suhbah is coming soon.</h2><p class="lead">Watch this space for our next gathering.</p></div></article>';
    return `
      <article class="event-card fade-in" aria-label="Upcoming Suhbah event">
        <div class="event-card-media" ${mediaStyle(event.image || '/assets/suhbah-gathering-hero.png')}>${registrationStatus(event.registrationStatus)}</div>
        <div class="event-card-body">
          <span class="event-section-label">The Next Suhbah</span>
          <span class="event-kicker">${html(event.number)}</span>
          <h2 class="event-title">${html(event.theme)}</h2>
          <p class="event-description">${html(event.description)}</p>
          <div class="event-meta">${meta('Date', dateLabel(event.date))}${meta('Time', event.time)}${meta('Location', event.location)}</div>
          <div class="countdown" data-countdown="${html(event.date)}T17:00:00+05:30">
            ${['Days', 'Hours', 'Minutes', 'Seconds'].map((label) => `<div class="count-unit"><span class="count-value">00</span><span class="count-label">${label}</span></div>`).join('')}
          </div>
          <a class="button primary event-reserve-button" href="${registrationUrl(event)}" data-route>${registrationIsOpen(event) ? (event.registrationStatus === 'Waitlist' ? 'Join the Waitlist' : 'Reserve Your Spot') : 'View Suhbah'}</a>
        </div>
      </article>
    `;
  }

  function meta(label, value) {
    return `<div class="meta-item"><span class="meta-label">${html(label)}</span><span class="meta-value">${html(value)}</span></div>`;
  }

  function registrationStatus(status = 'Open') {
    const messages = {
      Open: ['Reserve your seat', 'Reserve yours before this gathering fills up.'],
      Waitlist: ['Waitlist is open', 'Join the list and we will reach out if a spot opens.'],
      Closed: ['Registrations closed', 'This gathering is full. Watch for the next Suhbah.'],
    };
    const [title] = messages[status] || messages.Open;
    return `<div class="registration-label" aria-label="Registration status"><span>${html(status)}</span>${html(title)}</div>`;
  }

  function mediaStyle(image) {
    return image
      ? `style="background-image: url('${html(image)}')"`
      : '';
  }

  function quranParaLinks() {
    const paraNames = [
      'الم',
      'سيقول',
      'تلك الرسل',
      'لن تنالوا',
      'والمحصنات',
      'لا يحب الله',
      'وإذا سمعوا',
      'ولو أننا',
      'قال الملأ',
      'واعلموا',
      'يعتذرون',
      'وما من دابة',
      'وما أبرئ',
      'ربما',
      'سبحان الذي',
      'قال ألم',
      'اقترب للناس',
      'قد أفلح',
      'وقال الذين',
      'أمن خلق',
      'اتل ما أوحي',
      'ومن يقنت',
      'وما لي',
      'فمن أظلم',
      'إليه يرد',
      'حم',
      'قال فما خطبكم',
      'قد سمع الله',
      'تبارك الذي',
      'عم',
    ];

    return QuranLibrary.juz.map(({ number, surahs }, index) => {
      const label = String(number).padStart(2, '0');
      return `
        <details class="quran-juz" id="quran-juz-${number}">
          <summary class="quran-card" aria-label="Juz ${label}: ${surahs.length} surah${surahs.length === 1 ? '' : 's'}">
            <span class="quran-card-number" aria-hidden="true">${label}</span>
            <div class="quran-juz-title"><span class="quran-juz-label">Juz ${label}</span><strong lang="ar" dir="rtl">${paraNames[index]}</strong><span class="quran-juz-meta">${surahs.length} surah${surahs.length === 1 ? '' : 's'}</span></div>
            <span class="quran-expand" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 9 6 6 6-6" /></svg></span>
          </summary>
          <div class="quran-juz-content">
            <a class="quran-open-juz" href="${QuranLibrary.pdfUrl(number)}" target="_blank" rel="noreferrer">Open full Juz ${label} <span aria-hidden="true">↗</span></a>
            <ul class="quran-surahs">
              ${surahs.map((surah) => `
                <li>
                  <a class="quran-surah-link" href="${QuranLibrary.pdfUrl(surah.juz, surah.page)}" target="_blank" rel="noreferrer" aria-label="Open Surah ${html(surah.name)} from the beginning, Juz ${surah.juz}, PDF page ${surah.page}">
                    <span class="quran-surah-number">${surah.number}</span>
                    <span><strong>${html(surah.name)}</strong><small>Starts in Juz ${surah.juz} · PDF page ${surah.page}</small></span>
                    <span aria-hidden="true">↗</span>
                  </a>
                  ${surah.juz < number ? `<a class="quran-surah-continue" href="${QuranLibrary.pdfUrl(number)}" target="_blank" rel="noreferrer" aria-label="Continue Surah ${html(surah.name)} in Juz ${number}">Continue in this Juz ↗</a>` : ''}
                </li>
              `).join('')}
            </ul>
          </div>
        </details>
      `;
    }).join('');
  }

  function feature(label, title, text) {
    return `<article class="feature-card fade-in"><span class="feature-label">${html(label)}</span><h3>${html(title)}</h3><p class="muted">${html(text)}</p></article>`;
  }

  function timeline(number, title, text) {
    return `<article class="timeline-item fade-in"><div class="timeline-number">${number}</div><div class="timeline-content"><h3>${html(title)}</h3><p class="muted">${html(text)}</p></div></article>`;
  }

  function pastCard(event) {
    return `
      <article class="past-card fade-in" data-recap-id="${html(event.id)}" role="button" tabindex="0" aria-label="View recap for ${html(event.number)}: ${html(event.theme)}">
        <div class="past-image">${event.image ? `<img src="${html(event.image)}" alt="${html(event.number)}: ${html(event.theme)}" loading="lazy" />` : ''}</div>
        <div class="past-body">
          <span class="event-kicker">${html(event.number)}</span>
          <h3>${html(event.theme)}</h3>
          ${event.speaker ? `<p class="speaker-line"><span>Speaker:</span> ${html(event.speaker)}</p>` : ''}
          <p>${html(event.description)}</p>
          <span class="button linkish">View Recap</span>
        </div>
      </article>
    `;
  }

  function openRecap(eventId) {
    const session = db.events.find((event) => event.id === eventId);
    if (!session) return;
    document.querySelector('.recap-overlay')?.remove();
    document.body.classList.add('modal-open');
    document.body.insertAdjacentHTML(
      'beforeend',
      `
        <div class="recap-overlay" role="presentation">
          <section class="recap-dialog" role="dialog" aria-modal="true" aria-labelledby="recapTitle">
            <button class="recap-close" type="button" aria-label="Close recap">&times;</button>
            <div class="recap-heading">
              ${session.image ? `<img class="recap-thumbnail" src="${html(session.image)}" alt="${html(session.number)}: ${html(session.theme)}" />` : ''}
              <div><span class="event-kicker">${html(session.number)}</span><h2 id="recapTitle">${html(session.theme)}</h2></div>
            </div>
            <p class="recap-meta">${html(dateLabel(session.date))} · ${html(session.time)} · ${html(session.location)}</p>
            <p class="lead">${html(session.recap || session.description)}</p>
            ${session.speechLink ? `<a class="button secondary" href="${html(session.speechLink)}" target="_blank" rel="noreferrer">Open full session</a>` : ''}
          </section>
        </div>
      `,
    );
    document.querySelector('.recap-close')?.focus();
  }

  function closeRecap() {
    document.querySelector('.recap-overlay')?.remove();
    document.body.classList.remove('modal-open');
  }

  function stat(number, label) {
    return `<div class="stat"><span class="stat-number">${html(number)}</span><span class="stat-label">${html(label)}</span></div>`;
  }

  function testimonial(item) {
    return `<article class="testimonial-card fade-in"><p>"${html(item.quote)}"</p><strong>${html(item.name)}</strong></article>`;
  }

  function registrationForm(event) {
    if (!registrationIsOpen(event)) return `<div class="form-panel"><h2>Registrations closed</h2><p class="lead">Registration for ${html(event.number)}: ${html(event.theme)} is closed.</p><a class="button secondary" href="/#events">See other Suhbahs</a></div>`;
    const waitlist = event.registrationStatus === 'Waitlist';
    return `
      <form class="form-panel" id="registrationForm" aria-label="Registration for ${html(event.number)}: ${html(event.theme)}">
        <h2>${waitlist ? 'Join the waitlist' : 'Register'} for ${html(event.number)}</h2>
        <p class="muted">${html(event.theme)}${waitlist ? ' · We will contact you if a spot opens.' : ''}</p>
        <div class="form-grid">
          <input type="hidden" name="eventId" value="${html(event.id)}" />
          ${field('Full Name', 'name', 'text')}
          ${field('Email', 'email', 'email')}
          ${field('Phone Number', 'phone', 'tel')}
          ${field('Age', 'age', 'number')}
          <label class="field">
            <span>Gender</span>
            <select name="gender" required>
              <option value="">Select one</option>
              <option>Female</option>
              <option>Male</option>
            </select>
          </label>
          <label class="field">
            <span>What describes you the best?</span>
            <select name="profile" required>
              <option value="">Select one</option>
              <option>Student</option>
              <option>Working professional</option>
              <option>College student</option>
              <option>Others</option>
            </select>
          </label>
          <label class="field">
            <span>Have you attended a previous Suhbah?</span>
            <select name="attendedBefore" required>
              <option value="">Select one</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </label>
          <label class="field">
            <span>If yes, did you receive a Quran?</span>
            <select name="receivedQuran" required>
              <option value="">Select one</option>
              <option>Yes</option>
              <option>No</option>
              <option>Not applicable</option>
            </select>
          </label>
          <label class="field">
            <span>How did you hear about Suhbah?</span>
            <select name="source" required>
              <option value="">Select one</option>
              <option>Instagram</option>
              <option>WhatsApp</option>
              <option>Friend</option>
              <option>Community group</option>
              <option>Other</option>
            </select>
          </label>
          <label class="field"><span>Optional message</span><textarea name="message" placeholder="Anything you want us to know?"></textarea></label>
          <button class="button primary" type="submit">${waitlist ? 'Join Waitlist' : 'Reserve My Spot'}</button>
        </div>
      </form>
    `;
  }

  function field(label, name, type, value = '', required = true) {
    return `<label class="field"><span>${html(label)}</span><input name="${html(name)}" type="${html(type)}" value="${html(value)}" ${required ? 'required' : ''} /></label>`;
  }

  function footer() {
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div><a class="brand footer-brand" href="/" data-route><img class="brand-logo" src="/assets/suhbah-logo.png" alt="Suhbah" /></a><p>Reconnecting young people with the Quran, one gathering at a time.</p></div>
            <div><h3>Links</h3><div class="footer-links"><a href="${homeAnchor('#home')}">Home</a><a href="${homeAnchor('#about')}">About</a><a href="${homeAnchor('#events')}">Events</a><a href="${homeAnchor('#community')}">Community</a></div></div>
            <div><h3>Social</h3><div class="social-links"><a href="${html(db.socialLinks.instagram)}" target="_blank" rel="noreferrer">Instagram</a><a href="${html(db.socialLinks.whatsapp)}" target="_blank" rel="noreferrer">WhatsApp</a></div></div>
          </div>
          <div class="footer-bottom">© 2026 Suhbah. All rights reserved.</div>
        </div>
      </footer>
    `;
  }

  function adminLogin(message = '') {
    return `
      <div class="login-wrap">
        <form class="login-card" id="loginForm">
          <a class="brand login-brand" href="/" data-route><img class="brand-logo" src="/assets/suhbah-logo.png" alt="Suhbah" /></a>
          <h2 style="margin-top: 22px;">Admin sign in</h2>
          <p class="muted">Protected dashboard for managing events, registrations, testimonials, statistics, and social links.</p>
          ${message ? `<div class="notice">${html(message)}</div>` : ''}
          <div class="form-grid" style="margin-top: 16px;">
            ${field('Email', 'email', 'email')}
            ${field('Password', 'password', 'password')}
            <button class="button primary" type="submit">Sign in</button>
          </div>
        </form>
      </div>
    `;
  }

  function adminShell() {
    const summaries = [
      ['Total events', db.events.length, 'Gatherings in your library'],
      ['Upcoming', db.events.filter((event) => event.status === 'upcoming').length, 'Gatherings ahead'],
      ['Registrations', db.registrations.length, 'Across all gatherings'],
      ['Testimonials', db.testimonials.length, 'Voices from the community'],
    ];
    return `
      <div class="admin-layout">
        <header class="admin-header"><div class="container admin-header-inner">
          <a class="brand" href="/" data-route><img class="brand-logo" src="/assets/suhbah-logo.png" alt="Suhbah" /></a>
          <a class="admin-workspace-label" href="/admin" data-route>Admin workspace</a>
          <div class="admin-header-actions"><a class="small-button" href="/" target="_blank" rel="noreferrer">View website &nearr;</a><button class="small-button" id="logoutButton" type="button">Log out</button></div>
        </div></header>
        <main class="container admin-shell">
          <div class="admin-top">
            <div><span class="admin-overline">COMMUNITY MANAGEMENT</span><h1 class="admin-title">Your Suhbah workspace</h1></div>
          </div>
          <div class="admin-summary" aria-label="Community overview">
            ${summaries.map(([label, value, detail]) => `<div class="admin-metric"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`).join('')}
          </div>
          <nav class="admin-tabs" aria-label="Dashboard sections">
            ${['events', 'registrations', 'testimonials', 'statistics', 'social'].map((tab) => `<button class="admin-tab ${adminTab === tab ? 'active' : ''}" data-tab="${tab}" aria-current="${adminTab === tab ? 'page' : 'false'}" type="button">${tab[0].toUpperCase()}${tab.slice(1)}</button>`).join('')}
          </nav>
          <section class="admin-content" aria-label="${html(adminTab)}">${adminSection()}</section>
        </main>
      </div>
    `;
  }

  function adminSection() {
    if (adminTab === 'events') return eventsAdmin();
    if (adminTab === 'registrations') return registrationsAdmin();
    if (adminTab === 'testimonials') return testimonialsAdmin();
    if (adminTab === 'statistics') return statsAdmin();
    return socialAdmin();
  }

  function eventsAdmin() {
    const active = editing.events ? db.events.find((event) => event.id === editing.events) : null;
    return `
      <div class="admin-grid">
        <form class="form-panel" id="eventForm">
          <div class="admin-panel-heading"><span class="admin-overline">${active ? 'EVENT DETAILS' : 'PLAN A GATHERING'}</span><h2>${active ? 'Edit event' : 'Create an event'}</h2><p class="muted">${active ? 'Update the details your community sees.' : 'Set the details, then open registration for your community.'}</p></div>
          <input type="hidden" name="id" value="${html(active?.id || '')}" />
          <div class="form-grid">
            ${adminInput('Event number', 'number', active?.number)}
            ${adminInput('Theme', 'theme', active?.theme)}
            ${adminInput('Date', 'date', active?.date, 'date')}
            ${adminInput('Time', 'time', active?.time)}
            ${adminInput('Location', 'location', active?.location)}
            ${adminInput('Speaker', 'speaker', active?.speaker, 'text', false)}
            <label class="field"><span>Upload image</span><input name="imageFile" type="file" accept="image/*" /></label>
            <label class="field"><span>Upload full speech PDF</span><input name="speechPdfFile" type="file" accept="application/pdf,.pdf" /></label>
            ${adminInput('Full speech PDF link', 'speechLink', active?.speechLink, 'text', false)}
            ${adminSelect('Status', 'status', active?.status || 'upcoming', ['upcoming', 'past'])}
            ${adminSelect('Registration status', 'registrationStatus', active?.registrationStatus || 'Open', ['Open', 'Waitlist', 'Closed'])}
            <label class="field"><span>Description</span><textarea name="description" required>${html(active?.description || '')}</textarea></label>
            <div class="admin-form-actions"><button class="button primary" type="submit">${active ? 'Save changes' : 'Create event'}</button>${active ? '<button class="button secondary" type="button" id="cancelEventEdit">Cancel editing</button>' : ''}</div>
          </div>
        </form>
        <div class="admin-cards">
          <div class="admin-list-heading"><div><span class="admin-overline">YOUR GATHERINGS</span><h2>Event library</h2></div><span class="admin-count">${db.events.length} events</span></div>
          ${db.events.map((event) => `
            <article class="admin-card admin-event-card">
              <div class="admin-event-top"><span class="event-kicker">${html(event.number)}</span><span class="admin-status ${event.status === 'upcoming' ? 'is-upcoming' : ''}">${html(event.status)}</span></div>
              <h3>${html(event.theme)}</h3>
              <p class="admin-event-details">${html(event.date ? shortDate(`${event.date}T00:00:00`) : 'Date to be confirmed')}${event.time ? ` &middot; ${html(event.time)}` : ''}<br>${html(event.location || 'Location to be confirmed')}</p>
              <div class="admin-event-registration"><span>Registration <strong>${html(event.registrationStatus)}</strong></span><span>${db.registrations.filter((reg) => reg.eventId === event.id).length} registered</span></div>
              <div class="row-actions"><button class="small-button" data-edit-event="${html(event.id)}" type="button">Edit event</button><a class="small-button" href="${registrationUrl(event)}" target="_blank" rel="noreferrer">Registration page &nearr;</a><button class="small-button admin-delete" data-delete-event="${html(event.id)}" type="button" aria-label="Delete ${html(event.number)}">Delete</button></div>
            </article>
          `).join('') || '<div class="admin-empty"><h3>Your first gathering starts here</h3><p>Create an event using the form. It will appear here, ready to manage.</p></div>'}
        </div>
      </div>
    `;
  }

  function registrationsAdmin() {
    const registrations = filteredRegistrations();
    const eventIds = [...new Set([...db.events.map((event) => event.id), ...db.registrations.map((reg) => reg.eventId)])];
    return `
      <div class="table-panel admin-card">
        <div class="admin-top"><div><h2>Registrations</h2><p class="muted">${registrations.length} people registered${registrationEventId ? ' for this Suhbah' : ' across all Suhbahs'}.</p></div><button class="button secondary" id="exportCsv" type="button">Export CSV</button></div>
        <label class="field registration-filter"><span>Filter by Suhbah</span><select id="registrationEventFilter"><option value="">All Suhbahs</option>${eventIds.map((id) => {
          const event = db.events.find((item) => item.id === id);
          const reg = db.registrations.find((item) => item.eventId === id);
          const count = db.registrations.filter((item) => item.eventId === id).length;
          return `<option value="${html(id)}" ${registrationEventId === id ? 'selected' : ''}>${html(event ? `${event.number}: ${event.theme}` : `${registrationEventLabel(reg)} (archived)`)} (${count})</option>`;
        }).join('')}</select></label>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Age</th><th>Gender</th><th>Profile</th><th>Attended before</th><th>Quran received</th><th>Suhbah</th><th>Registration type</th><th>Registration date</th></tr></thead>
            <tbody>
              ${registrations.map((reg) => `<tr><td>${html(reg.name)}</td><td>${html(reg.email)}</td><td>${html(reg.phone)}</td><td>${html(reg.age)}</td><td>${html(reg.gender || '')}</td><td>${html(reg.profile || '')}</td><td>${html(reg.attendedBefore || '')}</td><td>${html(reg.receivedQuran || '')}</td><td>${html(registrationEventLabel(reg))}</td><td>${html(reg.registrationStatus === 'Waitlist' ? 'Waitlist' : 'Reserved')}</td><td>${html(shortDate(reg.createdAt))}</td></tr>`).join('') || '<tr><td colspan="11">No registrations for this selection.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function filteredRegistrations() {
    return db.registrations.filter((reg) => !registrationEventId || reg.eventId === registrationEventId);
  }

  function registrationEventLabel(reg) {
    const event = db.events.find((item) => item.id === reg.eventId);
    return event ? `${event.number}: ${event.theme}` : [reg.eventNumber, reg.eventTheme].filter(Boolean).join(': ') || `Suhbah (${reg.eventId})`;
  }

  function testimonialsAdmin() {
    const active = editing.testimonials ? db.testimonials.find((item) => item.id === editing.testimonials) : null;
    return `
      <div class="admin-grid">
        <form class="form-panel" id="testimonialForm">
          <h2>${active ? 'Edit testimonial' : 'Add testimonial'}</h2>
          <input type="hidden" name="id" value="${html(active?.id || '')}" />
          <div class="form-grid">
            ${adminInput('Name', 'name', active?.name)}
            <label class="field"><span>Quote</span><textarea name="quote" required>${html(active?.quote || '')}</textarea></label>
            <button class="button primary" type="submit">${active ? 'Save testimonial' : 'Add testimonial'}</button>
          </div>
        </form>
        <div class="admin-cards">
          ${db.testimonials.map((item) => `<article class="admin-card"><p>"${html(item.quote)}"</p><strong>${html(item.name)}</strong><div class="row-actions" style="margin-top: 12px;"><button class="small-button" data-edit-testimonial="${html(item.id)}" type="button">Edit</button><button class="small-button" data-delete-testimonial="${html(item.id)}" type="button">Delete</button></div></article>`).join('')}
        </div>
      </div>
    `;
  }

  function statsAdmin() {
    return `<form class="form-panel" id="statsForm"><h2>Community Statistics</h2><div class="form-grid">${adminInput('Number of members', 'members', db.communityStats.members)}${adminInput('Number of gatherings', 'gatherings', db.communityStats.gatherings)}${adminInput('Community count', 'community', db.communityStats.community)}${adminInput('Other statistic label', 'other', db.communityStats.other)}<button class="button primary" type="submit">Save statistics</button></div></form>`;
  }

  function socialAdmin() {
    return `<form class="form-panel" id="socialForm"><h2>Social Links</h2><p class="muted">Keep your community connected on Instagram and WhatsApp.</p><div class="form-grid">${adminInput('Instagram', 'instagram', db.socialLinks.instagram, 'url')}${adminInput('WhatsApp', 'whatsapp', db.socialLinks.whatsapp, 'url')}<button class="button primary" type="submit">Save social links</button></div></form>`;
  }

  function adminInput(label, name, value = '', type = 'text', required = true) {
    return `<label class="field"><span>${html(label)}</span><input name="${html(name)}" type="${html(type)}" value="${html(value)}" ${required ? 'required' : ''} /></label>`;
  }

  function adminSelect(label, name, value, options) {
    return `<label class="field"><span>${html(label)}</span><select name="${html(name)}" required>${options.map((option) => `<option ${option === value ? 'selected' : ''}>${html(option)}</option>`).join('')}</select></label>`;
  }

  function bindCommon() {
    document.querySelectorAll('[data-route]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        route(href);
      });
    });

    const menu = document.querySelector('.menu-button');
    const links = document.querySelector('.nav-links');
    if (menu && links) {
      menu.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        document.body.classList.toggle('menu-open', open);
        menu.setAttribute('aria-expanded', String(open));
      });
      links.querySelectorAll('a').forEach((link) =>
        link.addEventListener('click', () => {
          links.classList.remove('open');
          document.body.classList.remove('menu-open');
          menu.setAttribute('aria-expanded', 'false');
        }),
      );
    }
  }

  function bindPublic() {
    bindBookmark();
    const quranSearch = document.getElementById('quranSearch');
    if (quranSearch) {
      const normalizeSearch = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u0600-\u06ff]/g, '');
      const cards = [...document.querySelectorAll('.quran-juz')];
      const filterQuran = () => {
        const query = normalizeSearch(quranSearch.value);
        const juzNumber = query.match(/^(?:juz|para)?0*(\d+)$/)?.[1];
        let count = 0;
        cards.forEach((card, index) => {
          const juz = QuranLibrary.juz[index];
          const matches = !query || (juzNumber ? juz.number === Number(juzNumber) : normalizeSearch(card.textContent).includes(query));
          card.hidden = !matches;
          if (matches) count += 1;
        });
        document.getElementById('quranResults').textContent = query ? `${count} matching Juz` : 'Showing all 30 Juz';
        document.getElementById('quranEmpty').hidden = count > 0;
      };
      quranSearch.addEventListener('input', filterQuran);
      document.getElementById('quranClear').addEventListener('click', () => {
        quranSearch.value = '';
        filterQuran();
        quranSearch.focus();
      });
    }
    document.querySelectorAll('.past-card[data-recap-id]').forEach((card) => {
      card.addEventListener('click', () => openRecap(card.dataset.recapId));
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openRecap(card.dataset.recapId);
      });
    });

    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('recap-overlay') || event.target.closest('.recap-close')) {
        closeRecap();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeRecap();
    });

    document.getElementById('registrationForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const data = formData(form);
      const button = form.querySelector('button[type="submit"]');
      const originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = 'Reserving...';
      try {
        const { registration } = await api('/api/registrations', { method: 'POST', body: JSON.stringify(data) });
        if (!form.isConnected) return;
        const waitlist = registration.registrationStatus === 'Waitlist';
        document.getElementById('registrationMount').innerHTML = `
          <div class="success-panel" role="status">
            <div>
              <h3>${waitlist ? "You're on the waitlist." : "You're in."}</h3>
              <p class="lead">${waitlist ? 'You joined the waitlist for' : 'Your spot is reserved for'} ${html(registration.eventNumber)}: ${html(registration.eventTheme)}.${waitlist ? ' We will contact you if a spot opens.' : ' We look forward to seeing you there.'}</p>
              <a class="button secondary" href="/">Back to Suhbah</a>
            </div>
          </div>
        `;
        reveal();
      } catch (error) {
        button.disabled = false;
        button.textContent = originalLabel;
        form.querySelector('.notice')?.remove();
        form.insertAdjacentHTML('afterbegin', `<div class="notice" role="alert">${html(error.message)}</div>`);
      }
    });
  }

  function bindAdmin() {
    document.getElementById('cancelEventEdit')?.addEventListener('click', async () => {
      editing = {};
      await render();
    });
    document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await api('/api/login', { method: 'POST', body: JSON.stringify(formData(event.target)) });
        await render();
      } catch (error) {
        app.innerHTML = adminLogin('Invalid admin credentials.');
        bindCommon();
        bindAdmin();
      }
    });

    document.getElementById('logoutButton')?.addEventListener('click', async () => {
      await api('/api/logout', { method: 'POST', body: '{}' });
      await render();
    });

    document.querySelectorAll('.admin-tab').forEach((tab) => {
      tab.addEventListener('click', async () => {
        adminTab = tab.dataset.tab;
        editing = {};
        await render();
      });
    });

    document.getElementById('eventForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = formData(event.target);
      const file = event.target.imageFile.files[0];
      if (file) data.image = await fileToDataUrl(file);
      const speechPdfFile = event.target.speechPdfFile.files[0];
      if (speechPdfFile) data.speechLink = await fileToDataUrl(speechPdfFile);
      delete data.imageFile;
      delete data.speechPdfFile;
      await api('/api/admin/events', { method: data.id ? 'PUT' : 'POST', body: JSON.stringify(data) });
      editing = {};
      await render();
    });

    document.querySelectorAll('[data-edit-event]').forEach((button) => {
      button.addEventListener('click', async () => {
        editing = { events: button.dataset.editEvent };
        await render();
        document.getElementById('eventForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    document.querySelectorAll('[data-delete-event]').forEach((button) => {
      button.addEventListener('click', async () => {
        await api('/api/admin/events', { method: 'DELETE', body: JSON.stringify({ id: button.dataset.deleteEvent }) });
        await render();
      });
    });

    document.getElementById('testimonialForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = formData(event.target);
      await api('/api/admin/testimonials', { method: data.id ? 'PUT' : 'POST', body: JSON.stringify(data) });
      editing = {};
      await render();
    });

    document.querySelectorAll('[data-edit-testimonial]').forEach((button) => {
      button.addEventListener('click', async () => {
        editing = { testimonials: button.dataset.editTestimonial };
        await render();
      });
    });

    document.querySelectorAll('[data-delete-testimonial]').forEach((button) => {
      button.addEventListener('click', async () => {
        await api('/api/admin/testimonials', {
          method: 'DELETE',
          body: JSON.stringify({ id: button.dataset.deleteTestimonial }),
        });
        await render();
      });
    });

    document.getElementById('statsForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await api('/api/admin/statistics', { method: 'PUT', body: JSON.stringify(formData(event.target)) });
      await render();
    });

    document.getElementById('socialForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      await api('/api/admin/social', { method: 'PUT', body: JSON.stringify(formData(event.target)) });
      await render();
    });

    document.getElementById('exportCsv')?.addEventListener('click', exportCsv);
    document.getElementById('registrationEventFilter')?.addEventListener('change', async (event) => {
      registrationEventId = event.target.value;
      await render();
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function exportCsv() {
    const rows = [
      [
        'Name',
        'Email',
        'Phone',
        'Age',
        'Gender',
        'Profile',
        'Attended before',
        'Quran received',
        'Event',
        'Registration type',
        'Registration date',
      ],
      ...filteredRegistrations().map((reg) => {
        return [
          reg.name,
          reg.email,
          reg.phone,
          reg.age,
          reg.gender || '',
          reg.profile || '',
          reg.attendedBefore || '',
          reg.receivedQuran || '',
          registrationEventLabel(reg),
          reg.registrationStatus === 'Waitlist' ? 'Waitlist' : 'Reserved',
          shortDate(reg.createdAt),
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = registrationEventId ? `suhbah-${registrationEventId.replace(/[^a-z0-9_-]/gi, '-')}-registrations.csv` : 'suhbah-registrations.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  function countdowns() {
    clearInterval(countdownTimer);
    const targets = document.querySelectorAll('[data-countdown]');
    if (!targets.length) return;
    const update = () => {
      targets.forEach((target) => {
        const distance = Math.max(0, new Date(target.dataset.countdown) - new Date());
        const values = [
          Math.floor(distance / 86400000),
          Math.floor((distance % 86400000) / 3600000),
          Math.floor((distance % 3600000) / 60000),
          Math.floor((distance % 60000) / 1000),
        ];
        target.querySelectorAll('.count-value').forEach((item, index) => {
          item.textContent = String(values[index]).padStart(2, '0');
        });
      });
    };
    update();
    countdownTimer = setInterval(update, 1000);
  }

  function reveal() {
    const items = document.querySelectorAll('.fade-in');
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    items.forEach((item) => observer.observe(item));
  }

  async function render() {
    try {
      if (isAdmin()) {
        try {
          await loadAdmin();
          app.innerHTML = adminShell();
        } catch (error) {
          app.innerHTML = adminLogin();
        }
      } else {
        await loadPublic();
        app.innerHTML = publicShell();
      }
      bindCommon();
      bindPublic();
      bindAdmin();
      countdowns();
      reveal();
    } catch (error) {
      app.innerHTML = `<div class="login-wrap"><div class="login-card"><h2>Something went wrong</h2><p class="muted">${html(error.message)}</p></div></div>`;
    }
  }

  window.addEventListener('popstate', render);
  render();
})();
