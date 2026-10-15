
// 只动存档 s（s.farm + 各人的 seeds / basket / coins），叫醒谁、贴什么由各自的世界做。内容（菜名、台词）在 farm-content.js。
//
// 玩法：伞面顶上每人一个旧物花盆（slots 挨着的 = 邻居）；伞里存水（下雨涨），摇伞 = 所有盆各湿一半，转竹管 = 对准的那盆湿透；

// 还没做：小动物、巨型萝卜（跟传说鱼同一套，下一步）。
"use strict";
const WORLD_TZ = process.env.WORLD_TZ || "Etc/GMT-8"; // 游戏按 UTC+8 走（节日、夜河的钟点都按这个时区）
const crypto = require("crypto");
const C = require(process.env.WORLD_FARM_CONTENT || "../content/example-farm.js");

const FARM = { waterMax: 6, rainStepMs: 30 * 60000, homeTiles: 6, guestTiles: 4, crossOdds: 0.3, pityDays: 2, helpAfterMs: 2 * 3600000, stages: 4, groundTiles: 18 };

const HOME = C.HOME; const HOST = C.HOST;
const POT_KIND = C.POT_KIND;
const shDay = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA", { timeZone: WORLD_TZ });
const tiles = (n) => Array.from({ length: n }, () => ({ crop: null }));
const nameOf = (s, who) => C.NAMES[who] || (s.players[who] && s.players[who].name) || who;

/** 存档里没有就建一份；老存档补字段 */
function farmOf(s) {
  const f = (s.farm = s.farm || {});
  f.slots = f.slots || [...HOME];
  f.pots = f.pots || {};
  for (const w of f.slots) if (!f.pots[w]) f.pots[w] = { owner: w, kind: POT_KIND[w] || "crate", tiles: tiles(HOME.includes(w) ? FARM.homeTiles : FARM.guestTiles), sign: null };
  f.water = f.water || { level: 3, max: FARM.waterMax, rainAt: 0 };
  f.roots = f.roots || {};
  f.board = f.board || [];
  f.hybrids = f.hybrids || {};
  f.day = f.day || shDay();
  f.today = f.today || { rained: false, helped: {}, flooded: null };

  f.ground = f.ground || tiles(FARM.groundTiles);
  while (f.ground.length < FARM.groundTiles) f.ground.push({ crop: null });
  return f;
}
/** "ground:3" / 3 → 3（去空格、不分大小写）；不是地块编号 → -1 */
function groundIdx(plot) {
  const m = /^(?:ground:)?(\d+)$/.exec(String(plot ?? "").trim().toLowerCase());
  const i = m ? Number(m[1]) : -1;
  return i >= 0 && i < FARM.groundTiles ? i : -1;
}
// 传了 plot 就一定按地块处理（非法直接报错），只有没传才走自己的盆
const hasPlot = (plot) => plot != null && String(plot).trim() !== "";
const board = (f, who, text) => { f.board.push({ at: Date.now(), who, text }); f.board = f.board.slice(-50); };
const pl = (s, who) => { const p = s.players[who]; p.seeds = p.seeds || {}; p.basket = p.basket || []; return p; };
const seedName = (f, id) => (C.SEEDS[id] ? C.SEEDS[id].name : (f.hybrids[id] && f.hybrids[id].name) || id);

