

"use strict";
const crypto = require("crypto");

const RANK_NAME = { 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "小王", 17: "大王" };
const SUITS = ["♠", "♥", "♣", "♦"];
const rankOf = (id) => (id === 52 ? 16 : id === 53 ? 17 : 3 + Math.floor(id / 4));
const cardName = (id) => (id >= 52 ? RANK_NAME[rankOf(id)] : `${SUITS[id % 4]}${RANK_NAME[rankOf(id)]}`);
const sortIds = (ids) => ids.slice().sort((a, b) => rankOf(a) - rankOf(b) || a - b);
const TYPE_NAME = { single: "单张", pair: "对子", triple: "三张", triple1: "三带一", triple2: "三带二", straight: "顺子", pairs: "连对", plane: "飞机", plane1: "飞机带单", plane2: "飞机带对", four2: "四带二", four2p: "四带两对", bomb: "炸弹", rocket: "王炸" };

function counts(ranks) { const m = new Map(); for (const r of ranks) m.set(r, (m.get(r) || 0) + 1); return m; }
const consecutive = (rs) => rs.every((r, i) => i === 0 || r === rs[i - 1] + 1);

/** 认牌型：返回 {type, main, len} 或 null。main 是比大小用的主点数（顺子 / 连对 / 飞机是最小那张） */
function analyze(ids) {
  const ranks = ids.map(rankOf).sort((a, b) => a - b); const n = ranks.length; if (!n) return null;
  const c = counts(ranks); const by = (k) => [...c.entries()].filter(([, v]) => v === k).map(([r]) => r).sort((a, b) => a - b);
  if (n === 2 && ranks[0] === 16 && ranks[1] === 17) return { type: "rocket", main: 17, len: 2 };
  if (n === 1) return { type: "single", main: ranks[0], len: 1 };
  if (n === 2 && c.size === 1) return { type: "pair", main: ranks[0], len: 2 };
  if (n === 3 && c.size === 1) return { type: "triple", main: ranks[0], len: 3 };
  if (n === 4 && c.size === 1) return { type: "bomb", main: ranks[0], len: 4 };
  if (n === 4 && by(3).length === 1) return { type: "triple1", main: by(3)[0], len: 4 };
  if (n === 5 && by(3).length === 1 && by(2).length === 1) return { type: "triple2", main: by(3)[0], len: 5 };
  if (n === 6 && by(4).length === 1) return { type: "four2", main: by(4)[0], len: 6 };
  if (n === 8 && by(4).length === 1 && by(2).length === 2) return { type: "four2p", main: by(4)[0], len: 8 };
  const keys = [...c.keys()].sort((a, b) => a - b);
  if (n >= 5 && c.size === n && keys[keys.length - 1] <= 14 && consecutive(keys)) return { type: "straight", main: keys[0], len: n };
  if (n >= 6 && n % 2 === 0 && [...c.values()].every((v) => v === 2) && keys[keys.length - 1] <= 14 && consecutive(keys)) return { type: "pairs", main: keys[0], len: n };
  // 飞机：找最长的一串连着的三张（不含 2 和王），看剩下的是不是正好的翅膀
  const tri = keys.filter((r) => c.get(r) >= 3 && r <= 14);
  for (let k = Math.floor(n / 3); k >= 2; k--) {
    for (let i = tri.length - k; i >= 0; i--) {
      const seq = tri.slice(i, i + k); if (!consecutive(seq)) continue;
      const rest = new Map(c); for (const r of seq) rest.set(r, rest.get(r) - 3); const left = [...rest.entries()].filter(([, v]) => v > 0);
      const leftN = left.reduce((a, [, v]) => a + v, 0);
      if (n === 3 * k && leftN === 0) return { type: "plane", main: seq[0], len: n };
      if (n === 4 * k && leftN === k) return { type: "plane1", main: seq[0], len: n };
      if (n === 5 * k && left.length === k && left.every(([, v]) => v === 2)) return { type: "plane2", main: seq[0], len: n };
    }
  }
  return null;
}
/** a 能不能压 b（b 为空 = 首出，任何合法牌型都行） */
function beats(a, b) {
  if (!a) return false; if (!b) return true;
  if (a.type === "rocket") return true; if (b.type === "rocket") return false;
  if (a.type === "bomb" && b.type !== "bomb") return true;
  return a.type === b.type && a.len === b.len && a.main > b.main;
}

