// Lụm Store — static site builder
// Chạy: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { makeReviews } from "./reviews.mjs";

export function buildSite() {
const ROOT = process.cwd();
// Đổi hash khi app.js/style.css thay đổi → buộc browser tải bản mới, không dính cache cũ
const ASSET_VER = createHash("sha1")
  .update(readFileSync(join(ROOT, "assets/app.js")))
  .update(readFileSync(join(ROOT, "assets/style.css")))
  .digest("hex").slice(0, 8);
const data = JSON.parse(readFileSync(join(ROOT, "data/products.json"), "utf8"));
const B = data.brand;
const FACTORY = data.videos && data.videos.factory;
const PRODUCTS = data.products.filter((p) => p.active !== false);
const RV = new Map(PRODUCTS.map((p) => [p.slug, makeReviews(p)]));

/* ---------- review helpers ---------- */
const initials = (name) =>
  String(name || "KH").trim().split(/\s+/).slice(-2).map((x) => x[0] || "").join("").toUpperCase();
const starStr = (n) => "★★★★★".slice(0, n);
const rvItem = (r, extra = "") => `<div class="rv-item">
        <div class="avatar">${esc(initials(r.name))}</div>
        <div class="rv-body">
          <div class="rv-head"><b>${esc(r.name)}</b>${extra}</div>
          <div class="rv-meta"><span class="rv-stars">${starStr(r.stars)}</span> · ${esc(r.date)}${r.place ? ` · ${esc(r.place)}` : ""}</div>
          <p>${esc(r.text)}</p>
        </div>
      </div>`;

/* ---------- helpers ---------- */
const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const money = (n) => Number(n || 0).toLocaleString("vi-VN") + "đ";
const pct = (p) => Math.max(0, Math.round((1 - p.price / (p.oldPrice || p.price)) * 100));
const slugify = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function write(rel, content) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, "utf8");
}

