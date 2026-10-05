// สร้าง ../sgs-snap.html จาก page.html + sgs-paste.js — ฝังปุ่ม 2 ตัว: SGS Snap (วางทันที) และ SGS Snap Safe (ทีละช่อง)
// รัน: node source/build.js
const fs = require('fs');
const raw = fs.readFileSync(__dirname + '/sgs-paste.js', 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const VERSION = (raw.match(/var VERSION = '([^']+)'/) || [])[1];
if (!VERSION) throw new Error('ไม่เจอ VERSION ใน sgs-paste.js');

function bookmarklet(instant) {
  const src = instant ? raw.replace('var INSTANT = false;', 'var INSTANT = true;') : raw;
  if (instant && !src.includes('var INSTANT = true;')) throw new Error('สลับโหมด Snap ไม่สำเร็จ');
  return ('javascript:' + encodeURIComponent(src)).replace(/"/g, '&quot;');
}

let html = fs.readFileSync(__dirname + '/page.html', 'utf8');
for (const [slot, instant] of [['javascript:INSTANT', true], ['javascript:SAFE', false]]) {
  if (!html.includes(`href="${slot}"`)) throw new Error('ไม่เจอปุ่ม ' + slot + ' ใน page.html');
  const href = bookmarklet(instant);
  html = html.replace(`href="${slot}"`, () => `href="${href}"`);
  console.log(slot.slice(11), 'bookmarklet length:', href.length);
}
html = html.split('{{VERSION}}').join(VERSION);
fs.writeFileSync(__dirname + '/../sgs-snap.html', html);
