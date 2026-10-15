

const path = require("path");
try { delete require.cache[require.resolve(path.join(__dirname, "ddz.js"))]; } catch { /* ignore */ }
const ddz = require(path.join(__dirname, "ddz.js"));

const BOTS = { bot1: "秤砣", bot2: "泥鳅" };
const NAMES = require("./core.js").ROLES.names || {};
const AIS = require("./core.js").COMPANIONS;
const TIMEOUT = { human: 45000, ai: 150000, bot: 1500 };
const nameOf = (id) => BOTS[id] || NAMES[id] || id;
const T = (s) => (s.ddz = s.ddz || { seats: [null, null, null], kinds: {}, scores: {}, game: null });

function table(s, me) {
  const t = T(s); const g = t.game;
  return { seats: t.seats.map((id) => (id ? { id, name: nameOf(id), kind: t.kinds[id] || "human", score: t.scores[id] || 0 } : null)), timeouts: TIMEOUT,
    game: g ? { ...ddz.view(g, me), names: Object.fromEntries(g.seats.map((x) => [x, nameOf(x)])) } : null, mySeat: t.seats.indexOf(me) };
}

function notifyTurn(s, tell) {
  const t = T(s); const g = t.game; if (!g || g.phase === "done") return;
  const who = ddz.turnId(g); const key = `${g.at}:${g.plays.length}:${g.bid.asked}:${g.phase}`;
  if (t.kinds[who] !== "ai" || g.notified === key) return; g.notified = key;
  const lastTxt = g.last && g.lastBy !== who ? `上家 ${nameOf(g.lastBy)} 出的是 ${ddz.TYPE_NAME[g.last.type]}：${ddz.handText(g.last.ids)}。` : "该你先出。";
  tell(who, g.phase === "bid"
    ? `斗地主叫分：你的牌 ${ddz.handText(g.hands[who])}。现在最高 ${g.bid.cur} 分。叫写 [钓鱼:叫 1/2/3]，不叫写 [钓鱼:叫 0]（2 分半内，不叫就替你按牌叫）。`
    : `斗地主轮到你（地主是 ${nameOf(g.landlord)}${g.landlord === who ? "，就是你" : ""}）：${lastTxt}你的牌 ${ddz.handText(g.hands[who])}；剩牌 ${g.seats.map((x) => `${nameOf(x)} ${g.hands[x].length}`).join("，")}。出写 [钓鱼:出 3 3 3 4]（10 写 10，王写 小王 / 大王），${g.last && g.lastBy !== who ? "不要写 [钓鱼:不要]，" : ""}2 分半内不出就替你出。`);
}

function after(s, r, tell, note) {
  const t = T(s); const g = t.game;
  if (r && r.redeal) { t.game = ddz.deal(g.seats); note("斗地主：都没叫，重新发牌"); notifyTurn(s, tell); return; }
  if (g && g.phase === "done" && !g.scored) {
    g.scored = true; for (const [x, v] of Object.entries(g.score)) t.scores[x] = (t.scores[x] || 0) + v;
    const txt = `斗地主：${g.result.lordWin ? `地主 ${nameOf(g.landlord)} 赢了` : `农民 ${g.seats.filter((x) => x !== g.landlord).map(nameOf).join("、")} 赢了`}（${g.result.bid} 分 ×${2 ** g.result.bombs}${g.result.spring ? "，春天 ×2" : ""}）。`;
    note(txt); for (const x of g.seats) if (t.kinds[x] === "ai") tell(x, `${txt}这局你 ${g.score[x] > 0 ? "+" : ""}${g.score[x]}，总分 ${t.scores[x]}。`);
    return;
  }

  if (forcedPass(s)) return;
  notifyTurn(s, tell);
}