// ── 提示：从手牌里找能出的（先小后大，炸弹最后）──
function groups(hand) { const g = new Map(); for (const id of sortIds(hand)) { const r = rankOf(id); if (!g.has(r)) g.set(r, []); g.get(r).push(id); } return g; }
function candidates(hand, last) {
  const g = groups(hand); const ranks = [...g.keys()].sort((a, b) => a - b); const out = [];
  const take = (r, n) => g.get(r).slice(0, n);
  const singlesFor = (excl, k) => { const pick = []; for (const r of ranks) { if (excl.includes(r)) continue; if (g.get(r).length < 4 && pick.length < k) pick.push(g.get(r)[0]); } return pick.length === k ? pick : null; };
  const pairsFor = (excl, k) => { const pick = []; for (const r of ranks) { if (excl.includes(r) || g.get(r).length < 2 || g.get(r).length === 4) continue; if (pick.length < k * 2) pick.push(...take(r, 2)); } return pick.length === k * 2 ? pick : null; };
  const t = last ? last.type : null;
  const want = (type) => !t || t === type;
  if (want("single")) for (const r of ranks) out.push(take(r, 1));
  if (want("pair")) for (const r of ranks) if (g.get(r).length >= 2) out.push(take(r, 2));
  if (want("triple")) for (const r of ranks) if (g.get(r).length >= 3) out.push(take(r, 3));
  if (want("triple1")) for (const r of ranks) if (g.get(r).length >= 3) { const w = singlesFor([r], 1); if (w) out.push([...take(r, 3), ...w]); }
  if (want("triple2")) for (const r of ranks) if (g.get(r).length >= 3) { const w = pairsFor([r], 1); if (w) out.push([...take(r, 3), ...w]); }
  const runs = (minN, per, maxLen) => { const seqs = []; const ok = ranks.filter((r) => r <= 14 && g.get(r).length >= per); for (let i = 0; i < ok.length; i++) for (let j = i; j < ok.length && ok[j] - ok[i] === j - i; j++) { const len = j - i + 1; if (len >= minN && len <= maxLen) seqs.push(ok.slice(i, j + 1)); } return seqs; };
  if (want("straight")) for (const s of runs(5, 1, 12)) if (!last || s.length === last.len) out.push(s.flatMap((r) => take(r, 1)));
  if (want("pairs")) for (const s of runs(3, 2, 10)) if (!last || s.length * 2 === last.len) out.push(s.flatMap((r) => take(r, 2)));
  if (want("plane") || want("plane1") || want("plane2")) for (const s of runs(2, 3, 6)) {
    const k = s.length; const body = s.flatMap((r) => take(r, 3));
    if (want("plane") && (!last || last.len === 3 * k)) out.push(body);
    if (want("plane1") && (!last || last.len === 4 * k)) { const w = singlesFor(s, k); if (w) out.push([...body, ...w]); }
    if (want("plane2") && (!last || last.len === 5 * k)) { const w = pairsFor(s, k); if (w) out.push([...body, ...w]); }
  }
  for (const r of ranks) if (g.get(r).length === 4) out.push(take(r, 4));
  if (g.has(16) && g.has(17)) out.push([g.get(16)[0], g.get(17)[0]]);
  return out.map((ids) => ({ ids, a: analyze(ids) })).filter((x) => x.a && beats(x.a, last));
}
const costOf = (x) => (x.a.type === "rocket" ? 1000 : x.a.type === "bomb" ? 500 + x.a.main : 0) + x.a.main;
/** 提示：最省的一手（首出时出得越多越好、越小越好） */
function hint(hand, last) {
  const cs = candidates(hand, last); if (!cs.length) return null;
  if (!last) { cs.sort((a, b) => (a.a.type === "bomb" || a.a.type === "rocket" ? 1 : 0) - (b.a.type === "bomb" || b.a.type === "rocket" ? 1 : 0) || a.a.main - b.a.main || b.ids.length - a.ids.length); return cs[0].ids; }
  cs.sort((a, b) => costOf(a) - costOf(b)); return cs[0].ids;
}
/** 托管叫分：大王 / 小王 / 2 / 炸弹算分 */
function botBid(hand, cur) {
  const g = groups(hand); let pts = 0; if (g.has(17)) pts += 4; if (g.has(16)) pts += 3; pts += (g.get(15) || []).length * 2; for (const [r, v] of g) if (v.length === 4 && r < 16) pts += 6;
  const want = pts >= 12 ? 3 : pts >= 8 ? 2 : pts >= 5 ? 1 : 0; return want > cur ? want : 0;
}

