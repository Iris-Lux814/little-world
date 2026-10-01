
// 牌 = 自己鱼桶里的鱼 + 自己图鉴里钓到过的鱼（复印，打输了不丢真鱼）。传说鱼是万能牌。
// 一局 2~3 人、每人 5 张、5 轮；每轮翻一张天气牌，大家同时扣一张，翻开比牌力，最大的收走这轮所有牌；
// 最小的那张「放生」——出它的人偷看下一张天气牌。5 轮后收得多的赢，输家各给赢家 20 亮鳞（不够就给全部），赢家还能让输家「替我钓一竿」。
"use strict";
const crypto = require("crypto");

const HAND = 5;
const ROUNDS = 5;
const STAKE = 20;
const INVITE_MS = 5 * 60000; // 邀请等 5 分钟
const TURN_MS = 4 * 60000;
const WX = ["晴", "多云", "雨", "雾", "大风", "夜"];
const WX_RULE = {
  晴: "垃圾能「扔」：出垃圾的这轮不算输赢，垃圾塞进赢家手里换走他一张",
  多云: "没有特别的",
  雨: "湖里的鱼重量翻倍（牌力 +6）",
  雾: "名字带「雾」的鱼变王牌",
  大风: "海里的鱼 +1 星",
  夜: "夜河的鱼 +1 星",
};
const rid = () => crypto.randomBytes(3).toString("hex");
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** 一个人的牌组：鱼桶 + 自己图鉴（同一种只留最重的那张），太少就补「空钩」 */
function deckOf(s, who, SPECIES) {
  const p = s.players[who]; if (!p) return [];
  const by = {};
  const add = (species, kg, from) => { const sp = SPECIES.find((x) => x.id === species); if (!sp) return; const old = by[species]; if (!old || kg > old.kg) by[species] = { species, name: sp.name, stars: sp.r + 1, rarity: sp.r, kg: +(+kg || 0).toFixed(2), spot: sp.spot, junk: !!sp.junk, legend: sp.r >= 4, from }; };
  for (const f of p.bucket || []) add(f.species, f.kg, "bucket");
  for (const [sp, d] of Object.entries(p.mydex || {})) add(sp, d.maxKg, "dex");
  const all = Object.values(by); const fish = all.filter((c) => !c.junk); const junk = all.filter((c) => c.junk).sort(() => Math.random() - 0.5).slice(0, 2);
  const deck = [...fish, ...junk];
  // 太少就跟秤砣借几条普通鱼凑数（借的，牌力一样，打完还回去）
  const commons = SPECIES.filter((x) => x.r === 0 && !x.junk && x.spot !== "river" && !x.v2);
  while (deck.length < 8 && commons.length) { const sp = commons[Math.floor(Math.random() * commons.length)]; const kg = +(sp.kg[0] + Math.random() * (sp.kg[1] - sp.kg[0])).toFixed(2); deck.push({ species: sp.id, name: sp.name, stars: 1, rarity: 0, kg, spot: sp.spot, junk: false, legend: false, from: "borrowed" }); }
  return deck;
}
/** 牌力：星级定大小，重量拉开同星级；天气改规则 */
function power(c, wx) {
  if (c.empty) return 0;
  if (c.legend) return 60;
  if (c.junk) return 1;
  let stars = c.stars;
  if (wx === "大风" && c.spot === "sea") stars++;
  if (wx === "夜" && c.spot === "river") stars++;
  let pw = stars * 10 + Math.min(9, Math.floor(Math.log2(c.kg * 10 + 1) * 1.6));
  if (wx === "雨" && c.spot === "lake") pw += 6;
  if (wx === "雾" && /雾/.test(c.name)) pw = 99;
  return pw;
}
const cardTxt = (c, wx) => `${c.name}${c.empty ? "" : c.junk ? "（垃圾，晴天能扔）" : `（${c.legend ? "传说·万能" : `${c.stars}★ ${c.spot === "sea" ? "海" : c.spot === "lake" ? "湖" : c.spot === "river" ? "夜河" : "池塘"}`}${c.kg ? ` ${c.kg}kg` : ""}${c.from === "borrowed" ? " 借的" : ""}，牌力 ${power(c, wx || null)}${wx ? "" : "起"}）`}`;

function realWx(s, weatherOf, hour) {
  if (hour >= 19 || hour < 5) return "夜";
  const w = weatherOf(s, "pond"); return /雨/.test(w) ? "雨" : WX.includes(w) ? w : "多云";
}

