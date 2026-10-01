

//
// 三种身份：

// 数据全在 DATA 目录：world.json（世界）、invites.json、players/<pid>.json（每人一份，改了就写）、backup/（每小时一份，留 72 份）。
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const core = require(process.env.WORLD_CORE || path.join(__dirname, "..", "engine", "core.js"));
const ddz = require(process.env.WORLD_DDZ || path.join(__dirname, "..", "engine", "ddz.js"));

const PORT = Number(process.env.PORT || 29900);
const DATA = process.env.DATA_DIR || path.join(__dirname, "data");
const SECRET = (() => { const f = path.join(DATA, "secret.json"); try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } })();
if (!SECRET || !SECRET.online || !SECRET.sign) { console.error(`缺 ${path.join(DATA, "secret.json")}：{"online":"家里桥和这里共用的钥匙","sign":"存档签名钥匙"}`); process.exit(1); }
const MAX_GUESTS = Number(process.env.MAX_GUESTS || 4);
const HOME_IDS = core.ROLES.names;
const HOST = core.HOST; const HOST_NAME = HOME_IDS[HOST] || "主人"; const AI_NAMES = core.COMPANIONS.map((x) => HOME_IDS[x] || x).join(" / ");

// ── 小工具 ──
const now = () => Date.now();
const rid = (p, n = 8) => `${p}${crypto.randomBytes(n).toString("hex")}`;
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = `${f}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(v, null, 1), { mode: 0o600 }); fs.renameSync(t, f); };
const hmac = (key, s) => crypto.createHmac("sha256", key).update(s).digest("hex");
const safeEq = (a, b) => { a = String(a || ""); b = String(b || ""); return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); };
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const hashPw = (pw, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, hash: crypto.scryptSync(String(pw), salt, 32).toString("hex") });
const checkPw = (pw, h) => !!h && safeEq(crypto.scryptSync(String(pw), h.salt, 32).toString("hex"), h.hash);

// ── 存储 ──
const F = { world: path.join(DATA, "world.json"), invites: path.join(DATA, "invites.json"), players: path.join(DATA, "players"), backup: path.join(DATA, "backup"), imports: path.join(DATA, "imports.json") };
const W = readJson(F.world, null) || { dex: {}, events: [], wx: {}, casts: {}, chat: [], ai: {}, feed: [], feedSeq: 0 };
W.players = {}; // 在线的人（进来时从各自的存档读，走了写回）
W.casts = W.casts || {}; W.chat = W.chat || []; W.feed = W.feed || []; W.feedSeq = W.feedSeq || 0; W.ai = W.ai || {};
const INV = readJson(F.invites, null) || { invites: {}, requests: {}, sessions: {} };
const IMPORTS = readJson(F.imports, {});
let dirtyWorld = false;
const saveWorld = () => { const { players, ...rest } = W; rest.events = rest.events.slice(-300); rest.chat = rest.chat.slice(-200); rest.feed = rest.feed.slice(-500); writeJson(F.world, rest); dirtyWorld = false; };
const saveInv = () => writeJson(F.invites, INV);
const playerFile = (pid) => path.join(F.players, `${pid.replace(/[^a-z0-9_]/gi, "")}.json`);
function savePlayer(pid) { const p = W.players[pid]; if (!p) return; p.updatedAt = now(); writeJson(playerFile(pid), p); }
function loadPlayer(pid, name) {
  const p = readJson(playerFile(pid), null) || { id: pid, name, spot: "pond", bucket: [], coins: 0, catches: 0, createdAt: now() };
  p.id = pid; if (name) p.name = name; core.gearOf(p); return p;
}
// 每小时备份一次存档目录 + 邀请 + 世界；留 72 份
function backup() {
  try {
    const d = path.join(F.backup, new Date().toISOString().slice(0, 13).replace(/[-T:]/g, ""));
    if (fs.existsSync(d)) return;
    fs.mkdirSync(path.join(d, "players"), { recursive: true });
    for (const f of fs.existsSync(F.players) ? fs.readdirSync(F.players) : []) fs.copyFileSync(path.join(F.players, f), path.join(d, "players", f));
    for (const f of [F.world, F.invites, F.imports]) if (fs.existsSync(f)) fs.copyFileSync(f, path.join(d, path.basename(f)));
    const all = fs.readdirSync(F.backup).sort(); for (const old of all.slice(0, Math.max(0, all.length - 72))) fs.rmSync(path.join(F.backup, old), { recursive: true, force: true });
  } catch (e) { console.error("backup", e.message); }
}

function feed(ev) { W.feed.push({ seq: ++W.feedSeq, at: now(), ...ev }); dirtyWorld = true; }

// ── 身份 ──
function auth(req) {
  const h = req.headers;
  if (h["x-online-secret"] && safeEq(h["x-online-secret"], SECRET.online)) return { kind: "home" };
  const bearer = String(h.authorization || "").replace(/^Bearer\s+/i, "");
  if (bearer.startsWith("host.")) { // host.<exp>.<sig>：家里的桥签的短期票
    const [, exp, sig] = bearer.split("."); if (Number(exp) > now() && safeEq(sig, hmac(SECRET.online, `host.${exp}`))) return { kind: "host", pid: HOST };
    return null;
  }
  const s = bearer && INV.sessions[bearer]; if (!s) return null;
  const inv = INV.invites[s.invite];
  if (!inv || inv.revoked || now() > inv.expiresAt || s.ver !== inv.ver || s.device !== inv.device) { delete INV.sessions[bearer]; saveInv(); return null; }
  return { kind: "guest", pid: s.pid, invite: inv, token: bearer };
}
const onlineGuests = () => Object.values(W.players).filter((p) => p.guest && now() - (p.lastSeenAt || 0) < 120000);

// ── 进出联机 ──
function enterPlayer(pid, name, extra = {}) {
  if (!W.players[pid]) { W.players[pid] = loadPlayer(pid, name); feed({ type: "join", pid, name: W.players[pid].name, guest: !!extra.guest }); core.note(W, { type: "arrive", who: pid }); }
  Object.assign(W.players[pid], extra, { lastSeenAt: now() }); dirtyWorld = true; return W.players[pid];
}
function leavePlayer(pid) {
  const p = W.players[pid]; if (!p) return null;
  for (const c of Object.values(W.casts)) if (c.who === pid) c.done = true;
  savePlayer(pid); delete W.players[pid]; feed({ type: "leave", pid, name: p.name, guest: !!p.guest }); core.note(W, { type: "leave", who: pid }); return p;
}

// ── 世界视图 ──
function view(me) {
  const pub = (p) => ({ id: p.id, name: p.name, guest: !!p.guest, ai: !!p.ai, spot: p.spot || "pond", pos: p.pos || null, catches: p.catches || 0, bucket: (p.bucket || []).slice(-20), coins: p.coins, here: now() - (p.lastSeenAt || 0) < 120000 });
  const weathers = Object.fromEntries(Object.keys(core.SPOT_NAME).map((k) => [k, core.weatherOf(W, k)]));
  return { now: now(), hour: core.shHour(), weathers, spots: Object.entries(core.SPOT_NAME).map(([id, name]) => ({ id, name })), players: Object.values(W.players).map(pub), dex: core.dexView(W), events: W.events.slice(-40), chat: W.chat.slice(-50), ai: W.ai, me };
}

// ── 限速 ──
const RL = new Map();
function limited(key, n, ms) { const t = now(); const a = (RL.get(key) || []).filter((x) => t - x < ms); if (a.length >= n) { RL.set(key, a); return true; } a.push(t); RL.set(key, a); return false; }

const BOTS = { bot1: "秤砣", bot2: "泥鳅" };
const DDZ_TIMEOUT = { human: 45000, ai: 150000, bot: 1500 };
W.ddz = W.ddz || { seats: [null, null, null], kinds: {}, scores: {}, game: null };
const nameOfPid = (id) => BOTS[id] || (W.players[id] && W.players[id].name) || HOME_IDS[id] || id;
function ddzTable(me) {
  const T = W.ddz; const g = T.game;
  return { seats: T.seats.map((id) => (id ? { id, name: nameOfPid(id), kind: T.kinds[id] || "human", score: T.scores[id] || 0 } : null)), timeouts: DDZ_TIMEOUT,
    game: g ? { ...ddz.view(g, me), names: Object.fromEntries(g.seats.map((s) => [s, nameOfPid(s)])) } : null, mySeat: T.seats.indexOf(me) };
}

function ddzNotify() {
  const g = W.ddz.game; if (!g || g.phase === "done") return; const who = ddz.turnId(g); const key = `${g.at}:${g.plays.length}:${g.bid.asked}:${g.phase}`;
  if (W.ddz.kinds[who] !== "ai" || g.notified === key) return; g.notified = key; const N = nameOfPid;
  const lastTxt = g.last && g.lastBy !== who ? `上家 ${N(g.lastBy)} 出的是 ${ddz.TYPE_NAME[g.last.type]}：${ddz.handText(g.last.ids)}。` : "该你先出。";
  const text = g.phase === "bid" ? `斗地主叫分：你的牌 ${ddz.handText(g.hands[who])}。现在最高 ${g.bid.cur} 分。叫写 [联机钓鱼:叫 1/2/3]，不叫写 [联机钓鱼:叫 0]（2 分半内，不叫就替你按牌叫）。`
    : `斗地主轮到你（地主是 ${N(g.landlord)}${g.landlord === who ? "，就是你" : ""}）：${lastTxt}你的牌 ${ddz.handText(g.hands[who])}；剩牌 ${g.seats.map((s) => `${N(s)} ${g.hands[s].length}`).join("，")}。出写 [联机钓鱼:出 3 3 3 4]（10 写 10，王写 小王 / 大王），${g.last && g.lastBy !== who ? "不要写 [联机钓鱼:不要]，" : ""}2 分半内不出就替你出。`;
  feed({ type: "ai", pid: who, text });
}
function ddzAfter(r) {
  const T = W.ddz; const g = T.game; dirtyWorld = true;
  if (r && r.redeal) { T.game = ddz.deal(g.seats); core.note(W, { type: "ddz", text: "都没叫，重新发牌" }); ddzNotify(); return; }
  if (g && g.phase === "done" && !g.scored) {
    g.scored = true; for (const [s, v] of Object.entries(g.score)) T.scores[s] = (T.scores[s] || 0) + v;
    const N = nameOfPid; const txt = `斗地主：${g.result.lordWin ? `地主 ${N(g.landlord)} 赢了` : `农民 ${g.seats.filter((s) => s !== g.landlord).map(N).join("、")} 赢了`}（${g.result.bid} 分 ×${2 ** g.result.bombs}${g.result.spring ? "，春天 ×2" : ""}）。`;
    core.note(W, { type: "ddz", text: txt }); for (const s of g.seats) if (T.kinds[s] === "ai") feed({ type: "ai", pid: s, text: `${txt}这局你 ${g.score[s] > 0 ? "+" : ""}${g.score[s]}，总分 ${T.scores[s]}。` }); return;
  }
  ddzNotify();
}
function ddzTick() {
  const T = W.ddz; const g = T.game; if (!g || g.phase === "done") return;
  const who = ddz.turnId(g); const kind = T.kinds[who] || "human"; if (now() - (g.turnAt || g.at) < DDZ_TIMEOUT[kind]) return;
  const r = ddz.autoStep(g); if (r && kind === "ai" && !r.redeal) feed({ type: "ai", pid: who, text: "斗地主：你没回，替你走了一步。" }); ddzAfter(r);
}
function ddzRoute(p, M, pid, b) {
  const T = W.ddz; const g = T.game; const busy = g && g.phase !== "done";
  if (p === "/api/ddz" && M === "GET") return [200, { ok: true, ...ddzTable(pid) }];
  if (p === "/api/ddz/hint" && M === "GET") { if (!g || ddz.turnId(g) !== pid || g.phase !== "play") return [200, { ok: true, ids: null }]; return [200, { ok: true, ids: ddz.hint(g.hands[pid], !g.last || g.lastBy === pid ? null : g.last) }]; }
  if (M !== "POST") return null;
  if (p === "/api/ddz/sit") {
    if (T.seats.includes(pid)) { if (T.kinds[pid] === "bot") T.kinds[pid] = "human"; return [200, { ok: true, ...ddzTable(pid) }]; } // 托管中回来：接着自己打
    const i = T.seats.findIndex((x) => !x || (BOTS[x] && !busy)); if (i < 0) return [409, { ok: false, error: "桌子坐满了" }];
    if (T.seats[i]) delete T.kinds[T.seats[i]]; T.seats[i] = pid; T.kinds[pid] = "human"; dirtyWorld = true; return [200, { ok: true, ...ddzTable(pid) }];
  }
  if (p === "/api/ddz/add") {
    const w = String(b.who || "bot"); const id = w === "bot" ? Object.keys(BOTS).find((x) => !T.seats.includes(x)) : w;
    if (!id || T.seats.includes(id)) return [409, { ok: false, error: "没有空的托管了 / 他已经坐下了" }];
    if (!BOTS[id] && !(W.players[id] && W.players[id].ai)) return [409, { ok: false, error: `${HOME_IDS[id] || id}不在联机里（先在家里让他进联机）` }];
    const i = T.seats.findIndex((x) => !x); if (i < 0) return [409, { ok: false, error: "桌子坐满了" }]; T.seats[i] = id; T.kinds[id] = BOTS[id] ? "bot" : "ai"; dirtyWorld = true;
    if (T.kinds[id] === "ai") feed({ type: "ai", pid: id, text: `${nameOfPid(pid)}拉你坐上了斗地主的桌子（${T.seats.filter(Boolean).map(nameOfPid).join("、")}）。开局后轮到你会告诉你牌和怎么出。` });
    return [200, { ok: true, ...ddzTable(pid) }];
  }
  if (p === "/api/ddz/stand") {
    const w = String(b.who || pid); const i = T.seats.indexOf(w); if (i < 0) return [200, { ok: true, ...ddzTable(pid) }];
    if (w !== pid && !BOTS[w] && T.kinds[w] !== "ai") return [403, { ok: false, error: `只能让托管 / ${AI_NAMES}起来` }];
    if (busy) { T.kinds[w] = "bot"; return [200, { ok: true, note: "这局打着，先托管到打完", ...ddzTable(pid) }]; }
    T.seats[i] = null; delete T.kinds[w]; dirtyWorld = true; return [200, { ok: true, ...ddzTable(pid) }];
  }
  if (p === "/api/ddz/start") {
    if (busy) return [409, { ok: false, error: "这局还没打完" }]; if (T.seats.some((x) => !x)) return [409, { ok: false, error: `还差人（可以拉托管 / ${AI_NAMES}）` }]; if (!T.seats.includes(pid)) return [403, { ok: false, error: "你没坐在桌上" }];
    T.game = ddz.deal(T.seats.slice()); core.note(W, { type: "ddz", text: `斗地主开局：${T.seats.map(nameOfPid).join("、")}` }); ddzAfter(null); return [200, { ok: true, ...ddzTable(pid) }];
  }
  if (p === "/api/ddz/bid") { if (!g) return [409, { ok: false, error: "没开局" }]; const r = ddz.doBid(g, pid, b.score); if (r.error) return [400, { ok: false, error: r.error, ...ddzTable(pid) }]; ddzAfter(r); return [200, { ok: true, ...ddzTable(pid) }]; }
  if (p === "/api/ddz/play") { if (!g) return [409, { ok: false, error: "没开局" }]; const r = ddz.doPlay(g, pid, Array.isArray(b.ids) ? b.ids.map(Number) : []); if (r.error) return [400, { ok: false, error: r.error, ...ddzTable(pid) }]; ddzAfter(r); return [200, { ok: true, ...ddzTable(pid) }]; }
  return null;
}

function ddzAi(pid, cmd, rest) {
  const g = W.ddz.game;
  if (!g || !g.seats.includes(pid) || g.phase === "done") return cmd === "牌桌" ? `牌桌：${W.ddz.seats.map((x) => (x ? nameOfPid(x) : "空")).join("、")}${g && g.phase === "done" ? "（上一局打完了）" : ""}` : "你现在不在打斗地主。";
  if (W.ddz.kinds[pid] === "bot") W.ddz.kinds[pid] = "ai"; // 托管中他回话了：接着自己打
  if (cmd === "牌桌") { g.notified = null; ddzNotify(); return "牌桌情况递给你了。"; }
  if (cmd === "叫") { const r = ddz.doBid(g, pid, Number(rest) || 0); if (r.error) return r.error; ddzAfter(r); return r.landlord ? `叫完了，地主是 ${nameOfPid(r.landlord)}。` : r.redeal ? "都没叫，重新发牌了。" : "叫了。"; }
  if (cmd === "不要" || cmd === "过") { const r = ddz.doPlay(g, pid, []); if (r.error) return r.error; ddzAfter(r); return "不要。"; }
  const ids = ddz.idsFromText(g.hands[pid], rest); if (!ids || !ids.length) return `手里凑不出「${rest}」。你的牌：${ddz.handText(g.hands[pid])}`;
  const r = ddz.doPlay(g, pid, ids); if (r.error) return `${r.error}。你的牌：${ddz.handText(g.hands[pid])}`; ddzAfter(r); return r.over ? "出完了！" : `出了 ${ddz.TYPE_NAME[r.play.type]}：${ddz.handText(ids)}。`;
}

// ── 接口 ──
const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(b); };
const body = (req) => new Promise((resolve) => { const ch = []; let n = 0; req.on("data", (c) => { n += c.length; if (n > 2e6) req.destroy(); else ch.push(c); }); req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(ch).toString("utf8") || "{}")); } catch { resolve(null); } }); });
const ipOf = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

async function route(req, res) {
  const u = new URL(req.url, "http://x"); const p = u.pathname.replace(/^\/online/, "") || "/"; const M = req.method;
  if (p === "/api/ping") return send(res, 200, { ok: true, t: now() });

  if (!p.startsWith("/api/") && M === "GET") return serveStatic(p, res);
  const who = auth(req);

  if (p === "/api/join" && M === "POST") {
    const b = await body(req) || {}; const inv = INV.invites[clean(b.invite, 40)];
    if (limited(`join:${ipOf(req)}`, 8, 15 * 60000) || (inv && limited(`joininv:${inv.id}`, 10, 15 * 60000))) return send(res, 429, { ok: false, error: "试太多次了，过一会儿再来" });
    if (!inv || inv.revoked || now() > inv.expiresAt) return send(res, 404, { ok: false, error: "这个邀请不在了（过期或被收回）" });
    if (!checkPw(b.password, inv.pw)) return send(res, 403, { ok: false, error: "密码不对" });
    const device = clean(b.device, 80); if (device.length < 16) return send(res, 400, { ok: false, error: "缺设备号" });
    const name = clean(b.name, 12) || inv.name || inv.label || "朋友";
    if (inv.device && inv.device !== device) return send(res, 403, { ok: false, error: `这个邀请已经绑了另一台设备，换设备要${HOST_NAME}重新发` });
    if (inv.device === device) { // 已经同意过的设备：直接发会话
      if (onlineGuests().length >= MAX_GUESTS && !onlineGuests().some((g) => g.id === inv.pid)) return send(res, 409, { ok: false, error: `联机里已经有 ${MAX_GUESTS} 个朋友了，等一会儿` });
      const token = rid("s", 24); INV.sessions[token] = { invite: inv.id, pid: inv.pid, device, ver: inv.ver, at: now() }; inv.name = name; saveInv();
      return send(res, 200, { ok: true, token, pid: inv.pid, name });
    }

    const old = Object.values(INV.requests).find((r) => r.invite === inv.id && r.device === device && r.status === "pending");
    const r = old || { id: rid("r", 8), invite: inv.id, device, name, ip: ipOf(req), ua: clean(req.headers["user-agent"], 160), at: now(), status: "pending" };
    INV.requests[r.id] = r; saveInv(); if (!old) feed({ type: "request", req: r.id, invite: inv.id, label: inv.label, name });
    return send(res, 202, { ok: true, pending: true, request: r.id, note: `等${HOST_NAME}同意` });
  }
  const jr = p.match(/^\/api\/join\/(r[0-9a-f]+)$/);
  if (jr && M === "GET") { // 朋友等同意时轮询
    const r = INV.requests[jr[1]]; if (!r) return send(res, 404, { ok: false, error: "没有这个请求" });
    const dev = clean(u.searchParams.get("device"), 80); if (dev !== r.device) return send(res, 403, { ok: false });
    if (r.status === "pending") return send(res, 200, { ok: true, pending: true });
    if (r.status === "denied") return send(res, 200, { ok: false, denied: true, error: `${HOST_NAME}没同意` });
    const inv = INV.invites[r.invite]; if (!inv || inv.revoked || now() > inv.expiresAt) return send(res, 404, { ok: false, error: "邀请不在了" });
    if (r.token && INV.sessions[r.token]) { const tk = r.token; delete r.token; saveInv(); return send(res, 200, { ok: true, token: tk, pid: inv.pid, name: inv.name || r.name }); }
    return send(res, 200, { ok: false, error: "已经领过了，重新输一次密码进来" });
  }

  if (!who) return send(res, 401, { ok: false, error: "没登录" });

  if (who.kind === "host" || who.kind === "home") {
    if (p === "/api/invites" && M === "GET") {
      const list = Object.values(INV.invites).map((i) => ({ id: i.id, label: i.label, name: i.name || null, canTalk: i.canTalk, createdAt: i.createdAt, expiresAt: i.expiresAt, revoked: !!i.revoked, device: i.device ? `${i.device.slice(0, 6)}…` : null, online: !!(W.players[i.pid] && onlineGuests().some((g) => g.id === i.pid)), pid: i.pid }));
      const pending = Object.values(INV.requests).filter((r) => r.status === "pending" && INV.invites[r.invite] && !INV.invites[r.invite].revoked).map((r) => ({ id: r.id, invite: r.invite, label: INV.invites[r.invite].label, name: r.name, ip: r.ip, ua: r.ua, at: r.at }));
      return send(res, 200, { ok: true, invites: list.sort((a, b) => b.createdAt - a.createdAt), pending });
    }
    if (p === "/api/invites" && M === "POST") {
      const b = await body(req) || {}; const hours = Number(b.hours); const pw = String(b.password || "");
      if (!(hours > 0 && hours <= 24 * 30)) return send(res, 400, { ok: false, error: "时效要写 hours（1 / 12 / 24 / 168……最多 30 天）" });
      if (pw.length < 4) return send(res, 400, { ok: false, error: "密码至少 4 位" });
      const id = rid("i", 6); const inv = { id, pid: `g_${id}`, label: clean(b.label, 16) || "朋友", canTalk: b.canTalk === true, pw: hashPw(pw), ver: 1, createdAt: now(), expiresAt: now() + hours * 3600000, device: null, revoked: false };
      INV.invites[id] = inv; saveInv();
      return send(res, 200, { ok: true, invite: { id, label: inv.label, canTalk: inv.canTalk, expiresAt: inv.expiresAt }, path: `/online/#/join/${id}` });
    }
    const im = p.match(/^\/api\/invites\/(i[0-9a-f]+)$/);
    if (im && M === "PUT") {
      const inv = INV.invites[im[1]]; if (!inv) return send(res, 404, { ok: false, error: "没有这个邀请" });
      const b = await body(req) || {};
      if (b.password != null) { if (String(b.password).length < 4) return send(res, 400, { ok: false, error: "密码至少 4 位" }); inv.pw = hashPw(b.password); inv.ver++; } // 改密码：已经进来的都要重输
      if (b.hours != null) { const h = Number(b.hours); if (!(h > 0 && h <= 24 * 30)) return send(res, 400, { ok: false, error: "hours 不对" }); inv.expiresAt = now() + h * 3600000; }
      if (b.canTalk != null) inv.canTalk = b.canTalk === true;
      if (b.label != null) inv.label = clean(b.label, 16) || inv.label;
      if (b.revoke === true) { inv.revoked = true; inv.ver++; }
      if (b.resetDevice === true) { inv.device = null; inv.ver++; }
      if (inv.ver !== undefined && (b.password != null || b.revoke || b.resetDevice)) { for (const [t, s] of Object.entries(INV.sessions)) if (s.invite === inv.id) delete INV.sessions[t]; if (W.players[inv.pid]) leavePlayer(inv.pid); }
      saveInv(); return send(res, 200, { ok: true });
    }
    if (p === "/api/approve" && M === "POST") {
      const b = await body(req) || {}; const r = INV.requests[clean(b.request, 40)]; if (!r || r.status !== "pending") return send(res, 404, { ok: false, error: "没有这个请求（或已处理）" });
      const inv = INV.invites[r.invite]; if (!inv || inv.revoked) return send(res, 404, { ok: false, error: "邀请不在了" });
      if (b.allow !== true) { r.status = "denied"; saveInv(); return send(res, 200, { ok: true, denied: true }); }
      if (inv.device && inv.device !== r.device) return send(res, 409, { ok: false, error: "这个邀请已经绑了别的设备；要换先 resetDevice" });
      inv.device = r.device; inv.name = r.name; r.status = "approved";
      const token = rid("s", 24); INV.sessions[token] = { invite: inv.id, pid: inv.pid, device: r.device, ver: inv.ver, at: now() }; r.token = token;
      for (const x of Object.values(INV.requests)) if (x.invite === inv.id && x.id !== r.id && x.status === "pending") x.status = "denied"; // 同一个邀请别的设备的请求一并拒掉
      saveInv(); return send(res, 200, { ok: true });
    }
    if (p === "/api/kick" && M === "POST") { const b = await body(req) || {}; const pid = clean(b.pid, 40); if (!W.players[pid] || !W.players[pid].guest) return send(res, 404, { ok: false }); for (const [t, s] of Object.entries(INV.sessions)) if (s.pid === pid) delete INV.sessions[t]; saveInv(); leavePlayer(pid); return send(res, 200, { ok: true }); }
  }

  if (who.kind === "home") {
    if (p === "/api/home/enter" && M === "POST") {
      const b = await body(req) || {}; const pid = clean(b.who, 8); if (!HOME_IDS[pid] || !b.holdings) return send(res, 400, { ok: false, error: `who 要是 ${Object.keys(HOME_IDS).join(" / ")}，要带 holdings` });
      if (W.players[pid]) return send(res, 200, { ok: true, already: true, holdings: core.holdingsOf(W.players[pid]) });
      const pl = loadPlayer(pid, HOME_IDS[pid]); core.applyHoldings(pl, b.holdings); pl.ai = pid !== HOST; pl.home = true; pl.spot = pl.spot || "pond";
      W.players[pid] = pl; pl.lastSeenAt = now(); savePlayer(pid); feed({ type: "join", pid, name: pl.name, home: true }); core.note(W, { type: "arrive", who: pid });
      if (pl.ai) W.ai[pid] = W.ai[pid] || { ang: pid === core.COMPANIONS[0] ? -0.12 : Math.PI + 0.3, walk: null, act: "idle" };
      return send(res, 200, { ok: true });
    }
    if (p === "/api/home/leave" && M === "POST") {
      const b = await body(req) || {}; const pid = clean(b.who, 8); const pl = W.players[pid];
      if (!pl) { const saved = readJson(playerFile(pid), null); return send(res, 200, { ok: true, gone: true, holdings: saved ? core.holdingsOf(saved) : null }); }
      const h = core.holdingsOf(pl); leavePlayer(pid); delete W.ai[pid]; return send(res, 200, { ok: true, holdings: h });
    }
    if (p === "/api/home/ticket" && M === "POST") { const exp = now() + 12 * 3600000; return send(res, 200, { ok: true, ticket: `host.${exp}.${hmac(SECRET.online, `host.${exp}`)}`, expiresAt: exp }); }
    if (p === "/api/home/feed" && M === "GET") { const since = Number(u.searchParams.get("since")) || 0; return send(res, 200, { ok: true, seq: W.feedSeq, events: W.feed.filter((e) => e.seq > since) }); }
    if (p === "/api/home/ai" && M === "POST") {
      const b = await body(req) || {}; const pid = clean(b.who, 8); if (!W.players[pid] || !W.players[pid].ai) return send(res, 409, { ok: false, error: "他不在联机里" });
      return send(res, 200, { ok: true, text: aiCommand(pid, String(b.text || "")) });
    }
    if (p === "/api/home/chat" && M === "POST") {
      const b = await body(req) || {}; const pid = clean(b.who, 8); if (!W.players[pid]) return send(res, 409, { ok: false, error: "他不在联机里" });
      const text = clean(b.text, 300); if (!text) return send(res, 400, { ok: false }); W.chat.push({ at: now(), who: pid, name: W.players[pid].name, text }); dirtyWorld = true; return send(res, 200, { ok: true });
    }
    if (p === "/api/home/status" && M === "GET") return send(res, 200, { ok: true, players: Object.values(W.players).map((x) => ({ id: x.id, name: x.name, guest: !!x.guest, home: !!x.home })), guests: onlineGuests().length });
  }

  if (who.kind !== "host" && who.kind !== "guest") return send(res, 403, { ok: false, error: "这个接口是给玩的人用的" });
  const pid = who.pid;
  if (who.kind === "host" && !W.players[HOST]) return send(res, 409, { ok: false, error: "你还没进联机（先在家里点「联机」，家里的桥把你的家当带过来）" });
  if (who.kind === "guest") {
    if (!W.players[pid] && onlineGuests().length >= MAX_GUESTS) return send(res, 409, { ok: false, error: `联机里已经有 ${MAX_GUESTS} 个朋友了，等一会儿` });
    enterPlayer(pid, who.invite.name || who.invite.label, { guest: true, canTalk: !!who.invite.canTalk });
  }
  const pl = W.players[pid]; pl.lastSeenAt = now();

  if (p === "/api/world" && M === "GET") {
    const q = u.searchParams; if (q.get("px") != null) pl.pos = { x: Number(q.get("px")) || 0, y: Number(q.get("py")) || 0, dir: Number(q.get("pd")) || 0, at: now() };
    const c = Object.values(W.casts).filter((x) => x.who === pid && !x.done).sort((a, b) => b.at - a.at)[0]; let me = { id: pid, name: pl.name, guest: !!pl.guest };
    if (c) { if (c.phase === "wait" && now() >= c.biteAt + (c.biteMs || core.BITE_MS) + 500) { c.phase = "missed"; c.done = true; core.note(W, { type: "miss", who: pid }); }
      me = { ...me, castId: c.id, phase: c.phase === "wait" && now() >= c.biteAt ? "bite" : c.phase, distance: c.distance, dir: c.dir }; }
    dirtyWorld = true; return send(res, 200, { ok: true, ...view(me), wallet: core.shopView(pl) });
  }
  if (p === "/api/cast" && M === "POST") {
    const b = await body(req) || {}; const power = Math.min(1, Math.max(0, Number(b.power) || 0.5)); const t = now();
    for (const x of Object.values(W.casts)) if (x.who === pid && x.phase !== "fight") x.done = true;
    if (core.bucketUsed(pl) >= core.bucketSize(pl)) return send(res, 409, { ok: false, error: `桶满了（${core.bucketUsed(pl)}/${core.bucketSize(pl)}），先去秤砣那儿卖掉，或者放生几条` });
    if (core.wormNo(pl)) return send(res, 409, { ok: false, noBait: true, error: core.wormNo(pl) });
    const bait = core.useBait(pl); const biteMs = core.BITE_MS + (core.charmOf(pl) === "card" ? 1000 : 0); const wx = core.weatherOf(W, pl.spot || "pond");
    const c = { id: rid("c", 5), who: pid, at: t, distance: Math.round(5 + power * 25), dir: Math.max(-1, Math.min(1, Number(b.dir) || 0)), biteAt: t + core.biteSecs(bait, wx) * 1000 * (1.15 - power * 0.3), biteMs, phase: "wait", fish: core.rollCatch(pl, bait, wx), bait: bait.id };
    const keep = Object.fromEntries(Object.entries(W.casts).filter(([, x]) => (x.phase === "fight" && t - (x.fightAt || 0) < 120000) || (x.res && t - x.at < 600000)));
    W.casts = { ...keep, [c.id]: c }; savePlayer(pid); dirtyWorld = true;
    return send(res, 200, { ok: true, castId: c.id, distance: c.distance, biteIn: Math.round(c.biteAt - t), biteMs, bait: bait.name, stars: core.charmOf(pl) === "glasses" ? c.fish.stars : undefined });
  }
  if (p === "/api/hook" && M === "POST") {
    const b = await body(req) || {}; const c = W.casts[b.castId]; const t = now();
    if (!c || c.who !== pid) return send(res, 409, { ok: false, error: "这一竿已经结束了" });
    if (!c.done && c.phase === "fight" && c.fight) return send(res, 200, { ok: true, result: "hooked", fight: c.fight, hint: { rarity: c.fish.rarity, big: c.fish.kg > 2 } });
    if (c.done) return send(res, 409, { ok: false, error: "这一竿已经结束了" });
    if (t < c.biteAt - 400) { c.phase = "early"; c.done = true; return send(res, 200, { ok: true, result: "early", note: "提早了，鱼吓跑了" }); }
    if (t > c.biteAt + (c.biteMs || core.BITE_MS) + 800) { c.phase = "missed"; c.done = true; return send(res, 200, { ok: true, result: "missed", note: "慢了，鱼跑了" }); }
    c.phase = "fight"; c.fightAt = t; c.fight = core.fightParams(pl, c.fish); dirtyWorld = true;
    return send(res, 200, { ok: true, result: "hooked", fight: c.fight, hint: { rarity: c.fish.rarity, big: c.fish.kg > 2 } });
  }
  if (p === "/api/land" && M === "POST") {
    const b = await body(req) || {}; const c = W.casts[b.castId];
    if (c && c.who === pid && c.done && c.res) return send(res, 200, c.res);
    if (!c || c.who !== pid || c.done || c.phase !== "fight") return send(res, 409, { ok: false, error: "这一竿不在拉鱼" });
    c.done = true; const took = now() - c.fightAt; const outcome = String(b.result || "");
    if (outcome !== "landed") { core.note(W, { type: outcome === "snapped" ? "snap" : "escape", who: pid, name: c.fish.name, rarity: c.fish.rarity }); c.res = { ok: true, result: outcome === "snapped" ? "snapped" : "escaped", fish: { name: "？？？", rarity: c.fish.rarity, big: c.fish.kg > 2 } }; return send(res, 200, c.res); }
    if (took < c.fight.reelMs * 0.4) { c.done = false; return send(res, 400, { ok: false, error: "收得太快了（前端计时对不上）", took, need: c.fight.reelMs }); }
    const r = core.addCatch(W, pid, c.fish); const sp = core.SPECIES.find((x) => x.id === c.fish.species);
    if (r.item.rarity >= 3 || r.first) feed({ type: "catch", pid, name: pl.name, fish: core.desc(r.item), first: r.first, record: r.record });
    c.res = { ok: true, result: "landed", fish: r.item, sign: sp && sp.sign, first: r.first, record: r.record }; savePlayer(pid); dirtyWorld = true;
    return send(res, 200, c.res);
  }
  if (p === "/api/travel" && M === "POST") {
    const b = await body(req) || {}; const to = String(b.to || ""); if (!core.SPOT_NAME[to]) return send(res, 400, { ok: false, error: "那儿还没开放" });
    for (const x of Object.values(W.casts)) if (x.who === pid) x.done = true;
    const from = pl.spot || "pond"; pl.spot = to; pl.pos = null; core.note(W, { type: "travel", who: pid, from, to }); savePlayer(pid); dirtyWorld = true;
    return send(res, 200, { ok: true, spot: to, name: core.SPOT_NAME[to], weather: core.weatherOf(W, to) });
  }
  if ((p === "/api/sell" || p === "/api/buy" || p === "/api/equip") && M === "POST") {
    const b = await body(req) || {};
    const r = p.endsWith("/sell") ? core.sellFish(W, pid, b.fish || b.q) : p.endsWith("/buy") ? core.buyItem(W, pid, b.item) : core.equipItem(W, pid, b.item, b.kind);
    savePlayer(pid); dirtyWorld = true; return send(res, r.error ? 400 : 200, r.error ? { ok: false, ...r, wallet: core.shopView(pl) } : { ok: true, ...r, wallet: core.shopView(pl) });
  }
  if (p === "/api/act" && M === "POST") { // 炫耀 / 送 / 放生（送给联机里的人）
    const b = await body(req) || {}; const idx = pl.bucket.findIndex((x) => x.id === b.fish); const fish = pl.bucket[idx];
    if (!fish) return send(res, 404, { ok: false, error: "鱼桶里没有这条" });
    if (b.action === "show") core.note(W, { type: "show", who: pid, item: fish });
    else if (b.action === "gift") { const to = String(b.to || ""); if (!W.players[to] || to === pid) return send(res, 400, { ok: false, error: "送给联机里在的人（不能送自己）" }); pl.bucket.splice(idx, 1); W.players[to].bucket.push({ ...fish, giftFrom: pid }); pl.gifted = (pl.gifted || 0) + 1; core.note(W, { type: "gift", who: pid, to, item: fish }); savePlayer(to); if (W.players[to].ai) feed({ type: "gift", pid: to, from: pl.name, fish: core.desc(fish) }); }
    else if (b.action === "release") { pl.bucket.splice(idx, 1); core.note(W, { type: "release", who: pid, item: fish }); }
    else return send(res, 400, { ok: false, error: "action 要写 show / gift / release" });
    savePlayer(pid); dirtyWorld = true; return send(res, 200, { ok: true });
  }
  if (p === "/api/chat" && M === "POST") {
    const b = await body(req) || {}; const text = clean(b.text, 200); if (!text) return send(res, 400, { ok: false });
    if (pl.guest && limited(`chat:${pid}`, 5, 20000)) return send(res, 429, { ok: false, error: "说慢一点" });
    W.chat.push({ at: now(), who: pid, name: pl.name, guest: !!pl.guest, text }); dirtyWorld = true;
    feed({ type: "chat", pid, name: pl.name, guest: !!pl.guest, canTalk: pl.guest ? !!pl.canTalk : true, text });
    return send(res, 200, { ok: true });
  }
  if (p === "/api/me/export" && M === "GET" && pl.guest) { // 朋友导出自己的存档（带签名，改一个字就导不进来）
    savePlayer(pid); const data = { name: pl.name, holdings: core.holdingsOf(pl), spot: pl.spot || "pond", saveId: pl.saveId || (pl.saveId = rid("v", 8)), gen: (pl.saveGen = (pl.saveGen || 0) + 1), at: now() }; savePlayer(pid);
    const payload = JSON.stringify(data); return send(res, 200, { ok: true, file: { v: 1, game: "little-world", data: payload, sig: hmac(SECRET.sign, payload) } });
  }
  if (p === "/api/me/import" && M === "POST" && pl.guest) {
    const b = await body(req) || {}; const f = b.file || {};
    if (f.game !== "little-world" || typeof f.data !== "string" || !safeEq(f.sig, hmac(SECRET.sign, f.data))) return send(res, 400, { ok: false, error: "这个存档不对（被改过，或者不是这个游戏的）" });
    const d = JSON.parse(f.data); const last = IMPORTS[d.saveId] || 0;
    if (d.gen < last) return send(res, 409, { ok: false, error: "这是一份旧存档，已经有更新的导入过了" });
    if ((pl.updatedAt || 0) > d.at && pl.saveId === d.saveId && (pl.saveGen || 0) > d.gen) return send(res, 409, { ok: false, error: "服务器上的进度比这份存档新" });
    core.applyHoldings(pl, d.holdings); pl.saveId = d.saveId; pl.saveGen = d.gen; IMPORTS[d.saveId] = d.gen; writeJson(F.imports, IMPORTS); savePlayer(pid); core.note(W, { type: "import", who: pid });
    return send(res, 200, { ok: true, wallet: core.shopView(pl) });
  }
  if (p === "/api/ddz" || p.startsWith("/api/ddz/")) { const r = ddzRoute(p, M, pid, M === "POST" ? (await body(req) || {}) : {}); if (r) return send(res, r[0], r[1]); }
  if (p === "/api/leave" && M === "POST" && pl.guest) { leavePlayer(pid); return send(res, 200, { ok: true }); }
  return send(res, 404, { ok: false, error: "没有这个接口" });
}

