// Sinh đánh giá khách hàng (deterministic theo slug — build lại không đổi nội dung)
const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương", "Lý", "Phan", "Trịnh", "Đinh", "Tạ", "Lâm", "Mai", "Cao", "Võ"];
const DEM = ["Thị", "Thu", "Minh", "Ngọc", "Thanh", "Hồng", "Kim", "Diệu", "Bảo", "Phương", "Hải", "Gia", "Khánh", "Tuấn", "Văn", "Quốc", "Anh", "Như"];
const TEN = ["Hà", "Linh", "Trang", "Nhung", "Yến", "Oanh", "Hạnh", "Thảo", "My", "Nhi", "Ngân", "Quyên", "Hương", "Lan", "Chi", "Vy", "Tâm", "Nguyệt", "Hằng", "Trinh", "Dung", "Hiền", "Phúc", "Thư", "An", "Bích", "Cẩm", "Diệp", "Giang", "Hân", "Khuê", "Liên", "Mến", "Nga", "Oanh", "Phượng", "Quỳnh", "Sen", "Thắm", "Uyên", "Vân", "Xuân", "Ánh", "Bình", "Cúc", "Đào", "Hoa", "Kiều", "Lệ", "Mơ"];

const R5 = [
  "Túi xinh hơn mình tưởng, da mềm mà form vẫn đứng, đựng vừa điện thoại với ví mini.",
  "Nhận hàng rồi mới trả tiền nên rất yên tâm. Đúng mẫu trong ảnh, màu ngoài đời còn đẹp hơn.",
  "Shop gọi xác nhận trong 10 phút, giao 2 ngày là có. Đóng gói 3 lớp, hộp không móp.",
  "Mua tặng sinh nhật mẹ, mẹ khen mãi. Đường may chắc, khoá mở êm, không bị kẹt.",
  "Đeo đi làm cả tuần, ai cũng hỏi mua ở đâu. Với tầm giá này thì quá hợp lý.",
  "Túi nhẹ, đeo chéo cả ngày không mỏi vai. Lòng túi rộng hơn mình nghĩ, đựng được cả khăn giấy.",
  "Màu be ngoài đời sang lắm, phối với váy hay sơ mi đều đẹp. Sẽ ủng hộ shop tiếp.",
  "Mình đặt 2 cái cho mình và em gái, cả hai đều ưng. Nhân viên tư vấn màu rất có tâm.",
  "Hàng y như hình, không bị lỗi chỉ. Da lau sạch dễ, đi mưa nhẹ không sao.",
  "Lần thứ 3 mua ở shop, lần nào cũng ổn. Giao nhanh, đóng gói cẩn thận, giá tốt.",
  "Túi nhỏ gọn mà đựng được nhiều, đi chơi chỉ cần đeo mỗi nó là đủ.",
  "Khoá kim loại chắc chắn, dây đeo điều chỉnh được nên đeo chéo vừa in. Rất đáng tiền.",
  "Đặt hôm trước hôm sau đã thấy ship gọi. Túi đẹp, không có mùi keo gì cả.",
  "Mình cao 1m58 đeo chéo vừa đẹp, không bị quá dài. May chỉnh được dây nên ai cũng đeo được.",
  "Cầm lên thấy chắc tay, không ọp ẹp như mấy túi rẻ rẻ ngoài chợ. Rất ưng.",
  "Đóng gói kỹ, có cả thiệp cảm ơn nhỏ. Túi đúng mô tả, màu đen basic dễ dùng.",
  "Mua để đi tiệc cưới, lên hình cực xinh. Bạn bè xin link liên tục.",
  "Shop trả lời Zalo nhanh, đổi màu trước khi giao cũng được luôn. Dịch vụ 10 điểm.",
  "Túi bền, mình dùng 2 tháng rồi vẫn như mới, góc không bị bong keo.",
  "Da PU nhưng nhìn không bị rẻ tiền, đường chỉ đều, tem mác đầy đủ. Rất hài lòng.",
  "Giao hàng đúng hẹn, shipper thân thiện. Túi đựng vừa iPad mini luôn nha mọi người.",
  "Mình khó tính mà cũng không chê được điểm nào. Chốt đơn tiếp cho chị đồng nghiệp rồi.",
  "Màu trắng sữa dễ thương, không bị ố vàng sau 1 tháng dùng. Chất lượng ổn trong tầm giá.",
  "Đặt lúc 9h tối mà sáng hôm sau shop đã gọi xác nhận. Quá nhanh.",
  "Túi đứng form, để đồ nhiều vẫn không bị xẹp. Mình dùng đi làm hằng ngày.",
  "Quai đeo chắc, không bị tuột chỉ. Mình đeo 3 tháng rồi vẫn ổn.",
  "Bên trong có ngăn khoá kéo nhỏ đựng tiền rất tiện. Chi tiết này mình thích nhất.",
  "Giá này mà chất lượng vậy là quá thơm. Mua thêm 1 cái màu đen nữa rồi.",
  "Túi đẹp, giao nhanh, nhân viên dễ thương. Không có gì để chê.",
  "Mình ở tỉnh mà 3 ngày là nhận được. Túi còn nguyên seal, thơm mùi da mới.",
  "Đeo hợp với mọi outfit, từ đi chợ đến đi họp. Tiện cực kỳ.",
  "Chất da dày dặn, cầm chắc tay. Mẹ mình cũng đòi mua một cái.",
  "Shop tư vấn đúng nhu cầu, không bán thêm hàng thừa. Rất chuyên nghiệp.",
  "Túi y hình, màu hồng phấn nhẹ nhàng đúng như mình cần. Sẽ giới thiệu bạn bè.",
  "Kích thước vừa xinh, đựng điện thoại, son, ví, chìa khoá vừa khít. Gọn mà đủ.",
  "Hàng đóng hộp đẹp, thích hợp làm quà. Mình mua 3 cái tặng khách hàng.",
  "Mua online mà không phải đổi trả lần nào. Quá yên tâm.",
  "Chất lượng vượt giá tiền, đường may không có chỉ thừa. Rất nên mua.",
  "Đặt thử 1 cái, nhận xong quay lại đặt thêm 2 cái. Túi đẹp thật sự.",
  "Da mềm, không bị cứng như túi rẻ tiền. Cầm lên là thấy khác liền."
];

