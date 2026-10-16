// 真实星空（小屋的望远镜 / 圆窗点进去看的）：星表、星座线、深空照片都在本地文件里，太阳月亮行星在本机算，不联网。
//   GET  <前缀>/sky/catalog        → { ok, v, epoch, stars:[[ra°,dec°,mag,bv,name?]], lines:[…], deep:[{id,name,type,ra,dec,size,dist,img,credit,license,source}] }
//   GET  <前缀>/sky/img/<id>.jpg   → 深空照片（只认 catalog.deep 里有的 id）
//   GET  <前缀>/sky/now[?at=毫秒]   → { ok, at, where:{lat,lon,city,approx}, sun:{ra,dec,alt,az,light}, moon:{…,phase,illum,name}, planets:[…], weather }
//   GET  <前缀>/sky/where          → 现在用的位置
//   POST <前缀>/sky/where {"lat":35.7,"lon":139.7,"city":"…"}   存位置（DATA_DIR/sky-where.json）；{"clear":true} 删掉回默认
// 位置的优先级：POST 存的 > 环境变量 WORLD_LAT / WORLD_LON / WORLD_CITY > 按世界时区估（纬度 35°、经度 = 时区×15°，approx:true）。
// 坐标约定：ra/dec 是 J2000（度）；alt/az 是此刻此地、含大气折射（az 从正北顺时针）。
// 天气用的是游戏里小池塘那会儿的天气（不是真实天气）。
"use strict";
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "content", "sky");
const CATALOG = path.join(DATA_DIR, "catalog.json");
const IMG_DIR = path.join(DATA_DIR, "img");
const Astronomy = require(path.join(__dirname, "..", "engine", "vendor", "astronomy.js"));
const S = { cat: null, catMtime: 0, catBody: null, catPrefix: "" };

function catalog(prefix) {
  const st = fs.statSync(CATALOG);
  if (!S.cat || S.catMtime !== st.mtimeMs || S.catPrefix !== prefix) {
    const c = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
    if (!c || !Array.isArray(c.stars) || !Array.isArray(c.deep)) throw new Error("catalog.json 结构不对");
    // 图片地址跟着接口前缀走（WORLD_PREFIX 改了也对）
    for (const d of c.deep) if (d && typeof d.img === "string") d.img = d.img.replace(/^\/api\/world\/sky\//, `${prefix}/sky/`);
    S.cat = c; S.catMtime = st.mtimeMs; S.catPrefix = prefix; S.catBody = Buffer.from(JSON.stringify({ ok: true, ...c }));
  }
  return S.cat;
}

const PHASES = ["新月", "蛾眉月", "上弦月", "盈凸月", "满月", "亏凸月", "下弦月", "残月"];
function phaseName(elong) {   // 月日黄经差 0~360：0 新月、90 上弦、180 满月、270 下弦；这四个各占 ±12°（约一天）
  const e = ((elong % 360) + 360) % 360; const W = 12;
  if (e < W || e >= 360 - W) return PHASES[0];
  if (Math.abs(e - 90) < W) return PHASES[2];
  if (Math.abs(e - 180) < W) return PHASES[4];
  if (Math.abs(e - 270) < W) return PHASES[6];
  return e < 90 ? PHASES[1] : e < 180 ? PHASES[3] : e < 270 ? PHASES[5] : PHASES[7];
}
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
function pos(body, time, obs) {
  const j2000 = Astronomy.Equator(body, time, obs, false, true);
  const ofDate = Astronomy.Equator(body, time, obs, true, true);
  const hor = Astronomy.Horizon(time, obs, ofDate.ra, ofDate.dec, "normal");
  return { ra: r3(j2000.ra * 15), dec: r3(j2000.dec), alt: r2(hor.altitude), az: r2(hor.azimuth) };
}
function skyNow(where, date) {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(where.lat, where.lon, 0);
  const sun = pos(Astronomy.Body.Sun, time, obs);
  const light = sun.alt > -0.833 ? "白天" : sun.alt > -6 ? "民用晨昏" : sun.alt > -12 ? "航海晨昏" : sun.alt > -18 ? "天文晨昏" : "夜";
  const m = pos(Astronomy.Body.Moon, time, obs);
  const mi = Astronomy.Illumination(Astronomy.Body.Moon, time);
  const elong = Astronomy.MoonPhase(time);
  const moon = { ...m, phase: r3(elong / 360), illum: r3(mi.phase_fraction), name: phaseName(elong), elong: r2(elong), phaseAngle: r2(mi.phase_angle), waxing: elong < 180, mag: r2(mi.mag) };
  const PL = [["Mercury", "水星"], ["Venus", "金星"], ["Mars", "火星"], ["Jupiter", "木星"], ["Saturn", "土星"]];
  const planets = PL.map(([id, name]) => { const b = Astronomy.Body[id]; return { id: id.toLowerCase(), name, ...pos(b, time, obs), mag: r2(Astronomy.Illumination(b, time).mag) }; });
  return { sun: { ...sun, light }, moon, planets };
}

// 游戏天气 → 星空页认的六个词（晴 / 多云 / 雨 / 雾 / 雪 / 大风）和云量
const WX = { 晴: ["晴", 0], 多云: ["多云", 0.6], 小雨: ["雨", 1], 大雨: ["雨", 1], 雾: ["雾", 1], 大风: ["大风", 0.2] };
function weatherView(kind) { const w = WX[kind]; return w ? { text: w[0], cloud: w[1], raw: kind, cloudEstimated: true, src: "game" } : null; }

const okLat = (v) => typeof v === "number" && isFinite(v) && v >= -90 && v <= 90;
const okLon = (v) => typeof v === "number" && isFinite(v) && v >= -180 && v <= 180;
const round1 = (x) => Math.round(x * 10) / 10;   // 看星星用不着精确坐标，保留一位小数（约 10 公里）
function where(dataDir, tzOffsetMin) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dataDir, "sky-where.json"), "utf8"));
    if (j && okLat(j.lat) && okLon(j.lon)) return { lat: round1(j.lat), lon: round1(j.lon), city: String(j.city || "").slice(0, 40), approx: false, src: "set" };
  } catch { /* 没存过 */ }
  const lat = Number(process.env.WORLD_LAT), lon = Number(process.env.WORLD_LON);
  if (process.env.WORLD_LAT && process.env.WORLD_LON && okLat(lat) && okLon(lon)) return { lat: round1(lat), lon: round1(lon), city: String(process.env.WORLD_CITY || "").slice(0, 40), approx: false, src: "env" };
  const off = Number(tzOffsetMin) || 0;
  return { lat: 35, lon: round1(Math.max(-180, Math.min(180, off / 4))), city: "", approx: true, src: "tz" };
}

