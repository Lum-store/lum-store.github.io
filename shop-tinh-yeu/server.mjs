import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir, unlink, stat } from "node:fs/promises";
import { join, extname, normalize, relative, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildSite } from "./build.mjs";

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 5173);
const DATA_FILE = join(ROOT, "data/products.json");
const IMG_ROOT = join(ROOT, "assets/img");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const json = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
};

async function readBody(req, limit = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error("File quá lớn (tối đa 25MB)");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function safeSlug(s = "") {
  return String(s).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || "sp";
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);

  try {
    /* ---------- API ---------- */
    if (path === "/api/products" && req.method === "GET") {
      const buf = await readFile(DATA_FILE, "utf8");
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(buf);
      return;
    }

    if (path === "/api/products" && req.method === "POST") {
      const raw = await readBody(req);
      const data = JSON.parse(raw.toString("utf8"));
      if (!data || !Array.isArray(data.products)) return json(res, 400, { ok: false, error: "Dữ liệu không hợp lệ" });
      data.products.forEach((p, i) => {
        p.slug = safeSlug(p.slug || `san-pham-${i + 1}`);
        p.price = Math.max(0, Number(p.price) || 0);
        p.oldPrice = Math.max(0, Number(p.oldPrice) || 0);
        p.sold = Math.max(0, Number(p.sold) || 0);
        p.images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
        p.variants = Array.isArray(p.variants) ? p.variants : [];
        p.specs = Array.isArray(p.specs) ? p.specs : [];
        p.video = String(p.video || "");
        p.videoPoster = String(p.videoPoster || "");
      });
      await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
      const n = buildSite();
      return json(res, 200, { ok: true, products: data.products.length, pages: n });
    }

    if (path === "/api/rebuild" && req.method === "POST") {
      const n = buildSite();
      return json(res, 200, { ok: true, pages: n });
    }

    if (path === "/api/upload" && req.method === "POST") {
      const slug = safeSlug(url.searchParams.get("slug") || "chung");
      let ext = (url.searchParams.get("ext") || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) ext = "jpg";
      const buf = await readBody(req);
      if (!buf.length) return json(res, 400, { ok: false, error: "File rỗng" });
      const dir = join(IMG_ROOT, slug);
      await mkdir(dir, { recursive: true });
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      await writeFile(join(dir, name), buf);
      return json(res, 200, { ok: true, path: `assets/img/${slug}/${name}` });
    }

    if (path === "/api/upload-video" && req.method === "POST") {
      const slug = safeSlug(url.searchParams.get("slug") || "chung");
      let ext = (url.searchParams.get("ext") || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
      const buf = await readBody(req, 45 * 1024 * 1024);
      if (!buf.length) return json(res, 400, { ok: false, error: "File rỗng" });
      if (buf.length > 40 * 1024 * 1024) return json(res, 400, { ok: false, error: "Video tối đa 40MB" });

      const VIDEO_ROOT = join(ROOT, "assets/videos");
      await mkdir(VIDEO_ROOT, { recursive: true });
      const id = `${slug}-${Date.now().toString(36)}`;
      const raw = join(VIDEO_ROOT, `${id}.${ext === "webm" ? "webm" : "mp4"}`);
      await writeFile(raw, buf);

      // Chuẩn hoá: mp4/h264 + tạo ảnh poster
      const mp4 = join(VIDEO_ROOT, `${id}.mp4`);
      const poster = join(VIDEO_ROOT, `${id}.jpg`);
      let ok = ext === "mp4";
      try {
        await execFileAsync("ffmpeg", [
          "-y", "-v", "error", "-i", raw,
          "-vf", "scale='min(1280,iw)':-2",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-profile:v", "baseline", "-level", "3.0", "-bf", "0",
          "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4
        ], { maxBuffer: 1024 * 1024 });
        ok = true;
      } catch (e) {
        // ffmpeg lỗi: nếu file gốc đã là mp4 thì vẫn dùng được
        if (!ok) return json(res, 400, { ok: false, error: "Không xử lý được video. Thử file .mp4 (H.264)." });
      }
      if (ok && mp4 !== raw) { try { await unlink(raw); } catch {} }
      try {
        const st = await stat(mp4);
        if (st.size > 0) {
          await execFileAsync("ffmpeg", ["-y", "-v", "error", "-ss", "0.8", "-i", mp4, "-frames:v", "1", "-q:v", "4", poster], { maxBuffer: 1024 * 1024 });
        }
      } catch {}
      const hasPoster = await stat(poster).then(() => true).catch(() => false);
      return json(res, 200, {
        ok: true,
        path: `assets/videos/${id}.mp4`,
        poster: hasPoster ? `assets/videos/${id}.jpg` : ""
      });
    }

    if (path === "/api/delete-image" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const rel = String(body.path || "");
      const abs = normalize(join(ROOT, rel));
      const relToImg = relative(IMG_ROOT, abs);
      if (!rel || relToImg.startsWith("..") || /^[a-zA-Z]:/.test(relToImg)) {
        return json(res, 400, { ok: false, error: "Đường dẫn không hợp lệ" });
      }
      try { await unlink(abs); } catch {}
      return json(res, 200, { ok: true });
    }

    if (path === "/api/delete-video" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const rel = String(body.path || "");
      const abs = normalize(join(ROOT, rel));
      const relToVid = relative(join(ROOT, "assets/videos"), abs);
      if (!rel || relToVid.startsWith("..") || /^[a-zA-Z]:/.test(relToVid)) {
        return json(res, 400, { ok: false, error: "Đường dẫn không hợp lệ" });
      }
      try { await unlink(abs); } catch {}
      return json(res, 200, { ok: true });
    }

    if (path === "/api/import1688" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const input = String(body.url || "").trim();
      if (!input) return json(res, 400, { ok: false, error: "Chưa dán link" });

      // 1) lấy offerId
      let offerId = (input.match(/offer\/(\d{6,})/) || input.match(/offerId=(\d{6,})/) || [])[1];
      if (!offerId && /qr\.1688\.com\/s\//.test(input)) {
        try {
          const r = await fetch(input, { headers: { "User-Agent": UA } });
          const t = await r.text();
          offerId = (t.match(/offerId=(\d{6,})/) || [])[1];
        } catch {}
      }
      if (!offerId) return json(res, 400, { ok: false, error: "Link không đúng. Cần link dạng detail.1688.com/offer/123456.html" });

      // 2) tải trang
      let html = "";
      try {
        const r = await fetch(`https://detail.1688.com/offer/${offerId}.html`, {
          headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Referer: "https://www.1688.com/" }
        });
        html = await r.text();
      } catch (e) {
        return json(res, 502, { ok: false, error: "Không tải được trang 1688" });
      }
      if (/punish|Captcha Interception|x5secdata|x5step/i.test(html.slice(0, 4000)) || html.length < 5000) {
        return json(res, 403, { ok: false, error: "1688 đang chặn (captcha). Mở link trong tab đã đăng nhập rồi kéo thanh trượt, hoặc nhờ AI lấy giúp." });
      }

      // 3) bóc dữ liệu
      const pick = (re) => { const m = html.match(re); return m ? m[1] : ""; };
      const decode = (s) => String(s || "").replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, "/").replace(/&amp;/g, "&").trim();

      let name = decode(pick(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) || pick(/<title>([^<]+)<\/title>/i));
      name = name.replace(/[-_|].*?(1688|阿里巴巴).*$/i, "").replace(/\s+/g, " ").trim();

      const imgSet = new Set();
      const og = pick(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
      if (og) imgSet.add(decode(og));
      const imgRe = /"(?:fullPathOriginal|originalImageURI|imageUrl|imgUrl)"\s*:\s*"(https?:\\?\/\\?\/[^"]+?\.(?:jpg|jpeg|png|webp))"/gi;
      let m;
      while ((m = imgRe.exec(html)) && imgSet.size < 20) imgSet.add(decode(m[1]));
      const lazyRe = /data-lazyload-src="([^"]+\.(?:jpg|jpeg|png|webp))"/gi;
      while ((m = lazyRe.exec(html)) && imgSet.size < 20) imgSet.add(decode(m[1]));

      const cnyRaw = pick(/"price"\s*:\s*"?([0-9.]+)"?/i) || pick(/"currentPrice"\s*:\s*"?([0-9.]+)"?/i);
      const cny = parseFloat(cnyRaw) || 0;
      const price = cny ? Math.max(1000, Math.round((cny * 3700) / 1000) * 1000) : 0;

      const slug = `sp-${offerId}`;
      const images = [];
      let n = 0;
      for (const u of imgSet) {
        if (n >= 12) break;
        n++;
        try {
          const ir = await fetch(u.startsWith("//") ? "https:" + u : u, { headers: { "User-Agent": UA, Referer: "https://detail.1688.com/" } });
          if (!ir.ok) continue;
          const buf = Buffer.from(await ir.arrayBuffer());
          if (buf.length < 3000) continue;
          const ext = (u.match(/\.(jpg|jpeg|png|webp)/i) || [, "jpg"])[1].toLowerCase().replace("jpeg", "jpg");
          const dir = join(IMG_ROOT, slug);
          await mkdir(dir, { recursive: true });
          const fn = `${n}.${ext}`;
          await writeFile(join(dir, fn), buf);
          images.push(`assets/img/${slug}/${fn}`);
        } catch {}
      }

      if (!images.length) {
        return json(res, 422, { ok: false, error: "Không lấy được ảnh (1688 chặn tải ảnh). Thử lại hoặc thêm ảnh thủ công." });
      }

      const product = {
        slug,
        offerId,
        name: name || `Sản phẩm ${offerId}`,
        subtitle: "",
        price: price || 0,
        oldPrice: 0,
        sold: 0,
        badge: "",
        active: true,
        images,
        variants: [{ name: "Phân loại", options: ["Mặc định"] }],
        specs: [],
        description: `<p><b>${(name || "").replace(/</g, "&lt;")}</b></p><p>Hàng nhập khẩu nguyên seal. Sửa lại mô tả cho phù hợp.</p>`
      };
      return json(res, 200, { ok: true, product, cny, images: images.length });
    }

    /* ---------- static ---------- */
    let p = path;
    if (p === "/") p = "/index.html";
    if (!extname(p) && !p.endsWith("/")) {
      try {
        const candidate = join(ROOT, p + ".html");
        await readFile(candidate);
        p = p + ".html";
      } catch {}
    }
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) return json(res, 403, { ok: false });
    const st = await stat(file);
    if (!st.isFile()) return json(res, 404, { ok: false });

    const type = TYPES[extname(file).toLowerCase()] || "application/octet-stream";
    const headers = { "Content-Type": type, "Cache-Control": "no-cache", "Accept-Ranges": "bytes" };

    // Safari/iOS chỉ phát video khi server trả 206 cho Range request
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (req.method === "HEAD") {
      res.writeHead(200, { ...headers, "Content-Length": st.size });
      return res.end();
    }
    if (range) {
      let start = range[1] ? parseInt(range[1], 10) : null;
      let end = range[2] ? parseInt(range[2], 10) : null;
      if (start === null && end !== null) {
        start = Math.max(0, st.size - end);
        end = st.size - 1;
      }
      if (start === null) start = 0;
      if (end === null || end >= st.size) end = st.size - 1;
      if (start > end || start >= st.size) {
        res.writeHead(416, { ...headers, "Content-Range": `bytes */${st.size}` });
        return res.end();
      }
      res.writeHead(206, {
        ...headers,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${st.size}`
      });
      createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...headers, "Content-Length": st.size });
    createReadStream(file).pipe(res);
  } catch (err) {
    if (String(err.message || "").includes("ENOENT")) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<body style="font-family:system-ui;padding:40px"><h1>404</h1><p>Không tìm thấy: ${path}</p><a href="/">Về trang chủ</a> · <a href="/admin.html">Trang quản trị</a></body>`);
      return;
    }
    json(res, 500, { ok: false, error: String(err.message || err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Web:      http://localhost:${PORT}`);
  console.log(`  Quản trị: http://localhost:${PORT}/admin.html\n`);
});