// ── 一局 ──
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** seats: 3 个座位的 id。返回一局的状态（存档用纯 JSON） */
function deal(seats, now = Date.now()) {
  const d = shuffle([...Array(54).keys()]);
  const hands = Object.fromEntries(seats.map((s, i) => [s, sortIds(d.slice(i * 17, i * 17 + 17))]));
  const first = crypto.randomInt(3);
  return { seats, hands, bottom: sortIds(d.slice(51)), phase: "bid", bid: { cur: 0, by: null, turn: first, asked: 0, log: [] }, landlord: null, turn: first, last: null, lastBy: null, passes: 0, plays: [], bombs: 0, played: Object.fromEntries(seats.map((s) => [s, 0])), at: now, turnAt: now, winner: null };
}
const turnId = (g) => g.seats[g.turn];
function doBid(g, who, score) {
  if (g.phase !== "bid") return { error: "不在叫分" }; if (turnId(g) !== who) return { error: "还没轮到你叫" };
  score = Number(score) || 0; if (score && (score <= g.bid.cur || score > 3)) return { error: `要比 ${g.bid.cur} 大（1~3），不叫写 0` };
  g.bid.log.push({ who, score }); if (score) { g.bid.cur = score; g.bid.by = who; } g.bid.asked++;
  if (score === 3 || g.bid.asked >= 3) {
    if (!g.bid.by) { return { redeal: true }; } // 都不叫：重发
    g.landlord = g.bid.by; g.hands[g.landlord] = sortIds([...g.hands[g.landlord], ...g.bottom]); g.phase = "play"; g.turn = g.seats.indexOf(g.landlord); g.turnAt = Date.now();
    return { ok: true, landlord: g.landlord };
  }
  g.turn = (g.turn + 1) % 3; g.turnAt = Date.now(); return { ok: true };
}
function doPlay(g, who, ids) {
  if (g.phase !== "play") return { error: "还没开始出牌" }; if (turnId(g) !== who) return { error: "还没轮到你" };
  const lead = !g.last || g.lastBy === who;
  if (!ids || !ids.length) { if (lead) return { error: "该你先出，不能不要" }; g.passes++; g.plays.push({ who, pass: true }); g.turn = (g.turn + 1) % 3; g.turnAt = Date.now(); if (g.passes >= 2) { g.last = null; g.passes = 0; } return { ok: true, pass: true }; }
  const hand = g.hands[who]; const set = new Set(ids.map(Number)); if (set.size !== ids.length || [...set].some((x) => !hand.includes(x))) return { error: "手里没有这些牌" };
  const a = analyze([...set]); if (!a) return { error: "不是能出的牌型" };
  if (!lead && !beats(a, g.last)) return { error: `压不过上家的${TYPE_NAME[g.last.type]}` };
  g.hands[who] = hand.filter((x) => !set.has(x)); g.played[who]++; if (a.type === "bomb" || a.type === "rocket") g.bombs++;
  g.last = { ...a, ids: sortIds([...set]) }; g.lastBy = who; g.passes = 0; g.plays.push({ who, ids: g.last.ids, type: a.type });
  if (!g.hands[who].length) return { ok: true, play: g.last, over: finish(g, who) };
  g.turn = (g.turn + 1) % 3; g.turnAt = Date.now(); return { ok: true, play: g.last };
}
function finish(g, who) {
  g.phase = "done"; g.winner = who; const lordWin = who === g.landlord;
  const farmers = g.seats.filter((s) => s !== g.landlord);
  const spring = lordWin ? farmers.every((f) => g.played[f] === 0) : g.played[g.landlord] === 1;
  const mult = g.bid.cur * 2 ** g.bombs * (spring ? 2 : 1);
  g.score = Object.fromEntries(g.seats.map((s) => [s, s === g.landlord ? (lordWin ? 2 * mult : -2 * mult) : lordWin ? -mult : mult]));
  g.result = { lordWin, spring, mult, bombs: g.bombs, bid: g.bid.cur };
  return g.result;
}
/** 托管：轮到 bot / 超时的人时替他走一步 */
function autoStep(g) {
  const who = turnId(g);
  if (g.phase === "bid") return { who, ...doBid(g, who, botBid(g.hands[who], g.bid.cur)) };
  if (g.phase !== "play") return null;
  const lead = !g.last || g.lastBy === who;
  // 队友刚出的大牌就不压了（农民不压农民，除非能直接走完）
  if (!lead && g.lastBy !== g.landlord && who !== g.landlord) { const h = hint(g.hands[who], g.last); if (!h || h.length !== g.hands[who].length) return { who, ...doPlay(g, who, []) }; }
  const h = hint(g.hands[who], lead ? null : g.last);
  if (h && !lead && (analyze(h).type === "bomb" || analyze(h).type === "rocket") && g.hands[g.lastBy].length > 4 && g.hands[who].length > 6) return { who, ...doPlay(g, who, []) }; // 别太早扔炸弹
  return { who, ...doPlay(g, who, h || []) };
}
/** 给某个座位看：自己的手牌、别人剩几张、底牌（叫完才亮） */
function view(g, me) {
  return { seats: g.seats, phase: g.phase, turn: turnId(g), turnAt: g.turnAt, landlord: g.landlord, bid: { cur: g.bid.cur, by: g.bid.by, log: g.bid.log }, bottom: g.landlord ? g.bottom : null,
    hand: g.hands[me] ? g.hands[me].map((id) => ({ id, rank: rankOf(id), name: cardName(id) })) : null, counts: Object.fromEntries(g.seats.map((s) => [s, g.hands[s].length])),
    last: g.last ? { by: g.lastBy, type: g.last.type, typeName: TYPE_NAME[g.last.type], ids: g.last.ids, names: g.last.ids.map(cardName) } : null,
    plays: g.plays.slice(-12).map((p) => (p.pass ? p : { ...p, names: p.ids.map(cardName), typeName: TYPE_NAME[p.type] })), bombs: g.bombs, winner: g.winner, score: g.score || null, result: g.result || null,
    canPass: g.phase === "play" && turnId(g) === me && !!g.last && g.lastBy !== me };
}

function idsFromText(hand, text) {
  const want = String(text || "").replace(/小王/g, " SJ ").replace(/大王/g, " BJ ").replace(/10/g, " T ").toUpperCase().match(/SJ|BJ|[3-9TJQKA2]/g) || [];
  const map = { T: 10, J: 11, Q: 12, K: 13, A: 14, 2: 15, SJ: 16, BJ: 17 }; const left = sortIds(hand); const out = [];
  for (const w of want) { const r = map[w] || Number(w); const i = left.findIndex((id) => rankOf(id) === r); if (i < 0) return null; out.push(left.splice(i, 1)[0]); }
  return out;
}
const handText = (ids) => sortIds(ids).map((id) => RANK_NAME[rankOf(id)]).join(" ");

module.exports = { RANK_NAME, TYPE_NAME, rankOf, cardName, sortIds, analyze, beats, candidates, hint, botBid, deal, doBid, doPlay, autoStep, view, idsFromText, handText, turnId };