const R5C = [
  "Giac hoi silicon mem, bam da tot, hut rat deu. Dung 5 phut la thay nhe vai gay.",
  "Khong can lua nen an toan, dung tai nha cung duoc. Silicon mem mai, khong dau.",
  "Giao nhanh, dong goi ky, dung mau. Giac hoi silicon nay hut manh hon loai nhua cung.",
  "Dung di gio rat ok, da do deu, khong bi rop. Se mua them cho gia dinh.",
  "Chat silicon deo, de bop tao luc hut. Khong bi tuot khi di chuyen tren lung.",
  "Shop tu van nhiet tinh, giao 2 ngay la nhan. San pham dung mo ta, gia hop ly.",
  "Mua cho me dung, me khen nhieu. Giac hoi silicon nay sach se, de ve sinh.",
  "Hut deu, khong bi dau nhu giac hoi lua. Dung xong da hong hao, thu gian.",
  "Combo 10 cai gia tot, chia cho ca nha. Silicon mem, khong bi bien dang.",
  "Dong goi can than, co huong dan su dung. San pham dung hinh anh.",
  "Dung massage vai gay rat hieu qua, giam dau ro ret sau 1 tuan.",
  "Silicon cao cap, khong co mui nhua. Hut manh nhung khong de lai vet lau.",
  "Giao hang dung hen, shipper than thien. San pham nhu mo ta.",
  "Mua lan 2 roi, chat luong on dinh. Se tiep tuc ung ho shop.",
  "Giac hoi silicon nay de dung, khong can ky thuat. Phu hop nguoi moi.",
  "Hut deu khap lung, giam dau nhuc ro ret. Rat hai long.",
  "Chat lieu mem mai, khong gay kich ung da. Dung cho ca nguoi gia.",
  "Gia re ma chat luong tot. Mua combo 10 cai tiet kiem nhieu.",
  "Shop giao nhanh, dong goi ky. San pham dung mau, dung so luong.",
  "Giac hoi silicon khong lua an toan cho gia dinh co tre nho."
];