/** 买种子（秤砣店）：一包 PACK 颗 */
function buySeed(s, who, q, n = 1) {
  const id = Object.keys(C.SEEDS).find((k) => k === q || C.SEEDS[k].name === q) || Object.keys(C.SEEDS).find((k) => q && C.SEEDS[k].name.includes(q));
  if (!id) return { error: `秤砣这儿没有「${q}」的种子。有：${Object.values(C.SEEDS).map((x) => x.name).join("、")}` };
  n = Math.max(1, Math.min(10, Math.floor(Number(n)) || 1)); const it = C.SEEDS[id]; const cost = it.price * n; const p = pl(s, who);
  if ((p.coins || 0) < cost) return { error: `亮鳞不够（${n} 包${it.name}种子要 ${cost}，你有 ${p.coins || 0}）` };
  p.coins -= cost; p.seeds[id] = (p.seeds[id] || 0) + C.PACK * n;
  return { ok: true, text: `买了 ${n} 包${it.name}种子（${C.PACK * n} 颗）。`, seeds: p.seeds };
}
/** 种：只能种自己的盆 */
function plant(s, who, tile, seed, plot) {
  const f = farmOf(s);
  if (hasPlot(plot)) {
    const i = groundIdx(plot); if (i < 0) return { error: `没有「${plot}」这块地` };
    if (f.ground[i].crop) return { error: "这块地已经种了" };
    const p = pl(s, who); const id = Object.keys(p.seeds).find((k) => (k === seed || seedName(f, k) === seed) && p.seeds[k] > 0) || (!seed ? Object.keys(p.seeds).find((k) => p.seeds[k] > 0) : null);
    if (!id) return { error: seed ? `你没有「${seed}」的种子，先去秤砣那儿买` : "你没有种子，先去秤砣那儿买" };
    p.seeds[id]--; if (!p.seeds[id]) delete p.seeds[id];
    f.ground[i].crop = { seed: id, plantedAt: Date.now(), stage: 0, wet: 0, dryDays: 0, pollen: null, by: who };
    return { ok: true, plot: `ground:${i}`, text: `在地${i + 1}种下了${seedName(f, id)}。` };
  }
  const pot = f.pots[who]; if (!pot) return { error: "你在伞上还没有花盆" };
  const i = Number.isInteger(Number(tile)) ? Number(tile) : pot.tiles.findIndex((t) => !t.crop);
  if (i < 0 || i >= pot.tiles.length) return { error: "盆里没有空格了" };
  if (pot.tiles[i].crop) return { error: "这格已经种了" };
  const p = pl(s, who); const id = Object.keys(p.seeds).find((k) => (k === seed || seedName(f, k) === seed) && p.seeds[k] > 0) || (!seed ? Object.keys(p.seeds).find((k) => p.seeds[k] > 0) : null);
  if (!id) return { error: seed ? `你没有「${seed}」的种子，先去秤砣那儿买` : "你没有种子，先去秤砣那儿买" };
  p.seeds[id]--; if (!p.seeds[id]) delete p.seeds[id];
  pot.tiles[i].crop = { seed: id, plantedAt: Date.now(), stage: 0, wet: 0, dryDays: 0, pollen: null };
  return { ok: true, tile: i, text: `在第 ${i + 1} 格种下了${seedName(f, id)}。` };
}
/** 摇伞：用 1 格水，所有盆各湿一半 */
function shake(s, who) {
  const f = farmOf(s);
  if (f.water.level < 1) return { ok: true, empty: true, text: "伞里没水了，摇下来几片叶子。等下雨。" };
  f.water.level--; let n = 0;
  for (const w of f.slots) for (const t of f.pots[w].tiles) if (t.crop) { t.crop.wet = Math.min(1, (t.crop.wet || 0) + 0.5); n++; }
  return { ok: true, water: f.water.level, text: `摇了一下伞，水一圈洒下来，${n} 棵苗都沾到了一点。伞里还剩 ${f.water.level} 格水。` };
}
/** 转竹管：用 1 格水，对准的那盆湿透；竹管停在那个方向 */
function spout(s, who, to) {
  const f = farmOf(s); const key = f.pots[to] ? to : Object.keys(f.pots).find((k) => nameOf(s, k) === to);
  if (!key) return { error: `伞上没有「${to}」的花盆` };
  f.spout = key; f.spoutBy = who;
  if (f.water.level < 1) return { ok: true, empty: true, text: `竹管转向${nameOf(s, key)}的盆了，可伞里没水，等下雨。` };
  f.water.level--; for (const t of f.pots[key].tiles) if (t.crop) t.crop.wet = 1;
  if (key === HOST && who !== HOST) f.today.helped[who] = Date.now();
  return { ok: true, water: f.water.level, text: `咔——竹管转向${nameOf(s, key)}的盆，水顺着槽流过去，盆里都湿透了。伞里还剩 ${f.water.level} 格水。` };
}
/** 收：只收自己盆里熟了的；串过粉的顺带一颗杂交种子 */
function harvest(s, who, tile, plot) {
  const f = farmOf(s);
  if (hasPlot(plot)) {
    const i = groundIdx(plot); if (i < 0) return { error: `没有「${plot}」这块地` };
    const c = f.ground[i].crop; if (!c || c.stage < FARM.stages) return { error: "这块地还没有熟的" };
    const p = pl(s, who);
    const item = { id: `v${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`, at: Date.now(), by: who, grower: c.by || null, seed: c.seed, name: seedName(f, c.seed), hybrid: !!f.hybrids[c.seed] };
    p.basket.push(item); p.harvested = (p.harvested || 0) + 1; f.ground[i].crop = null;
    const from = c.by && c.by !== who ? `（${nameOf(s, c.by)}种的）` : "";
    return { ok: true, plot: `ground:${i}`, text: `从地${i + 1}收了${item.name}${from}。`, basket: p.basket.length };
  }
  const pot = f.pots[who]; if (!pot) return { error: "你在伞上还没有花盆" };
  const idxs = tile != null && tile !== "" ? [Number(tile)] : pot.tiles.map((t, i) => (t.crop && t.crop.stage >= FARM.stages ? i : -1)).filter((i) => i >= 0);
  if (!idxs.length) return { error: "还没有熟的" };
  const p = pl(s, who); const got = [];
  for (const i of idxs) {
    const t = pot.tiles[i]; if (!t || !t.crop || t.crop.stage < FARM.stages) continue;
    const c = t.crop; const item = { id: `v${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`, at: Date.now(), by: who, seed: c.seed, name: seedName(f, c.seed), hybrid: !!f.hybrids[c.seed] };
    p.basket.push(item); got.push(item.name); p.harvested = (p.harvested || 0) + 1; // 成就馆用的累计数（菜篮会卖掉，不能拿篮子数）
    if (c.pollen) { const hid = c.pollen.hybrid; p.seeds[hid] = (p.seeds[hid] || 0) + 1; got.push(`一颗${f.hybrids[hid].name}的种子`); }
    t.crop = null;
  }
  return got.length ? { ok: true, text: `收了：${got.join("、")}。`, basket: p.basket.length } : { error: "还没有熟的" };
}
/** 浇地：不用伞里的水（井 / 水壶，不限次），那一格今天湿透 */
function water(s, who, plot) {
  const f = farmOf(s); const i = groundIdx(plot); if (i < 0) return { error: `没有「${plot}」这块地` };
  const c = f.ground[i].crop; if (!c) return { error: `地${i + 1}还空着，没什么可浇的` };
  if (c.wet >= 1) return { ok: true, plot: `ground:${i}`, text: `地${i + 1}已经是湿的了。` };
  c.wet = 1;
  return { ok: true, plot: `ground:${i}`, text: `给地${i + 1}的${seedName(f, c.seed)}浇了水。` };
}
function sign(s, who, text) { const f = farmOf(s); const pot = f.pots[who]; if (!pot) return { error: "你在伞上还没有花盆" }; pot.sign = String(text || "").trim().slice(0, 10) || null; return { ok: true, text: pot.sign ? `插了个小牌子：「${pot.sign}」` : "把小牌子拔了" }; }

