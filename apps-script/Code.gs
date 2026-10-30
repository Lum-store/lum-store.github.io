/**
 * Lụm Store — nhận đơn từ web, ghi vào Google Sheet
 * Dán toàn bộ file này vào Google Apps Script (script.google.com) của Sheet bạn muốn dùng.
 */

const SHEET_NAME = "DonHang";   // mặc định (web túi xách)

function sheetNameFor_(shop) {
  if (shop === "giac-hoi") return "DonHangGiacHoi";
  return SHEET_NAME;
}

/* Sheet đích. Để trống "" nếu script gắn trực tiếp trong Sheet (container-bound).
 * Nếu tạo script độc lập (script.google.com/home) thì dán ID file Sheet vào đây.
 * Lấy ID từ URL: docs.google.com/spreadsheets/d/<ID>/edit
 */
const SHEET_ID = "1FVgPLv50qB6PDwjQFwLMFQ1urdpDtxceNSyvth_kuio";

function ss_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

/* ================== TELEGRAM ==================
 * Điền 2 dòng dưới để nhận thông báo đơn mới trên điện thoại.
 * Cách lấy: xem file HUONG-DAN-TELEGRAM.md
 */
const TELEGRAM_TOKEN = "8509130330:AAGP0lFk4zeQStCNL-NdZhJZ6Oo74jKyJ9Q";      // bot @hh3dtq_storage_08_bot
const TELEGRAM_CHAT_ID = "5551685072";    // chat riêng của shop (id nhóm thì là số âm -100...)

function tgReady_() {
  return String(TELEGRAM_TOKEN).indexOf(":") > 0 && String(TELEGRAM_CHAT_ID).length > 0;
}

