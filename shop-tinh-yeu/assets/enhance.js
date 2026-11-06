/* =========================================================
   Shop Tình Yêu — Enhancements
   Countdown timer · Toast notification · Floating CTA · Popup form · Trust badges
   ========================================================= */

(function () {
  "use strict";

  var cfg = window.LUM_CONFIG || {};
  var base = (document.querySelector('html')?.getAttribute('data-base') || '..');

  /* ---------- 1. Countdown timer ---------- */
  function initCountdown() {
    var el = document.getElementById('countdownBox');
    if (!el) return;
    // End time: 24 hours from first visit (stored in localStorage)
    var key = 'shop_countdown_end';
    var end = localStorage.getItem(key);
    if (!end) {
      end = Date.now() + 59 * 60 * 1000 + 59 * 1000;
      localStorage.setItem(key, end);
    }
    end = parseInt(end, 10);
    var dEl = el.querySelector('[data-cd="d"]');
    var hEl = el.querySelector('[data-cd="h"]');
    var mEl = el.querySelector('[data-cd="m"]');
    var sEl = el.querySelector('[data-cd="s"]');
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      var diff = end - Date.now();
      if (diff <= 0) {
        // reset for next 24h
        end = Date.now() + 59 * 60 * 1000 + 59 * 1000;
        localStorage.setItem(key, end);
        diff = end - Date.now();
      }
      var d = Math.floor(diff / 86400000);
      var h = Math.floor((diff % 86400000) / 3600000);
      var m = Math.floor((diff % 3600000) / 60000);
      var s = Math.floor((diff % 60000) / 1000);
      if (dEl) dEl.textContent = pad(d);
      if (hEl) hEl.textContent = pad(h);
      if (mEl) mEl.textContent = pad(m);
      if (sEl) sEl.textContent = pad(s);
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- 2. Toast notification (social proof) ---------- */
  var toastData = [
    { name: "🔒 N*** H***", text: "Mua Combo 1 (Free Ship)", time: "2 phút trước" },
    { name: "🔒 N*** L***", text: "Mua Combo 2 (Free Ship)", time: "3 phút trước" },
    { name: "🔒 T*** N***", text: "Mua Combo 1 (Free Ship)", time: "4 phút trước" },
    { name: "🔒 L*** B***", text: "Mua Combo 1 (Free Ship)", time: "5 phút trước" },
    { name: "🔒 N*** D***", text: "Mua Combo 2 (Free Ship)", time: "6 phút trước" },
    { name: "🔒 T*** L***", text: "Mua Combo 1 (Free Ship)", time: "1 phút trước" },
    { name: "🔒 V*** T***", text: "Mua Combo 1 (Free Ship)", time: "2 phút trước" },
    { name: "🔒 Đ*** H***", text: "Mua Combo 1 (Free Ship)", time: "3 phút trước" },
    { name: "🔒 B*** Y***", text: "Mua Combo 2 (Free Ship)", time: "4 phút trước" },
    { name: "🔒 N*** V***", text: "Mua Combo 1 (Free Ship)", time: "5 phút trước" },
    { name: "🔒 T*** A***", text: "Mua Combo 1 (Free Ship)", time: "6 phút trước" },
    { name: "🔒 P*** M***", text: "Mua Combo 2 (Free Ship)", time: "1 phút trước" },
    { name: "🔒 H*** T***", text: "Mua Combo 1 (Free Ship)", time: "2 phút trước" },
    { name: "🔒 L*** T***", text: "Mua Combo 1 (Free Ship)", time: "3 phút trước" },
    { name: "🔒 N*** P***", text: "Mua Combo 2 (Free Ship)", time: "4 phút trước" },
    { name: "🔒 T*** V***", text: "Mua Combo 1 (Free Ship)", time: "5 phút trước" },
    { name: "🔒 V*** L***", text: "Mua Combo 1 (Free Ship)", time: "6 phút trước" },
    { name: "🔒 Đ*** T***", text: "Mua Combo 2 (Free Ship)", time: "1 phút trước" },
    { name: "🔒 B*** H***", text: "Mua Combo 1 (Free Ship)", time: "2 phút trước" },
    { name: "🔒 N*** M***", text: "Mua Combo 1 (Free Ship)", time: "3 phút trước" },
    { name: "🔒 P*** L***", text: "Mua Combo 2 (Free Ship)", time: "4 phút trước" },
    { name: "🔒 H*** V***", text: "Mua Combo 1 (Free Ship)", time: "5 phút trước" },
    { name: "🔒 L*** N***", text: "Mua Combo 1 (Free Ship)", time: "6 phút trước" },
    { name: "🔒 T*** P***", text: "Mua Combo 2 (Free Ship)", time: "1 phút trước" },
    { name: "🔒 V*** N***", text: "Mua Combo 1 (Free Ship)", time: "2 phút trước" },
    { name: "🔒 K*** T***", text: "Mua Combo 3 (Free Ship)", time: "3 phút trước" },
    { name: "🔒 M*** H***", text: "Mua Combo 2 (Free Ship)", time: "4 phút trước" },
    { name: "🔒 Q*** L***", text: "Mua Combo 3 (Free Ship)", time: "5 phút trước" },
    { name: "🔒 R*** S***", text: "Mua Combo 1 (Free Ship)", time: "6 phút trước" },
  ];
  function initToast() {
    var toast = document.getElementById('toastNotify');
    if (!toast) return;
    // Shuffle toastData (Fisher-Yates) and avoid consecutive repeats
    var shuffled = toastData.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    var idx = 0;
    var lastIdx = -1;
    function show() {
      // pick next non-repeating index
      if (idx >= shuffled.length) {
        // re-shuffle
        for (var i = shuffled.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
        }
        idx = 0;
      }
      var d = shuffled[idx];
      idx++;
      toast.querySelector('.toast-title').textContent = d.name;
      toast.querySelector('.toast-content').textContent = d.text;
      toast.querySelector('.toast-time').textContent = d.time;
      toast.classList.add('show');
      setTimeout(function () { toast.classList.remove('show'); }, 4000);
    }
    // First show after 5s, then every 10s
    setTimeout(function () { show(); setInterval(show, 10000); }, 5000);
  }

  /* ---------- 3. Floating CTA bar ---------- */
  function initFloatingCTA() {
    var bar = document.getElementById('floatingCTA');
    if (!bar) return;
    var shown = false;
    function onScroll() {
      var y = window.scrollY || window.pageYOffset;
      if (y > 600 && !shown) { bar.classList.add('show'); shown = true; }
      else if (y <= 600 && shown) { bar.classList.remove('show'); shown = false; }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    // click scrolls to order form
    var btn = bar.querySelector('.fcta-btn');
    if (btn) btn.addEventListener('click', function () {
      var f = document.getElementById('orderFormWrap') || document.getElementById('orderForm');
      if (f) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- 4. Popup form ---------- */
  function initPopup() {
    var popup = document.getElementById('popupForm');
    if (!popup) return;
    var shown = false;
    function open() {
      if (shown) return;
      shown = true;
      popup.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      popup.classList.remove('show');
      document.body.style.overflow = '';
    }
    popup.querySelectorAll('[data-close-popup]').forEach(function (b) { b.addEventListener('click', close); });
    // Trigger after 15s or 50% scroll
    setTimeout(open, 15000);
    var scrollTriggered = false;
    window.addEventListener('scroll', function () {
      if (scrollTriggered) return;
      var y = window.scrollY || window.pageYOffset;
      var h = document.body.scrollHeight - window.innerHeight;
      if (h > 0 && y / h > 0.5) { scrollTriggered = true; open(); }
    }, { passive: true });
    // Submit handler — gửi đơn về Sheet + Telegram
    var form = popup.querySelector('form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = (form.querySelector('[name="name"]') || {}).value || '';
        var phone = (form.querySelector('[name="phone"]') || {}).value || '';
        var address = (form.querySelector('[name="address"]') || {}).value || '';
        if (name.trim().length < 2) { alert('Vui lòng nhập họ tên.'); return; }
        if (!/^(0|\+?84)(\d{9})$/.test(phone.replace(/[\s.\-]/g, ''))) { alert('Số điện thoại chưa đúng. VD: 0982467019'); return; }
        if (address.trim().length < 3) { alert('Vui lòng nhập địa chỉ.'); return; }
        // Gửi về Sheet + Telegram
        var cfg = window.LUM_CONFIG || {};
        var sheetUrl = (cfg.sheetEndpoint || '').trim();
        // Gửi dữ liệu trong nền, phản hồi ngay cho khách
        var order = {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          product: 'Cốc Silicone Y Tế Cao Cấp',
          combo: 'Popup form',
          page: location.href,
          time: new Date().toLocaleString('vi-VN', { hour12: false }),
          shop: cfg.shop || ''
        };
        if (sheetUrl) {
          try { navigator.sendBeacon(sheetUrl, new Blob([JSON.stringify(order)], { type: 'text/plain;charset=utf-8' })); } catch (e) {}
          fetch(sheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(order)
          }).catch(function () {});
        }
        // Hiện popup cảm ơn
        var ty = document.getElementById('popupThankYou');
        if (ty) {
          ty.classList.add('show');
          document.body.style.overflow = 'hidden';
          setTimeout(function () { ty.classList.remove('show'); document.body.style.overflow = ''; }, 5000);
        } else {
          if (window.lumToast) window.lumToast('Đã nhận thông tin! Shop sẽ liên hệ bạn trong 15 phút.');
          else alert('Đã nhận thông tin! Shop sẽ liên hệ bạn trong 15 phút.');
        }
        form.reset();
        close();
      });
    }
  }

  /* ---------- 5. Trust badges (already in HTML, just animate) ---------- */
  function initTrustBadges() {
    // no-op, CSS handles styling
  }

  /* ---------- Init ---------- */
  function init() {
    initCountdown();
    initToast();
    initFloatingCTA();
    initPopup();
    initTrustBadges();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
