'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fonts = [400, 500, 600].map(weight => `@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/ttf;base64,${fs.readFileSync(path.join(root, `fonts/ibm-plex-sans-${weight}.ttf`)).toString('base64')}) format('truetype')}`).join('\n');
let html = read('template.html');
for (const [marker, value] of Object.entries({FONT_STYLES:fonts,APP_STYLES:read('styles.css'),RANKUPS_SCRIPT:read('rankups.js'),ORIGINAL_ENVIRONMENTS_SCRIPT:read('original-environments.js'),ENVIRONMENTS_SCRIPT:read('environments.js'),ARSENAL_SCRIPT:read('arsenal.js'),FAN_CONTENT_SCRIPT:read('fan-content.js'),CATALOG_SCRIPT:read('catalog.js'),ENGINE_SCRIPT:read('engine.js'),TRAINING_SCRIPT:read('training.js'),APP_SCRIPT:read('app.js')})) {
  html = html.replace(`/* ${marker} */`, () => value);
}
html = html.replace('</head>', () => `<!-- IBM Plex Sans, SIL Open Font License 1.1.\n${read('fonts/OFL.txt').replace(/--/g, '—')}\n-->\n</head>`);
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Built standalone index.html (${Math.round(Buffer.byteLength(html) / 1024)} KiB). No network or server required.`);