/* ---------- placeholder images ---------- */
function ensurePlaceholder(p) {
  if (!Array.isArray(p.images) || !p.images.length) p.images = [`assets/img/${p.slug}/1.svg`];
  const dir = join(ROOT, "assets/img", p.slug);
  mkdirSync(dir, { recursive: true });
  p.images.forEach((rel, i) => {
    const abs = join(ROOT, rel);
    if (existsSync(abs)) return;
    mkdirSync(dirname(abs), { recursive: true });
    const label = esc(p.name).slice(0, 40);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1ea"/><stop offset="1" stop-color="#ffe0d1"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#g)"/>
<circle cx="400" cy="330" r="120" fill="#ffd9c7"/>
<text x="400" y="520" font-family="Segoe UI, sans-serif" font-size="34" font-weight="700" fill="#c4451c" text-anchor="middle">${label}</text>
<text x="400" y="570" font-family="Segoe UI, sans-serif" font-size="22" fill="#e08a68" text-anchor="middle">Ảnh ${i + 1} · thay bằng ảnh thật</text>
</svg>`;
    writeFileSync(abs, svg, "utf8");
  });
}
PRODUCTS.forEach(ensurePlaceholder);

/* ---------- shared partials ---------- */
function head({ title, desc, image, base, extra = "" }) {
  return `<!doctype html>
<html lang="vi" data-base="${base}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#ff4d1c">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(B.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
<meta name="format-detection" content="telephone=no">
<meta name="x-build" content="${ASSET_VER}">
<meta http-equiv="Cache-Control" content="no-store">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${base}/assets/style.css?v=${ASSET_VER}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="26" fill="#ff4d1c"/><text x="50" y="70" font-size="58" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">L</text></svg>'
  )}">
<script>
window.LUM_CONFIG = ${JSON.stringify({ brand: B.name, phone: B.phone, sheetEndpoint: B.sheetEndpoint || "", shop: B.shop || "" })};
${B.fbPixel ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(B.fbPixel)}');fbq('track','PageView');` : ""}
</script>
${extra}
</head>`;
}

function header(base) {
  return `<div class="topbar">Freeship toàn quốc đơn từ <b>299K</b> · Kiểm hàng trước khi thanh toán · Đổi trả 7 ngày</div>
<header class="header">
  <div class="container header-in">
    <a class="logo" href="${base}/index.html">
      <span class="logo-mark">L</span>
      <span>${esc(B.name)}<small>${esc(B.tagline)}</small></span>
    </a>
    <nav class="header-nav">
      <a href="${base}/index.html">Trang chủ</a>
      <a href="${base}/index.html#san-pham">Sản phẩm</a>
      <a href="${base}/chinh-sach.html">Chính sách</a>
      <a href="${base}/index.html#faq">Hỏi đáp</a>
    </nav>
    <div class="header-actions">
      <a class="call-btn" href="tel:${B.phone}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>
        ${esc(B.phoneDisplay)}
      </a>
    </div>
  </div>
</header>`;
}

function footer(base) {
  return `<footer class="footer">
  <div class="container footer-grid">
    <div>
      <div class="logo" style="margin-bottom:10px">
        <span class="logo-mark">L</span>
        <span>${esc(B.name)}<small>${esc(B.tagline)}</small></span>
      </div>
      <p>Chuyên hàng tiêu dùng chọn lọc, giá tận gốc. Giao toàn quốc, thanh toán khi nhận hàng.</p>
      <p>Hotline / Zalo: <a href="tel:${B.phone}"><b style="color:#fff">${esc(B.phoneDisplay)}</b></a></p>
      <p>${esc(B.address)}</p>
    </div>
    <div>
      <h4>Chính sách</h4>
      <div class="footer-links">
        <a href="${base}/chinh-sach.html#doi-tra">Đổi trả 7 ngày</a>
        <a href="${base}/chinh-sach.html#van-chuyen">Vận chuyển</a>
        <a href="${base}/chinh-sach.html#bao-mat">Bảo mật thông tin</a>
        <a href="${base}/chinh-sach.html#thanh-toan">Thanh toán</a>
      </div>
    </div>
    <div>
      <h4>Liên hệ</h4>
      <div class="footer-links">
        <a href="${B.zalo}" target="_blank" rel="noopener">Zalo: ${esc(B.phoneDisplay)}</a>
        <a href="${B.messenger}" target="_blank" rel="noopener">Messenger</a>
        <a href="mailto:${B.email}">${esc(B.email)}</a>
      </div>
      <p style="margin-top:10px">Thời gian hỗ trợ: 8:00 – 21:00 hằng ngày</p>
    </div>
  </div>
  <div class="container footer-bottom">
    © ${new Date().getFullYear()} ${esc(B.name)}. Giá đã bao gồm VAT. Hình ảnh mang tính minh hoạ.
  </div>
</footer>`;
}

const stars = (n = 5) => "★★★★★".slice(0, n);

/* 63 tỉnh / thành phố (địa chỉ 3 cấp cũ: xã – huyện – tỉnh) */
const PROVINCES = JSON.parse(readFileSync(join(ROOT, "data/provinces.json"), "utf8"));

/* ---------- home ---------- */
function card(p) {
  const img = p.images[0];
  return `<a class="card" href="p/${p.slug}.html">
    <div class="card-media">
      <img src="${img}" alt="${esc(p.name)}" loading="lazy" width="400" height="400">
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : pct(p) > 0 ? `<span class="badge">-${pct(p)}%</span>` : ""}
    </div>
    <div class="card-body">
      <h3 class="card-title">${esc(p.name)}</h3>
      <div class="card-price">
        <span class="price">${money(p.price)}</span>
        ${p.oldPrice > p.price ? `<span class="price-old">${money(p.oldPrice)}</span>` : ""}
      </div>
      <div class="card-meta">
        <span>${stars(5)}</span><span class="dot"></span><span>Đã bán ${Number(p.sold || 0).toLocaleString("vi-VN")}</span>
      </div>
      <span class="card-cta">Xem &amp; đặt hàng</span>
    </div>
  </a>`;
}

function homePage() {
  const base = ".";
  const list = PRODUCTS.map(card).join("\n");
  const homeRv = PRODUCTS.slice(0, 3).map((p) => {
    const r = (RV.get(p.slug).reviews.find((x) => x.stars === 5)) || RV.get(p.slug).reviews[0];
    return `<div class="review">
        <div class="review-top"><div class="avatar">${esc(initials(r.name))}</div><div><b>${esc(r.name)}</b><div class="stars">${starStr(r.stars)}</div></div></div>
        <p>“${esc(r.text)}”</p>
        <div class="review-sp"><a href="p/${p.slug}.html">${esc(p.name)}</a> · ${esc(r.date)}</div>
      </div>`;
  }).join("\n      ");
  return `${head({
    title: `${B.name} – ${B.tagline}`,
    desc: B.desc || "Sản phẩm chọn lọc giá tận gốc. Giao toàn quốc, kiểm hàng trước khi thanh toán, đổi trả 7 ngày.",
    image: PRODUCTS[0] ? PRODUCTS[0].images[0] : "",
    base
  })}
<body data-product-id="home">
${header(base)}
<section class="hero">
  <div class="container hero-in">
    <span class="eyebrow">${esc(B.heroEyebrow || "🔥 Mới về mỗi tuần")}</span>
    <h1>${B.heroTitle || "Sản phẩm chất lượng,<br><em>giá tận gốc</em>"}</h1>
    <p>${esc(B.heroDesc || "Tuyển chọn những sản phẩm đang được săn nhiều nhất. Giá đã gồm ship, được kiểm hàng trước khi trả tiền.")}</p>
    <div class="hero-cta">
      <a class="btn btn-primary" href="#san-pham">${esc(B.heroCta || "Xem sản phẩm ↓")}</a>
      <a class="btn btn-ghost" href="tel:${B.phone}">Gọi tư vấn</a>
    </div>
    <div class="hero-trust">
      <span class="chip"><i>✓</i> Thanh toán khi nhận hàng</span>
      <span class="chip"><i>✓</i> Đổi trả trong 7 ngày</span>
      <span class="chip"><i>✓</i> Giao 2–4 ngày</span>
      <span class="chip"><i>✓</i> Hotline 8h–21h</span>
    </div>
  </div>
</section>

<section class="section" id="san-pham">
  <div class="container">
    <div class="section-head">
      <div>
        <h2>${esc(B.sectionTitle || "Sản phẩm đang bán")}</h2>
        <p>${esc(B.sectionDesc || "Bấm vào sản phẩm để xem chi tiết và đặt hàng")}</p>
      </div>
    </div>
    <div class="grid">
${list}
    </div>
  </div>
</section>

<section class="section benefits">
  <div class="container">
    <div class="section-head"><div><h2>Mua ở ${esc(B.name)} có gì khác?</h2></div></div>
    <div class="benefit-grid">
      <div class="benefit"><div class="benefit-ico">🚚</div><div><b>Ship toàn quốc</b><span>Nội thành 1–2 ngày, tỉnh 2–4 ngày</span></div></div>
      <div class="benefit"><div class="benefit-ico">💵</div><div><b>COD 100%</b><span>Nhận hàng, kiểm tra rồi mới trả tiền</span></div></div>
      <div class="benefit"><div class="benefit-ico">🔄</div><div><b>Đổi trả 7 ngày</b><span>Lỗi do shop, đổi mới miễn phí</span></div></div>
      <div class="benefit"><div class="benefit-ico">☎️</div><div><b>Hỗ trợ thật</b><span>Gọi/Zalo ${esc(B.phoneDisplay)} là có người nghe</span></div></div>
    </div>
  </div>
</section>

<section class="section${FACTORY ? "" : " hidden"}" id="xuong-may"${FACTORY ? "" : " hidden"}>
  <div class="container">
    <div class="section-head"><div><h2>Xưởng may thật, quay tại xưởng</h2><p>Hàng làm tại xưởng, không qua trung gian — nên giá mới rẻ được như vậy</p></div><a href="#san-pham">Xem sản phẩm</a></div>
    ${FACTORY ? `<div class="factory-video" id="factoryVideoWrap">
      <video id="factoryVideo" poster="${base}/${FACTORY.poster}" data-src="${base}/${FACTORY.src}" preload="none" playsinline webkit-playsinline x5-playsinline="true" x5-video-player-type="h5" muted></video>
      <button class="video-cover" id="factoryPlay" type="button" aria-label="Xem video xưởng may">
        <span class="video-cover-ico">▶</span>
        <span class="video-cover-tx">Xem video xưởng may</span>
        <span class="video-cover-sub">Video 24 giây · quay tại xưởng</span>
      </button>
    </div>` : ""}
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head"><div><h2>Khách đã mua nói gì</h2><p>Đánh giá từ khách đã nhận hàng</p></div><a href="#san-pham">Xem sản phẩm</a></div>
    <div class="review-grid">
      ${homeRv}
    </div>
  </div>
</section>

<section class="section" id="faq">
  <div class="container">
    <div class="section-head"><div><h2>Câu hỏi thường gặp</h2></div></div>
    <div class="faq">
      <details open><summary>Tôi có được kiểm hàng trước khi thanh toán không?</summary><p>Có. Bạn được mở kiểm tra sản phẩm cùng nhân viên giao hàng trước khi trả tiền.</p></details>
      <details><summary>Bao lâu thì nhận được hàng?</summary><p>Nội thành Hà Nội/TP.HCM: 1–2 ngày. Các tỉnh khác: 2–4 ngày làm việc.</p></details>
      <details><summary>Phí ship bao nhiêu?</summary><p>Miễn phí ship cho đơn từ 299.000đ. Đơn nhỏ hơn phí ship 25.000đ toàn quốc.</p></details>
      <details><summary>Hàng lỗi thì sao?</summary><p>Bạn chụp ảnh gửi Zalo ${esc(B.phoneDisplay)} trong 7 ngày, shop đổi mới hoặc hoàn tiền.</p></details>
      <details><summary>Đặt hàng bằng cách nào?</summary><p>Chọn sản phẩm → điền tên, số điện thoại, địa chỉ → bấm “Đặt hàng”. Shop gọi xác nhận trong 15 phút.</p></details>
    </div>
  </div>
</section>
${footer(base)}
<script src="${base}/assets/app.js?v=${ASSET_VER}"></script>
</body>
</html>`;
}

/* ---------- product page ---------- */
function productPage(p, index) {
  const base = "..";
  const rv = RV.get(p.slug);
  const rvFirst = 8;
  const hasVideo = !!p.video;
  const vPoster = p.videoPoster || p.images[0];
  const thumbs = (hasVideo ? `
      <button class="thumb thumb-video is-active" data-video="${base}/${p.video}" data-poster="${base}/${vPoster}" aria-label="Video sản phẩm"><img src="${base}/${vPoster}" alt="${esc(p.name)} - video" loading="lazy"><span class="thumb-play">▶</span></button>` : "")
    + p.images.map((src, i) => `
      <button class="thumb${!hasVideo && i === 0 ? " is-active" : ""}" data-idx="${i}" data-src="${base}/${src}" aria-label="Ảnh ${i + 1}"><img src="${base}/${src}" alt="${esc(p.name)} - ảnh ${i + 1}" loading="lazy"></button>`).join("");
  const normOpt = (o) => {
    if (typeof o === "string") o = { value: o };
    const price = (o.price != null && o.price !== "") ? Number(o.price) : p.price;
    const count = (o.count != null && o.count !== "") ? Number(o.count) : 1;
    return { value: String(o.value || o.name || o.label || "").trim(), price, count };
  };
  const normGroups = (p.variants || []).map((g) => ({
    name: g.name || "Phân loại",
    options: (g.options || []).map(normOpt).filter((o) => o.value)
  })).filter((g) => g.options.length);
  const firstPrice = normGroups.length && normGroups[0].options.length ? normGroups[0].options[0].price : p.price;
  const variantHtml = normGroups.map((g) => `
      <div class="opt-group">
        <label class="opt-label">${esc(g.name)}: <span data-selected="${esc(g.name)}">${esc(g.options[0].value)}</span></label>
        <div class="chips" data-group="${esc(g.name)}">
          ${g.options.map((o, i) => `<button type="button" class="opt${i === 0 ? " is-active" : ""}" data-value="${esc(o.value)}" data-price="${o.price}" data-count="${o.count}">${esc(o.value)}${o.price !== p.price ? ` · ${money(o.price)}` : ""}</button>`).join("")}
        </div>
      </div>`).join("");

  const specs = (p.specs || []).length
    ? `<table class="spec-table">${p.specs.map((s) => `<tr><td>${esc(s.k)}</td><td>${esc(s.v)}</td></tr>`).join("")}</table>`
    : "";

  const related = PRODUCTS.filter((x) => x.slug !== p.slug).slice(0, 4).map((x) => `
      <a class="card" href="../${x.slug}/">
        <div class="card-media"><img src="${base}/${x.images[0]}" alt="${esc(x.name)}" loading="lazy"></div>
        <div class="card-body"><h3 class="card-title">${esc(x.name)}</h3>
        <div class="card-price"><span class="price">${money(x.price)}</span></div></div>
      </a>`).join("");

  return `${head({
    title: `${p.name} – ${money(p.price)} | ${B.name}`,
    desc: (p.subtitle || p.name) + " Giao toàn quốc, kiểm hàng trước khi thanh toán, đổi trả 7 ngày.",
    image: p.images[0],
    base
  })}
<body data-product-id="${esc(p.offerId || p.slug)}">
${header(base)}
<div class="container breadcrumb"><a href="${base}/index.html">Trang chủ</a> / <a href="${base}/index.html#san-pham">Sản phẩm</a> / <span>${esc(p.name)}</span></div>

<div class="container pdp">
  <div class="pdp-gallery">
    <div class="gallery-main" id="galleryMain">
      <img id="galleryImg" src="${base}/${p.images[0]}" alt="${esc(p.name)}" width="800" height="800"${hasVideo ? " hidden" : ""}>
      ${hasVideo ? `<video id="galleryVideo" class="gallery-video" src="${base}/${p.video}" poster="${base}/${vPoster}" autoplay muted controls playsinline webkit-playsinline x5-playsinline="true" x5-video-player-type="h5"></video>
      <button class="gallery-play" id="galleryPlay" type="button" aria-label="Xem video sản phẩm" hidden><span class="gallery-play-ico">▶</span><span class="gallery-play-tx">Xem video sản phẩm</span></button>
      <span class="gallery-progress" id="galleryProgress" hidden><i></i></span>` : ""}
      ${p.images.length > 1 ? `<span class="gallery-count" id="galleryCount">${hasVideo ? "Video" : "1/" + p.images.length}</span>` : ""}
    </div>
    <div class="gallery-thumbs">${thumbs}</div>
  </div>

  <div class="pdp-info">
    ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
    <h1>${esc(p.name)}</h1>
    <p class="pdp-sub">${esc(p.subtitle || "")}</p>
    <div class="pdp-rating"><span class="stars">${starStr(Math.round(rv.rating))}</span> <b>${rv.rating.toFixed(1).replace(".", ",")}/5</b> <span>·</span> <a href="#danh-gia">${rv.total.toLocaleString("vi-VN")} lượt đánh giá</a> <span>·</span> <span>${Number(p.sold || 0).toLocaleString("vi-VN")} đã bán</span></div>

    <div class="price-box">
      <div class="row">
        <span class="price">${money(p.price)}</span>
        ${p.oldPrice > p.price ? `<span class="price-old">${money(p.oldPrice)}</span>` : ""}
        ${p.oldPrice > p.price ? `<span class="save">Tiết kiệm ${pct(p)}%</span>` : ""}
      </div>
      <div class="note">Giá đã gồm VAT · Miễn phí ship đơn từ 299K</div>
    </div>

    ${variantHtml}

    <div class="opt-group">
      <label class="opt-label">Số lượng</label>
      <div class="qty">
        <button type="button" data-step="-1" aria-label="Giảm">−</button>
        <input id="qtyInput" type="number" inputmode="numeric" value="1" min="1" max="99" data-unit="${firstPrice}" aria-label="Số lượng">
        <button type="button" data-step="1" aria-label="Tăng">+</button>
      </div>
    </div>

    <div class="pdp-buy">
      <a class="btn btn-primary" href="#orderForm">Đặt hàng ngay</a>
    </div>
    <div class="micro"><span><i>✓</i> Thanh toán khi nhận</span><span><i>✓</i> Đổi trả 7 ngày</span><span><i>✓</i> Giao 2–4 ngày</span></div>

    <div class="order-card" id="orderFormWrap">
      <h3>Đặt hàng nhanh</h3>
      <p class="hint">Điền thông tin, shop gọi xác nhận trong 15 phút.</p>
      <form id="orderForm" data-product="${esc(p.name)}" novalidate>
        <div class="field">
          <label for="fName">Họ và tên <span>*</span></label>
          <input id="fName" name="name" type="text" placeholder="VD: Nguyễn Thị Lan" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="fPhone">Số điện thoại <span>*</span></label>
          <input id="fPhone" name="phone" type="tel" inputmode="numeric" placeholder="VD: 0982467019" autocomplete="tel" required>
        </div>
        <div class="field">
          <label for="fStreet">Số nhà, tên đường <span>*</span></label>
          <input id="fStreet" name="street" type="text" placeholder="VD: 12 Nguyễn Văn Linh" autocomplete="address-line1" required>
        </div>
        <div class="field">
          <label for="fProvince">Tỉnh / Thành phố <span>*</span></label>
          <select id="fProvince" name="province" autocomplete="address-level1" required>
            <option value="">— Chọn tỉnh / thành phố —</option>
            ${PROVINCES.map((x) => `<option value="${x.code}" data-name="${esc(x.short)}">${esc(x.short)}</option>`).join("")}
          </select>
        </div>
        <div class="field-2">
          <div class="field">
            <label for="fDistrict">Quận / Huyện <span>*</span></label>
            <select id="fDistrict" name="district" autocomplete="address-level2" required disabled>
              <option value="">— Chọn quận / huyện —</option>
            </select>
          </div>
          <div class="field">
            <label for="fWard">Xã / Phường <span>*</span></label>
            <select id="fWard" name="ward" autocomplete="address-line2" required disabled>
              <option value="">— Chọn xã / phường —</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label for="fNote">Ghi chú (không bắt buộc)</label>
          <textarea id="fNote" name="note" placeholder="Màu sắc / size / giờ giao hàng…"></textarea>
        </div>
        <div class="form-total"><span>Tạm tính (COD)</span><b id="formTotal">${money(p.price)}</b></div>
        <button class="btn btn-primary btn-block" type="submit" id="submitBtn">ĐẶT HÀNG – Thanh toán khi nhận</button>
        <p class="form-err" id="formErr"></p>
        <p class="form-note">Bằng việc đặt hàng, bạn đồng ý với chính sách đổi trả &amp; bảo mật của shop.</p>
      </form>
    </div>
  </div>
</div>

<div class="container">
  <div class="panel">
    <h3>Mô tả sản phẩm</h3>
    <div class="prose">${p.description || "<p>Đang cập nhật.</p>"}</div>
    ${specs ? `<h3 style="margin-top:18px">Thông số</h3>${specs}` : ""}
    ${p.images.length > 1 ? `<h3 style="margin-top:22px">Album ảnh (${p.images.length})</h3>
    <div class="album">${p.images.map((src, i) => `<button class="album-item" type="button" data-idx="${i}"><img src="${base}/${src}" alt="${esc(p.name)} ${i + 1}" loading="lazy"></button>`).join("")}</div>` : ""}
  </div>

  <div class="panel" id="danh-gia">
    <h3>Đánh giá từ khách hàng</h3>
    <div class="rv-summary">
      <div class="rv-score">
        <b>${rv.rating.toFixed(1).replace(".", ",")}</b>
        <span class="rv-stars">${starStr(Math.round(rv.rating))}</span>
        <small>${rv.total.toLocaleString("vi-VN")} lượt đánh giá</small>
      </div>
      <div class="rv-bars">
        ${[5, 4, 3, 2, 1].map((s, i) => `<button type="button" class="rv-bar" data-star="${s}" aria-label="Xem đánh giá ${s} sao"><span>${s}★</span><div class="rv-track"><i style="width:${Math.round((rv.dist[i] / rv.total) * 100)}%"></i></div><b>${rv.dist[i].toLocaleString("vi-VN")}</b></button>`).join("")}
      </div>
    </div>

    <div class="rv-list" id="rvList" data-slug="${esc(p.slug)}" data-total="${rv.total}" data-count="${rv.reviews.length}" data-shown="${rvFirst}">
      ${rv.reviews.slice(0, rvFirst).map((r) => rvItem(r)).join("")}
    </div>
    <button type="button" class="rv-more" id="rvMore">Xem thêm đánh giá</button>
    <p class="rv-note" id="rvNote">Đang hiển thị ${rvFirst} bình luận mới nhất · tổng ${rv.total.toLocaleString("vi-VN")} lượt đánh giá</p>
    <p class="rv-reason" id="rvReason" hidden></p>
    <button type="button" class="rv-reset" id="rvReset" hidden>← Xem tất cả đánh giá</button>

    <h3 class="rv-form-title">Viết đánh giá của bạn</h3>
    <form class="rv-form" id="rvForm">
      <div class="rv-form-row">
        <input id="rvName" type="text" placeholder="Tên của bạn" autocomplete="name" required>
        <div class="rv-pick" id="rvPick" role="group" aria-label="Chọn số sao">
          ${[5, 4, 3, 2, 1].map((n) => `<button type="button" class="rv-star is-on" data-star="${n}" aria-label="${n} sao">★</button>`).join("")}
        </div>
      </div>
      <textarea id="rvText" rows="3" placeholder="Chia sẻ cảm nhận về sản phẩm…" required></textarea>
      <button class="btn btn-primary btn-block" type="submit">Gửi đánh giá</button>
    </form>
    <script type="application/json" id="rvData">${JSON.stringify(rv.reviews).replace(/</g, "\\u003c")}</script>
  </div>

  <div class="panel">
    <h3>Chính sách mua hàng</h3>
    <div class="prose">
      <ul>
        <li><b>Thanh toán:</b> COD – nhận hàng, kiểm tra rồi mới trả tiền.</li>
        <li><b>Vận chuyển:</b> 1–2 ngày nội thành, 2–4 ngày các tỉnh. Freeship đơn từ 299K.</li>
        <li><b>Đổi trả:</b> 7 ngày nếu lỗi nhà sản xuất hoặc không đúng mô tả.</li>
        <li><b>Hỗ trợ:</b> Gọi/Zalo <a href="tel:${B.phone}">${esc(B.phoneDisplay)}</a> (8h–21h).</li>
      </ul>
    </div>
  </div>

  <div class="section" style="padding-bottom:0">
    <div class="section-head"><div><h2>Sản phẩm khác</h2></div><a href="${base}#san-pham">Xem tất cả</a></div>
    <div class="grid">${related}</div>
  </div>
</div>

<div class="sticky-buy" id="stickyBuy">
  <div class="sb-price">Tạm tính<b id="sbPrice">${money(p.price)}</b></div>
  <button class="btn btn-primary" id="sbBtn" type="button">Đặt hàng</button>
</div>

<div class="modal" id="successModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
  <div class="modal-card">
    <div class="modal-ico">✓</div>
    <h3 id="modalTitle">Đặt hàng thành công!</h3>
    <p>Cảm ơn bạn. Shop sẽ gọi xác nhận trong <b>15 phút</b>.</p>
    <div class="modal-code" id="modalCode">Mã đơn: —</div>
    <p id="modalTotal"></p>
    <a class="btn btn-primary btn-block" href="tel:${B.phone}">Gọi ${esc(B.phoneDisplay)}</a>
    <button class="btn btn-ghost btn-block" type="button" data-close-modal>Tiếp tục xem</button>
  </div>
</div>

${footer(base)}
<script src="${base}/assets/app.js?v=${ASSET_VER}"></script>
</body>
</html>`;
}

/* ---------- policy page ---------- */
function policyPage() {
  const base = ".";
  return `${head({
    title: `Chính sách mua hàng | ${B.name}`,
    desc: "Chính sách đổi trả, vận chuyển, thanh toán và bảo mật thông tin tại " + B.name,
    base
  })}
<body data-product-id="policy">
${header(base)}
<div class="container" style="padding-top:18px;max-width:820px">
  <h1 style="font-size:26px;letter-spacing:-.03em;margin:8px 0 4px">Chính sách mua hàng</h1>
  <p style="color:#6b7280;font-size:13.5px;margin:0 0 18px">Áp dụng cho mọi đơn hàng tại ${esc(B.name)}</p>

  <div class="panel" id="doi-tra"><h3>1. Đổi trả trong 7 ngày</h3><div class="prose">
    <p>Sản phẩm được đổi mới hoặc hoàn tiền trong 7 ngày kể từ khi nhận hàng nếu: lỗi do nhà sản xuất, giao sai mẫu/size, sản phẩm không đúng mô tả.</p>
    <p>Sản phẩm còn nguyên tem, chưa qua sử dụng. Vui lòng gửi ảnh/video qua Zalo <a href="tel:${B.phone}">${esc(B.phoneDisplay)}</a> để được xử lý nhanh.</p>
  </div></div>

  <div class="panel" id="van-chuyen"><h3>2. Vận chuyển</h3><div class="prose">
    <p>Nội thành Hà Nội &amp; TP.HCM: 1–2 ngày. Các tỉnh khác: 2–4 ngày làm việc.</p>
    <p>Phí ship 25.000đ, miễn phí cho đơn từ 299.000đ. Đơn được kiểm tra trước khi thanh toán.</p>
  </div></div>

  <div class="panel" id="thanh-toan"><h3>3. Thanh toán</h3><div class="prose">
    <p>Hình thức chính: COD – thanh toán tiền mặt cho nhân viên giao hàng sau khi kiểm tra sản phẩm.</p>
    <p>Với đơn giá trị lớn, shop có thể liên hệ để thống nhất chuyển khoản trước.</p>
  </div></div>

  <div class="panel" id="bao-mat"><h3>4. Bảo mật thông tin</h3><div class="prose">
    <p>Thông tin bạn cung cấp (tên, số điện thoại, địa chỉ) chỉ dùng để xử lý và giao đơn hàng, không chia sẻ cho bên thứ ba ngoài đơn vị vận chuyển.</p>
    <p>Bạn có thể yêu cầu xoá dữ liệu bất kỳ lúc nào bằng cách gọi hotline.</p>
  </div></div>

  <p style="font-size:13px;color:#6b7280;margin:18px 0 30px">Cần hỗ trợ? Gọi/Zalo <a href="tel:${B.phone}" style="color:#ff4d1c;font-weight:700">${esc(B.phoneDisplay)}</a> · ${esc(B.email)}</p>
</div>
${footer(base)}
<script src="${base}/assets/app.js?v=${ASSET_VER}"></script>
</body>
</html>`;
}

/* ---------- write ---------- */
write("index.html", homePage());
PRODUCTS.forEach((p, i) => write(`p/${p.slug}.html`, productPage(p, i)));
write("chinh-sach.html", policyPage());

const urls = ["index.html", "chinh-sach.html", ...PRODUCTS.map((p) => `p/${p.slug}.html`)];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`);
write("robots.txt", "User-agent: *\nAllow: /\n");
write(".nojekyll", "");

return PRODUCTS.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const n = buildSite();
  console.log(`✓ Build xong: ${n} trang sản phẩm`);
}
