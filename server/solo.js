// 单人版世界服务：一个人玩 + 自己会动的 AI 伙伴，不用登录，只听本机。
// 路径跟联机版 / 家用版一样（前缀 WORLD_PREFIX，默认 /api/world），前端只换前缀和地址。
// 规则全在 engine/ 里；这里只管存档、接口、伙伴的自动玩法、聊天、小人图。
// 不带：捉迷藏、换装、天象、截图。
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ENGINE = process.env.WORLD_ENGINE_DIR || path.join(__dirname, "..", "engine");
const core = require(path.join(ENGINE, "core.js"));
const farm = require(path.join(ENGINE, "farm.js"));
const cards = require(path.join(ENGINE, "cards.js"));
const ddzHome = require(path.join(ENGINE, "ddz-home.js"));
const duel = require(path.join(ENGINE, "duel.js"));

const PORT = Number(process.env.PORT || 29901);
const HOSTNAME = process.env.HOST || "127.0.0.1";
const PREFIX = (process.env.WORLD_PREFIX || "/api/world").replace(/\/+$/, "");
const DATA = process.env.DATA_DIR || path.join(__dirname, "data");
const STATE = path.join(DATA, "world.json");
const SPRITES = path.join(DATA, "sprites");
const SPRITE_MAX = 512 * 1024, SPRITE_W = 240, SPRITE_H = 320;

const { rnd, shHour, SPECIES, BITE_MS, SHOP, gearOf, bucketUsed, bucketSize, charmOf, useBait, wormNo, aiFail, biteSecs, note, desc, pickFish,
  sellFish, buyItem, equipItem, shopView, SPOT_NAME, walkMs, angNorm, spotsOf, spotOf, lineSpot, riverHour, nameOf } = core;
const HOST = core.HOST;
const AIS = core.COMPANIONS.slice();
const ALL = [HOST, ...AIS];
core.CATCH_HOOKS.push((st, w, item) => duel.onCatch(st, w, item));
// 鱼桶牌赢家叫人「替钓」：钓上来的下一条直接转进赢家的桶（钩子在鱼进桶之后跑，玩家 / 伙伴 / 传说鱼都走这儿）
core.CATCH_HOOKS.push((st, w, item) => { const fv = cards.takeFavor(st, w, item); if (fv) { note(st, { type: "cards-favor", who: w, to: fv.to, item }); if (AIS.includes(fv.to)) tell(st, fv.to, `${nameOf(w)}替我钓的 ${desc(item)} 收到了。`); } });

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = `${f}.${process.pid}.${crypto.randomBytes(3).toString("hex")}.tmp`; fs.writeFileSync(t, JSON.stringify(v, null, 1)); fs.renameSync(t, f); };
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ── 存档 ──
function load() {
  let raw = null; try { raw = fs.readFileSync(STATE, "utf8"); } catch (e) { if (e.code !== "ENOENT") throw new Error(`world.json 读不出（${e.code}）`); }
  let s = null; if (raw !== null) { s = JSON.parse(raw); if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error("world.json 不是对象"); }
  s = s || { players: {}, dex: {}, events: [], casts: {}, chat: [], open: true, trial: true };
  s.players = s.players || {}; s.dex = s.dex || {}; s.events = s.events || []; s.casts = s.casts || {}; s.chat = s.chat || [];
  if (s.open == null) s.open = true; if (s.trial == null) s.trial = true;
  for (const id of ALL) s.players[id] = s.players[id] || { id, name: nameOf(id), spot: "pond", bait: "cranberry", bucket: [], coins: 0, lastSeenAt: 0, catches: 0, seen: [], rares: 0, legends: 0, gifted: 0, mydex: {} };
  return s;
}
const save = (s) => { s.events = s.events.slice(-300); s.chat = s.chat.slice(-200); writeJson(STATE, s); };
const hostHere = (s) => Date.now() - (s.players[HOST].lastSeenAt || 0) < 2 * 60000;
const placeOf = (s, who) => (s.players[who] && s.players[who].spot) || "pond";
const spotName = (s, p) => SPOT_NAME[p] || (p === "river" && s.trial ? "夜河" : p);
function weatherOf(s, spot) { return core.weatherOf(s, spot); }
const farmOn = (s) => !!(s.open || s.trial);
const cardsOn = () => true;
const rollCatch = (p, b, s) => core.rollCatch(p, b, (s.wx && s.wx[p.spot] && s.wx[p.spot].w) || "", s);

// ── 聊天：世界里的话都在这儿（你、伙伴、系统）──
const CHAT_LINES = (core.CONTENT && core.CONTENT.CHAT_LINES) || ["嗯。", "今天水不错。", "你那边咬钩了吗？", "等会儿去秤砣那儿看看。", "刚才那条跑了，可惜。"];
function chat(s, who, text, extra = {}) {
  s.chat.push({ id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, at: Date.now(), who, name: who === "system" ? "" : nameOf(who), text: String(text).slice(0, 300), ...extra });
}
const tell = (s, who, text) => chat(s, who, text, { auto: true });   // 游戏替伙伴说的一句（到了、钓到了……）
const sys = (s, text) => chat(s, "system", text);
const noTell = () => {};   // 斗地主桌递给伙伴的是给模型看的提示原文，单人版伙伴是托管，丢掉不进聊天