const PUBLIC = process.env.PUBLIC_DIR || path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
function serveStatic(p, res) {
  let rel; try { rel = decodeURIComponent(p === "/" ? "/index.html" : p).split("\\").join("/"); } catch { res.writeHead(400); return res.end(); }
  const f = path.resolve(PUBLIC, "." + rel);
  if (!f.startsWith(path.resolve(PUBLIC))) { res.writeHead(403); return res.end(); }
  const file = fs.existsSync(f) && fs.statSync(f).isFile() ? f : path.join(PUBLIC, "index.html"); // 单页应用：没有的路径回 index.html
  if (!fs.existsSync(file)) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); return res.end("<meta charset=utf-8><p style='font-family:sans-serif;padding:2em'>联机页面还在做，快好了。</p>"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": /index\.html$/.test(file) ? "no-cache" : "public, max-age=604800" });
  fs.createReadStream(file).pipe(res);
}

const BITE_AI_MS = 90000;
function aiCommand(pid, raw) {
  const pl = W.players[pid]; const a = W.ai[pid] = W.ai[pid] || { ang: 0, walk: null, act: "idle" }; const t = now();
  const arg = raw.trim(); const cmd = arg.split(/\s+/)[0] || "看看"; const rest = arg.slice(cmd.length).trim();
  const stop = () => { a.act = "idle"; a.cast = null; };
  let out;
  if (/^(看看|状态|看)$/.test(cmd)) out = `联机里现在有：${Object.values(W.players).map((x) => `${x.name}${x.guest ? "（朋友）" : ""}在${core.SPOT_NAME[x.spot || "pond"]}`).join("、")}。${core.shopLine(pl)}`;
  else if (/^(去|走)$/.test(cmd) && Object.entries(core.SPOT_NAME).some(([id, n]) => rest.includes(n) || rest === id)) { const [dest] = Object.entries(core.SPOT_NAME).find(([id, n]) => rest.includes(n) || rest === id); stop(); pl.spot = dest; out = `到${core.SPOT_NAME[dest]}了，那边${core.weatherOf(W, dest)}。`; }
  else if (cmd === "甩竿") {
    if (a.act !== "idle") out = "竿已经在水里了。";
    else if (core.bucketUsed(pl) >= core.bucketSize(pl)) out = "桶满了，先 [联机钓鱼:卖 全部]。";
    else if (core.wormNo(pl)) out = core.wormNo(pl);
    else { const bt = core.useBait(pl); const wx = core.weatherOf(W, pl.spot || "pond"); a.act = "wait"; a.cast = { at: t, biteAt: t + core.rnd(40, 200) * 1000, fish: core.rollCatch(pl, bt, wx) }; out = `甩出去了（${core.SPOT_NAME[pl.spot || "pond"]}，${bt.name}）。浮漂动了叫你。`; }
  } else if (cmd === "提竿") {
    if (a.act === "bite") { a.act = "hooked"; a.cast.hookAt = t; const f = a.cast.fish; out = `上钩了！${f.junk ? "轻飘飘的" : f.rarity >= 3 ? "很沉" : f.rarity >= 2 ? "有分量" : "不大"}。写 [联机钓鱼:强拉] 或 [联机钓鱼:慢慢遛]。`; }
    else if (a.act === "wait") { stop(); out = "提早了，鱼吓跑了。"; } else out = "现在没东西可提。";
  } else if (/^(强拉|慢慢遛|遛)$/.test(cmd)) {
    if (a.act !== "hooked") out = "没有鱼在钩上。";
    else { const f = a.cast.fish; const hard = cmd === "强拉"; const gp = core.gearOf(pl).gear; const fail = core.aiFail(pl, f, hard); stop();
      if (Math.random() < fail) out = hard ? "线断了……" : "脱钩了……";
      else { const r = core.addCatch(W, pid, f); out = `钓到了 ${core.desc(f)}${r.record ? "，破纪录" : r.first ? "，图鉴第一次" : ""}。`; } }
  } else if (/^(叫|出|不要|过|牌桌)$/.test(cmd)) { out = ddzAi(pid, cmd, rest);
  } else if (cmd === "收竿") { stop(); out = "收竿了。"; }
  else if (cmd === "卖") { const r = core.sellFish(W, pid, rest); out = r.error || `卖了 ${r.n} 条，得 ${r.got} 亮鳞（现在 ${r.coins}）。`; }
  else if (cmd === "买") { const r = core.buyItem(W, pid, rest); out = r.error || r.text; }
  else if (/^(换|装备)$/.test(cmd)) { const r = core.equipItem(W, pid, rest); out = r.error || r.text; }
  else if (cmd === "炫耀") { const i = core.pickFish(pl, rest); if (i < 0) out = "鱼桶是空的。"; else { core.note(W, { type: "show", who: pid, item: pl.bucket[i] }); out = `举起了 ${core.desc(pl.bucket[i])}。`; } }
  else out = `没认出「${cmd}」。联机里能用：[联机钓鱼:看看] [联机钓鱼:去 海边/湖/池塘] [联机钓鱼:甩竿] [联机钓鱼:提竿] [联机钓鱼:强拉] [联机钓鱼:慢慢遛] [联机钓鱼:收竿] [联机钓鱼:卖 全部] [联机钓鱼:买 …] [联机钓鱼:换 …] [联机钓鱼:炫耀]；公共聊天 [联机说:…]。`;
  savePlayer(pid); dirtyWorld = true; return out;
}