/** 世界 tick 里调：到点替人走一步。改了存档返回 true */
function forcedPass(s) { const t = T(s); const g = t.game; if (!g || g.phase !== "play") return false; const who = ddz.turnId(g);
  if (t.kinds[who] !== "ai" || !g.last || g.lastBy === who) return false;

  //   上家是单张 / 对子（这两种 candidates 列得全），或者手里牌比上家少、又没有炸弹 / 王炸
  const hand = g.hands[who]; const cnt = {}; for (const id of hand) cnt[ddz.rankOf(id)] = (cnt[ddz.rankOf(id)] || 0) + 1;
  const bomb = Object.values(cnt).some((n) => n >= 4) || (hand.includes(52) && hand.includes(53));
  const sure = g.last.type === "single" || g.last.type === "pair" || (hand.length < g.last.ids.length && !bomb);
  return sure && !ddz.hint(hand, g.last); }
function tick(s, tell, note) {
  const t = T(s); const g = t.game; if (!g || g.phase === "done") return false;
  const who = ddz.turnId(g); const kind = t.kinds[who] || "human";
  if (forcedPass(s) && Date.now() - (g.turnAt || g.at) >= 1500) { const r = ddz.autoStep(g); if (r && !r.error) { note(`斗地主：${nameOf(who)} 要不起，自动过`); after(s, r, tell, note); return true; } }
  if (Date.now() - (g.turnAt || g.at) < TIMEOUT[kind]) return false;
  const r = ddz.autoStep(g); if (r && kind === "ai" && !r.redeal) tell(who, "斗地主：你没回，替你走了一步。");
  after(s, r, tell, note); return true;
}

/** HTTP：act = "" | hint | sit | add | stand | start | bid | play。返回 [code, body, dirty] */
function route(s, act, M, pid, b, tell, note) {
  const t = T(s); const g = t.game; const busy = !!(g && g.phase !== "done");
  if (act === "" && M === "GET") return [200, { ok: true, ...table(s, pid) }, false];
  if (act === "hint" && M === "GET") { if (!g || ddz.turnId(g) !== pid || g.phase !== "play") return [200, { ok: true, ids: null }, false]; return [200, { ok: true, ids: ddz.hint(g.hands[pid], !g.last || g.lastBy === pid ? null : g.last) }, false]; }
  if (M !== "POST") return [405, { ok: false, error: "POST" }, false];
  if (act === "sit") {
    if (t.seats.includes(pid)) { if (t.kinds[pid] === "bot") t.kinds[pid] = "human"; return [200, { ok: true, ...table(s, pid) }, true]; } // 托管中回来：接着自己打
    const i = t.seats.findIndex((x) => !x || (BOTS[x] && !busy)); if (i < 0) return [409, { ok: false, error: "桌子坐满了" }, false];
    if (t.seats[i]) delete t.kinds[t.seats[i]]; t.seats[i] = pid; t.kinds[pid] = "human"; return [200, { ok: true, ...table(s, pid) }, true];
  }
  if (act === "add") {
    const w = String(b.who || "bot"); const id = w === "bot" ? Object.keys(BOTS).find((x) => !t.seats.includes(x)) : w;
    if (!id || t.seats.includes(id)) return [409, { ok: false, error: "没有空的托管了 / 他已经坐下了" }, false];
    if (!BOTS[id] && !AIS.includes(id)) return [400, { ok: false, error: "who 只能是 bot / 伙伴的 id" }, false];
    const i = t.seats.findIndex((x) => !x); if (i < 0) return [409, { ok: false, error: "桌子坐满了" }, false];
    t.seats[i] = id; t.kinds[id] = BOTS[id] ? "bot" : "ai";
    if (t.kinds[id] === "ai") tell(id, `${nameOf(pid)}拉你坐上了小屋里斗地主的桌子（${t.seats.filter(Boolean).map(nameOf).join("、")}）。开局后轮到你会告诉你牌和怎么出；想看桌面写 [钓鱼:斗地主]。`);
    return [200, { ok: true, ...table(s, pid) }, true];
  }
  if (act === "stand") {
    const w = String(b.who || pid); const i = t.seats.indexOf(w); if (i < 0) return [200, { ok: true, ...table(s, pid) }, false];

    if (w !== pid && !BOTS[w] && !AIS.includes(w)) return [403, { ok: false, error: "只能让托管 / 伙伴起来" }, false];
    if (busy) { t.kinds[w] = "bot"; return [200, { ok: true, note: "这局打着，先托管到打完", ...table(s, pid) }, true]; }
    t.seats[i] = null; delete t.kinds[w]; return [200, { ok: true, ...table(s, pid) }, true];
  }
  if (act === "start") {
    if (busy) return [409, { ok: false, error: "这局还没打完" }, false];
    if (t.seats.some((x) => !x)) return [409, { ok: false, error: "还差人（可以拉托管 / 伙伴）" }, false];
    if (!t.seats.includes(pid)) return [403, { ok: false, error: "你没坐在桌上" }, false];
    t.game = ddz.deal(t.seats.slice()); note(`斗地主开局：${t.seats.map(nameOf).join("、")}`); after(s, null, tell, note); return [200, { ok: true, ...table(s, pid) }, true];
  }
  if (act === "bid") { if (!g) return [409, { ok: false, error: "没开局" }, false]; const r = ddz.doBid(g, pid, b.score); if (r.error) return [400, { ok: false, error: r.error, ...table(s, pid) }, false]; after(s, r, tell, note); return [200, { ok: true, ...table(s, pid) }, true]; }
  if (act === "play") { if (!g) return [409, { ok: false, error: "没开局" }, false]; const r = ddz.doPlay(g, pid, Array.isArray(b.ids) ? b.ids.map(Number) : []); if (r.error) return [400, { ok: false, error: r.error, ...table(s, pid) }, false]; after(s, r, tell, note); return [200, { ok: true, ...table(s, pid) }, true]; }
  return [404, { ok: false, error: "没有这个" }, false];
}