// ── 伙伴的自动玩法：走走、甩竿、拉鱼、桶满了去卖；在夜河就帮忙拉传说鱼 ──
const AI_HOME = {}; AIS.forEach((w, i) => { AI_HOME[w] = i === 0 ? -0.12 : Math.PI + 0.3 + i * 0.4; });
const BITE_AI_MS = 20000;
function aiState(s, who) {
  s.ai = s.ai || {}; const a = (s.ai[who] = s.ai[who] || { ang: AI_HOME[who] || 0, walk: null, act: "idle", nextAt: 0 });
  if (a.walk && Date.now() >= a.walk.at + a.walk.dur) { a.ang = a.walk.to; a.walk = null; a.arrived = true; }
  return a;
}
const aiAng = (a, now = Date.now()) => (a.walk ? a.walk.from + (a.walk.to - a.walk.from) * Math.min(1, (now - a.walk.at) / a.walk.dur) : a.ang);
function aiStep(s, who, now) {
  const a = aiState(s, who); const pl = s.players[who]; let dirty = false;
  if (a.arrived) { a.arrived = false; dirty = true; tell(s, who, `到了，站在${spotName(s, placeOf(s, who))}${spotOf(a.ang, placeOf(s, who))}。`); }
  if (a.cast) {
    if (a.act === "wait" && now >= a.cast.biteAt) { a.act = "bite"; a.cast.hookAt = now + rnd(2, 6) * 1000; dirty = true; }
    else if (a.act === "bite" && now >= a.cast.hookAt) {
      const f = a.cast.fish; const hard = Math.random() < 0.4; a.act = "idle"; a.cast = null; dirty = true;
      if (Math.random() < aiFail(pl, f, hard)) { note(s, { type: hard ? "snap" : "escape", who, name: f.name, rarity: f.rarity }); if (f.rarity >= 2) tell(s, who, hard ? "线断了……" : "脱钩了……"); }
      else { const r = core.addCatch(s, who, f); if (f.rarity >= 2 || r.mineFirst) tell(s, who, `钓到了 ${desc(f)}${r.record ? "，破纪录" : r.mineFirst ? "，图鉴第一次" : ""}。`); }
      a.nextAt = now + rnd(60, 240) * 1000;
    }
    return dirty;
  }
  if (a.walk || now < a.nextAt) return dirty;
  const place = placeOf(s, who);
  if (place === "river" && !riverHour()) { pl.spot = "pond"; a.ang = AI_HOME[who] || 0; note(s, { type: "travel", who, from: "river", to: "pond" }); return true; }
  if (bucketUsed(gearOf(pl)) >= bucketSize(pl)) { const r = sellFish(s, who, "全部"); if (!r.error) tell(s, who, `去秤砣那儿卖了 ${r.n} 条，得了 ${r.got} 亮鳞。`); a.nextAt = now + 30000; return true; }
  const roll = Math.random();
  if (roll < 0.25) {   // 走到这片水边另一个地方
    const SP = spotsOf(place); const here = spotOf(aiAng(a, now), place); const opts = SP.filter((x) => x[0] !== here); const to = pick(opts.length ? opts : SP);
    let goal = to[1]; if (lineSpot(place)) goal = Math.max(-1.5, Math.min(1.5, goal));
    const from = aiAng(a, now); const target = lineSpot(place) ? goal : from + angNorm(goal - from);
    a.walk = { from, to: target, at: now, dur: walkMs(from, target, place) }; a.ang = from; note(s, { type: "move", who, name: to[0] }); a.nextAt = now + 60000; return true;
  }
  if (roll < 0.32) {   // 换个钓点
    const spots = Object.keys(SPOT_NAME).filter((k) => k !== place && (k !== "river" || riverHour())); if (!spots.length) return dirty;
    const dest = pick(spots); pl.spot = dest; a.ang = AI_HOME[who] || 0; a.walk = null; note(s, { type: "travel", who, from: place, to: dest }); tell(s, who, `去${spotName(s, dest)}了。`); a.nextAt = now + rnd(60, 180) * 1000; return true;
  }
  if (wormNo(pl)) { const r = buyItem(s, who, "worm", 3); if (r.error) { a.nextAt = now + 600000; return dirty; } }
  const bt = useBait(pl); a.act = "wait"; a.cast = { at: now, biteAt: now + biteSecs(bt, weatherOf(s, place)) * 1000 * 0.8, fish: rollCatch(pl, bt, s), bait: bt.id }; note(s, { type: "cast", who }); return true;
}

