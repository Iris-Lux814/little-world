

//   开赌之后钓到的才算（放生的也算，杂物不算）→ 到点结算：输的欠一张欠条，平局作废 → 欠的人可以标「还了」，债主撕掉才算还清（撕了留着能翻）。
"use strict";
const fs = require("fs");
const path = require("path");

const CONTENT = process.env.WORLD_DUEL_CONTENT || path.join(__dirname, "..", "content", "example-duel.json");
let cache = null;
function content() { let m = 0; try { m = fs.statSync(CONTENT).mtimeMs; } catch { /* ignore */ } if (!cache || cache.m !== m) cache = { m, c: JSON.parse(fs.readFileSync(CONTENT, "utf8")) }; return cache.c; }
const AIS = require("./core.js").COMPANIONS;
const HOST = require("./core.js").HOST;
const KINDS = { biggest: "谁钓的单条最重", count: "谁钓得多" };
const SPANS = { "30m": "30 分钟", "1h": "1 小时", tonight: "到今晚 12 点" };
const ASK_MS = 2 * 60000, STAKE_MAX = 40, LINES_MAX = 20, IOU_MAX = 200;
const pick = (a) => (a && a.length ? a[Math.floor(Math.random() * a.length)] : "");
const D = (s) => (s.duel = s.duel || { bet: null, ious: [], seq: 0 });
const shMidnight = (t) => { const d = new Date(t + 8 * 3600000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - 8 * 3600000; };
const endOf = (span, t) => (span === "30m" ? t + 30 * 60000 : span === "1h" ? t + 3600000 : shMidnight(t));
const live = (b) => !!b && (b.phase === "asking" || b.phase === "on");

function line(who, kind, vars = {}) {
  const L = content().lines || {};
  return String(pick((L[who] && L[who][kind]) || (L.any && L.any[kind]) || []) || "").replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}
function say(b, who, text) { if (!text) return; b.lines.push({ who, line: String(text).slice(0, 80), at: Date.now() }); if (b.lines.length > LINES_MAX) b.lines.splice(0, b.lines.length - LINES_MAX); }

function start(s, o = {}) {
  const t = D(s); const now = Date.now();
  if (live(t.bet)) return { error: "已经有一局在赌了", code: 409 };
  const w = String(o.with || ""); if (!AIS.includes(w)) return { error: "跟谁赌？with 写伙伴的 id", code: 400 };
  const kind = String(o.kind || ""); if (!Object.hasOwn(KINDS, kind)) return { error: "赌什么？kind 写 biggest / count", code: 400 };
  const span = String(o.span || ""); if (!Object.hasOwn(SPANS, span)) return { error: "多久？span 写 30m / 1h / tonight", code: 400 };
  if (span === "tonight" && shMidnight(now) - now < 10 * 60000) return { error: "离 12 点不到十分钟了，选 30 分钟或 1 小时吧", code: 409 };
  const stake = String(o.stake || "").replace(/\s+/g, " ").trim();
  if (!stake) return { error: "输的人要做什么？写一下", code: 400 };
  if (stake.length > STAKE_MAX) return { error: `赌注 ${STAKE_MAX} 个字以内`, code: 400 };
  t.bet = { id: `d${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, with: w, kind, span, stake, at: now, askUntil: now + ASK_MS, startAt: null, endAt: null,
    phase: "asking", counted: [], score: { [HOST]: { n: 0, w: 0 }, [w]: { n: 0, w: 0 } }, lines: [], result: null };
  return { bet: t.bet };
}

function cancel(s) {
  const b = D(s).bet; if (!b || b.phase !== "asking") return { error: "没有在等人接的赌", code: 409 };
  b.phase = "declined"; b.result = { winner: null, cancelled: true, line: "收回了。" }; return { bet: b };
}
/** 对方接 / 不接（暗号或到点自动）。text：他自己带的一句话，不带就从内容文件挑 */
function answer(s, who, yes, text) {
  const b = D(s).bet;
  if (!b || b.phase !== "asking" || b.with !== who) return { error: "没有等你接的赌" };
  const now = Date.now();
  if (yes) { b.phase = "on"; b.startAt = now; b.endAt = endOf(b.span, now); }
  else { b.phase = "declined"; b.result = { winner: null, line: "" }; }
  say(b, who, String(text || "").trim() || line(who, yes ? "accept" : "decline", { stake: b.stake }));
  if (!yes) b.result.line = b.lines[b.lines.length - 1].line;
  return { bet: b };
}

/** 记一条（钓上来时 core.addCatch 的钩子同步调；tick 再扫 s.events 补漏）。窗口和先后都按鱼的 item.at（没有才用事件时间）；
 *  按鱼 id 去重；seq 是记分先后，同重同毫秒也分得出谁先 */
function count(b, who, item, at) {
  if (!b || b.phase !== "on" || !item || item.junk || !(at >= b.startAt) || at >= b.endAt) return false;   // 杂物（明信片、瓶子）不算鱼
  const sc = b.score[who]; if (!sc) return false;
  const id = item.id || `${who}:${at}`; if (b.counted.includes(id)) return false;
  b.counted.push(id); if (b.counted.length > 3000) b.counted.splice(0, 1000);
  b.seq = (b.seq || 0) + 1; sc.n++;
  const kg = item.kg || 0;
  // 更重的顶替；一样重但钓得更早的（tick 补漏补上来的）也顶替——记的是这个重量最早钓到的那条
  if (kg > sc.w || (kg === sc.w && kg > 0 && at < sc.wAt)) { sc.w = kg; sc.fish = item.name; sc.wAt = at; sc.wSeq = b.seq; }
  return true;
}
function onCatch(s, who, item) { const b = s.duel && s.duel.bet; return count(b, who, item, item && item.at != null ? item.at : Date.now()); }
/** 世界 tick 里调（2 秒一次）：events = s.events。自动接、记分、到点结算。返回刚发生的事给调用方递话 */
function tick(s, events, now = Date.now()) {
  const t = D(s); const b = t.bet; const out = [];
  if (b && b.phase === "asking" && now >= b.askUntil) {
    const p = (content().acceptRate || {})[b.with]; const yes = Math.random() < (p == null ? 0.8 : p);
    answer(s, b.with, yes, ""); out.push({ type: yes ? "auto-accept" : "auto-decline", bet: b });
  }
  if (b && b.phase === "on") {
    for (const e of events || []) if (e.type === "catch" && e.item) count(b, e.who, e.item, e.item.at != null ? e.item.at : e.at);
    if (now >= b.endAt) { settle(s); out.push({ type: "settled", bet: b, iou: b.result.iou ? t.ious.find((x) => x.id === b.result.iou) : null }); }
  }
  return out;
}
function settle(s) {
  const t = D(s); const b = t.bet; const a = b.score[HOST], o = b.score[b.with];
  let winner = null;
  if (b.kind === "biggest") { if (a.w > o.w) winner = HOST; else if (o.w > a.w) winner = b.with; else if (a.w > 0) winner = a.wAt !== o.wAt ? (a.wAt < o.wAt ? HOST : b.with) : (a.wSeq || 0) < (o.wSeq || 0) ? HOST : b.with; }   // 一样重：先钓到的赢（比 item.at；同一毫秒才比记分序号）
  else if (a.n !== o.n) winner = a.n > o.n ? HOST : b.with;
  b.phase = "done";
  const loser = winner ? (winner === HOST ? b.with : HOST) : null;
  b.result = { winner, line: winner ? line(b.with, winner === HOST ? "lose" : "win", { stake: b.stake }) : line(b.with, "draw", {}) };
  say(b, b.with, b.result.line);
  if (loser) {
    const iou = { id: String(++t.seq), debtor: loser, creditor: winner, stake: b.stake, at: Date.now(), betId: b.id, kind: b.kind };
    t.ious.push(iou); b.result.iou = iou.id;
    // GPT：没撕的一张都不裁；撕掉的超过 IOU_MAX 张，旧的挪进 s.duel.archive（不删，GET /bet?all=1 能翻到）
    const torn = t.ious.filter((x) => x.tornAt);
    if (torn.length > IOU_MAX) { const old = torn.slice(0, torn.length - IOU_MAX); const drop = new Set(old.map((x) => x.id)); t.archive = (t.archive || []).concat(old); t.ious = t.ious.filter((x) => !drop.has(x.id)); }
  }
}
const findIou = (s, id) => D(s).ious.find((x) => x.id === String(id || "").replace(/^#/, "").trim()) || null;
/** 欠的人标「还了」（债主确认后撕） */
function paid(s, who, id, note) {
  const i = id ? findIou(s, id) : D(s).ious.find((x) => x.debtor === who && !x.tornAt && !x.paidMark);
  if (!i) return { error: id ? `没有 ${id} 号欠条` : "你没有欠着的", code: 404 };
  if (i.debtor !== who) return { error: "这张不是你欠的", code: 409 };
  if (i.tornAt) return { error: "已经撕了", code: 409 };
  i.paidMark = Date.now(); if (note) i.note = String(note).slice(0, 40);
  return { iou: i };
}
/** 债主撕掉（还清） */
function tear(s, who, id) {
  const i = findIou(s, id); if (!i) return { error: `没有 ${id || "这"} 号欠条`, code: 404 };
  if (i.creditor !== who) return { error: "不是欠你的，撕不了", code: 409 };
  if (i.tornAt) return { error: "已经撕了", code: 409 };
  i.tornAt = Date.now(); return { iou: i };
}
function view(s, all = false) {
  const t = D(s);
  const bet = t.bet ? (({ counted, ...x }) => x)(t.bet) : null;
  return { bet, ious: all ? (t.archive || []).concat(t.ious) : t.ious, presets: content().presets || [], kinds: Object.entries(KINDS).map(([k, name]) => ({ k, name })), spans: Object.entries(SPANS).map(([k, name]) => ({ k, name })) };
}

function owesLine(s, who, names) {
  const open = D(s).ious.filter((i) => !i.tornAt && (i.debtor === who || i.creditor === who));
  return open.length ? open.map((i) => (i.debtor === who ? `你欠${names[i.creditor]}：${i.stake}（${i.id} 号${i.paidMark ? "，你标了还了" : ""}）` : `${names[i.debtor]}欠你：${i.stake}（${i.id} 号${i.paidMark ? "，她说还了，撕掉写 [钓鱼:撕欠条 " + i.id + "]" : ""}）`)).join("；") : "";
}
const scoreText = (b, who) => { const x = b.score[who] || { n: 0, w: 0 }; return b.kind === "biggest" ? (x.w ? `${x.w}kg` : "还没钓到") : `${x.n} 条`; };
module.exports = { start, cancel, answer, tick, onCatch, paid, tear, view, owesLine, scoreText, live, KINDS, SPANS };
