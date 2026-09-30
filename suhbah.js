(function () {
  'use strict';

  const app = document.getElementById('app');
  let db = { events: [], testimonials: [], registrations: [], communityStats: {}, socialLinks: {} };
  let adminTab = 'events';
  let editing = {};
  let countdownTimer;

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
        .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || db.events[0]
    );
  }

  function isAdmin() {
    return window.location.pathname.replace(/\/$/, '') === '/admin';
  }

  function route(path) {
    window.history.pushState({}, '', path);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadPublic() {
    db = await api('/api/public');
  }

  async function loadAdmin() {
    db = await api('/api/admin');
  }

  function header() {
    return `
      <header class="header">
        <nav class="container nav" aria-label="Primary navigation">
          <a class="brand" href="/" data-route><img class="brand-logo" src="/assets/suhbah-logo.png" alt="Suhbah" /></a>
          <div class="nav-links" id="navLinks">
            <a class="nav-link" href="#home">Home</a>
            <a class="nav-link" href="#about">About</a>
            <a class="nav-link" href="#events">Events</a>
            <a class="nav-link" href="#community">Community</a>
            <a class="nav-link" href="#quran-library">Quran</a>
            <a class="nav-link" href="#testimonials">Voices</a>
            <a class="nav-link" href="#contact">Contact</a>
            <a class="nav-link" href="/admin" data-route>Admin</a>
          </div>
          <div class="nav-actions"><a class="button primary" href="#register">Join Next Suhbah</a></div>
          <button class="menu-button" type="button" aria-label="Open menu" aria-controls="navLinks" aria-expanded="false"><span class="menu-icon"></span></button>
        </nav>
      </header>
    `;
  }

  function publicShell() {
    return `<div class="site">${header()}${publicMain()}${footer()}</div>`;
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
                <a class="button primary" href="#register">Join the Next Suhbah</a>
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
          <div class="container fade-in">
            <div class="quran-library-head">
              <span>Explore the Quran</span>
              <h2>Quran Library</h2>
            </div>
            <figure class="quran-hadith">
              <blockquote lang="ar" dir="rtl">عَنْ عُثْمَانَ ـ رضى الله عنه ـ عَنِ النَّبِيِّ صلى الله عليه وسلم قَالَ "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ"</blockquote>
              <figcaption>
                <span class="hadith-translation">Narrated Uthman: The Prophet (ﷺ) said, "The best among you are those who learn the Qur'an and teach it."</span>
                <span class="hadith-source">Sahih al-Bukhari 5027</span>
              </figcaption>
            </figure>
            <div class="quran-grid">
              ${quranParaLinks()}
            </div>
          </div>
        </section>
        <section class="section cta">
          <div class="container fade-in">
            <h2>Your next step starts here.</h2>
            <p class="lead">You don't need to know everything about the Quran.<br />You just need to show up.</p>
            <div class="cta-row">
              <a class="button secondary" href="#register">Join the Next Suhbah</a>
              <a class="button ghost" href="${html(db.socialLinks.whatsapp)}" target="_blank" rel="noreferrer">Join the Community</a>
            </div>
          </div>
        </section>
        <section class="section white" id="register">
          <div class="container registration-grid">
            <div class="registration-copy fade-in">
              <p class="registration-label-text">Event registration</p>
              <h2 class="registration-brand">Suhbah</h2>
              <p class="registration-subtitle">Reserve your spot</p>
              <p class="lead">${html(event.number)}: ${html(event.theme)}</p>
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
            <div id="registrationMount" class="fade-in">${registrationForm(event)}</div>
          </div>
        </section>
      </main>
    `;
  }

  function eventCard(event) {
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
          <a class="button primary event-reserve-button" href="#register">Reserve Your Spot</a>
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

    return Array.from({ length: 30 }, (_, index) => {
      const number = index + 1;
      const label = String(number).padStart(2, '0');
      return `
        <a class="quran-card" href="http://www.janathimessage.co.uk/quran/para${number}.pdf" target="_blank" rel="noreferrer" aria-label="Open Juz ${label}">
          <span class="quran-card-number" aria-hidden="true">${label}</span>
          <strong lang="ar" dir="rtl">${paraNames[index]}</strong>
        </a>
      `;
    }).join('');
  }

  function pastMediaStyle(image) {
    return image ? `style="background-image: url('${html(image)}')"` : '';
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
        <div class="past-image" ${pastMediaStyle(event.image)}></div>
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
            <span class="event-kicker">${html(session.number)}</span>
            <h2 id="recapTitle">${html(session.theme)}</h2>
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
    return `
      <form class="form-panel" id="registrationForm">
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
              <option>Prefer not to say</option>
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
          <button class="button primary" type="submit">Reserve My Spot</button>
        </div>
      </form>
    `;
  }

  function field(label, name, type, value = '', required = true) {
    return `<label class="field"><span>${html(label)}</span><input name="${html(name)}" type="${html(type)}" value="${html(value)}" ${required ? 'required' : ''} /></label>`;
  }

  function footer() {
    return `
      <footer class="footer" id="contact">
        <div class="container">
          <div class="footer-grid">
            <div><a class="brand footer-brand" href="/" data-route><img class="brand-logo" src="/assets/suhbah-logo.png" alt="Suhbah" /></a><p>Reconnecting young people with the Quran, one gathering at a time.</p></div>
            <div><h3>Links</h3><div class="footer-links"><a href="#home">Home</a><a href="#about">About</a><a href="#events">Events</a><a href="#community">Community</a><a href="#contact">Contact</a></div></div>
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
    return `
      <div class="admin-layout">
        ${header()}
        <main class="container admin-shell">
          <div class="admin-top">
            <div><span class="eyebrow"><span class="dot"></span> Admin dashboard</span><h1 class="admin-title">Suhbah Admin</h1></div>
            <button class="button ghost" id="logoutButton" type="button">Log out</button>
          </div>
          <div class="admin-tabs" role="tablist">
            ${['events', 'registrations', 'testimonials', 'statistics', 'social'].map((tab) => `<button class="admin-tab ${adminTab === tab ? 'active' : ''}" data-tab="${tab}" type="button">${tab[0].toUpperCase()}${tab.slice(1)}</button>`).join('')}
          </div>
          <section>${adminSection()}</section>
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
          <h2>${active ? 'Edit event' : 'Create event'}</h2>
          <input type="hidden" name="id" value="${html(active?.id || '')}" />
          <div class="form-grid">
            ${adminInput('Event number', 'number', active?.number)}
            ${adminInput('Theme', 'theme', active?.theme)}
            ${adminInput('Date', 'date', active?.date, 'date')}
            ${adminInput('Time', 'time', active?.time)}
            ${adminInput('Location', 'location', active?.location)}
            ${adminInput('Speaker', 'speaker', active?.speaker, 'text', false)}
            <label class="field"><span>Upload image</span><input name="imageFile" type="file" accept="image/*" /></label>
            ${adminInput('Image URL or saved image data', 'image', active?.image, 'text', false)}
            <label class="field"><span>Upload full speech PDF</span><input name="speechPdfFile" type="file" accept="application/pdf,.pdf" /></label>
            ${adminInput('Full speech PDF link', 'speechLink', active?.speechLink, 'text', false)}
            ${adminSelect('Status', 'status', active?.status || 'upcoming', ['upcoming', 'past'])}
            ${adminSelect('Registration status', 'registrationStatus', active?.registrationStatus || 'Open', ['Open', 'Waitlist', 'Closed'])}
            <label class="field"><span>Description</span><textarea name="description" required>${html(active?.description || '')}</textarea></label>
            <button class="button primary" type="submit">${active ? 'Save event' : 'Create event'}</button>
          </div>
        </form>
        <div class="admin-cards">
          ${db.events.map((event) => `
            <article class="admin-card">
              <span class="event-kicker">${html(event.number)} · ${html(event.status)}</span>
              <h3>${html(event.theme)}</h3>
              <div class="row-actions"><button class="small-button" data-edit-event="${html(event.id)}" type="button">Edit</button><button class="small-button" data-delete-event="${html(event.id)}" type="button">Delete</button></div>
            </article>
          `).join('')}
        </div>
      </div>
    `;
  }

  function registrationsAdmin() {
    return `
      <div class="table-panel admin-card">
        <div class="admin-top"><div><h2>Registrations</h2><p class="muted">${db.registrations.length} people registered.</p></div><button class="button secondary" id="exportCsv" type="button">Export CSV</button></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Age</th><th>Gender</th><th>Profile</th><th>Attended before</th><th>Quran received</th><th>Event</th><th>Registration date</th></tr></thead>
            <tbody>
              ${db.registrations.map((reg) => {
                const event = db.events.find((item) => item.id === reg.eventId);
                return `<tr><td>${html(reg.name)}</td><td>${html(reg.email)}</td><td>${html(reg.phone)}</td><td>${html(reg.age)}</td><td>${html(reg.gender || '')}</td><td>${html(reg.profile || '')}</td><td>${html(reg.attendedBefore || '')}</td><td>${html(reg.receivedQuran || '')}</td><td>${html(event?.theme || 'Suhbah')}</td><td>${html(shortDate(reg.createdAt))}</td></tr>`;
              }).join('') || '<tr><td colspan="10">No registrations yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
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
    return `<form class="form-panel" id="socialForm"><h2>Social Links</h2><div class="form-grid">${adminInput('Instagram', 'instagram', db.socialLinks.instagram, 'url')}${adminInput('WhatsApp', 'whatsapp', db.socialLinks.whatsapp, 'url')}${adminInput('YouTube', 'youtube', db.socialLinks.youtube, 'url')}<button class="button primary" type="submit">Save social links</button></div></form>`;
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
      const button = event.target.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Reserving...';
      try {
        await api('/api/registrations', { method: 'POST', body: JSON.stringify(formData(event.target)) });
        document.getElementById('registrationMount').innerHTML = `
          <div class="success-panel">
            <div>
              <h3>You're in.</h3>
              <p class="lead">We're looking forward to seeing you at the next Suhbah.</p>
              <a class="button secondary" href="#home">Back to Suhbah</a>
            </div>
          </div>
        `;
        reveal();
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Reserve My Spot';
        event.target.insertAdjacentHTML('afterbegin', `<div class="notice">${html(error.message)}</div>`);
      }
    });
  }

  function bindAdmin() {
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
        'Registration date',
      ],
      ...db.registrations.map((reg) => {
        const event = db.events.find((item) => item.id === reg.eventId);
        return [
          reg.name,
          reg.email,
          reg.phone,
          reg.age,
          reg.gender || '',
          reg.profile || '',
          reg.attendedBefore || '',
          reg.receivedQuran || '',
          event?.theme || 'Suhbah',
          shortDate(reg.createdAt),
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'suhbah-registrations.csv';
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