// ── 一起玩：传说鱼 / 打赌 / 欠条 / 牌 ──
function togetherTick(s, now) {
  let dirty = false; const before = JSON.stringify([s.legendRoll, s.legend && s.legend.phase, (s.bets || []).map((b) => b.status)]);
  const lt = core.legendTick(s, { riverOpen: core.RIVER_OPEN || !!s.trial, herHere: hostHere(s) });
  if (lt.spawned) { for (const w of ALL) if (placeOf(s, w) === "river") core.legendJoin(s, w); sys(s, `夜河里有大家伙在翻水——${s.legend.name}！`); }
  if (lt.gone) sys(s, `${s.legend.name}沉下去了，今晚没拉成。`);
  if (lt.ended) sys(s, s.legend.phase === "won" ? `拉上来了！${s.legend.name}（${s.legend.kg}kg）。` : `${s.legend.name}跑了……岸边留下一片它的鳞。`);
  const L = s.legend;
  if (L && (L.phase === "calling" || L.phase === "fight")) for (const w of AIS) if (placeOf(s, w) === "river" && core.legendJoin(s, w)) dirty = true;   // 鱼出来以后才走到夜河的也算到场
  if (L && L.phase === "fight") for (const w of AIS) { if (placeOf(s, w) !== "river") continue; const a = aiState(s, w); if (now - (a.cheerAt || 0) > rnd(6, 12) * 1000) { a.cheerAt = now; const r = core.legendCheer(s, w, Math.random() < 0.75 ? "加油" : "放线", ""); if (!r.error) dirty = true; } }
  for (const b of core.betTick(s)) { dirty = true; sys(s, b.winner ? `「${b.title}」结了，${nameOf(b.winner)}赢。` : `「${b.title}」平局。`); }
  if ((s.bets || []).some((b) => b.status === "open" && now > b.acceptBy)) dirty = true;
  // 三人打赌：伙伴 1 分钟内接
  for (const b of s.bets || []) if (b.status === "open") for (const w of AIS) if (!b.answers || b.answers[w] == null) { if (now - b.at > 60000) { const r = core.betAnswer(s, w, b.id, Math.random() < 0.85); if (!r.error) { dirty = true; tell(s, w, r.bet.status === "declined" ? "这局不赌了。" : "接了。"); } } }
  if (s.duel && duel.live(s.duel.bet)) { const bb = JSON.stringify(s.duel.bet); for (const e of duel.tick(s, s.events)) { if (e.type === "auto-accept" || e.type === "accept") tell(s, e.bet.with, `接了，${duel.KINDS[e.bet.kind]}，输的：${e.bet.stake}。`); if (e.type === "auto-decline" || e.type === "decline") tell(s, e.bet.with, "这次不赌。"); if (e.type === "settled") sys(s, e.iou ? `欠条 · ${nameOf(e.iou.debtor)}欠${nameOf(e.iou.creditor)}：${e.iou.stake}` : "平局，谁也不欠谁。"); } if (JSON.stringify(s.duel.bet) !== bb) dirty = true; }
  return dirty || before !== JSON.stringify([s.legendRoll, s.legend && s.legend.phase, (s.bets || []).map((b) => b.status)]);
}
const cardOpts = () => ({ SPECIES, weatherOf, hour: shHour(), names: Object.fromEntries(ALL.map((w) => [w, nameOf(w)])) });
function cardsAuto(s, now) {   // 伙伴打鱼桶牌：叫到就接，轮到就出（出最小的那张）
  const g = s.cards && s.cards.cur; if (!g || g.status === "done") return false; let dirty = false;
  for (const w of AIS) {
    if (!g.seats.includes(w)) continue;
    if (g.status === "invite" && !(g.accepted || {})[w] && now - (g.at || 0) > 5000) { const r = cards.answer(s, w, true, cardOpts()); if (!r.error) dirty = true; }
    else if (g.status === "on" && !(g.played || {})[w] && now - (g.roundAt || g.at || 0) > 4000) { const r = cards.play(s, w, "1", cardOpts()); if (!r.error) { dirty = true; if (r.result) sys(s, r.result.text); } }
  }
  return dirty;
}
function ddzAuto(s) {   // 伙伴打斗地主：用规则里的托管走一步
  const t = s.ddz; const g = t && t.game; if (!g || g.phase === "done") return false;
  for (const w of AIS) if (t.kinds[w] === "ai") t.kinds[w] = "bot";
  return false;
}

function worldTick() {
  const s = load(); const now = Date.now(); let dirty = false;
  if (!s.open) return;
  if (togetherTick(s, now)) dirty = true;
  if (!global.__envAt || now - global.__envAt > 60000) { global.__envAt = now; core.setEnv({ v2: true, dreaming: false, wishDoneToday: false, listening: false, calling: false, readToday: false, annivDay: 0 }); }
  if (farmOn(s) && (!global.__farmAt || now - global.__farmAt > 60000)) { global.__farmAt = now; for (const e of farm.farmTick(s, { wx: weatherOf(s, "farm"), herLastAt: s.players[HOST].lastSeenAt || 0 })) { dirty = true; if (e.type === "help") note(s, { type: "farm", who: e.who, cmd: "帮浇", must: e.must }); } }
  ddzAuto(s);
  if (s.ddz && s.ddz.game && s.ddz.game.phase !== "done" && ddzHome.tick(s, noTell, (t) => { note(s, { type: "ddz", text: t }); sys(s, t); })) dirty = true;
  if (s.cards && s.cards.cur && s.cards.cur.status !== "done") { if (cardsAuto(s, now)) dirty = true; const evs = cards.tick(s, cardOpts()); if (evs.length) { dirty = true; for (const e of evs) if (e.type === "round" && e.result) sys(s, e.result.text); } }
  for (const w of AIS) if (aiStep(s, w, now)) dirty = true;
  if (dirty) save(s);
}

