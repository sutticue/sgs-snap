// สร้าง ../install.html (โหมดปกติ) และ ../sgs-snap.html (SGS Snap) จาก template.html + sgs-paste.js
// รัน: node source/build.js
const fs = require('fs');
const raw = fs.readFileSync(__dirname + '/sgs-paste.js', 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const VERSION = (raw.match(/var VERSION = '([^']+)'/) || [])[1];
if (!VERSION) throw new Error('ไม่เจอ VERSION ใน sgs-paste.js');
const tpl = fs.readFileSync(__dirname + '/template.html', 'utf8');
const tplInstant = fs.readFileSync(__dirname + '/template-instant.html', 'utf8'); // หน้าติดตั้ง "SGS Snap" ออกแบบแยก

function build(out, instant) {
  const src = instant ? raw.replace('var INSTANT = false;', 'var INSTANT = true;') : raw;
  if (instant && !src.includes('var INSTANT = true;')) throw new Error('สลับโหมดวางทันทีไม่สำเร็จ');
  const href = 'javascript:' + encodeURIComponent(src);
  let html = (instant ? tplInstant : tpl).replace('href="javascript:void 0"', () => 'href="' + href.replace(/"/g, '&quot;') + '"');
  html = html.split('{{VERSION}}').join(VERSION + (instant ? ' · Snap' : ''));
  fs.writeFileSync(__dirname + '/../' + out, html);
  console.log(out, 'bookmarklet length:', href.length);
}
build('install.html', false);
build('sgs-snap.html', true);