/** 每天 0 点结算：湿过的长、干的蔫 / 枯、邻居开花串粉 */
function farmDay(s) {
  const f = farmOf(s); const out = [];
  // 邻居串粉（先看今天开着的花，再长）：左盆最右一格 × 右盆最左一格，两边都在开花（stage 3）
  for (let k = 0; k + 1 < f.slots.length; k++) {
    const A = f.pots[f.slots[k]], B = f.pots[f.slots[k + 1]]; const a = A.tiles[A.tiles.length - 1].crop, b = B.tiles[0].crop;
    if (!a || !b || a.stage !== 3 || b.stage !== 3 || a.pollen || b.pollen || Math.random() >= FARM.crossOdds) continue;
    const [x, y] = [a.seed, b.seed].sort(); const hid = `h:${x}+${y}:${A.owner}+${B.owner}`;
    if (!f.hybrids[hid]) { f.hybrids[hid] = { name: C.HYBRID_NAME(x, y, nameOf(s, A.owner), nameOf(s, B.owner)), parents: [x, y], by: [A.owner, B.owner], firstAt: Date.now() }; out.push({ type: "hybrid", id: hid, name: f.hybrids[hid].name }); for (const o of [A.owner, B.owner]) { const q = s.players[o]; if (q) q.hybridsFound = (q.hybridsFound || 0) + 1; } } // 成就：新杂交两家各记一次
    a.pollen = { from: b.seed, by: B.owner, hybrid: hid }; b.pollen = { from: a.seed, by: A.owner, hybrid: hid };
    board(f, "system", `${nameOf(s, A.owner)}和${nameOf(s, B.owner)}的盆挨着开花，串粉了——收的时候会多一颗「${f.hybrids[hid].name}」的种子。`);
  }
  for (const w of f.slots) for (const t of f.pots[w].tiles) {
    const c = t.crop; if (!c) continue;
    const flooded = f.today.flooded === w;
    if (!flooded && (c.wet >= 1 || f.today.rained)) { c.stage = Math.min(FARM.stages, c.stage + 1); c.dryDays = 0; }
    else if (!flooded) { c.dryDays = (c.dryDays || 0) + 1; if (c.dryDays >= 3) { board(f, "system", `${nameOf(s, w)}盆里的${seedName(f, c.seed)}干死了。`); out.push({ type: "wither", who: w }); t.crop = null; continue; } }
    c.wet = 0;
  }
  for (const t of f.ground) { // 地里：雨或手动浇过就长，干 3 天枯；不会被竹管淹
    const c = t.crop; if (!c) continue;
    if (c.wet >= 1 || f.today.rained) { c.stage = Math.min(FARM.stages, c.stage + 1); c.dryDays = 0; }
    else { c.dryDays = (c.dryDays || 0) + 1; if (c.dryDays >= 3) { board(f, "system", `地里${nameOf(s, c.by || HOST)}种的${seedName(f, c.seed)}干死了。`); out.push({ type: "wither", who: c.by || null, plot: true }); t.crop = null; continue; } }
    c.wet = 0;
  }
  f.today = { rained: false, helped: {}, flooded: null };
  return out;
}