// ── 小人图 ──
const spriteFile = (pid) => path.join(SPRITES, `${pid.replace(/[^a-z0-9_-]/gi, "")}.png`);
function spriteOf(pid) { try { const st = fs.statSync(spriteFile(pid)); return `${PREFIX}/sprite/${pid}?v=${Math.round(st.mtimeMs)}`; } catch { return null; } }
// 整张 PNG 都验：签名、每个块的 CRC、IHDR 在前 IEND 在后、IDAT 解压出来的字节数跟宽高位深对得上。只验头的话伪造头 + 空数据也能传上来
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function pngSize(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  let p = 8, ihdr = null, idat = [], end = false, first = true, plte = false;
  while (p + 12 <= buf.length && !end) {
    const len = buf.readUInt32BE(p); const type = buf.toString("ascii", p + 4, p + 8); if (p + 12 + len > buf.length) return null;
    if (crc32(buf.subarray(p + 4, p + 8 + len)) !== buf.readUInt32BE(p + 8 + len)) return null;
    const data = buf.subarray(p + 8, p + 8 + len);
    if (first && type !== "IHDR") return null; first = false;
    if (type === "IHDR") {
      if (len !== 13 || ihdr) return null;
      ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], comp: data[10], filter: data[11], interlace: data[12] };
      if (!ihdr.w || !ihdr.h || ihdr.w > SPRITE_W || ihdr.h > SPRITE_H) return null;   // 先卡尺寸，再往下解压
    }
    else if (type === "PLTE") { if (plte || idat.length || len === 0 || len % 3 !== 0 || len / 3 > 256) return null; plte = len / 3; }   // 调色板：只一块、在 IDAT 前、3 的倍数、1~256 条
    else if (type === "IDAT") idat.push(data); else if (type === "IEND") end = true;
    p += 12 + len;
  }
  if (!ihdr || !end || !idat.length || p !== buf.length || ihdr.comp !== 0 || ihdr.filter !== 0 || ihdr.interlace !== 0) return null;
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color]; if (!ch) return null;
  const okDepth = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }[ihdr.color]; if (!okDepth.includes(ihdr.depth)) return null;
  if (ihdr.color === 3 && (!plte || plte > 2 ** ihdr.depth)) return null;
  const rowLen = 1 + Math.ceil(ihdr.w * ch * ihdr.depth / 8); const need = ihdr.h * rowLen;
  let raw; try { raw = require("zlib").inflateSync(Buffer.concat(idat), { maxOutputLength: need + 1 }); } catch { return null; }
  if (raw.length !== need) return null;
  for (let y = 0; y < ihdr.h; y++) if (raw[y * rowLen] > 4) return null;   // 每行第一个字节是滤波类型 0~4
  return { w: ihdr.w, h: ihdr.h };
}

// ── 视图（跟家用版 / 联机版同形）──
function view(s, me) {
  const pub = (p) => ({ id: p.id, name: p.name, spot: p.spot, catches: p.catches, bucket: p.bucket.slice(-20), coins: p.coins, here: p.id === HOST ? hostHere(s) : true, away: null, sprite: spriteOf(p.id) });
  const trial = !!s.trial, SPN = trial && !SPOT_NAME.river ? { ...SPOT_NAME, river: "夜河" } : SPOT_NAME;
  const dex = SPECIES.filter((sp) => core.RIVER_OPEN || trial || sp.spot !== "river").map((sp) => ({ id: sp.id, name: sp.name, spot: sp.spot, rarity: sp.r, stars: sp.r + 1, junk: !!sp.junk, hours: sp.hours || null, ...(s.dex[sp.id] ? { caught: true, ...s.dex[sp.id], sign: sp.sign } : { caught: false }), mine: (s.players[HOST].mydex || {})[sp.id] || null }));
  const ai = {}; for (const w of AIS) { const a = aiState(s, w); ai[w] = { ang: a.ang, walk: a.walk, act: a.act, place: placeOf(s, w), cab: null, spot: spotOf(aiAng(a), placeOf(s, w)), away: false, gear: (({ rod, bobber }) => ({ rod, bobber }))(gearOf(s.players[w]).gear) }; }
  const mySpot = s.players[HOST].spot || "pond"; const weathers = Object.fromEntries(Object.keys(SPN).map((k) => [k, weatherOf(s, k)]));
  const hp = s.players[HOST];
  return { items: hp.items || {}, specials: charmOf(hp) === "watch" ? core.specialsNow(s, mySpot) : null,
    farm: farmOn(s) ? farm.farmView(s) : null, legend: core.legendView(s), bets: core.betsView(s), open: !!s.open, trial, now: Date.now(), hour: shHour(), weather: weathers[mySpot], weathers, spots: Object.entries(SPN).map(([id, name]) => ({ id, name })), players: Object.values(s.players).map(pub), dex, events: s.events.slice(-40), me, ai, roles: { host: HOST, companions: AIS } };
}

// ── 接口 ──
const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" }); res.end(b); };
const readRaw = (req, limit) => new Promise((resolve, reject) => { const ch = []; let n = 0; req.on("data", (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error("too big"), { code: "E413" })); req.destroy(); } else ch.push(c); }); req.on("end", () => resolve(Buffer.concat(ch))); req.on("error", reject); });