function tgSend_(html) {
  if (!tgReady_()) return { ok: false, reason: "chưa cấu hình token/chat_id" };
  try {
    const res = UrlFetchApp.fetch("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    return { ok: code === 200, status: code, body: res.getContentText().slice(0, 300) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function tgEsc_(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tgMoney_(n) {
  return Number(n || 0).toLocaleString("vi-VN") + "đ";
}

function tgMessage_(b) {
  const phone = String(b.phone || "");
  const title = (b.shop === "giac-hoi") ? "🛍️ ĐƠN GIÁC HƠI" : "🛍️ ĐƠN HÀNG MỚI";
  const lines = [
    title + " · <code>" + tgEsc_(b.orderCode || "") + "</code>",
    "",
    "👤 <b>" + tgEsc_(b.name || "") + "</b>",
    "📞 <a href=\"tel:" + tgEsc_(phone) + "\">" + tgEsc_(phone) + "</a>",
    "📍 " + tgEsc_(b.address || ""),
    "",
    "👜 " + tgEsc_(b.product || ""),
    "🎨 " + tgEsc_(b.variant || "—") + " · SL " + (Number(b.qty) || 1),
    "💰 <b>" + tgMoney_(b.total) + "</b> (thanh toán khi nhận)"
  ];
  const link = String(b.productUrl || b.page || "");
  if (/^https?:\/\//i.test(link)) {
    lines.push("🔗 <a href=\"" + tgEsc_(link) + "\">Mở đúng mẫu túi khách đặt</a>");
  }
  if (b.shipping && Number(b.shipping) > 0) lines.push("🚚 Phí ship: " + tgMoney_(b.shipping));
  if (b.note) lines.push("📝 " + tgEsc_(b.note));
  const src = [];
  if (b.utmSource) src.push(tgEsc_(b.utmSource));
  if (b.utmCampaign) src.push(tgEsc_(b.utmCampaign));
  if (b.fbclid) src.push("fbclid");
  if (src.length) lines.push("📊 Nguồn: " + src.join(" / "));
  return lines.join("\n");
}

/** Chạy hàm này trong editor để thử bot (gửi 1 tin mẫu) */
function testTelegram() {
  getSheet_(""); // tạo sẵn tab DonHang nếu chưa có
  const r = tgSend_("✅ <b>Lụm Store</b> đã kết nối Telegram!\nĐơn mới sẽ bắn về đây.");
  Logger.log(JSON.stringify(r));
  return r;
}

const HEADERS = [
  "Thời gian", "Mã đơn", "Sản phẩm", "Phân loại", "SL", "Đơn giá", "Tổng tiền",
  "Khách hàng", "SĐT", "Địa chỉ", "Ghi chú", "Nguồn (utm_source)", "Chiến dịch", "fbclid", "Trang đặt",
  "Link sản phẩm"
];

function getSheet_(shop) {
  const ss = ss_();
  const name = (shop === "giac-hoi") ? "DonHangGiacHoi" : SHEET_NAME;
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#fff0ea");
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150);
    sh.setColumnWidth(3, 220);
    sh.setColumnWidth(10, 300);
    sh.setColumnWidth(16, 150);
    sh.getRange(2, 5, 998, 3).setNumberFormat("#,##0");   // SL / Đơn giá / Tổng tiền
    sh.getRange(2, 9, 998, 1).setNumberFormat("@");       // SĐT: giữ số 0 đầu
  } else {
    // Bảng đã có sẵn nhưng thiếu cột mới (vd "Link sản phẩm") → bổ sung tiêu đề
    const have = Math.max(sh.getLastColumn(), 1);
    if (have < HEADERS.length) {
      const add = HEADERS.slice(have);
      sh.getRange(1, have + 1, 1, add.length).setValues([add])
        .setFontWeight("bold").setBackground("#fff0ea");
    }
  }
  return sh;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    const sh = getSheet_(body.shop);
    const tz = Session.getScriptTimeZone();
    const now = body.createdAt ? new Date(body.createdAt) : new Date();

    // Chống trùng: web có thể gửi lại đơn đã lưu (queue) → không ghi 2 lần
    const code = String(body.orderCode || "");
    if (code && sh.getLastRow() > 1) {
      const codes = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < codes.length; i++) {
        if (String(codes[i][0]) === code) {
          return ContentService
            .createTextOutput(JSON.stringify({ ok: true, orderCode: code, duplicate: true }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    sh.appendRow([
      Utilities.formatDate(now, tz, "dd/MM/yyyy HH:mm:ss"),
      body.orderCode || "",
      body.product || "",
      body.variant || "",
      Number(body.qty) || 1,
      Number(body.unitPrice) || 0,
      Number(body.total) || 0,
      body.name || "",
      "'" + String(body.phone || ""),   // dấu ' để giữ số 0 đầu
      body.address || "",
      body.note || "",
      body.utmSource || "",
      body.utmCampaign || "",
      body.fbclid || "",
      body.page || "",
      ""
    ]);

    // Trang trí + link sản phẩm: lỗi ở đây không được làm hỏng đơn
    try {
      // Định dạng lại ô cho đúng kiểu (cột có thể bị dính định dạng ngày từ trước)
      const rowIdx = sh.getLastRow();
      sh.getRange(rowIdx, 1).setNumberFormat("dd/MM/yyyy HH:mm:ss");
      sh.getRange(rowIdx, 5, 1, 3).setNumberFormat("#,##0");
      sh.getRange(rowIdx, 9).setNumberFormat("@");

      // Cột "Link sản phẩm": hyperlink bấm được để shop mở đúng mẫu, tránh nhầm hàng
      const pUrl = String(body.productUrl || body.page || "").trim();
      const cell = sh.getRange(rowIdx, HEADERS.length);
      if (/^https?:\/\//i.test(pUrl)) {
        // Rich text link (không dùng công thức HYPERLINK vì lỗi theo locale của Sheet)
        const rv = SpreadsheetApp.newRichTextValue()
          .setText("Mở sản phẩm")
          .setLinkUrl(pUrl)
          .build();
        cell.setRichTextValue(rv);
      } else {
        cell.setValue(pUrl);
      }
    } catch (e) {}

    // Gửi thông báo Telegram (nếu đã cấu hình) — lỗi tele không làm hỏng đơn
    let tg = { ok: false, reason: "off" };
    try { tg = tgSend_(tgMessage_(body)); } catch (e) { tg = { ok: false, error: String(e) }; }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, orderCode: body.orderCode || "", telegram: tg.ok }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** Mở link web app trên trình duyệt để kiểm tra */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: "LumStore orders", time: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Tạo sẵn sheet DonHang khi chạy tay trong editor */
function setup() {
  getSheet_();
}