/** 他在打斗地主吗（「出 / 不要 / 叫」先给斗地主，不在打才给鱼桶牌） */
const inGame = (s, pid) => { const g = s.ddz && s.ddz.game; return !!(g && g.phase !== "done" && g.seats.includes(pid)); };

function ai(s, pid, cmd, rest, tell, note) {
  const t = T(s); const g = t.game;
  if (!inGame(s, pid)) return cmd === "斗地主" ? `斗地主桌：${t.seats.map((x) => (x ? nameOf(x) : "空")).join("、")}${g && g.phase === "done" ? "（上一局打完了）" : ""}` : "你现在不在打斗地主。";
  if (t.kinds[pid] === "bot") t.kinds[pid] = "ai"; // 托管中他回话了：接着自己打
  if (cmd === "斗地主") { g.notified = null; notifyTurn(s, tell); return "牌桌情况递给你了。"; }
  if (cmd === "叫") { const r = ddz.doBid(g, pid, Number(rest) || 0); if (r.error) return r.error; after(s, r, tell, note); return r.landlord ? `叫完了，地主是 ${nameOf(r.landlord)}。` : r.redeal ? "都没叫，重新发牌了。" : "叫了。"; }
  if (cmd === "不要" || cmd === "过") { const r = ddz.doPlay(g, pid, []); if (r.error) return r.error; after(s, r, tell, note); return "不要。"; }
  const ids = ddz.idsFromText(g.hands[pid], rest); if (!ids || !ids.length) return `手里凑不出「${rest}」。你的牌：${ddz.handText(g.hands[pid])}`;
  const r = ddz.doPlay(g, pid, ids); if (r.error) return `${r.error}。你的牌：${ddz.handText(g.hands[pid])}`;
  after(s, r, tell, note); return r.over ? "出完了！" : `出了 ${ddz.TYPE_NAME[r.play.type]}：${ddz.handText(ids)}。`;
}

module.exports = { table, tick, route, ai, inGame, BOTS, TIMEOUT };