async function route(req, res) {
  const u = new URL(req.url, "http://x"); const p = u.pathname; const M = req.method; const q = u.searchParams;
  if (M === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-World-Token, Authorization" }); res.end(); return; }
  if (p === "/api/ping" || p === `${PREFIX}/ping`) return send(res, 200, { ok: true, t: Date.now(), prefix: PREFIX });
  if (!p.startsWith(PREFIX + "/") && p !== PREFIX) return send(res, 404, { ok: false, error: "not found" });
  const sub = p === PREFIX ? "" : p.slice(PREFIX.length);

  // 小人图：先于读 JSON 正文
  if (sub === "/sprite" && M === "POST") {
    let buf; try { buf = await readRaw(req, SPRITE_MAX + 1); } catch (e) { return send(res, e.code === "E413" ? 413 : 400, { ok: false, error: e.code === "E413" ? `图太大（最多 ${SPRITE_MAX / 1024}KB）` : "请求断了" }); }
    const pid = ALL.includes(String(q.get("who") || "")) ? String(q.get("who")) : HOST;
    const sz = pngSize(buf); if (!sz) return send(res, 400, { ok: false, error: "要 PNG 文件（正文直接放图片）" });
    if (sz.w !== SPRITE_W || sz.h !== SPRITE_H) return send(res, 400, { ok: false, error: `尺寸要 ${SPRITE_W}×${SPRITE_H}，这张是 ${sz.w}×${sz.h}` });
    fs.mkdirSync(SPRITES, { recursive: true }); const f = spriteFile(pid); const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, buf); fs.renameSync(t, f);
    return send(res, 200, { ok: true, who: pid, sprite: spriteOf(pid) });
  }
  if (sub === "/sprite" && M === "DELETE") { const pid = ALL.includes(String(q.get("who") || "")) ? String(q.get("who")) : HOST; try { fs.unlinkSync(spriteFile(pid)); } catch { /* 本来就没有 */ } return send(res, 200, { ok: true, who: pid, sprite: null }); }
  if (sub.startsWith("/sprite/") && M === "GET") {
    const pid = sub.slice("/sprite/".length); if (!ALL.includes(pid)) return send(res, 404, { ok: false, error: "没有这个人" });
    let buf; try { buf = fs.readFileSync(spriteFile(pid)); } catch { return send(res, 404, { ok: false, error: "没传过小人图" }); }
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable", "Access-Control-Allow-Origin": "*" }); res.end(buf); return;
  }

  let b = {};
  if (M === "POST" || M === "PUT") {
    let raw; try { raw = await readRaw(req, 2e6); } catch (e) { return send(res, e.code === "E413" ? 413 : 400, { ok: false, error: e.code === "E413" ? "太大了" : "请求断了" }); }
    let v; try { v = JSON.parse(raw.toString("utf8") || "{}"); } catch { return send(res, 400, { ok: false, error: "invalid json" }); }
    if (!v || typeof v !== "object" || Array.isArray(v)) return send(res, 400, { ok: false, error: "正文要是一个 JSON 对象" });
    b = v;
  }
  const s = load(); const now = Date.now(); const me = s.players[HOST];
  // 玩的人站在哪（前端轮询带 px / py / pd），进屋 / 农场带 sc
  if (q.get("px") != null && !/^(cabin|farm)$/.test(String(q.get("sc") || ""))) me.pos = { x: Number(q.get("px")) || 0, y: Number(q.get("py")) || 0, dir: Number(q.get("pd")) || 0, at: now, spot: me.spot || "pond" };
  if (q.get("sc") || q.get("px") != null) { const sc = String(q.get("sc") || ""); me.scene = /^(cabin|farm)$/.test(sc) ? { scene: sc, at: now, ...(q.get("px") != null ? { x: Number(q.get("px")) || 0, y: Number(q.get("py")) || 0, dir: Number(q.get("pd")) || 0 } : {}), ...(q.get("use") ? { use: String(q.get("use")).slice(0, 24) } : {}) } : null; }
  if ((me.spot || "pond") === "river") core.legendJoin(s, HOST);
  { const was = me.lastSeenAt || 0; me.lastSeenAt = now; if (now - was > 10 * 60000) note(s, { type: "arrive", who: HOST }); }
  const r = handle(s, sub, M, b, q, now);
  if (!r) return send(res, 404, { ok: false, error: "没有这个接口" });
  if (r.save !== false) save(s);
  return send(res, r.code || 200, r.body);
}

const ok = (body, extra = {}) => ({ code: 200, body: { ok: true, ...body }, ...extra });
const bad = (code, error, more = {}) => ({ code, body: { ok: false, error, ...more }, save: false });

