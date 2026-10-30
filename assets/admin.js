/* Admin logic */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const money = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";

  let DB = { brand: {}, products: [] };
  let cur = 0;
  let dirty = false;

  const q = (window.location.hash || "").replace("#", "");

  /* ---------- toast ---------- */
  let tTimer;
  function toast(msg, isErr) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.classList.add("show");
    clearTimeout(tTimer);
    tTimer = setTimeout(() => el.classList.remove("show"), 3000);
  }

  function markDirty(v = true) {
    dirty = v;
    const msg = v ? "Có thay đổi chưa lưu" : "Đã lưu";
    ["saveState", "saveState2"].forEach((id) => { const e = $("#" + id); if (e) e.textContent = msg; });
  }

  /* ---------- load ---------- */
  async function load() {
    const r = await fetch("/api/products");
    DB = await r.json();
    DB.brand = DB.brand || {};
    DB.products = DB.products || [];
    DB.products.forEach((p) => {
      p.variants = (p.variants || []).map((g) => {
        g = g || {};
        const opts = (g.options || []).map((o) => {
          if (typeof o === "string") o = { value: o };
          o = o || {};
          return {
            value: String(o.value || o.name || o.label || "").trim(),
            price: (o.price != null && o.price !== "") ? Number(o.price) : (p.price || 0),
            count: (o.count != null && o.count !== "") ? Number(o.count) : 1
          };
        }).filter((o) => o.value);
        return { name: g.name || "Phân loại", options: opts };
      });
    });
    renderList();
    if (DB.products.length) select(0);
    fillBrand();
  }

  /* ---------- list ---------- */
  function renderList() {
    const box = $("#prodList");
    const term = (($("#searchBox") || {}).value || "").trim().toLowerCase();
    $("#pcount").textContent = DB.products.length;
    box.innerHTML = "";
    DB.products.forEach((p, i) => {
      if (term && !String(p.name || "").toLowerCase().includes(term)) return;
      const b = document.createElement("button");
      b.className = "adm-item" + (i === cur ? " is-active" : "");
      b.type = "button";
      const img = (p.images && p.images[0]) || "";
      b.innerHTML = `
        ${img ? `<img src="/${img}" alt="">` : `<span style="width:42px;height:42px;border-radius:8px;background:#f1f2f6;display:block"></span>`}
        <div style="min-width:0">
          <b>${escapeHtml(p.name || "(chưa có tên)")}</b>
          <span>${money(p.price)}</span>
          ${p.active === false ? '<span class="off"> · Đang ẩn</span>' : ""}
        </div>`;
      b.onclick = () => select(i);
      box.appendChild(b);
    });
    if (!box.children.length) {
      box.innerHTML = '<p class="adm-muted" style="padding:10px 6px">Không có sản phẩm nào.</p>';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* ---------- select product ---------- */
  function select(i) {
    cur = i;
    const p = DB.products[i];
    if (!p) { $("#emptyState").hidden = false; $("#editorBody").hidden = true; return; }
    $("#emptyState").hidden = true;
    $("#editorBody").hidden = false;

    $("#edTitle").textContent = p.name || "Sản phẩm";
    $("#edSlug").textContent = "Link: /p/" + (p.slug || "") + ".html · Mã 1688: " + (p.offerId || "—");
    $("#edActive").checked = p.active !== false;
    $("#edName").value = p.name || "";
    $("#edSubtitle").value = p.subtitle || "";
    $("#edPrice").value = p.price || "";
    $("#edOldPrice").value = p.oldPrice || "";
    $("#edSold").value = p.sold || "";
    $("#edBadge").value = p.badge || "";
    $("#edOfferId").value = p.offerId || "";
    $("#edDesc").innerHTML = p.description || "";
    $("#previewLink").href = "/p/" + (p.slug || "") + ".html";

    renderImages();
    renderVideo();
    renderVariants();
    renderSpecs();
    renderList();
    markDirty(false);
  }

  /* ---------- video ---------- */
  function renderVideo() {
    const p = DB.products[cur];
    const box = $("#videoBox");
    const nameEl = $("#videoName");
    if (!box) return;
    if (p && p.video) {
      box.innerHTML = `
        <video src="/${p.video}" poster="${p.videoPoster ? "/" + p.videoPoster : ""}" preload="metadata" muted playsinline controls></video>
        <span class="adm-muted sm">${p.video}</span>`;
      if (nameEl) nameEl.textContent = "";
    } else {
      box.innerHTML = '<p class="adm-muted" style="margin:0">Chưa có video. Khách vẫn xem được ảnh bình thường.</p>';
      if (nameEl) nameEl.textContent = "";
    }
  }

  async function uploadVideo(file) {
    const p = DB.products[cur];
    if (!p || !file) return;
    if (file.size > 40 * 1024 * 1024) { toast("Video tối đa 40MB", true); return; }
    const prog = $("#videoProgress");
    prog.hidden = false;
    prog.textContent = "Đang xử lý video (có thể mất 10–60 giây)…";
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
    try {
      const r = await fetch(`/api/upload-video?slug=${encodeURIComponent(p.slug)}&ext=${ext}`, { method: "POST", body: file });
      const j = await r.json();
      if (j.ok) {
        p.video = j.path;
        p.videoPoster = j.poster || "";
        renderVideo(); markDirty();
        toast("Đã tải video. Bấm Lưu để cập nhật web.");
      } else {
        toast(j.error || "Tải video lỗi", true);
      }
    } catch (e) { toast("Tải video lỗi: " + e.message, true); }
    prog.hidden = true;
    prog.textContent = "";
  }

  /* ---------- images ---------- */
  let dragIdx = -1;
  function renderImages() {
    const p = DB.products[cur];
    const grid = $("#imageGrid");
    grid.innerHTML = "";
    const imgs = p.images || [];
    const cnt = $("#imgCount");
    if (cnt) cnt.textContent = imgs.length;
    imgs.forEach((src, idx) => {
      const d = document.createElement("div");
      d.className = "adm-img" + (idx === 0 ? " is-main" : "");
      d.draggable = true;
      d.dataset.idx = idx;
      d.innerHTML = `
        <img src="/${src}" alt="" draggable="false">
        ${idx === 0 ? '<span class="tag">Ảnh chính</span>' : ""}
        <div class="ops">
          <button type="button" data-act="left" title="Sang trái">←</button>
          <button type="button" data-act="main" title="Đặt làm ảnh chính">★</button>
          <button type="button" data-act="right" title="Sang phải">→</button>
          <button type="button" class="del" data-act="del" title="Xoá">✕</button>
        </div>`;
      d.querySelectorAll("button").forEach((b) => {
        b.onclick = (e) => { e.stopPropagation(); imageAction(b.dataset.act, idx); };
      });
      d.addEventListener("dragstart", (e) => {
        dragIdx = idx;
        d.classList.add("is-dragging");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); } catch (err) {}
      });
      d.addEventListener("dragend", () => { dragIdx = -1; d.classList.remove("is-dragging"); });
      d.addEventListener("dragover", (e) => { e.preventDefault(); d.classList.add("is-over"); });
      d.addEventListener("dragleave", () => d.classList.remove("is-over"));
      d.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        d.classList.remove("is-over");
        const from = dragIdx >= 0 ? dragIdx : Number(e.dataTransfer.getData("text/plain"));
        if (Number.isInteger(from) && from >= 0 && from !== idx) {
          const arr = p.images;
          const [m] = arr.splice(from, 1);
          arr.splice(idx, 0, m);
          renderImages(); renderList(); markDirty();
        }
      });
      grid.appendChild(d);
    });
  }

  async function imageAction(act, idx) {
    const p = DB.products[cur];
    const imgs = p.images;
    if (act === "del") {
      const [removed] = imgs.splice(idx, 1);
      renderImages(); markDirty();
      if (removed && removed.startsWith("assets/img/")) {
        fetch("/api/delete-image", { method: "POST", body: JSON.stringify({ path: removed }) }).catch(() => {});
      }
    } else if (act === "left" && idx > 0) {
      [imgs[idx - 1], imgs[idx]] = [imgs[idx], imgs[idx - 1]];
      renderImages(); markDirty();
    } else if (act === "right" && idx < imgs.length - 1) {
      [imgs[idx + 1], imgs[idx]] = [imgs[idx], imgs[idx + 1]];
      renderImages(); markDirty();
    } else if (act === "main" && idx > 0) {
      const [m] = imgs.splice(idx, 1);
      imgs.unshift(m);
      renderImages(); markDirty();
    }
    renderList();
  }

  async function uploadFiles(files) {
    const p = DB.products[cur];
    if (!p) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const prog = $("#uploadProgress");
    prog.hidden = false;
    for (let i = 0; i < list.length; i++) {
      prog.textContent = `Đang tải ảnh ${i + 1}/${list.length}…`;
      const f = list[i];
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      try {
        const r = await fetch(`/api/upload?slug=${encodeURIComponent(p.slug)}&ext=${ext}`, { method: "POST", body: f });
        const j = await r.json();
        if (j.ok) {
          if (!Array.isArray(p.images)) p.images = [];
          p.images.push(j.path);
          renderImages(); markDirty(); renderList();
        } else {
          toast(j.error || "Tải ảnh lỗi", true);
        }
      } catch (e) { toast("Tải ảnh lỗi: " + e.message, true); }
    }
    prog.hidden = true;
    prog.textContent = "";
  }

  /* ---------- variants ---------- */
  function normOpt(o, fallback) {
    if (typeof o === "string") o = { value: o };
    o = o || {};
    return {
      value: String(o.value || o.name || o.label || "").trim(),
      price: (o.price != null && o.price !== "") ? Number(o.price) : (fallback || 0),
      count: (o.count != null && o.count !== "") ? Number(o.count) : 1
    };
  }
  function renderVariants() {
    const p = DB.products[cur];
    const box = $("#variantList");
    box.innerHTML = "";
    (p.variants || []).forEach((g, idx) => {
      const group = document.createElement("div");
      group.className = "adm-var-group";
      const head = document.createElement("div");
      head.className = "adm-var-head";
      const nameI = document.createElement("input");
      nameI.type = "text";
      nameI.value = g.name || "";
      nameI.placeholder = "Tên nhóm (VD: Phân loại)";
      const delG = document.createElement("button");
      delG.className = "adm-x";
      delG.type = "button";
      delG.title = "Xoá nhóm";
      delG.textContent = "✕";
      delG.onclick = () => { p.variants.splice(idx, 1); renderVariants(); markDirty(); };
      head.appendChild(nameI);
      head.appendChild(delG);
      group.appendChild(head);
      nameI.oninput = () => { g.name = nameI.value; markDirty(); };

      const optsBox = document.createElement("div");
      optsBox.className = "adm-var-opts";
      const opts = (g.options || []).map((o) => normOpt(o, p.price));
      g.options = opts;
      opts.forEach((o, oi) => {
        const orow = document.createElement("div");
        orow.className = "adm-var-opt";
        const vI = document.createElement("input");
        vI.type = "text"; vI.value = o.value; vI.placeholder = "Tên biến thể (VD: Combo 10 cái)";
        const pI = document.createElement("input");
        pI.type = "number"; pI.value = o.price; pI.placeholder = "Giá (đ)";
        const cI = document.createElement("input");
        cI.type = "number"; cI.value = o.count; cI.placeholder = "Số cái/gói";
        const delO = document.createElement("button");
        delO.className = "adm-x"; delO.type = "button"; delO.title = "Xoá";
        delO.textContent = "✕";
        delO.onclick = () => { g.options.splice(oi, 1); renderVariants(); markDirty(); };
        vI.oninput = () => { o.value = vI.value; g.options[oi] = normOpt({ value: vI.value, price: pI.value, count: cI.value }, p.price); markDirty(); };
        pI.oninput = () => { o.price = Number(pI.value) || 0; g.options[oi].price = o.price; markDirty(); };
        cI.oninput = () => { o.count = Number(cI.value) || 1; g.options[oi].count = o.count; markDirty(); };
        orow.appendChild(vI); orow.appendChild(pI); orow.appendChild(cI); orow.appendChild(delO);
        optsBox.appendChild(orow);
      });
      const addOpt = document.createElement("button");
      addOpt.className = "adm-btn ghost sm";
      addOpt.type = "button";
      addOpt.textContent = "+ Thêm biến thể";
      addOpt.onclick = () => {
        g.options.push(normOpt({ value: "Mặc định", price: p.price, count: 1 }, p.price));
        renderVariants(); markDirty();
      };
      optsBox.appendChild(addOpt);
      group.appendChild(optsBox);
      box.appendChild(group);
    });
  }

  /* ---------- specs ---------- */
  function renderSpecs() {
    const p = DB.products[cur];
    const box = $("#specList");
    box.innerHTML = "";
    (p.specs || []).forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "adm-spec";
      row.innerHTML = `
        <input type="text" value="${escapeHtml(s.k || "")}" placeholder="Tên thông số (VD: Chất liệu)">
        <input type="text" value="${escapeHtml(s.v || "")}" placeholder="Giá trị (VD: Inox 304)">
        <button class="adm-x" type="button" title="Xoá">✕</button>`;
      const [kI, vI] = row.querySelectorAll("input");
      kI.oninput = () => { s.k = kI.value; markDirty(); };
      vI.oninput = () => { s.v = vI.value; markDirty(); };
      row.querySelector("button").onclick = () => { p.specs.splice(idx, 1); renderSpecs(); markDirty(); };
      box.appendChild(row);
    });
  }

  /* ---------- brand ---------- */
  const BRAND_MAP = {
    bName: "name", bTagline: "tagline", bPhone: "phone", bPhoneDisplay: "phoneDisplay",
    bZalo: "zalo", bMessenger: "messenger", bEmail: "email", bAddress: "address",
    bSheet: "sheetEndpoint", bPixel: "fbPixel"
  };
  function fillBrand() {
    Object.entries(BRAND_MAP).forEach(([id, key]) => {
      const el = $("#" + id);
      if (el) el.value = DB.brand[key] || "";
    });
  }

  /* ---------- save ---------- */
  let saving = false;
  async function save() {
    if (saving) return;
    saving = true;
    $$("#saveBtn, #saveBtn2, #saveBtn3").forEach((b) => { b.disabled = true; });
    try {
      const r = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: DB.brand, products: DB.products })
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Lỗi lưu");
      markDirty(false);
      $("#saveState").textContent = "Đã lưu · " + new Date().toLocaleTimeString("vi-VN");
      toast("✓ Đã lưu và cập nhật web");
      renderList();
    } catch (e) {
      toast("Lỗi: " + e.message, true);
    } finally {
      saving = false;
      $$("#saveBtn, #saveBtn2, #saveBtn3").forEach((b) => { b.disabled = false; });
    }
  }

  /* ---------- events ---------- */
  function bind() {
    // tabs
    $$(".adm-tab").forEach((t) => {
      t.onclick = () => {
        $$(".adm-tab").forEach((x) => x.classList.remove("is-active"));
        t.classList.add("is-active");
        $("#tab-products").hidden = t.dataset.tab !== "products";
        $("#tab-settings").hidden = t.dataset.tab !== "settings";
      };
    });

    // basic fields
    const map = {
      edName: (p, v) => { p.name = v; $("#edTitle").textContent = v || "Sản phẩm"; renderList(); },
      edSubtitle: (p, v) => { p.subtitle = v; },
      edPrice: (p, v) => { p.price = Number(v) || 0; renderList(); },
      edOldPrice: (p, v) => { p.oldPrice = Number(v) || 0; },
      edSold: (p, v) => { p.sold = Number(v) || 0; },
      edBadge: (p, v) => { p.badge = v; },
      edOfferId: (p, v) => { p.offerId = v; }
    };
    Object.entries(map).forEach(([id, fn]) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", () => {
        const p = DB.products[cur];
        if (!p) return;
        fn(p, el.value);
        markDirty();
      });
    });

    $("#edActive").addEventListener("change", (e) => {
      const p = DB.products[cur];
      if (!p) return;
      p.active = e.target.checked;
      renderList();
      markDirty();
    });

    // description
    $("#edDesc").addEventListener("input", () => {
      const p = DB.products[cur];
      if (p) { p.description = $("#edDesc").innerHTML; markDirty(); }
    });
    $("#edDesc").addEventListener("paste", async (e) => {
      const items = Array.from(e.clipboardData?.items || []);
      const fileItem = items.find((i) => i.type.startsWith("image/"));
      if (fileItem) {
        e.preventDefault();
        const file = fileItem.getAsFile();
        const p = DB.products[cur];
        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const r = await fetch(`/api/upload?slug=${encodeURIComponent(p.slug)}&ext=${ext}`, { method: "POST", body: file });
        const j = await r.json();
        if (j.ok) document.execCommand("insertHTML", false, `<img src="/${j.path}" alt="">`);
      }
    });

    $$(".adm-toolbar button").forEach((b) => {
      b.onmousedown = (e) => e.preventDefault();
      b.onclick = () => {
        const cmd = b.dataset.cmd;
        document.execCommand(cmd, false, b.dataset.val || null);
        $("#edDesc").dispatchEvent(new Event("input"));
      };
    });

    // images
    $("#pickBtn").onclick = () => $("#fileInput").click();
    $("#fileInput").onchange = (e) => { uploadFiles(e.target.files); e.target.value = ""; };
    const drop = $("#dropZone");
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault(); drop.classList.add("is-over");
    }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => {
      e.preventDefault(); drop.classList.remove("is-over");
    }));
    drop.addEventListener("drop", (e) => {
      if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
    });
    document.addEventListener("paste", (e) => {
      if (e.target.closest("#edDesc")) return;
      const f = Array.from(e.clipboardData?.files || []);
      if (f.length) uploadFiles(f);
    });

    // video
    const vPick = $("#videoPick");
    const vInput = $("#videoInput");
    if (vPick && vInput) {
      vPick.onclick = () => vInput.click();
      vInput.onchange = (e) => { const f = e.target.files[0]; uploadVideo(f); e.target.value = ""; };
    }
    const vDel = $("#videoDel");
    if (vDel) vDel.onclick = async () => {
      const p = DB.products[cur];
      if (!p || !p.video) return;
      if (!confirm("Xoá video của sản phẩm này?")) return;
      const old = p.video, oldPoster = p.videoPoster;
      p.video = "";
      p.videoPoster = "";
      renderVideo(); markDirty();
      for (const f of [old, oldPoster]) {
        if (!f) continue;
        try { await fetch("/api/delete-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: f }) }); } catch (err) {}
      }
      toast("Đã xoá video. Bấm Lưu để cập nhật web.");
    };

    // add / reorder
    $("#addVariant").onclick = () => {
      const p = DB.products[cur];
      p.variants = p.variants || [];
      p.variants.push({ name: "Phân loại", options: [{ value: "Mặc định", price: p.price || 0, count: 1 }] });
      renderVariants(); markDirty();
    };
    $("#addSpec").onclick = () => {
      const p = DB.products[cur];
      p.specs = p.specs || [];
      p.specs.push({ k: "", v: "" });
      renderSpecs(); markDirty();
    };
    $("#moveUp").onclick = () => {
      if (cur <= 0) return;
      [DB.products[cur - 1], DB.products[cur]] = [DB.products[cur], DB.products[cur - 1]];
      select(cur - 1); markDirty();
    };
    $("#moveDown").onclick = () => {
      if (cur >= DB.products.length - 1) return;
      [DB.products[cur + 1], DB.products[cur]] = [DB.products[cur], DB.products[cur + 1]];
      select(cur + 1); markDirty();
    };

    $("#searchBox").addEventListener("input", renderList);

    $("#dupBtn").onclick = () => {
      const src = DB.products[cur];
      if (!src) return;
      const copy = JSON.parse(JSON.stringify(src));
      copy.slug = (src.slug || "sp") + "-" + Math.random().toString(36).slice(2, 6);
      copy.name = (src.name || "Sản phẩm") + " (bản sao)";
      DB.products.splice(cur + 1, 0, copy);
      renderList();
      select(cur + 1);
      markDirty();
      toast("Đã nhân bản — nhớ bấm Lưu");
    };

    $("#delBtn").onclick = () => {
      const p = DB.products[cur];
      if (!p) return;
      if (!confirm('Xoá "' + (p.name || "") + '"? Không hoàn tác được.')) return;
      DB.products.splice(cur, 1);
      cur = Math.max(0, Math.min(cur, DB.products.length - 1));
      markDirty();
      if (DB.products.length) select(cur);
      else { renderList(); $("#editorBody").hidden = true; $("#emptyState").hidden = false; }
    };

    $("#importBtn").onclick = async () => {
      const input = $("#importUrl");
      const msg = $("#importMsg");
      const url = (input.value || "").trim();
      if (!url) { input.focus(); return; }
      msg.textContent = "Đang lấy dữ liệu từ 1688…";
      $("#importBtn").disabled = true;
      try {
        const r = await fetch("/api/import1688", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });
        const j = await r.json();
        if (!j.ok) { msg.textContent = j.error || "Không lấy được."; return; }
        DB.products.unshift(j.product);
        renderList();
        select(0);
        markDirty();
        msg.textContent = `Đã lấy ${j.images} ảnh · giá gốc ${j.cny || "?"} tệ → nhớ sửa giá & bấm Lưu`;
        input.value = "";
      } catch (e) {
        msg.textContent = "Lỗi: " + e.message;
      } finally {
        $("#importBtn").disabled = false;
      }
    };

    // allow Enter in import box
    $("#importUrl").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); $("#importBtn").click(); }
    });

    $("#addBtn").onclick = () => {
      const slug = "san-pham-" + Math.random().toString(36).slice(2, 7);
      DB.products.push({
        slug,
        name: "Sản phẩm mới",
        subtitle: "",
        price: 0,
        oldPrice: 0,
        sold: 0,
        badge: "",
        active: true,
        images: [`assets/img/${slug}/1.svg`],
        variants: [{ name: "Phân loại", options: [{ value: "Mặc định", price: 0, count: 1 }] }],
        specs: [],
        description: ""
      });
      renderList();
      select(DB.products.length - 1);
      markDirty();
      $("#edName").focus();
      $("#edName").select();
    };

    // brand inputs
    Object.entries(BRAND_MAP).forEach(([id, key]) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("input", () => { DB.brand[key] = el.value; markDirty(); });
    });

    // save buttons
    ["saveBtn", "saveBtn2", "saveBtn3"].forEach((id) => {
      const b = $("#" + id);
      if (b) b.onclick = save;
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    });

    window.addEventListener("beforeunload", (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  bind();
  load().catch((e) => toast("Không tải được dữ liệu: " + e.message, true));
})();