const R4C = [
  "Hang dep, silicon mem. Giao cham 1 ngay so voi du kien nhung van ok.",
  "San pham tot, hut manh. Mau ngoai hoi khac anh mot chut nhung van dep.",
  "Dung duoc, silicon mem. Hut hoi manh so voi mong doi nhung quen dan.",
  "Dong goi ky, giao hoi cham. Chat luong san pham tot.",
  "Hut deu, silicon mem. Gia hop ly. Se mua them."
];


const R4 = [
  "Hàng đẹp, đúng mẫu. Giao hơi chậm 1 ngày so với dự kiến nhưng vẫn ok.",
  "Túi xinh, chỉ là màu ngoài đời đậm hơn ảnh một chút. Mình vẫn dùng tốt.",
  "Chất lượng ổn trong tầm giá. Khoá hơi cứng lúc mới, dùng vài hôm thì mượt.",
  "Túi nhỏ hơn mình tưởng, may mà vẫn đựng vừa điện thoại. Da đẹp.",
  "Đóng gói chắc nhưng hộp hơi móp góc, túi bên trong không sao.",
  "Hàng ổn, shipper gọi hơi khó nghe. Túi thì đẹp, mình vẫn giới thiệu bạn mua.",
  "Form đẹp nhưng dây đeo hơi mảnh, mình thay dây khác cho chắc.",
  "Mua tặng, người nhận thích. Trừ 1 sao vì giao lâu hơn shop nói.",
  "Da đẹp, mùi nhẹ. Mong shop có thêm màu nâu bò nữa.",
  "Ổn so với giá. Túi hơi nặng hơn mình nghĩ nhưng bù lại chắc chắn."
];

const R3 = [
  "Mình đặt màu đen mà shop giao màu be. Báo shop thì được đổi lại trong 2 ngày, nên chỉ trừ 2 sao.",
  "Giao sai mẫu (mẫu khoá móc thành khoá kéo). Shop đổi cái khác, hàng mới thì đẹp.",
  "Đơn hẹn giao thứ 4 mà thứ 7 mới tới, lỡ mất dịp đi tiệc. Hàng thì ổn.",
  "Nhận sai màu, shop xử lý nhanh và đổi đúng màu mình chọn. Trừ sao vì phải chờ thêm 3 ngày.",
  "Túi đúng chất, nhưng giao nhầm màu hồng trong khi mình đặt trắng. Đã đổi, ok.",
  "Giao trễ 3 ngày so với hẹn, shipper không gọi trước. Túi vẫn đẹp.",
  "Sai mẫu so với ảnh đặt, shop đổi lại nhưng mình phải ra bưu cục lấy.",
  "Màu ngoài đời khác ảnh khá nhiều, shop cho đổi sang màu khác, tính ra cũng ổn."
];

const R2 = [
  "Đặt màu đen, nhận màu nâu, đổi lại mất gần 1 tuần. Sản phẩm thì không lỗi.",
  "Giao sai mẫu hoàn toàn, phải chờ đổi 5 ngày. Hàng đúng thì đẹp.",
  "Hẹn giao 3 ngày mà 9 ngày mới nhận, lại còn sai màu. Shop có đổi nhưng mất thời gian."
];
const R1 = [
  "Giao hàng quá chậm, đặt 10 ngày mới tới, mình không kịp dùng."
];

