// SGS — วางคะแนนจาก Google Sheets / Excel ลงหน้า "บันทึกผลการเรียน" ทีละหลายช่อง
// กด bookmark 1 ครั้ง → คลิกช่องเริ่มต้น → Cmd/Ctrl+V
// หน้า SGS บันทึกทันทีที่ค่าเปลี่ยน (CheckValue → PageMethods.SaveMe) และเก็บ state ไว้ในตัวแปร global
// โหมดปกติ: กรอกทีละช่องแล้วรอ server ตอบก่อน (รู้ผลทุกช่อง)
// โหมดวางทันที (INSTANT): ใส่ค่าทุกช่อง + change ในรอบเดียว ไม่รอ ไม่ระบายสี — SaveMe รับค่าเป็น argument จึงบันทึกถูกช่อง
//   browser ต่อคิวคำขอให้เอง แต่ callback ของ SGS ใช้ global ร่วมกัน ช่องรวม/เกรดบนจออาจไม่อัปเดตจนกว่าจะ refresh
(function () {
  var VERSION = 'v8'; // เปลี่ยนทุกครั้งที่แก้โค้ด — กล่องดำ/หน้าติดตั้งโชว์ ใช้เช็คว่าปุ่มบนแถบเป็นตัวล่าสุดไหม
  var INSTANT = false; // build.js สลับเป็น true สำหรับปุ่ม SGS Snap
  if (window.__sgsPaste) { window.__sgsPaste('[' + VERSION + '] พร้อมอยู่แล้ว — คลิกช่องเริ่มต้น แล้วกด วาง'); return; }
  if (!document.querySelector('input[id*="TableControlRepeater_ctl"][id$="_S10"]')) {
    alert('หน้านี้ไม่ใช่หน้ากรอกคะแนน SGS — ไม่ได้ทำอะไร');
    return;
  }

  var COLS = ['S10', 'S11', 'S12', 'S13', 'S14', 'S15', 'S16', 'S17', 'S18', 'Final', 'ReGr', 'RepeatGr', 'Remark'];
  var ID_RE = /^(.*TableControlRepeater_ctl\d+_)([A-Za-z0-9]+)$/;
  var busy = false;

  var box = document.createElement('div');
  box.title = 'คลิกเพื่อซ่อน';
  box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;max-width:380px;padding:12px 14px;' +
    'background:#1f2937;color:#fff;font:14px/1.5 sans-serif;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.3);' +
    'white-space:pre-line;cursor:pointer';
  box.onclick = function () { if (!busy) box.style.display = 'none'; };
  document.body.appendChild(box);
  function toast(msg) { box.style.display = 'block'; box.textContent = msg; }
  window.__sgsPaste = toast;

  function label(col) {
    if (/^S\d+$/.test(col)) return 'ช่อง ' + col.slice(1);
    return { Final: 'ปลายภาค', Remark: 'หมายเหตุ' }[col] || col;
  }
  function maxOf(el, col) {
    var m = (el.getAttribute('onchange') || '').match(new RegExp("'" + col + "'\\s*,\\s*'([^']*)'"));
    return m ? m[1] : '';
  }
  function parse(text) {
    return text.replace(/\r/g, '').replace(/\n+$/, '').split('\n')
      .map(function (r) { return r.split('\t').map(function (c) { return c.trim(); }); });
  }

  document.addEventListener('paste', function (e) {
    var el = e.target;
    var m = el && el.tagName === 'INPUT' && el.id && el.id.match(ID_RE);
    if (!m || COLS.indexOf(m[2]) < 0) return;
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if (!/[\t\n]/.test(text.replace(/\s+$/, ''))) return; // ค่าเดียว → ปล่อยให้วางตามปกติ
    e.preventDefault();
    e.stopPropagation();
    if (busy) { toast('กำลังบันทึกชุดก่อนหน้าอยู่ รอให้เสร็จก่อน'); return; }
    run(m[1], m[2], parse(text));
  }, true);

  function run(startRow, startCol, grid) {
    var rows = Array.prototype.map.call(document.querySelectorAll('input[id$="_S10"]'), function (x) {
      return x.id.slice(0, -3);
    }).filter(function (p) { return ID_RE.test(p + 'S10'); });
    var r0 = rows.indexOf(startRow);
    // คอลัมน์ที่ยังไม่ได้ติ๊กเปิด (disabled) ข้ามไป เหมือนปุ่ม Enter ของหน้า SGS
    var cols = COLS.slice(COLS.indexOf(startCol)).filter(function (c) {
      var x = document.getElementById(startRow + c);
      return x && !x.disabled;
    });
    var width = Math.max.apply(null, grid.map(function (r) { return r.length; }));

    if (width > cols.length) {
      toast('ยังไม่ได้กรอกอะไรเลย\nข้อมูลกว้าง ' + width + ' คอลัมน์ แต่ช่องที่เปิดให้กรอกตั้งแต่ตรงนี้มีแค่ ' +
        cols.length + ' (' + cols.map(label).join(', ') + ')\n→ ติ๊กเปิดคอลัมน์ให้ครบก่อน');
      return;
    }
    if (r0 + grid.length > rows.length) {
      toast('ยังไม่ได้กรอกอะไรเลย\nข้อมูล ' + grid.length + ' แถว แต่จากแถวนี้ลงไปมีนักเรียน ' + (rows.length - r0) +
        ' คน\n→ ถ้ามีหลายหน้า ให้เพิ่ม "รายการ/หน้า" ให้เห็นครบก่อน');
      return;
    }

    var jobs = [], bad = [];
    grid.forEach(function (row, i) {
      row.forEach(function (v, j) {
        if (v === '') return; // ช่องว่างใน sheet = ไม่แตะค่าเดิม
        var col = cols[j], el = document.getElementById(rows[r0 + i] + col);
        var name = 'แถว ' + (r0 + i + 1) + ' ' + label(col);
        if (col !== 'Remark') {
          var max = maxOf(el, col);
          if (isNaN(v) || (max !== '' && parseFloat(v) > parseFloat(max))) bad.push(name + ': "' + v + '" (เต็ม ' + max + ')');
        }
        jobs.push({ el: el, v: v, name: name });
      });
    });

    if (bad.length) {
      toast('ยังไม่ได้กรอกอะไรเลย — มีค่าไม่ถูกต้อง:\n' + bad.slice(0, 8).join('\n') +
        (bad.length > 8 ? '\n…อีก ' + (bad.length - 8) + ' ช่อง' : ''));
      return;
    }
    if (!jobs.length) { toast('ไม่มีค่าให้กรอก (ทุกช่องว่าง)'); return; }
    if (!confirm('จะบันทึก ' + jobs.length + ' ช่อง\n' +
      'แถว ' + (r0 + 1) + '–' + (r0 + grid.length) + '  ·  ' + cols.slice(0, width).map(label).join(', ') +
      '\n\nช่องที่ว่างใน sheet จะข้าม (ไม่ลบค่าเดิม)\nตกลง?')) return;
    (INSTANT ? fillInstant : fill)(jobs);
  }

  // เรียก flow เดิมของหน้า (onchange → CheckValue → SaveMe → GetGr → MyCallBack1)
  // แล้วดักปลายทางเพื่อรู้ว่าช่องนี้เสร็จหรือ error ก่อนไปช่องถัดไป
  function saveOne(el, v) {
    return new Promise(function (resolve) {
      var cb1 = window.MyCallBack1, onErr = window.MyError, al = window.alert, done = false;
      var timer = setTimeout(function () { finish('TIMEOUT'); }, 15000);
      function finish(err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.MyCallBack1 = cb1; window.MyError = onErr; window.alert = al;
        resolve(err);
      }
      window.MyCallBack1 = function (r) { cb1(r); finish(null); };
      window.MyError = function (r) { finish((r && r._message) || 'error'); };
      window.alert = function (msg) { finish(String(msg).trim()); }; // SaveMe ไม่ผ่าน → หน้าเดิมจะ alert
      el.value = v;
      el.dispatchEvent(new Event('change'));
    });
  }

  async function fill(jobs) {
    busy = true;
    var fails = [], stopped = null;
    for (var k = 0; k < jobs.length; k++) {
      var j = jobs[k];
      toast('กำลังบันทึก ' + (k + 1) + '/' + jobs.length + ' …\n' + j.name);
      j.el.style.backgroundColor = '#fef9c3';
      var err = await saveOne(j.el, j.v);
      j.el.style.backgroundColor = err ? '#fecaca' : '#bbf7d0';
      if (err === 'TIMEOUT') { stopped = j.name; break; }
      if (err) fails.push(j.name + ': ' + err);
    }
    busy = false;
    var ok = jobs.length - fails.length - (stopped ? jobs.length - k : 0);
    var msg = 'บันทึกสำเร็จ ' + ok + '/' + jobs.length + ' ช่อง (สีเขียว)';
    if (fails.length) msg += '\n\nไม่ผ่าน (สีแดง):\n' + fails.slice(0, 8).join('\n') + (fails.length > 8 ? '\n…อีก ' + (fails.length - 8) : '');
    if (stopped) msg += '\n\nหยุดที่ ' + stopped + ' — server ไม่ตอบ 15 วินาที\nเช็คเน็ต/ยัง login อยู่ไหม แล้ววางใหม่ตั้งแต่ช่องนั้น';
    toast(msg);
  }

  function fillInstant(jobs) {
    jobs.forEach(function (j) {
      j.el.value = j.v;
      j.el.dispatchEvent(new Event('change'));
    });
    toast('วางครบ ' + jobs.length + ' ช่องแล้ว\nSGS กำลังส่งบันทึกอยู่เบื้องหลัง — รอสัก 10 วินาที อย่าเพิ่งปิด/เปลี่ยนหน้า\nแล้ว refresh เพื่อเช็คว่าบันทึกติดครบ');
  }

  toast('[' + VERSION + (INSTANT ? ' · Snap' : ' · Safe') + '] พร้อมแล้ว\n1. ติ๊กเปิดคอลัมน์ที่จะกรอก\n2. คลิกช่องเริ่มต้น (แถว/คอลัมน์แรกของข้อมูล)\n3. กด Ctrl+V (Mac: Cmd+V)');
})();