function farmTick(s, o = {}) {
  const f = farmOf(s); const now = Date.now(); const ev = [];
  if (shDay(now) !== f.day) { ev.push({ type: "day", events: farmDay(s) }); f.day = shDay(now); }
  if (/雨/.test(o.wx || "")) {
    f.today.rained = true;
    if (now - (f.water.rainAt || 0) >= FARM.rainStepMs) {
      f.water.rainAt = now;

      if (f.spout && f.spoutBy === C.FLOODER && !f.today.flooded && f.water.level >= f.water.max) { f.today.flooded = f.spout; board(f, C.FLOODER, C.FLOOD_LINE); ev.push({ type: "flood", who: f.spout }); }
      if (f.water.level < f.water.max) { f.water.level++; ev.push({ type: "rain", level: f.water.level }); }
    }
  }

  const herPot = f.pots[HOST]; const herDry = herPot && herPot.tiles.some((t) => t.crop && t.crop.wet < 1) && !f.today.rained;
  const away = now - (o.herLastAt || now);
  if (herDry && away > FARM.helpAfterMs && f.water.level >= 1) {
    for (const w of Object.keys(C.HELPERS)) {
      if (f.today.helped[w] || Object.keys(f.today.helped).length) break;
      const must = away > FARM.pityDays * 86400000; const roll = (f.today.rolled = f.today.rolled || {});
      if (!must && roll[w]) continue; roll[w] = true;
      if (!must && Math.random() >= C.HELPERS[w].odds) continue;
      spout(s, w, HOST); f.today.helped[w] = now;
      for (const t of f.ground) if (t.crop) t.crop.wet = 1;
      const h = C.HELPERS[w]; board(f, w, h.line[Math.floor(Math.random() * h.line.length)]);
      if (h.sign) herPot.sign = h.sign[Math.floor(Math.random() * h.sign.length)];
      ev.push({ type: "help", who: w, must });
    }
  }
  return ev;
}