const PLACE = ["Hà Nội", "TP.HCM", "Hải Phòng", "Đà Nẵng", "Cần Thơ", "Nghệ An", "Thanh Hóa", "Bắc Ninh", "Quảng Ninh", "Ninh Bình", "Nam Định", "Thái Bình", "Hưng Yên", "Vĩnh Phúc", "Bình Dương", "Đồng Nai", "Long An", "Tiền Giang", "Huế", "Khánh Hòa", "Lâm Đồng", "Gia Lai", "Đắk Lắk", "An Giang"];

const pad = (n) => (n < 10 ? "0" + n : "" + n);

/**
 * Sinh danh sách đánh giá cho 1 sản phẩm.
 * @returns {{rating:number, total:number, dist:number[], reviews:Array<{name:string, stars:number, date:string, text:string, place:string}>}}
 */
export function makeReviews(product) {
  const seed = hash((product.slug || product.name || "sp") + "|rv|" + (product.offerId || ""));
  const rand = rng(seed);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // Điểm trung bình mục tiêu 4.4 – 4.9
  const TARGETS = [4.9, 4.8, 4.9, 4.7, 4.6, 4.8, 4.5, 4.9, 4.4, 4.7];
  const target = TARGETS[seed % TARGETS.length];

  const total = 1000 + (seed % 900); // số lượt đánh giá hiển thị (1.000 – 1.899)
  const shown = 96 + (seed % 50); // số bình luận có sẵn để bấm "Xem thêm"

  // Chỉ có 5★ / 4★ / 3★ / 2★ — không có 1★. 2★ và 3★ chỉ chê ship lâu.
  // Số lượng 5★ luôn là số lẻ.
  const c2 = 1 + (seed % 3); // 1 – 3 đánh giá 2 sao
  const c3 = 4 + (seed % 5); // 4 – 8 đánh giá 3 sao
  const rest = total - c2 - c3;
  let c4 = Math.round(total * (5 - target) - 3 * c2 - 2 * c3);
  c4 = Math.max(0, Math.min(rest, c4));
  let c5 = rest - c4;
  if (c5 % 2 === 0) { c5 -= 1; c4 += 1; }
  if (c5 < 1) { c5 = 1; c4 = rest - 1; }

  // Danh sách bình luận hiển thị: đủ số 2★/3★ như biểu đồ, còn lại chia 5★/4★
  const stars = [];
  for (let i = 0; i < c3; i++) stars.push(3);
  for (let i = 0; i < c2; i++) stars.push(2);
  const remaining = shown - c3 - c2;
  for (let i = 0; i < remaining; i++) {
    const r = rand();
    stars.push(r < c5 / (c5 + c4) ? 5 : 4);
  }

  // Trộn để danh sách không bị nhóm theo số sao
  for (let i = stars.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [stars[i], stars[j]] = [stars[j], stars[i]];
  }

  const now = Date.now();
  let i3 = 0, i2 = 0;
  const reviews = stars.map((s) => {
    const name = pick(HO) + " " + pick(DEM) + " " + pick(TEN);
    const theme = product.reviewTheme || "bag";
  const R5Pool = theme === "cupping" ? R5C : R5;
  const R4Pool = theme === "cupping" ? R4C : R4;
  const pool = s === 5 ? R5Pool : s === 4 ? R4Pool : s === 3 ? R3 : R2;
    const text = s === 3 ? R3[i3++ % R3.length] : s === 2 ? R2[i2++ % R2.length] : pick(pool);
    const days = Math.floor(rand() * 300) + 1;
    const d = new Date(now - days * 86400000);
    return {
      name,
      stars: s,
      date: pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(),
      text: text,
      place: pick(PLACE),
      _t: now - days * 86400000
    };
  });

  reviews.sort((a, b) => b._t - a._t);
  reviews.forEach((r) => delete r._t);

  const dist = [c5, c4, c3, c2, 0];
  const rating = Math.round(((5 * c5 + 4 * c4 + 3 * c3 + 2 * c2) / total) * 10) / 10;

  return { rating, total, dist, reviews, odd: c5 };
}