const SKY_ID = /^[A-Za-z0-9_-]{1,20}$/;
// solo.js 调：sub 是去掉前缀后的路径（/sky/…）；处理了返回 true
async function route(req, res, sub, opt) {
  const { M, q, prefix, dataDir, tzOffsetMin, weatherKind, send, readRaw } = opt;
  if (!/^\/sky(\/|$)/.test(sub)) return false;
  try {
    if (sub === "/sky/catalog" && M === "GET") {
      catalog(prefix);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*", "Content-Length": S.catBody.length });
      res.end(S.catBody); return true;
    }
    const im = sub.match(/^\/sky\/img\/([^/]+)\.jpg$/);
    if (im && M === "GET") {
      const id = im[1];
      if (!SKY_ID.test(id) || !catalog(prefix).deep.some((d) => d.id === id)) { send(res, 404, { ok: false, error: "没有这张图" }); return true; }
      let buf; try { buf = fs.readFileSync(path.join(IMG_DIR, `${id}.jpg`)); } catch { send(res, 404, { ok: false, error: "图不在" }); return true; }
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff", "Content-Length": buf.length });
      res.end(buf); return true;
    }
    if (sub === "/sky/now" && M === "GET") {
      const atRaw = q.get("at");
      const at = atRaw == null || atRaw === "" ? new Date() : /^-?\d+(\.\d+)?$/.test(atRaw.trim()) ? new Date(Number(atRaw)) : new Date(atRaw);
      if (isNaN(at.getTime())) { send(res, 400, { ok: false, error: "at 不对" }); return true; }
      const w = where(dataDir, tzOffsetMin);
      send(res, 200, { ok: true, at: at.getTime(), where: w, ...skyNow(w, at), weather: weatherView(weatherKind) }); return true;
    }
    if (sub === "/sky/where" && M === "GET") { send(res, 200, { ok: true, where: where(dataDir, tzOffsetMin) }); return true; }
    if (sub === "/sky/where" && M === "POST") {
      let b; try { b = JSON.parse((await readRaw(req, 4096)).toString("utf8") || "{}"); } catch { send(res, 400, { ok: false, error: "要 JSON：{\"lat\":35.7,\"lon\":139.7,\"city\":\"…\"}" }); return true; }
      const f = path.join(dataDir, "sky-where.json");
      if (b && b.clear === true) { try { fs.unlinkSync(f); } catch { /* 本来就没有 */ } send(res, 200, { ok: true, where: where(dataDir, tzOffsetMin) }); return true; }
      // GPT：null / "" / true 不能被 Number() 转成 0；只收数字或数字样子的字符串，正文要是对象
      if (!b || typeof b !== "object" || Array.isArray(b)) { send(res, 400, { ok: false, error: "正文要是一个 JSON 对象" }); return true; }
      const num = (v) => typeof v === "number" ? v : typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN;
      const lat = num(b.lat), lon = num(b.lon);
      if (!okLat(lat) || !okLon(lon)) { send(res, 400, { ok: false, error: "纬度要在 -90~90、经度在 -180~180" }); return true; }
      fs.mkdirSync(dataDir, { recursive: true }); const t = `${f}.${process.pid}.tmp`;
      fs.writeFileSync(t, JSON.stringify({ lat: round1(lat), lon: round1(lon), city: String((b && b.city) || "").slice(0, 40) })); fs.renameSync(t, f);
      send(res, 200, { ok: true, where: where(dataDir, tzOffsetMin) }); return true;
    }
  } catch (e) { send(res, 500, { ok: false, error: e.message }); return true; }
  send(res, 404, { ok: false, error: "没有这个星空接口" }); return true;
}

module.exports = { route, skyNow, phaseName, where, weatherView };