// 联机：朋友来了在伞面末尾给他一个 4 格的盆 + 一根气根平台；走了平台合上，盆留着
function farmJoin(s, pid, name, kind = "crate") {
  const f = farmOf(s); if (!f.slots.includes(pid)) f.slots.push(pid);
  if (!f.pots[pid]) f.pots[pid] = { owner: pid, kind, tiles: tiles(FARM.guestTiles), sign: null };
  const r = (f.roots[pid] = f.roots[pid] || { name, since: Date.now(), bow: "粉" }); r.present = true; r.name = name || r.name; return r;
}
function farmLeave(s, pid) { const f = farmOf(s); if (f.roots[pid]) f.roots[pid].present = false; }

function farmView(s) {
  const f = farmOf(s);
  return {
    day: f.day, water: f.water, spout: f.spout || null, spoutBy: f.spoutBy || null, roots: f.roots, board: f.board.slice(-20), hybrids: f.hybrids,
    slots: f.slots.map((w) => ({ who: w, name: nameOf(s, w), ...f.pots[w], tiles: f.pots[w].tiles.map((t) => (t.crop ? { crop: { ...t.crop, name: seedName(f, t.crop.seed), ripe: t.crop.stage >= FARM.stages } } : { crop: null })) })),
    shop: Object.entries(C.SEEDS).map(([id, x]) => ({ id, name: x.name, price: x.price, pack: C.PACK, sell: x.sell })),
    stages: FARM.stages,
    ground: f.ground.map((t, i) => ({ id: `ground:${i}`, crop: t.crop ? { ...t.crop, name: seedName(f, t.crop.seed), ripe: t.crop.stage >= FARM.stages, byName: t.crop.by ? nameOf(s, t.crop.by) : null } : null })),
  };
}

function cropPrice(f, seed) { if (C.SEEDS[seed]) return C.SEEDS[seed].sell; const h = f.hybrids[seed]; if (!h) return 0; const [a, b] = h.parents || []; return Math.round((((C.SEEDS[a] || {}).sell || 0) + ((C.SEEDS[b] || {}).sell || 0)) / 2 * 1.5); }
function sellCrop(s, who, id) {
  const f = farmOf(s); const p = pl(s, who);
  const pick = id ? p.basket.filter((x) => x.id === id) : p.basket.slice();
  if (!pick.length) return { error: id ? "菜篮里没有这个" : "菜篮是空的" };
  let got = 0; const names = {};
  for (const x of pick) { got += cropPrice(f, x.seed); names[x.name] = (names[x.name] || 0) + 1; }
  const ids = new Set(pick.map((x) => x.id)); p.basket = p.basket.filter((x) => !ids.has(x.id));
  p.coins = (p.coins || 0) + got;
  return { ok: true, text: `秤砣收了${Object.entries(names).map(([k, n]) => (n > 1 ? `${k}×${n}` : k)).join("、")}，给了 ${got} 亮鳞。`, got, wallet: p.coins };
}
const farmBag = (s, who) => { const p = pl(s, who); return { seeds: p.seeds, basket: p.basket.slice(-30) }; };

module.exports = { FARM, farmOf, farmView, farmBag, farmTick, farmDay, buySeed, plant, shake, spout, harvest, water, groundIdx, sellCrop, cropPrice, sign, farmJoin, farmLeave };
