/* Lụm Store — interactions */
(function () {
  "use strict";
  try {
    console.log("[Lụm Store] build:", (document.currentScript && document.currentScript.src) || "?");
  } catch (e) {}

  var CFG = window.LUM_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var money = function (n) {
    return Number(n || 0).toLocaleString("vi-VN") + "đ";
  };
  window.lumMoney = money;

  /* ---------------- Toast ---------------- */
  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }
  window.lumToast = toast;

  /* ---------------- Tracking helpers ---------------- */
  function track(evt, params) {
    try { if (typeof window.fbq === "function") window.fbq("track", evt, params || {}); } catch (e) {}
    try { if (typeof window.gtag === "function") window.gtag("event", evt, params || {}); } catch (e) {}
  }
  window.lumTrack = track;

  function attr(name) {
    try {
      var p = new URLSearchParams(location.search);
      return p.get(name) || "";
    } catch (e) { return ""; }
  }

  /* ---------------- Order queue (local backup) ---------------- */
  var QKEY = "lum_orders_v1";
  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch (e) { return []; }
  }
  function writeQueue(list) {
    try { localStorage.setItem(QKEY, JSON.stringify(list.slice(-40))); } catch (e) {}
  }
  function enqueue(order) {
    var list = readQueue();
    list.push({ order: order, tries: 0, sent: false });
    writeQueue(list);
  }
  function markSent(code) {
    var list = readQueue();
    for (var i = 0; i < list.length; i++) {
      if (list[i].order && list[i].order.orderCode === code) list[i].sent = true;
    }
    writeQueue(list.filter(function (x) { return !x.sent; }));
  }

  /* ---------------- Send to Google Sheet ---------------- */
  var SHEET_URL = (CFG.sheetEndpoint || "").trim();

  function sendToSheet(order) {
    return new Promise(function (resolve) {
      if (!SHEET_URL) { resolve({ ok: false, reason: "no-endpoint" }); return; }
      var body = JSON.stringify(order);
      // Apps Script không trả CORS header ổn định -> dùng no-cors, coi như đã gửi.
      fetch(SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: body
      }).then(function () { resolve({ ok: true }); })
        .catch(function () { resolve({ ok: false, reason: "network" }); });
    });
  }

  function flushQueue() {
    if (!SHEET_URL) return;
    var list = readQueue().filter(function (x) { return !x.sent; });
    if (!list.length) return;
    list.forEach(function (item) {
      item.tries = (item.tries || 0) + 1;
      if (item.tries > 5) return;
      sendToSheet(item.order).then(function (r) { if (r.ok) markSent(item.order.orderCode); });
    });
  }

  function newCode() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    var rnd = Math.floor(Math.random() * 900 + 100);
    return "LS" + String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes()) + rnd;
  }

  /* ---------------- Product page ---------------- */
  // Phát video chắc chắn hơn trên browser trong app (Zalo/FB/Messenger) và iOS
  function playVideo(v) {
    v.muted = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("x5-playsinline", "true");
    var pr = null;
    try { pr = v.play(); } catch (e) {}
    if (pr && pr.catch) pr.catch(function () {
      try { v.load(); v.play(); } catch (e) {}
    });
    return pr;
  }

  function initGallery() {
    var wrap = $("#galleryMain");
    var img = $("#galleryImg");
    if (!wrap || !img) return;
    var thumbs = $$(".thumb");
    if (!thumbs.length) return;
    var vid = $("#galleryVideo");
    var playBtn = $("#galleryPlay");
    var prog = $("#galleryProgress");
    var progFill = prog ? $("i", prog) : null;
    if (vid) {
      vid.loop = false;
      vid.muted = true;
      vid.controls = true;
      ["playing", "pause", "ended", "error", "canplay"].forEach(function (ev) {
        vid.addEventListener(ev, function () {
          if (ev === "error") {
            try { console.error("[Lụm Store] video lỗi", vid.error && vid.error.code, vid.currentSrc); } catch (e) {}
          }
          if (playBtn) playBtn.hidden = vid.hidden || !vid.paused;
        });
      });
      if (progFill) {
        vid.addEventListener("timeupdate", function () {
          var d = vid.duration || 0;
          progFill.style.width = d ? Math.min(100, (vid.currentTime / d) * 100) + "%" : "0%";
        });
      }
    }
    var idx = 0;
    var imgCount = thumbs.filter(function (t) { return !t.getAttribute("data-video"); }).length;

    function isVideo(i) { return !!(thumbs[i] && thumbs[i].getAttribute("data-video")); }
    function imgPos(i) {
      var pos = 0;
      for (var k = 0; k <= i; k++) if (!isVideo(k)) pos++;
      return pos;
    }
    function srcOf(i) {
      var t = thumbs[i];
      return t.getAttribute("data-src") || (t.querySelector("img") || {}).src || "";
    }
    function show(i, autoplay) {
      idx = (i + thumbs.length) % thumbs.length;
      var v = isVideo(idx);
      if (vid) {
        if (v) {
          if (!vid.getAttribute("src")) {
            vid.setAttribute("src", thumbs[idx].getAttribute("data-video"));
            vid.setAttribute("poster", thumbs[idx].getAttribute("data-poster") || "");
          }
          vid.hidden = false;
          if (autoplay) playVideo(vid);
        } else {
          try { vid.pause(); } catch (e) {}
          vid.hidden = true;
        }
      }
      img.hidden = v;
      if (!v) img.src = srcOf(idx);
      // Nút ▶ chỉ hiện khi đang ở mục video và video chưa chạy (autoplay bị chặn)
      if (playBtn) playBtn.hidden = !v || !vid || !vid.paused;
      if (prog) prog.hidden = !v;
      thumbs.forEach(function (t, n) { t.classList.toggle("is-active", n === idx); });
      var c = $("#galleryCount");
      if (c) {
        if (v) c.textContent = "Video";
        else c.textContent = imgPos(idx) + "/" + imgCount;
      }
      var act = thumbs[idx];
      if (act && act.scrollIntoView) {
        try { act.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); } catch (e) {}
      }
      var lb = $("#lightboxImg");
      if (lb) lb.src = v ? (thumbs[idx].getAttribute("data-poster") || "") : srcOf(idx);
    }

    thumbs.forEach(function (t, n) { t.addEventListener("click", function () { show(n, true); }); });

    var sx = 0, sy = 0;
    wrap.addEventListener("touchstart", function (e) {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    wrap.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });

    // lightbox
    var box = document.createElement("div");
    box.className = "lightbox";
    box.id = "lightbox";
    box.innerHTML = '<img id="lightboxImg" alt=""><button class="lb-close" type="button" aria-label="Đóng">✕</button>' +
      '<button class="lb-nav prev" type="button" aria-label="Trước">‹</button>' +
      '<button class="lb-nav next" type="button" aria-label="Sau">›</button>' +
      '<span class="lb-count" id="lbCount"></span>';
    document.body.appendChild(box);

    function openLb(i) {
      show(i);
      if (isVideo(idx)) return;
      box.classList.add("is-open");
      document.body.style.overflow = "hidden";
      var c = $("#lbCount");
      if (c) c.textContent = imgPos(idx) + " / " + imgCount;
    }
    function closeLb() {
      box.classList.remove("is-open");
      document.body.style.overflow = "";
    }
    function nav(d) {
      var n = idx;
      for (var k = 0; k < thumbs.length; k++) {
        n = (n + d + thumbs.length) % thumbs.length;
        if (!isVideo(n)) break;
      }
      show(n);
      var c = $("#lbCount");
      if (c) c.textContent = imgPos(idx) + " / " + imgCount;
    }

    if (playBtn) playBtn.addEventListener("click", function (e) { e.stopPropagation(); show(idx, true); });
    if (vid) vid.addEventListener("click", function (e) {
      e.stopPropagation();
      if (vid.paused) show(idx, true);
      else vid.controls = true;
    });
    img.addEventListener("click", function () { openLb(idx); });
    $(".lb-close", box).addEventListener("click", closeLb);
    $(".lb-nav.prev", box).addEventListener("click", function (e) { e.stopPropagation(); nav(-1); });
    $(".lb-nav.next", box).addEventListener("click", function (e) { e.stopPropagation(); nav(1); });
    box.addEventListener("click", function (e) { if (e.target === box) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") nav(-1);
      if (e.key === "ArrowRight") nav(1);
    });

    var lbx = 0;
    box.addEventListener("touchstart", function (e) { lbx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - lbx;
      if (Math.abs(dx) > 40) nav(dx < 0 ? 1 : -1);
    }, { passive: true });

    // album grid
    $$(".album-item").forEach(function (b) {
      b.addEventListener("click", function () {
        var want = Number(b.getAttribute("data-idx")) || 0;
        var target = -1;
        thumbs.forEach(function (t, n) { if (t.getAttribute("data-idx") === String(want)) target = n; });
        openLb(target >= 0 ? target : want);
      });
    });

    // Mở trang là tự phát video (muted) nếu mục đầu tiên là video
    show(0, isVideo(0));
  }

  function initVariants() {
    $$(".chips").forEach(function (group) {
      var name = group.getAttribute("data-group") || "Phân loại";
      $$(".opt", group).forEach(function (btn) {
        btn.addEventListener("click", function () {
          $$(".opt", group).forEach(function (x) { x.classList.remove("is-active"); });
          btn.classList.add("is-active");
          var out = $('[data-selected="' + name + '"]');
          if (out) out.textContent = btn.getAttribute("data-value") || btn.textContent.trim();
          // cập nhật giá theo biến thể được chọn
          var price = Number(btn.getAttribute("data-price") || 0);
          var oldPrice = Number(btn.getAttribute("data-oldprice") || 0);
          var shipping = Number(btn.getAttribute("data-shipping") || 0);
          if (price > 0) {
            var input = $("#qtyInput");
            if (input) { input.setAttribute("data-unit", price); input.setAttribute("data-shipping", shipping); }
            var priceEl = $(".price-box .price");
            if (priceEl) priceEl.textContent = money(price);
            // giá gốc gạch + % tiết kiệm theo biến thể
            var row = $(".price-box .row");
            if (row) {
              var oldEl = row.querySelector(".price-old");
              var saveEl = row.querySelector(".save");
              if (oldPrice > price) {
                if (!oldEl) { oldEl = document.createElement("span"); oldEl.className = "price-old"; row.appendChild(oldEl); }
                oldEl.textContent = money(oldPrice);
                if (!saveEl) { saveEl = document.createElement("span"); saveEl.className = "save"; row.appendChild(saveEl); }
                saveEl.textContent = "Tiết kiệm " + Math.max(0, Math.round((1 - price / oldPrice) * 100)) + "%";
              } else {
                if (oldEl) oldEl.remove();
                if (saveEl) saveEl.remove();
              }
            }
            var syncFn = input && input._sync;
            if (typeof syncFn === "function") syncFn();
          }
        });
      });
    });
  }

  function selectedVariant() {
    var active = $(".opt.is-active");
    return active ? (active.getAttribute("data-value") || active.textContent.trim()) : "";
  }

  function initQty() {
    var input = $("#qtyInput");
    if (!input) return;
    function sync() {
      var unit = Number(input.getAttribute("data-unit") || 0);
      var shipping = Number(input.getAttribute("data-shipping") || 0);
      var q = Math.max(1, Math.min(99, parseInt(input.value, 10) || 1));
      input.value = q;
      var total = unit * q + shipping;
      var totalEl = $("#formTotal");
      if (totalEl) totalEl.textContent = money(total);
      var sb = $("#sbPrice");
      if (sb) sb.textContent = money(total);
    }
    input._sync = sync;
    $$(".qty button").forEach(function (b) {
      b.addEventListener("click", function () {
        var cur = parseInt(input.value, 10) || 1;
        input.value = Math.max(1, Math.min(99, cur + (Number(b.getAttribute("data-step")) || 1)));
        sync();
      });
    });
    input.addEventListener("input", sync);
    sync();
  }

  function initSticky() {
    var bar = $("#stickyBuy");
    if (!bar) return;
    document.body.classList.add("has-sticky");
    var onScroll = function () {
      if (window.scrollY > 420) bar.classList.add("show");
      else bar.classList.remove("show");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    var jump = $("#sbBtn");
    if (jump) {
      jump.addEventListener("click", function () {
        var form = $("#orderForm");
        if (form) {
          form.scrollIntoView({ behavior: "smooth", block: "center" });
          var name = $("#fName");
          if (name) setTimeout(function () { name.focus({ preventScroll: true }); }, 420);
        }
      });
    }
  }

  function openModal(code, total) {
    var m = $("#successModal");
    if (!m) return;
    var codeEl = $("#modalCode");
    if (codeEl) codeEl.textContent = "Mã đơn: " + code;
    var totEl = $("#modalTotal");
    if (totEl) totEl.textContent = total ? "Tổng tiền: " + money(total) + " (thanh toán khi nhận hàng)" : "";
    m.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    var m = $("#successModal");
    if (m) m.classList.remove("is-open");
    document.body.style.overflow = "";
  }
  window.lumCloseModal = closeModal;

  /* ---------------- Địa chỉ 3 cấp: Tỉnh → Huyện → Xã ---------------- */
  var BASE = document.documentElement.getAttribute("data-base") || ".";
  var ADDR_CACHE = {};

  function fillSelect(sel, items, placeholder) {
    if (!sel) return;
    var html = '<option value="">' + placeholder + "</option>";
    for (var i = 0; i < items.length; i++) html += '<option value="' + items[i] + '">' + items[i] + "</option>";
    sel.innerHTML = html;
    sel.value = "";
    sel.disabled = !items.length;
  }

  function loadDistricts(code) {
    if (ADDR_CACHE[code]) return Promise.resolve(ADDR_CACHE[code]);
    return fetch(BASE + "/assets/addr/" + code + ".json")
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) { ADDR_CACHE[code] = list; return list; })
      .catch(function () { return []; });
  }

  function initAddress() {
    var prov = $("#fProvince");
    var dist = $("#fDistrict");
    var ward = $("#fWard");
    if (!prov || !dist || !ward) return;

    prov.addEventListener("change", function () {
      fillSelect(dist, [], "— Chọn quận / huyện —");
      fillSelect(ward, [], "— Chọn xã / phường —");
      if (!prov.value) return;
      loadDistricts(prov.value).then(function (list) {
        fillSelect(dist, list.map(function (d) { return d.n; }), "— Chọn quận / huyện —");
        if (list.length === 1) {
          dist.value = list[0].n;
          dist.dispatchEvent(new Event("change"));
        }
      });
    });

    dist.addEventListener("change", function () {
      fillSelect(ward, [], "— Chọn xã / phường —");
      if (!dist.value || !prov.value) return;
      loadDistricts(prov.value).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].n === dist.value) {
            fillSelect(ward, list[i].w, "— Chọn xã / phường —");
            if (list[i].w.length === 1) ward.value = list[i].w[0];
            return;
          }
        }
      });
    });
  }

  /* ---------------- Đánh giá: xem thêm + gửi bình luận ---------------- */
  var RV_NAMES = ["Nguyễn Thu Hà", "Trần Minh Anh", "Lê Ngọc Ánh", "Phạm Thu Trang", "Hoàng Yến Nhi", "Vũ Khánh Linh", "Đặng Phương Thảo", "Bùi Thanh Hằng", "Đỗ Diệu Linh", "Ngô Hải Yến", "Dương Kim Ngân", "Phan Quỳnh Chi", "Trịnh Mai Anh", "Đinh Thùy Dương", "Lâm Bích Ngọc", "Mai Phương Uyên", "Võ Thị Hồng", "Tạ Thu Quyên", "Cao Ngọc Diệp", "Trần Bảo Châu"];
  var RV_TXT = {
    5: ["Túi đẹp đúng như ảnh, da mềm cầm rất thích tay.", "Giao nhanh, đóng gói kỹ, mở ra là thơm mùi da mới.", "Đeo đi làm cả tuần rồi, form vẫn đứng, không bị nhăn.", "Mua lần 2 rồi, chất lượng vẫn ổn định như lần đầu.", "Shop tư vấn nhiệt tình, gọi xác nhận trong 10 phút.", "Đựng vừa điện thoại, ví, son, khoá — gọn mà đủ đồ.", "Màu ngoài đời xinh hơn ảnh, phối đồ gì cũng hợp.", "Được kiểm hàng trước khi trả tiền nên rất yên tâm.", "Đường may chắc, khoá mượt, không có chỉ thừa.", "Quá hợp lý với tầm giá, mình giới thiệu cho cả phòng."],
    4: ["Hàng đẹp, chỉ là giao chậm hơn shop nói 1 ngày.", "Túi xinh, màu hơi đậm so với ảnh nhưng vẫn dùng tốt.", "Chất ổn trong tầm giá, khoá hơi cứng lúc mới.", "Form đẹp, dây đeo hơi mảnh, mình thay dây khác.", "Đóng gói chắc, hộp hơi móp góc nhưng túi không sao."],
    3: ["Đặt màu đen mà giao màu be, shop đổi lại trong 2 ngày.", "Giao sai mẫu khoá móc, shop đổi cái khác, hàng mới đẹp.", "Hẹn thứ 4 mà thứ 7 mới tới, lỡ mất dịp đi tiệc.", "Nhận sai màu, shop xử lý nhanh nhưng phải chờ thêm 3 ngày.", "Giao nhầm màu hồng trong khi mình đặt trắng.", "Giao trễ 3 ngày, shipper không gọi trước.", "Sai mẫu so với ảnh, phải ra bưu cục đổi.", "Màu ngoài đời khác ảnh, shop cho đổi màu khác."],
    2: ["Đặt màu đen, nhận màu nâu, đổi lại mất gần 1 tuần.", "Giao sai mẫu hoàn toàn, chờ đổi 5 ngày.", "Hẹn 3 ngày mà 9 ngày mới nhận, lại còn sai màu."]
  };
  function rvRand(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
  function rvGenFor(star, idx) {
    var s = star || 5;
    var pool = RV_TXT[s] || RV_TXT[5];
    var r2 = rvRand(idx * 5.3 + 11);
    var d = new Date(Date.now() - Math.floor(r2 * 330) * 86400000);
    var pad = function (v) { return (v < 10 ? "0" : "") + v; };
    return {
      name: RV_NAMES[(idx * 7 + s * 3) % RV_NAMES.length],
      stars: s,
      date: pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(),
      text: pool[(idx * 7 + s) % pool.length],
      place: ""
    };
  }

  function rvHtml(r, extra) {
    var st = "★★★★★".slice(0, r.stars);
    return '<div class="rv-item">' +
      '<div class="avatar">' + (r.name || "KH").trim().split(/\s+/).slice(-2).map(function (x) { return x[0] || ""; }).join("").toUpperCase() + "</div>" +
      '<div class="rv-body"><div class="rv-head"><b>' + escHtml(r.name) + "</b>" + (extra || "") + "</div>" +
      '<div class="rv-meta"><span class="rv-stars">' + st + "</span> · " + escHtml(r.date) + (r.place ? " · " + escHtml(r.place) : "") + "</div>" +
      "<p>" + escHtml(r.text) + "</p></div></div>";
  }

  function escHtml(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function initReviews() {
    var list = $("#rvList");
    if (!list) return;
    var more = $("#rvMore");
    var note = $("#rvNote");
    var reason = $("#rvReason");
    var resetBtn = $("#rvReset");
    var dataEl = $("#rvData");
    var slug = list.getAttribute("data-slug") || "sp";
    var total = parseInt(list.getAttribute("data-total") || "0", 10);
    var STEP = 8;
    var ALL = [];
    try { ALL = JSON.parse((dataEl && dataEl.textContent) || "[]") || []; } catch (e) { ALL = []; }

    var COUNTS = {};
    $$(".rv-bar").forEach(function (b) {
      var n = parseInt((b.querySelector("b").textContent || "0").replace(/\./g, ""), 10) || 0;
      COUNTS[parseInt(b.getAttribute("data-star"), 10)] = n;
    });

    var KEY = "lum_rv_" + slug;
    var mine = [];
    try { mine = JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch (e) { mine = []; }

    var cur = 0; // 0 = tất cả
    var shown = STEP;
    var cache = {};

    function base() {
      var arr = mine.slice().reverse().concat(ALL);
      return cur ? arr.filter(function (r) { return r.stars === cur; }) : arr;
    }
    function limit() { return cur ? (COUNTS[cur] || 0) : total; }
    function view() {
      var key = "@" + cur + ":" + mine.length;
      if (cache[key]) return cache[key];
      var arr = base();
      var lim = limit();
      var used = {};
      arr.forEach(function (r) { used[r.text] = 1; });
      for (var i = arr.length; i < lim; i++) {
        var g = rvGenFor(cur, i + 1);
        var guard = 0;
        while (used[g.text] && guard < 30) { guard++; g = rvGenFor(cur, i + 1 + guard * 13); }
        used[g.text] = 1;
        arr.push(g);
      }
      cache = {};
      cache[key] = arr;
      return arr;
    }
    function noteText(n, lim) {
      if (!lim) return "Chưa có đánh giá " + cur + " sao.";
      if (cur) return "Đang xem " + n + " / " + lim.toLocaleString("vi-VN") + " đánh giá " + cur + "★";
      return n >= lim
        ? "Đã hiển thị toàn bộ · " + lim.toLocaleString("vi-VN") + " lượt đánh giá"
        : "Đang hiển thị " + n + " bình luận mới nhất · tổng " + lim.toLocaleString("vi-VN") + " lượt đánh giá";
    }
    function render() {
      var arr = view();
      var lim = limit();
      var n = Math.min(shown, lim, arr.length);
      var html = "";
      for (var i = 0; i < n; i++) html += rvHtml(arr[i], arr[i].mine ? '<span class="rv-badge">Bạn</span>' : "");
      if (!n) html = '<p class="rv-empty">Chưa có đánh giá ' + cur + ' sao cho sản phẩm này.</p>';
      list.innerHTML = html;

      if (more) more.style.display = n >= lim || !lim ? "none" : "";
      if (note) note.textContent = noteText(n, lim);

      $$(".rv-bar").forEach(function (b) {
        b.classList.toggle("is-active", parseInt(b.getAttribute("data-star"), 10) === cur);
      });
      if (resetBtn) resetBtn.hidden = !cur;
      if (reason) {
        if (cur === 2 || cur === 3) {
          reason.hidden = false;
          reason.textContent = "Lý do trừ sao: giao nhầm màu / nhầm mẫu hoặc giao trễ ngày — shop đã đổi lại cho khách.";
        } else {
          reason.hidden = true;
          reason.textContent = "";
        }
      }
    }

    if (more) {
      more.addEventListener("click", function () {
        shown += STEP;
        render();
      });
    }

    $$(".rv-bar").forEach(function (b) {
      b.addEventListener("click", function () {
        var s = parseInt(b.getAttribute("data-star"), 10) || 0;
        cur = cur === s ? 0 : s;
        shown = STEP;
        render();
        if (cur && list.getBoundingClientRect().top < 0) list.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        cur = 0;
        shown = STEP;
        render();
      });
    }

    /* bình luận khách tự gửi (lưu trên máy) */
    function readMine() {
      try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
    }

    var form = $("#rvForm");
    if (!form) { render(); return; }
    var pick = $("#rvPick");
    if (pick) {
      pick.addEventListener("click", function (e) {
        var b = e.target.closest ? e.target.closest("[data-star]") : null;
        if (!b) return;
        var v = parseInt(b.getAttribute("data-star"), 10) || 5;
        pick.setAttribute("data-value", v);
        $$("[data-star]", pick).forEach(function (x) {
          x.classList.toggle("is-on", parseInt(x.getAttribute("data-star"), 10) <= v);
        });
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (($("#rvName") || {}).value || "").trim();
      var text = (($("#rvText") || {}).value || "").trim();
      if (name.length < 2) { toast("Vui lòng nhập tên của bạn."); $("#rvName").focus(); return; }
      if (text.length < 4) { toast("Vui lòng nhập nội dung đánh giá."); $("#rvText").focus(); return; }
      var stars = parseInt((pick && pick.getAttribute("data-value")) || "5", 10) || 5;
      var d = new Date();
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      var r = {
        name: name,
        stars: stars,
        date: pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(),
        text: text,
        place: "",
        mine: true
      };
      mine.push(r);
      cache = {};
      try { localStorage.setItem(KEY, JSON.stringify(mine.slice(-30))); } catch (err) {}
      cur = 0;
      shown = STEP;
      render();
      form.reset();
      if (pick) {
        pick.setAttribute("data-value", "5");
        $$("[data-star]", pick).forEach(function (x) { x.classList.add("is-on"); });
      }
      toast("Cảm ơn bạn đã đánh giá!");
    });

    render();
  }

  function initForm() {
    var form = $("#orderForm");
    if (!form) return;

    initAddress();

    $$("[data-close-modal]").forEach(function (b) { b.addEventListener("click", closeModal); });
    var modal = $("#successModal");
    if (modal) {
      modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
    }
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var errEl = $("#formErr");
      var name = ($("#fName") || {}).value || "";
      var phone = (($("#fPhone") || {}).value || "").replace(/[\s.\-]/g, "");
      var street = ($("#fStreet") || {}).value || "";
      var ward = ($("#fWard") || {}).value || "";
      var district = ($("#fDistrict") || {}).value || "";
      var provSel = $("#fProvince");
      var province = provSel && provSel.selectedOptions && provSel.selectedOptions[0]
        ? (provSel.selectedOptions[0].getAttribute("data-name") || "")
        : "";
      var note = ($("#fNote") || {}).value || "";
      var qty = parseInt((($("#qtyInput") || {}).value || 1), 10) || 1;
      var unit = Number((($("#qtyInput") || {}).getAttribute) ? $("#qtyInput").getAttribute("data-unit") : 0) || 0;
      var shipping = Number((($("#qtyInput") || {}).getAttribute) ? $("#qtyInput").getAttribute("data-shipping") : 0) || 0;

      function fail(msg) {
        if (errEl) { errEl.textContent = msg; errEl.classList.add("show"); }
        toast(msg);
      }
      if (name.trim().length < 2) { fail("Vui lòng nhập họ tên của bạn."); $("#fName").focus(); return; }
      if (!/^(0|\+?84)(\d{9})$/.test(phone)) { fail("Số điện thoại chưa đúng. Ví dụ: 0982467019"); $("#fPhone").focus(); return; }
      if (street.trim().length < 3) { fail("Vui lòng nhập số nhà, tên đường."); $("#fStreet").focus(); return; }
      if (!province) { fail("Vui lòng chọn Tỉnh / Thành phố."); $("#fProvince").focus(); return; }
      if (!district) { fail("Vui lòng chọn Quận / Huyện."); $("#fDistrict").focus(); return; }
      if (!ward) { fail("Vui lòng chọn Xã / Phường."); $("#fWard").focus(); return; }
      var address = [street.trim(), ward.trim(), district.trim(), province].join(", ");
      if (errEl) errEl.classList.remove("show");

      var code = newCode();
      // Link sạch (bỏ utm/fbclid) để shop mở đúng mẫu túi, không nhầm hàng
      var productUrl = location.origin + location.pathname;
      var order = {
        orderCode: code,
        createdAt: new Date().toISOString(),
        product: form.getAttribute("data-product") || "",
        variant: selectedVariant(),
        qty: qty,
        unitPrice: unit,
        total: unit * qty + shipping,
        shipping: shipping,
        name: name.trim(),
        phone: phone,
        address: address.trim(),
        note: note.trim(),
        page: location.href,
        productUrl: productUrl,
        utmSource: attr("utm_source"),
        utmCampaign: attr("utm_campaign"),
        utmContent: attr("utm_content"),
        fbclid: attr("fbclid"),
        shop: CFG.shop || "",
        referrer: document.referrer || ""
      };

      var btn = $("#submitBtn");
      var oldLabel = btn ? btn.innerHTML : "";
      if (btn) { btn.disabled = true; btn.innerHTML = "Đang gửi đơn…"; }

      enqueue(order);
      sendToSheet(order).then(function (r) {
        if (r.ok) markSent(code);
        if (btn) { btn.disabled = false; btn.innerHTML = oldLabel; }
        form.reset();
        if ($("#fProvince")) $("#fProvince").dispatchEvent(new Event("change"));
        if ($("#qtyInput")) { $("#qtyInput").value = 1; }
        var totalEl = $("#formTotal");
        if (totalEl) totalEl.textContent = money(unit);
        openModal(code, order.total);
        track("Purchase", { value: order.total, currency: "VND", content_name: order.product });
        if (!r.ok && r.reason === "no-endpoint") {
          toast("Đơn đã lưu. Chưa cấu hình Google Sheet.");
        }
      });
    });
  }

  /* ---------------- Home ---------------- */
  function initVideoBlocks() {
    $$(".factory-video").forEach(function (box) {
      var v = $("video", box);
      var btn = $(".video-cover", box);
      if (!v || !btn) return;
      btn.addEventListener("click", function () {
        var src = v.getAttribute("data-src");
        if (src && !v.getAttribute("src")) v.setAttribute("src", src);
        v.controls = true;
        btn.classList.add("is-hidden");
        var pr = playVideo(v);
        if (pr && pr.catch) pr.catch(function () { btn.classList.remove("is-hidden"); });
        v.addEventListener("pause", function () {
          if (v.currentTime > 0 && v.currentTime < v.duration - 0.3) return;
        });
      });
    });
  }

  function initHome() {
    $$("[data-quick-buy]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var href = a.getAttribute("href") || "";
        if (href.indexOf("#") === 0) {
          e.preventDefault();
          var target = $(href);
          if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    });
  }

  /* ---------------- Boot ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    initGallery();
    initVideoBlocks();
    initVariants();
    initQty();
    initSticky();
    initReviews();
    initForm();
    initHome();
    flushQueue();
    track("ViewContent", {
      content_name: document.title,
      content_ids: [document.body.getAttribute("data-product-id") || ""]
    });
  });
})();
