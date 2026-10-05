// เทส logic ของ sgs-paste.js กับหน้า SGS จำลอง (ไม่ต้องใช้ browser) — รัน: node source/test.js
// จำลองแค่สิ่งที่โค้ดแตะ: ช่อง input ตามชื่อ id ของ SGS, onchange → CheckValue → SaveMe (async) → MyCallBack1
const fs = require('fs');
const assert = require('assert');
const RAW = fs.readFileSync(__dirname + '/sgs-paste.js', 'utf8');
const P = 'ctl00_PageContent_TblTranscriptsTableControlRepeater_';
const MAX = { S10: 10, S11: 10, S12: 10, S13: 0, S14: 0, S15: 0, S16: 0, S17: 0, S18: 0, Final: 20, ReGr: 4, RepeatGr: 4, Remark: '' };
const wait = ms => new Promise(r => setTimeout(r, ms));

function setup(instant) {
  const els = {}, order = [];
  const st = { toast: '', saved: [], inFlight: 0, maxInFlight: 0, alerts: [], paste: null };
  for (let r = 0; r < 5; r++) for (const col of Object.keys(MAX)) {
    const id = P + 'ctl0' + r + '_' + col;
    const e = {
      id, tagName: 'INPUT', value: '', disabled: true, style: {},
      getAttribute: a => a === 'onchange' ? `CheckValue(document.all('${id}'), '${col}','${MAX[col]}','1','f','s','t','g');return false;` : null,
      dispatchEvent() { // = CheckValue ของ SGS
        const v = e.value;
        if (parseFloat(v) > MAX[col] || isNaN(v)) { window.alert(v + ' กรอกคะแนนไม่ถูกต้อง'); return; }
        st.inFlight++; st.maxInFlight = Math.max(st.maxInFlight, st.inFlight);
        setTimeout(() => { // = SaveMe → MyCallBack → GetGr → MyCallBack1
          st.inFlight--; st.saved.push(id.replace(P, '') + '=' + v);
          if (v === '9.9') { window.alert('server ไม่รับ'); e.value = ''; } else window.MyCallBack1([0, 0, 0, 0]);
        }, 5);
      },
    };
    els[id] = e; order.push(e);
  }
  global.window = global;
  global.Event = class { constructor(t) { this.type = t; } };
  global.MyCallBack1 = () => {};
  global.MyError = () => {};
  global.alert = m => st.alerts.push(String(m));
  global.confirm = () => true;
  global.__sgsPaste = undefined;
  const box = { style: {}, set textContent(t) { st.toast = t; } };
  global.document = {
    createElement: () => box, body: { appendChild() {} },
    addEventListener: (t, f) => { st.paste = f; },
    querySelector: () => order.find(e => e.id.endsWith('_S10')) || null,
    querySelectorAll: () => order.filter(e => e.id.endsWith('_S10')),
    getElementById: id => els[id] || null,
  };
  eval(instant ? RAW.replace('var INSTANT = false;', 'var INSTANT = true;') : RAW);
  const enable = c => order.filter(e => e.id.endsWith('_' + c)).forEach(e => { e.disabled = false; });
  enable('S10'); enable('S11'); enable('Final');
  const paste = (row, col, text) => {
    let prevented = false;
    st.paste({ target: els[P + 'ctl0' + row + '_' + col], clipboardData: { getData: () => text }, preventDefault() { prevented = true; }, stopPropagation() {} });
    return prevented;
  };
  const reset = () => { st.saved = []; st.alerts = []; st.maxInFlight = 0; };
  return { st, paste, reset, els };
}

async function suite(instant) {
  const name = instant ? 'Snap (วางทันที)' : 'ปกติ (รอทีละช่อง)';
  const { st, paste, reset } = setup(instant);

  assert.strictEqual(paste(0, 'S10', '7'), false, 'วางค่าเดียวต้องปล่อยให้วางปกติ');

  reset(); paste(1, 'S10', '8\t9\t15\n7\t\t18\n'); await wait(200);
  assert.deepStrictEqual(st.saved, ['ctl01_S10=8', 'ctl01_S11=9', 'ctl01_Final=15', 'ctl02_S10=7', 'ctl02_Final=18'], 'ข้ามคอลัมน์ที่ปิด + ข้ามช่องว่าง');
  if (!instant) assert.strictEqual(st.maxInFlight, 1, 'โหมดปกติต้องส่งทีละช่อง');

  reset(); paste(0, 'S10', '11\t5'); await wait(50);
  assert.strictEqual(st.saved.length, 0, 'ค่าเกินคะแนนเต็มต้องไม่กรอกเลยทั้งชุด');
  assert.match(st.toast, /เต็ม 10/);

  reset(); paste(3, 'S10', '1\n2\n3'); await wait(50);
  assert.strictEqual(st.saved.length, 0, 'แถวเกินจำนวนนักเรียนต้องไม่กรอก');

  reset(); paste(0, 'S10', '1\t2\t3\t4'); await wait(50);
  assert.strictEqual(st.saved.length, 0, 'คอลัมน์เกินที่เปิดไว้ต้องไม่กรอก');

  reset(); paste(0, 'S11', '9.9\n5'); await wait(100);
  assert.deepStrictEqual(st.saved, ['ctl00_S11=9.9', 'ctl01_S11=5'], 'server ปฏิเสธแล้วยังไปช่องถัดไป');
  if (!instant) {
    assert.match(st.toast, /สำเร็จ 1\/2/);
    assert.strictEqual(st.alerts.length, 0, 'โหมดปกติต้องดัก alert ไว้ในกล่องดำ');
  }

  console.log('✓', name);
}

(async () => {
  await suite(false);
  await suite(true);

  // หน้าที่ไม่ใช่ SGS → ไม่ติดตั้งอะไร
  let msg = '';
  global.alert = m => { msg = m; };
  global.__sgsPaste = undefined;
  global.document = { querySelector: () => null };
  eval(RAW);
  assert.match(msg, /ไม่ใช่หน้ากรอกคะแนน SGS/);
  assert.strictEqual(global.__sgsPaste, undefined);
  console.log('✓ หน้าที่ไม่ใช่ SGS');
})().catch(e => { console.error('✗', e.message); process.exit(1); });