function create(s, by, seats, { SPECIES, weatherOf, hour, now = Date.now() }) {
  s.cards = s.cards || { cur: null, history: [], stats: {}, favors: [] };
  const g0 = s.cards.cur; if (g0 && g0.status !== "done") return { error: `已经有一局在打（${g0.status === "invite" ? "等人接" : `第 ${g0.round} 轮`}）` };
  seats = [...new Set([by, ...(seats || [])])].filter((w) => s.players[w]);
  if (seats.length < 2) return { error: "至少两个人（写上要跟谁打）" };
  const wxDeck = [realWx(s, weatherOf, hour), ...Array.from({ length: ROUNDS - 1 }, () => WX[Math.floor(Math.random() * WX.length)])];
  const g = { id: `c${now.toString(36)}${rid()}`, by, seats, status: "invite", accepted: { [by]: true }, at: now, deadline: now + INVITE_MS, round: 0, wxDeck, hands: {}, played: {}, taken: Object.fromEntries(seats.map((w) => [w, []])), peek: {}, log: [], pot: [] };
  s.cards.cur = g; return { game: g };
}
function answer(s, who, yes, ctx) {
  const g = s.cards && s.cards.cur; if (!g || g.status !== "invite") return { error: "现在没有等人接的牌局" };
  if (!g.seats.includes(who)) return { error: "这局没叫你" };
  if (!yes) { g.seats = g.seats.filter((w) => w !== who); delete g.accepted[who]; if (g.seats.length < 2) { g.status = "done"; g.endedWhy = "人不够，散了"; finish(s, g); return { game: g, cancelled: true }; } }
  else g.accepted[who] = true;
  if (g.seats.every((w) => g.accepted[w])) return { game: g, started: start(s, g, ctx) };
  return { game: g };
}
function start(s, g, { SPECIES, now = Date.now() }) {
  g.status = "on"; g.round = 1; g.roundAt = now; g.deadline = now + TURN_MS;
  for (const w of g.seats) g.hands[w] = shuffle(deckOf(s, w, SPECIES)).slice(0, HAND).map((c) => ({ ...c, cid: rid() }));
  g.log.push({ round: 0, text: `开局：${g.seats.length} 个人，每人 ${HAND} 张，第 1 轮天气「${g.wxDeck[0]}」（${WX_RULE[g.wxDeck[0]]}）。` });
  return true;
}
const curWx = (g) => g.wxDeck[g.round - 1];
// 天气牌跟大家的牌一起翻开；只有第 1 轮（就是小世界此刻的天气）和放生偷看到的人提前知道
const seenWx = (g, who) => (g.round === 1 || (g.peek[who] && g.peek[who].round === g.round) ? curWx(g) : null);
/** 出牌：q 可以是第几张（1 起）、cid、或鱼名 */
function play(s, who, q, opts) {
  const g = s.cards && s.cards.cur; if (!g || g.status !== "on") return { error: "现在没有在打的牌局" };
  if (!g.seats.includes(who)) return { error: "你不在这局里" };
  if (g.played[who]) return { error: "这轮你已经扣了一张，等别人" };
  const h = g.hands[who]; const qs = String(q == null ? "" : q).trim();
  let i = /^\d+$/.test(qs) ? Number(qs) - 1 : h.findIndex((c) => c.cid === qs || c.name === qs);
  if (i < 0) i = h.findIndex((c) => qs && (c.name.includes(qs) || qs.includes(c.name)));
  if (i < 0 || i >= h.length) return { error: `手里没有「${qs}」。手牌：${h.map((c, k) => `${k + 1}.${cardTxt(c, curWx(g))}`).join(" ")}` };
  const [c] = h.splice(i, 1); g.played[who] = { ...c, auto: !!(opts && opts.auto) };
  if (g.seats.every((w) => g.played[w])) return { card: c, result: resolve(s, g, opts) };
  return { card: c, waiting: g.seats.filter((w) => !g.played[w]) };
}
function resolve(s, g, { now = Date.now(), names = {} } = {}) {
  const wx = curWx(g); const P = g.played; const N = (w) => names[w] || w;
  const thrown = wx === "晴" ? g.seats.filter((w) => P[w].junk && !P[w].empty) : [];
  const rest = g.seats.filter((w) => !thrown.includes(w));
  const pw = Object.fromEntries(g.seats.map((w) => [w, thrown.includes(w) ? -1 : power(P[w], wx)]));
  const top = Math.max(...rest.map((w) => pw[w])); const tops = rest.filter((w) => pw[w] === top);
  let winner = tops.length === 1 ? tops[0] : null;
  if (!winner && tops.length > 1) { const kg = Math.max(...tops.map((w) => P[w].kg)); const t2 = tops.filter((w) => P[w].kg === kg); winner = t2.length === 1 ? t2[0] : null; }
  const cards = g.seats.filter((w) => !thrown.includes(w)).map((w) => P[w]);
  const parts = [];
  if (winner) { g.taken[winner].push(...cards, ...g.pot); parts.push(`${N(winner)}收走 ${cards.length + g.pot.length} 张`); g.pot = []; }
  else { g.pot.push(...cards); parts.push(`平了，${cards.length} 张留在桌上归下一轮的赢家`); }
  // 晴天扔垃圾：塞进赢家手里换走一张
  for (const w of thrown) { if (winner && winner !== w && g.hands[winner].length) { const k = Math.floor(Math.random() * g.hands[winner].length); const [lost] = g.hands[winner].splice(k, 1, { ...P[w], cid: rid() }); g.hands[w].push({ ...lost, cid: rid() }); parts.push(`${N(w)}把${P[w].name}塞给${N(winner)}，换走了一张`); } else parts.push(`${N(w)}的${P[w].name}没扔成`); }
  // 放生：最小的那张（不是赢家、唯一最小）偷看下一张天气
  let freed = null;
  if (g.round < ROUNDS) { const cand = rest.filter((w) => w !== winner); if (cand.length) { const lo = Math.min(...cand.map((w) => pw[w])); const los = cand.filter((w) => pw[w] === lo); if (los.length === 1) { freed = los[0]; g.peek[freed] = { round: g.round + 1, wx: g.wxDeck[g.round] }; parts.push(`${N(freed)}的${P[freed].name}最小，放生——偷看了下一张天气`); } } }
  const r = { round: g.round, wx, played: Object.fromEntries(g.seats.map((w) => [w, { name: P[w].name, stars: P[w].stars, kg: P[w].kg, power: pw[w], auto: P[w].auto, thrown: thrown.includes(w) }])), winner, freed, text: `第 ${g.round} 轮（${wx}）：${g.seats.map((w) => `${N(w)} ${P[w].name}${thrown.includes(w) ? "（扔）" : ` ${pw[w]}`}`).join("，")}。${parts.join("；")}。` };
  g.log.push(r); g.played = {};
  if (g.round >= ROUNDS || g.seats.some((w) => !g.hands[w].length)) { g.status = "done"; settle(s, g, names); }
  else { g.round++; g.roundAt = now; g.deadline = now + TURN_MS; }
  return r;
}
function settle(s, g, names = {}) {
  const N = (w) => names[w] || w;
  const score = (w) => [g.taken[w].length, g.taken[w].reduce((a, c) => a + power(c, null), 0)];
  const best = g.seats.slice().sort((a, b) => score(b)[0] - score(a)[0] || score(b)[1] - score(a)[1]);
  const [a, b] = [score(best[0]), score(best[1])];
  g.winner = a[0] === b[0] && a[1] === b[1] ? null : best[0];
  g.pay = [];
  if (g.winner) for (const w of g.seats) if (w !== g.winner) { const p = s.players[w]; const n = Math.min(STAKE, p.coins || 0); p.coins = (p.coins || 0) - n; s.players[g.winner].coins = (s.players[g.winner].coins || 0) + n; g.pay.push({ from: w, n }); g.favorFrom = (g.favorFrom || []).concat(w); }
  g.endText = g.winner ? `${N(g.winner)}赢了（收了 ${a[0]} 张）。${g.pay.map((x) => (x.n ? `${N(x.from)}给了 ${x.n} 亮鳞` : `${N(x.from)}兜里没亮鳞了`)).join("，")}。赢家可以叫输家「替我钓一竿」。` : "平局，谁也不给谁。";
  finish(s, g);
}
function finish(s, g) {
  g.endedAt = Date.now(); const st = s.cards.stats;
  if (g.round > 0) for (const w of g.seats) { st[w] = st[w] || { games: 0, wins: 0 }; st[w].games++; if (g.winner === w) st[w].wins++; }
  s.cards.history = [...(s.cards.history || []), { id: g.id, at: g.at, endedAt: g.endedAt, seats: g.seats, winner: g.winner || null, endText: g.endText || g.endedWhy || "", rounds: g.log.filter((x) => x.round > 0).map((x) => x.text) }].slice(-20);
}
/** 赢家叫输家替钓：输家下一条钓上来的鱼进赢家的桶 */
function favor(s, winner, from) {
  const h = (s.cards && s.cards.history) || []; const last = [...h].reverse().find((x) => x.winner === winner);
  const g = s.cards.cur && s.cards.cur.id === (last && last.id) ? s.cards.cur : null;
  if (!last || !g || !(g.favorFrom || []).includes(from)) return { error: "最近一局你没赢他，或者已经叫过了" };
  g.favorFrom = g.favorFrom.filter((w) => w !== from); s.cards.favors = (s.cards.favors || []).concat({ from, to: winner, at: Date.now() }); return { ok: true };
}
/** addCatch 之后调：有欠着的「替我钓一竿」就把这条转过去 */
function takeFavor(s, who, item) {
  const fs = (s.cards && s.cards.favors) || []; const i = fs.findIndex((f) => f.from === who); if (i < 0) return null;
  const [f] = fs.splice(i, 1); const p = s.players[who]; const k = p.bucket.findIndex((x) => x.id === item.id); if (k < 0) return null;
  const [fish] = p.bucket.splice(k, 1); s.players[f.to].bucket.push({ ...fish, giftFrom: who, favor: true }); return f;
}
/** 到点：邀请过期就按接了的人开 / 散；一轮超时替没出的人随手出一张 */
function tick(s, opts) {
  const g = s.cards && s.cards.cur; const now = opts.now || Date.now(); const out = [];
  if (!g || g.status === "done" || now < g.deadline) return out;
  if (g.status === "invite") {
    g.seats = g.seats.filter((w) => g.accepted[w]);
    if (g.seats.length >= 2) { start(s, g, opts); out.push({ type: "start", game: g }); } else { g.status = "done"; g.endedWhy = "没人接，散了"; finish(s, g); out.push({ type: "cancel", game: g }); }
    return out;
  }
  for (const w of g.seats) if (!g.played[w]) { const h = g.hands[w]; const k = h.reduce((bi, c, i) => (power(c, curWx(g)) < power(h[bi], curWx(g)) ? i : bi), 0); const r = play(s, w, k + 1, { ...opts, auto: true }); out.push({ type: "auto", who: w, card: r.card }); if (r.result) out.push({ type: "round", result: r.result, game: g }); }
  return out;
}
/** 给某个人看的牌桌：自己的手牌 + 偷看到的天气，别人的手牌只给张数 */
function view(s, who) {
  const c = s.cards || {}; const g = c.cur;
  const base = { rules: { hand: HAND, rounds: ROUNDS, stake: STAKE, wx: WX_RULE }, stats: c.stats || {}, history: (c.history || []).slice(-5).reverse(), favors: c.favors || [] };
  if (!g) return { ...base, game: null };
  const wx = g.status === "on" ? seenWx(g, who) : null;
  return { ...base, game: { id: g.id, by: g.by, seats: g.seats, status: g.status, accepted: g.accepted, deadline: g.deadline, round: g.round, rounds: ROUNDS, wx, wxRule: wx ? WX_RULE[wx] : null,
    peeked: !!(g.peek[who] && g.peek[who].round === g.round && g.round > 1),
    hand: (g.hands[who] || []).map((c) => ({ ...c, power: power(c, wx) })), handCount: Object.fromEntries(g.seats.map((w) => [w, (g.hands[w] || []).length])),
    played: Object.fromEntries(g.seats.map((w) => [w, !!g.played[w]])), taken: Object.fromEntries(g.seats.map((w) => [w, g.taken[w].length])), pot: g.pot.length,
    log: g.log.slice(-6), winner: g.winner || null, endText: g.endText || g.endedWhy || null, favorFrom: g.favorFrom || [] } };
}
/** 给 AI 的一行：现在轮到什么 */
function promptFor(s, who) {
  const g = s.cards && s.cards.cur; if (!g || g.status !== "on" || !g.seats.includes(who) || g.played[who]) return null; const wx = seenWx(g, who);
  const head = wx ? `天气「${wx}」${g.round > 1 ? "（你放生时偷看到的，别人不知道）" : ""}：${WX_RULE[wx]}` : `这轮天气牌扣着，跟牌一起翻（晴：垃圾能扔；雨：湖鱼 +6；雾：带雾的鱼是王牌；大风：海鱼 +1 星；夜：夜河鱼 +1 星）`;
  return `鱼桶牌第 ${g.round}/${ROUNDS} 轮，${head}。你的手牌：${g.hands[who].map((c, k) => `${k + 1}.${cardTxt(c, wx)}`).join(" ")}。扣一张写 [钓鱼:出 第几张或鱼名]（4 分钟内，不出就替你随手出最小的）。`;
}

module.exports = { HAND, ROUNDS, STAKE, WX, WX_RULE, deckOf, power, cardTxt, create, answer, play, tick, view, promptFor, favor, takeFavor };