function aiTick() {
  const t = now();
  for (const [pid, a] of Object.entries(W.ai)) {
    if (!a.cast || !W.players[pid]) continue;
    if (a.act === "wait" && t >= a.cast.biteAt) { a.act = "bite"; feed({ type: "ai", pid, text: "浮漂动了！90 秒内写 [联机钓鱼:提竿]。" }); }
    else if (a.act === "bite" && t > a.cast.biteAt + BITE_AI_MS) { a.act = "idle"; a.cast = null; feed({ type: "ai", pid, text: "没来得及提竿，鱼跑了。" }); }
    else if (a.act === "hooked" && t > (a.cast.hookAt || t) + 180000) { a.act = "idle"; a.cast = null; feed({ type: "ai", pid, text: "鱼等太久，自己挣脱了。" }); }
  }
  // 朋友十分钟没动静算走了（存档写回）
  for (const p of Object.values(W.players)) if (p.guest && t - (p.lastSeenAt || 0) > 10 * 60000) leavePlayer(p.id);
}

setInterval(() => { try { aiTick(); } catch (e) { console.error("tick", e.message); } try { ddzTick(); } catch (e) { console.error("ddz", e.message); } if (dirtyWorld) { try { saveWorld(); } catch (e) { console.error("save", e.message); } } }, 2000);
setInterval(backup, 10 * 60000); backup();
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { for (const pid of Object.keys(W.players)) savePlayer(pid); saveWorld(); process.exit(0); });

http.createServer((req, res) => { route(req, res).catch((e) => { console.error(e); try { send(res, 500, { ok: false, error: "服务器出错了" }); } catch {} }); })
  .listen(PORT, "127.0.0.1", () => console.log(`[little-world] 127.0.0.1:${PORT}，数据 ${DATA}`));
module.exports = { route, W, INV };
