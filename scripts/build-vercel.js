const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'public');
fs.mkdirSync(output, { recursive: true });

// Vercel serves public/ separately from the Node server bundle. Copy only
// browser assets: the database, environment files, and server code stay private.
for (const name of ['index.html', 'suhbah.js', 'suhbah.css', 'quran-library.js', 'assets']) {
  fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
}

console.log('Prepared frontend files in public/ for Vercel.');