function handle(s, sub, M, b, q, now) {
  const me = s.players[HOST];
  if (sub === "" && M === "GET") {
    const c = Object.values(s.casts).filter((x) => x.who === HOST && !x.done).sort((a, b2) => b2.at - a.at)[0]; let mine = null;
    if (c) { if (c.phase === "wait" && now >= c.biteAt + (c.biteMs || BITE_MS) + 500) { c.phase = "missed"; c.done = true; note(s, { type: "miss", who: HOST }); } mine = { castId: c.id, phase: c.phase === "wait" && now >= c.biteAt ? "bite" : c.phase, distance: c.distance, dir: c.dir }; }
    const v = view(s, mine); return ok({ ...v, wallet: shopView(me), mePos: me.pos || null, meScene: me.scene || null, away: null });
  }
  if (sub === "/open" && M === "POST") { s.open = b.open === true; note(s, { type: s.open ? "open" : "close", who: HOST }); return ok({ open: s.open }); }
  if (sub === "/trial" && M === "POST") { s.trial = b.on !== false; return ok({ trial: s.trial, spot: me.spot || "pond" }); }
  if (sub === "/cast" && M === "POST") {
    const power = Math.min(1, Math.max(0, Number(b.power) || 0.5));
    for (const x of Object.values(s.casts)) if (x.who === HOST && x.phase !== "fight") x.done = true;
    const pl = gearOf(me);
    if (bucketUsed(pl) >= bucketSize(pl)) return bad(409, `桶满了（${bucketUsed(pl)}/${bucketSize(pl)}），先去秤砣那儿卖掉，或者放生几条`);
    if (wormNo(pl)) return bad(409, wormNo(pl), { noBait: true });
    const bait = useBait(pl); const biteMs = BITE_MS + (charmOf(pl) === "card" ? 1000 : 0);
    const c = { id: `c${now.toString(36)}`, who: HOST, at: now, distance: Math.round(5 + power * 25), dir: Math.max(-1, Math.min(1, Number(b.dir) || 0)), biteAt: now + biteSecs(bait, weatherOf(s, pl.spot || "pond")) * 1000 * (1.15 - power * 0.3), biteMs, phase: "wait", fish: rollCatch(pl, bait, s), bait: bait.id };
    const keep = Object.fromEntries(Object.entries(s.casts).filter(([, x]) => (x.phase === "fight" && now - (x.fightAt || 0) < 120000) || (x.res && now - x.at < 600000)));
    s.casts = { ...keep, [c.id]: c }; note(s, { type: "cast", who: HOST });
    return ok({ castId: c.id, distance: c.distance, biteIn: Math.round(c.biteAt - now), biteMs, bait: bait.name, stars: charmOf(pl) === "glasses" ? c.fish.stars : undefined });
  }
  if (sub === "/hook" && M === "POST") {
    const c = s.casts[b.castId];
    if (c && !c.done && c.phase === "fight" && c.fight) return ok({ result: "hooked", fight: c.fight, hint: { rarity: c.fish.rarity, big: c.fish.kg > 2 } }, { save: false });
    if (!c || c.done) return bad(409, "这一竿已经结束了");
    if (now < c.biteAt - 400) { c.phase = "early"; c.done = true; return ok({ result: "early", note: "提早了，鱼吓跑了" }); }
    if (now > c.biteAt + (c.biteMs || BITE_MS) + 800) { c.phase = "missed"; c.done = true; return ok({ result: "missed", note: "慢了，鱼跑了" }); }
    c.phase = "fight"; c.fightAt = now; c.fight = core.fightParams(me, c.fish);
    return ok({ result: "hooked", fight: c.fight, hint: { rarity: c.fish.rarity, big: c.fish.kg > 2 } });
  }
  if (sub === "/land" && M === "POST") {
    const c = s.casts[b.castId];
    if (c && c.done && c.res) return { code: 200, body: c.res, save: false };
    if (!c || c.done || c.phase !== "fight") return bad(409, "这一竿不在拉鱼");
    c.done = true; const took = now - c.fightAt; const outcome = String(b.result || "");
    if (outcome !== "landed") { note(s, { type: outcome === "snapped" ? "snap" : "escape", who: HOST, name: c.fish.name, rarity: c.fish.rarity }); c.res = { ok: true, result: outcome === "snapped" ? "snapped" : "escaped", fish: { name: "？？？", rarity: c.fish.rarity, big: c.fish.kg > 2 } }; return { code: 200, body: c.res }; }
    if (took < c.fight.reelMs * 0.4) { c.done = false; return { code: 400, body: { ok: false, error: "收得太快了（前端计时对不上）", took, need: c.fight.reelMs } }; }
    const r = core.addCatch(s, HOST, c.fish); const sp = SPECIES.find((x) => x.id === c.fish.species);
    if (c.fish.rarity >= 3) for (const w of AIS) tell(s, w, `${nameOf(HOST)}钓到了 ${desc(c.fish)}！`);
    c.res = { ok: true, result: "landed", fish: r.item, sign: sp && sp.sign, first: r.mineFirst, record: r.record }; return { code: 200, body: c.res };
  }
  if (sub === "/use" && M === "POST") { const r = core.useItem(s, HOST, String(b.item || "")); if (r.error) return bad(409, r.error); return ok({ text: r.text, items: me.items || {} }); }
  if (sub === "/farm" || sub.startsWith("/farm/")) {
    if (!farmOn(s)) return bad(409, "农场没开");
    if (sub === "/farm" && M === "GET") return ok({ farm: farm.farmView(s), bag: farm.farmBag(s, HOST) });
    if (M !== "POST") return null;
    const act = sub.split("/").pop(); let r;
    if (act === "buy") r = farm.buySeed(s, HOST, String(b.seed || ""), b.n);
    else if (act === "plant") r = farm.plant(s, HOST, b.tile, b.seed ? String(b.seed) : null, b.plot != null ? String(b.plot) : null);
    else if (act === "shake") r = farm.shake(s, HOST);
    else if (act === "spout") r = farm.spout(s, HOST, String(b.to || HOST));
    else if (act === "harvest") r = farm.harvest(s, HOST, b.tile, b.plot != null ? String(b.plot) : null);
    else if (act === "water") r = farm.water(s, HOST, String(b.plot == null ? "" : b.plot));
    else if (act === "sign") r = farm.sign(s, HOST, b.text);
    else if (act === "sell") r = farm.sellCrop(s, HOST, b.id ? String(b.id) : null);
    else return bad(404, "没有这个动作");
    if (r.error) return bad(409, r.error);
    note(s, { type: "farm", who: HOST, cmd: act }); return ok({ ...r, farm: farm.farmView(s), bag: farm.farmBag(s, HOST) });
  }
  if (sub === "/legend" && M === "GET") { const since = Number(q.get("since")) || 0; const L = core.legendView(s); return ok({ legend: L, cheers: L ? (L.cheers || []).filter((c) => c.at > since) : [] }, { save: false }); }
  if (sub === "/legend/start" && M === "POST") {
    if ((me.spot || "pond") !== "river") return bad(409, "先去夜河");
    core.legendJoin(s, HOST); const r = core.legendStart(s); if (r.error) return bad(409, r.error);
    sys(s, `开始拉${s.legend.name}了！`); return ok({ fight: r.fight, legend: core.legendView(s) });
  }
  if (sub === "/legend/land" && M === "POST") {
    const L = s.legend;
    if (L && (L.phase === "won" || L.phase === "lost") && L.endedAt && now - L.endedAt < 600000) return ok({ result: L.phase, item: L.item, board: (s.legendBoard || []).slice(-10), again: true }, { save: false });
    const r = core.legendEnd(s, b.result === "landed" ? "landed" : "escaped", L && L.fightAt ? now - L.fightAt : 0);
    if (r.error) return { code: r.need ? 400 : 409, body: { ok: false, ...r }, save: false };
    sys(s, r.result === "won" ? `拉上来了！${L.name}。` : `${L.name}跑了……`); return { code: 200, body: r };
  }
  // 三人打赌（旧 POST /bet）、一对一打赌（GET /bet、/bet/start …）
  if (sub === "/bet" && M === "POST") { const r = core.betCreate(s, HOST, b); if (r.error) return bad(400, r.error); sys(s, `${nameOf(HOST)}开了一局「${r.bet.title}」，赌注：${r.bet.stake}。`); return ok({ bet: r.bet }); }
  if (sub === "/bet/answer" && M === "POST") { const r = core.betAnswer(s, HOST, String(b.id || "") || null, b.yes !== false); if (r.error) return bad(409, r.error); return ok({ bet: r.bet }); }
  if (sub === "/bet/pay" && M === "POST") { const r = core.betPay(s, HOST, String(b.id || "") || null); if (r.error) return bad(409, r.error); sys(s, `${nameOf(HOST)}把欠${nameOf(r.iou.to)}的「${r.iou.stake}」还了。`); return ok({ bet: r.bet }); }
  if (sub === "/bet" && M === "GET") return ok({ ...duel.view(s, !!q.get("all")) }, { save: false });
  if (["/bet/start", "/bet/cancel", "/bet/iou/paid", "/bet/iou/tear"].includes(sub) && M === "POST") {
    const act = sub.slice("/bet/".length);
    const r = act === "start" ? duel.start(s, b) : act === "cancel" ? duel.cancel(s) : act === "iou/paid" ? duel.paid(s, HOST, b.id, b.note) : duel.tear(s, HOST, b.id);
    if (r.error) return { code: r.code || 400, body: { ok: false, error: r.error, ...duel.view(s) }, save: false };
    if (act === "start") { note(s, { type: "duel", phase: "asking", with: r.bet.with, id: r.bet.id }); sys(s, `${nameOf(HOST)}跟${nameOf(r.bet.with)}打赌：${duel.KINDS[r.bet.kind]}，${duel.SPANS[r.bet.span]}，输的：${r.bet.stake}`); }
    else if (act === "cancel") note(s, { type: "duel", phase: "cancelled", with: r.bet.with, id: r.bet.id });
    else if (act === "iou/paid") { note(s, { type: "iou", phase: "paid", who: HOST, id: r.iou.id }); tell(s, r.iou.creditor, `收到，${r.iou.id} 号欠条撕了。`); const t = duel.tear(s, r.iou.creditor, r.iou.id); if (!t.error) note(s, { type: "iou", phase: "torn", who: r.iou.creditor, id: r.iou.id }); }
    else note(s, { type: "iou", phase: "torn", who: HOST, id: r.iou.id });
    return ok({ ...(r.iou ? { iou: r.iou } : {}), ...duel.view(s) });
  }
  if (sub === "/travel" && M === "POST") {
    const to = String(b.to || ""); if (!SPOT_NAME[to] && !(to === "river" && s.trial)) return bad(400, "那儿还没开放");
    if (to === "river" && !riverHour()) return bad(409, "夜河晚上 7 点才开门");
    for (const x of Object.values(s.casts)) if (x.who === HOST) x.done = true;
    const from = me.spot || "pond"; me.spot = to; me.pos = null; note(s, { type: "travel", who: HOST, from, to });
    return ok({ spot: to, name: SPOT_NAME[to] || "夜河", weather: weatherOf(s, to) });
  }
  if (sub === "/visit" && M === "POST") {
    const pl = gearOf(me); const day = core.shDate(); pl.pelGift = pl.pelGift || {}; let gift = null;
    if (pl.bait === "worm" && now - (pl.pelGift.emptyAt || 0) > 2 * 3600e3) { pl.baits.bread = (pl.baits.bread || 0) + 5; pl.bait = "bread"; pl.pelGift.emptyAt = now; gift = { kind: "empty", n: 5, name: "面包屑", line: "……拿去，过期的。" }; }
    else if (pl.pelGift.day !== day) { pl.baits.bread = (pl.baits.bread || 0) + 3; if (pl.bait === "worm") pl.bait = "bread"; pl.pelGift.day = day; gift = { kind: "daily", n: 3, name: "面包屑", line: "又来了。……过期的，拿去。" }; }
    if (gift) note(s, { type: "pelgift", who: HOST, name: gift.name, n: gift.n });
    return ok({ gift, wallet: shopView(pl) });
  }
  if ((sub === "/sell" || sub === "/buy" || sub === "/equip") && M === "POST") {
    const who = AIS.includes(b.from) ? b.from : HOST;
    const r = sub === "/sell" ? sellFish(s, who, b.fish || b.q) : sub === "/buy" ? buyItem(s, who, b.item, b.n) : equipItem(s, who, b.item, b.kind);
    return { code: r.error ? 400 : 200, body: { ok: !r.error, ...r, wallet: shopView(s.players[who]) } };
  }
  if (sub === "/act" && M === "POST") {
    const who = AIS.includes(b.from) ? b.from : HOST; const pl = s.players[who]; const idx = pl.bucket.findIndex((x) => x.id === b.fish); const fish = pl.bucket[idx];
    if (!fish) return bad(404, "鱼桶里没有这条");
    if (b.action === "show") { note(s, { type: "show", who, item: fish }); if (who === HOST) tell(s, pick(AIS), pick(["哇，好大。", "给我看看！", "不错啊。"])); }
    else if (b.action === "gift") { const to = String(b.to || ""); if (!s.players[to] || to === who) return bad(400, "to 要写别人的 id（不能送自己）"); pl.bucket.splice(idx, 1); s.players[to].bucket.push({ ...fish, giftFrom: who }); pl.gifted = (pl.gifted || 0) + 1; note(s, { type: "gift", who, to, item: fish }); if (AIS.includes(to)) tell(s, to, `谢谢，${desc(fish)}我收下了。`); }
    else if (b.action === "release") { pl.bucket.splice(idx, 1); note(s, { type: "release", who, item: fish }); }
    else return bad(400, "action 要写 show / gift / release");
    return ok({});
  }
  if (sub === "/cabin" && M === "GET") return ok({ ...core.cabinView(s) }, { save: false });
  if (sub === "/cabin/tank" && M === "POST") { const who = AIS.includes(b.from) ? b.from : HOST; const r = b.action === "take" ? core.tankTake(s, who, b.fish) : core.tankPut(s, who, b.fish); return { code: r.error ? 400 : 200, body: { ok: !r.error, ...r, cabin: core.cabinView(s) } }; }
  if (sub === "/cabin/place" && M === "POST") { const r = core.cabinPlace(s, String(b.slot || ""), b.item == null ? null : String(b.item)); return { code: r.error ? r.code || 400 : 200, body: r.error ? { ok: false, error: r.error, cabin: core.cabinView(s) } : { ok: true, ...r, cabin: core.cabinView(s) }, save: !r.error }; }
  if (sub === "/cabin/note" && M === "POST") { const who = AIS.includes(b.from) ? b.from : HOST; const r = core.cabinNote(s, who, b.text); return { code: r.error ? 400 : 200, body: { ok: !r.error, ...r, cabin: core.cabinView(s) }, save: !r.error }; }
  if (sub === "/cabin/layout" && M === "GET") { const l = s.cabinLayout || {}; return ok({ layout: l.items || {}, at: l.at || 0, by: l.by || null }, { save: false }); }
  if (sub === "/cabin/layout" && M === "POST") {
    const l = s.cabinLayout = s.cabinLayout || { items: {} }; if (b.reset) l.items = {};
    const moves = b.moves && typeof b.moves === "object" ? b.moves : {}; const num = (v) => (Number.isFinite(+v) ? Math.max(-100000, Math.min(100000, +v)) : null);
    for (const [k, v] of Object.entries(moves).slice(0, 200)) {
      if (!/^[A-Za-z0-9_.-]{1,48}$/.test(k)) continue; if (v === null) { delete l.items[k]; continue; }
      const x = num(v && v.x), y = num(v && v.y); if (x === null || y === null) continue;
      const sc = Number.isFinite(+v.s) ? Math.max(0.5, Math.min(2, +v.s)) : 1;
      l.items[k] = { room: String((v && v.room) || "").slice(0, 24), x, y, ...(sc !== 1 ? { s: sc } : {}), ...(v.hide ? { hide: true } : {}) };
    }
    if (Object.keys(l.items).length > 300) return bad(400, "家具太多了");
    l.at = now; l.by = HOST; return ok({ layout: l.items, at: l.at, by: HOST });
  }
  if (sub === "/ddz" || sub.startsWith("/ddz/")) {
    const act = sub.slice("/ddz".length).replace(/^\//, ""); const pid = AIS.includes(String(b.from || q.get("from") || "")) ? String(b.from || q.get("from")) : HOST;
    const [code, out, dirty] = ddzHome.route(s, act, M, pid, b, noTell, (t) => { note(s, { type: "ddz", text: t }); sys(s, t); });
    return { code, body: out, save: dirty };
  }
  if (sub === "/cards" && M === "GET") return ok({ open: cardsOn(s), ...cards.view(s, HOST) }, { save: false });
  if (["new", "answer", "play", "favor"].some((x) => sub === `/cards/${x}`) && M === "POST") {
    const act = sub.split("/").pop(); let r;
    if (act === "new") r = cards.create(s, HOST, [HOST, ...(Array.isArray(b.with) ? b.with : AIS).filter((w) => AIS.includes(w))], cardOpts());
    else if (act === "answer") r = cards.answer(s, HOST, b.yes !== false, cardOpts());
    else if (act === "play") { r = cards.play(s, HOST, b.card, cardOpts()); if (r.result) sys(s, r.result.text); }
    else r = cards.favor(s, HOST, b.from);
    return { code: r.error ? 400 : 200, body: r.error ? { ok: false, error: r.error, ...cards.view(s, HOST) } : { ok: true, result: r.result || null, ...cards.view(s, HOST) }, save: !r.error };
  }
  if (sub === "/chat" && M === "GET") { const since = Number(q.get("since")) || 0; return ok({ chat: s.chat.filter((m) => m.at > since).slice(-100) }, { save: false }); }
  if (sub === "/chat" && M === "POST") {
    const text = clean(b.text, 300); if (!text) return bad(400, "说点什么");
    chat(s, HOST, text); const w = pick(AIS); if (w && Math.random() < 0.7) setTimeout(() => { try { const s2 = load(); tell(s2, w, pick(CHAT_LINES)); save(s2); } catch { /* 下次再说 */ } }, rnd(2, 6) * 1000);
    return ok({ chat: s.chat.slice(-100) });
  }
  return null;
}

if (require.main === module) {
  fs.mkdirSync(DATA, { recursive: true });
  const srv = http.createServer((req, res) => { route(req, res).catch((e) => { try { send(res, 500, { ok: false, error: String(e && e.message || e) }); } catch { /* 已经回过 */ } }); });
  srv.listen(PORT, HOSTNAME, () => console.log(`[little-world solo] http://${HOSTNAME}:${PORT}${PREFIX}  data=${DATA}`));
  setInterval(() => { try { worldTick(); } catch (e) { console.error("tick:", e.message); } }, 2000);
}
module.exports = { route, handle, worldTick, view, load, save, pngSize, PREFIX };
