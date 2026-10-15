
// 只放纯规则：鱼、饵、装备、商店、钓鱼结算、天气、岸边地形。不碰文件、不碰网络、不认识具体是谁在玩。
// 状态的形状（两边一样）：{ players: { <id>: 玩家 }, dex: { <鱼种>: 图鉴 }, events: [...], wx: { <钓点>: 天气 } }

"use strict";
const WORLD_TZ = process.env.WORLD_TZ || "Etc/GMT-8"; // 游戏按 UTC+8 走（节日、夜河的钟点都按这个时区）
const crypto = require("crypto");

const rnd = (a, b) => a + Math.random() * (b - a);
const pickW = (items, w) => { const s = items.reduce((t, x) => t + w(x), 0); let r = Math.random() * s; for (const x of items) { r -= w(x); if (r <= 0) return x; } return items[items.length - 1]; };
const shHour = () => Number(new Date().toLocaleString("en-US", { timeZone: WORLD_TZ, hour: "numeric", hour12: false })) % 24;
const RARITY = ["普通", "优秀", "稀有", "史诗", "传说"];

const CONTENT = require(process.env.WORLD_CONTENT || require("path").join(__dirname, "..", "content", "example.js"));
const { ROLES, SPECIES, SHOP, SHOP_HELP, MOONCAKE_DAYS } = CONTENT;
const HOST = ROLES.host, PARTNER = ROLES.partner || ROLES.host, COMPANIONS = ROLES.companions || [];
const nameOf = (id) => (ROLES.names && ROLES.names[id]) || id;

const RIVER_OPEN = true;

//   calling 正在打电话；readToday 今天读过书（共读 / 书房）；annivDay 纪念日是每月几号（0 = 不知道）
const ENV = { v2: false, dreaming: false, wishDoneToday: false, listening: false, calling: false, readToday: false, annivDay: 0 };
function setEnv(e) { Object.assign(ENV, e || {}); }
const shDate = (t = Date.now()) => new Date(t).toLocaleDateString("en-CA", { timeZone: WORLD_TZ }); // 2026-09-28
const shMonth = () => Number(shDate().slice(5, 7));
const shMinute = () => new Date().getUTCMinutes();

const FEST = {
  spring: [["2026-02-16", "2026-02-21"], ["2027-02-05", "2027-02-10"], ["2028-01-25", "2028-01-30"]],
  lantern: [["2026-03-01", "2026-03-05"], ["2027-02-18", "2027-02-22"], ["2028-02-07", "2028-02-11"]],
  qingming: [["04-03", "04-07"]],
  duanwu: [["2026-06-17", "2026-06-21"], ["2027-06-07", "2027-06-11"], ["2028-05-26", "2028-05-30"]],
  qixi: [["2026-08-19", "2026-08-19"], ["2027-08-08", "2027-08-08"], ["2028-08-26", "2028-08-26"]],
  midautumn: [["2026-09-22", "2026-09-28"], ["2027-09-12", "2027-09-18"], ["2028-09-30", "2028-10-06"]],
  chongyang: [["2026-10-16", "2026-10-20"], ["2027-10-06", "2027-10-10"], ["2028-10-24", "2028-10-28"]],
  dongzhi: [["12-20", "12-24"]],
  laba: [["2027-01-14", "2027-01-16"], ["2028-01-03", "2028-01-05"], ["2029-01-21", "2029-01-23"]],
  halloween: [["10-29", "11-01"]],
  xmas: [["12-22", "12-26"]],
  love: [["02-14", "02-14"], ["03-14", "03-14"], ["05-20", "05-20"]],
  snow: [["12-20", "12-24"], ["12-01", "12-31", "wet"], ["01-01", "02-28", "wet"]], // 冬至前后；或者 12～2 月下雨 / 起雾（算下雪）
};
function festOn(key, wx = "") {
  if (key === "anniv") return !!ENV.annivDay && Number(shDate().slice(8, 10)) === ENV.annivDay;
  const d = shDate(), md = d.slice(5);
  return (FEST[key] || []).some(([a, z, need]) => (a.length === 5 ? md >= a && md <= z : d >= a && d <= z) && (!need || /雨|雾/.test(wx)));
}
// 条件：e = { h, wx, prev, since, s, now }
const RAINY = /雨/;
const COND = {
  rainAfter: (e) => !RAINY.test(e.wx) && RAINY.test(e.prev || "") && e.now - e.since < 3600000,
  sunAfterRain: (e) => e.wx === "晴" && RAINY.test(e.prev || "") && e.now - e.since < 3600000,
  dawn: (e) => e.h >= 5 && e.h < 8,
  noonSun: (e) => e.h >= 11 && e.h < 14 && e.wx === "晴",
  hotAfternoon: (e) => (shMonth() >= 6 && shMonth() <= 8) || (e.wx === "晴" && e.h >= 13 && e.h < 17),
  clearNight: (e) => isNight() && /晴|多云/.test(e.wx),
  deepClearNight: (e) => e.h < 4 && e.wx === "晴",
  fogNight: (e) => isNight() && /雾/.test(e.wx),
  cold: () => [11, 12, 1, 2].includes(shMonth()),
  windy: (e) => e.wx === "大风",
  calmSun: (e) => e.wx === "晴",
  night: () => isNight(),
  hourEdge: () => shMinute() >= 55 || shMinute() < 5,
  farmBerry: (e) => Object.values(((e.s && e.s.farm) || {}).pots || {}).some((pt) => (pt.tiles || []).some((x) => x.crop && x.crop.seed === "strawberry")),
  wishDone: () => ENV.wishDoneToday, dreaming: () => ENV.dreaming, listening: () => ENV.listening, calling: () => ENV.calling, readToday: () => ENV.readToday,
};
const WHEN_TEXT = { rainAfter: "雨刚停", sunAfterRain: "雨后放晴", dawn: "清晨", noonSun: "晴天正午", hotAfternoon: "晴天午后", clearNight: "晴朗的夜里", deepClearNight: "晴天深夜", fogNight: "起雾的夜里", cold: "天冷", windy: "风大", calmSun: "晴天湖面静", night: "夜里", hourEdge: "整点前后", farmBerry: "农场种着草莓", wishDone: "有愿望刚做成", readToday: "今天读过书", ...(CONTENT.WHEN_TEXT || {}) };
/** 这条鱼此刻能不能出：v2 没开不出；有 when 的要条件对；节日的要在窗口里 */
function speciesOk(x, e) {
  if (x.v2 && !ENV.v2) return false;
  if (x.when && !(COND[x.when] && COND[x.when](e))) return false;
  if (x.fest && !festOn(x.fest, e.wx)) return false;
  return true;
}
/** 怀表 / 小道消息：这会儿（这个钓点）哪些特别的鱼在出 */
function specialsNow(s, spot) {
  const w = weatherOf(s, spot); const cur = (s.wx || {})[spot] || {};
  const e = { h: shHour(), wx: w, prev: cur.prev, since: cur.since || 0, s, now: Date.now() };
  return SPECIES.filter((x) => (x.spot === spot || x.spot === "any") && (x.when || x.fest) && speciesOk(x, e)).map((x) => ({ id: x.id, name: x.name, stars: x.r + 1, why: x.fest ? "节日" : WHEN_TEXT[x.when] || "" }));
}

const riverHour = (h = shHour()) => h >= 19 || h < 5;
/** 月亮有多圆（0 = 初一，1 = 十五）：按朔望月从 2000-01-06 18:14 UTC 那次新月算 */
const moonFull = (t = Date.now()) => { const ph = (((t - Date.UTC(2000, 0, 6, 18, 14)) / 86400000 / 29.530588) % 1 + 1) % 1; return (1 - Math.cos(ph * 2 * Math.PI)) / 2; };

const nightKey = (t = Date.now()) => new Date(t - 6 * 3600000).toLocaleDateString("en-CA", { timeZone: WORLD_TZ });
const BITE_MS = 4000; // 咬钩窗口。前端拿 cast 返回的 biteIn 在本地准点冒「！」，不靠轮询；提竿请求在路上的时间另给 0.8 秒宽限

// 货币「亮鳞」：秤砣收鱼时从鱼身上刮下来、放天平上称出来的鳞片。星级越高鳞越亮越值钱，大鱼多刮几片。
// 装备 6 格：竿 / 浮漂 / 线轴 / 挂件 / 饵 / 桶。每个人一套。
// 纪念品（有人写的、掉的东西）秤砣不收，一直留在桶里但不占格子，以后挪进小屋展示柜。
const KEEPSAKE = new Set(CONTENT.KEEPSAKE_IDS || []);
const PRICE = [8, 22, 70, 180, 480];

const isNight = () => { const h = shHour(); return h >= 20 || h < 5; };

const SLOT_NAME = { rod: "竿", bobber: "浮漂", reel: "线轴", charm: "挂件", bait: "饵", bucket: "桶", item: "道具", decor: "摆设" };
const baitOnSale = (id) => { const b = SHOP.bait[id]; if (!b || id === "worm") return false; if (b.v2 && !ENV.v2) return false; if (b.limited && b.fest && b.fest !== "midautumn") return festOn(b.fest); if (!b.limited) return true; const d = new Date().toLocaleDateString("en-CA", { timeZone: WORLD_TZ }); return MOONCAKE_DAYS.some(([a, z]) => d >= a && d <= z); };
function gearOf(p) {
  p.coins = p.coins || 0;
  const g = (p.gear = p.gear || {}); for (const [k, def] of Object.entries({ rod: "pole", bobber: "wood", reel: "cotton", charm: "none", bucket: "pail" })) if (!SHOP[k][g[k]]) g[k] = def;
  p.owned = (p.owned || []).filter((id) => Object.values(SHOP).some((x) => x[id])); for (const id of ["pole", "wood", "cotton", "none", "pail"]) if (!p.owned.includes(id)) p.owned.push(id);
  if (!p.baits || p.baits.cranberry != null) { p.baits = { bread: 10, ...(p.baits || {}) }; delete p.baits.cranberry; } // 新手 10 份面包屑（原来的蔓越莓换成面包屑）
  if (!p.bait || (p.bait !== "worm" && !(p.baits[p.bait] > 0)) || !SHOP.bait[p.bait]) p.bait = Object.keys(p.baits).find((k) => p.baits[k] > 0) || "worm";
  return p;
}
const keptCount = (p) => p.bucket.filter((x) => KEEPSAKE.has(x.species)).length;
const bucketUsed = (p) => p.bucket.length - keptCount(p); // 纪念品不占格子
const bucketSize = (p) => SHOP.bucket[gearOf(p).gear.bucket]?.size || 20;
const charmOf = (p) => gearOf(p).gear.charm;
const hasKeepsake = (p, sp) => p.bucket.some((x) => x.species === sp) || (p.seen || []).includes(sp);
const itemsOf = () => Object.entries(SHOP).flatMap(([kind, items]) => Object.entries(items).map(([id, it]) => ({ kind, id, it })));
const itemsOn = () => itemsOf().filter((x) => !x.it.v2 || ENV.v2);
const findItem = (q, kind) => { q = String(q || "").replace(/饵$/, "").trim(); if (!q) return null; return itemsOn().find((x) => (!kind || x.kind === kind) && (x.id === q || x.it.name === q)) || itemsOn().find((x) => (!kind || x.kind === kind) && x.it.name.includes(q)) || null; };
/** 一条鱼能刮多少亮鳞（纪念品 null = 秤砣不收） */
function scalesOf(f, p) {
  if (KEEPSAKE.has(f.species)) return null;
  const base = f.junk ? 3 : PRICE[Math.max(0, Math.min(4, (f.stars || 1) - 1))] + Math.round((f.kg || 0) * ((f.stars || 1) + 1));
  const ch = p ? SHOP.charm[charmOf(p)] : null; return Math.round(base * (ch && ch.sellBonus ? 1 + ch.sellBonus : 1));
}

const WORM_DAY = 5;
const shDay = () => new Date().toLocaleDateString("en-CA", { timeZone: WORLD_TZ });
/** 甩竿前问一声：要用蚯蚓但秤砣今天不给了 → 返回一句话；能甩 → null */
function wormNo(p) {
  gearOf(p); if (p.bait !== "worm") return null;
  const w = p.worms && p.worms.day === shDay() ? p.worms.n : 0;
  if (w < WORM_DAY || p.coins >= SHOP.bait.bread.price) return w < WORM_DAY ? null : `秤砣：「今天塞过 ${WORM_DAY} 条了。兜里有亮鳞，自己买包面包屑去。」（饵用完了，先买饵）`;
  return null;
}
/** 用掉一份饵（甩竿时）。没饵了就换秤砣塞的蚯蚓 */
function useBait(p) { gearOf(p); const id = p.bait; if (id === "worm") { const d = shDay(); p.worms = p.worms && p.worms.day === d ? p.worms : { day: d, n: 0 }; p.worms.n++; } if (id !== "worm") { p.baits[id] = (p.baits[id] || 0) - 1; if (p.baits[id] <= 0) { delete p.baits[id]; gearOf(p); } } return { id, ...(SHOP.bait[id] || SHOP.bait.worm) }; }
const baitOdds = (b) => (b.night && isNight() ? b.night : b.odds);
function biteSecs(b, weather) { const [a, z] = b.bite; return rnd(a, z) * (b.rainFast && /雨/.test(weather || "") ? 0.5 : 1); }
function luckOf(p, wx = "") {
  const g = gearOf(p).gear; const bo = SHOP.bobber[g.bobber] || SHOP.bobber.wood; const rod = SHOP.rod[g.rod] || {}; const ch = SHOP.charm[g.charm] || {};
  return (isNight() && bo.nightLuck ? bo.nightLuck : bo.luck)
    + (rod.luck || 0) + (isNight() && rod.nightLuck ? rod.nightLuck : 0) + (ch.luck || 0) + (ch.windLuck && wx === "大风" ? ch.windLuck : 0); // v2：竿 / 挂件也能带运气
}

/** 这一竿钓上什么。wx = 这个钓点此刻的天气（雾鲤要雾） */
function rollCatch(p, b, wx = "", s = null) {
  gearOf(p); b = b || SHOP.bait[p.bait] || SHOP.bait.worm;
  const h = shHour(); const odds = baitOdds(b);
  let tier = pickW([0, 1, 2, 3, 4], (i) => odds[i]);
  if (Math.random() < luckOf(p, wx)) tier = Math.min(4, tier + 1); // 浮漂 / 发卡 / 挂件的运气

  const run = p.lowRun || 0; if (tier === 0 && run >= 5 && Math.random() < Math.min(0.5, (run - 4) * 0.1)) tier = 1;

  const cw = (s && s.wx && s.wx[p.spot]) || {}; const env = { h, wx, prev: cw.prev, since: cw.since || 0, s, now: Date.now() };
  const here = (x) => (x.spot === p.spot || x.spot === "any") && speciesOk(x, env);
  if (b.junkOnly) { const jp = SPECIES.filter((x) => here(x) && x.junk); if (jp.length) { const sp = pickW(jp, () => 1); return { species: sp.id, name: sp.name, rarity: sp.r, stars: sp.r + 1, kg: Math.round(rnd(sp.kg[0], sp.kg[1]) * 100) / 100, junk: true }; } }
  let pool = SPECIES.filter((x) => here(x) && x.r === tier);
  if (!pool.length) pool = SPECIES.filter((x) => here(x) && x.r <= tier);
  // 雾鲤：不起雾的时候很难碰到（四次里只剩一次机会），碰不到就降一档
  const foggy = /雾/.test(wx || ""); pool = pool.filter((x) => !x.fog || foggy || Math.random() < 0.25);
  if (!pool.length) pool = SPECIES.filter((x) => here(x) && x.r === Math.max(0, tier - 1) && !x.fog);
  const lordOk = (x) => !x.lord || (LORD_SOLO && h >= x.hours[0] && h < x.hours[1] && !/雨/.test(wx || "") && !(s && s.riverLord === nightKey()) && Math.random() < 0.05 + 0.95 * moonFull() ** 1.5);
  pool = pool.filter(lordOk); if (!pool.length) pool = SPECIES.filter((x) => here(x) && x.r === Math.max(0, tier - 1) && !x.lord);

  const sp = pickW(pool, (x) => (x.hours && !(h >= x.hours[0] && h < x.hours[1]) ? 0.15 : 1) * (x.fog && !foggy ? 0.08 : 1) * (x.junk ? 0.35 * (b.junk || 1) : 1)
    * (x.fest ? 2 : 1) * (b.fest && x.fest === b.fest ? 2 : 1) * (b.sweet && (x.tags || []).includes("sweet") ? 3 : 1) * (x.likes && x.likes === p.bait ? 3 : 1) * (x.likedBy && s && p === s.players[x.likedBy] ? 3 : 1)); // v2：节日鱼在窗口里多 2 倍；对口的饵再多
  const kg = Math.round(rnd(sp.kg[0], sp.kg[1]) * 100) / 100;
  return { species: sp.id, name: sp.name, rarity: sp.r, stars: sp.r + 1, kg, junk: !!sp.junk };
}

const CATCH_HOOKS = [];
function note(s, ev) { s.events.push({ at: Date.now(), ...ev }); }
/** 钓上来一条：进鱼桶、记图鉴、记成就用的数 */
function addCatch(s, who, c) {
  const p = s.players[who]; const item = { id: `f${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`, at: Date.now(), by: who, ...c };
  p.bucket.push(item); p.catches = (p.catches || 0) + 1; p.seen = p.seen || []; if (!p.seen.includes(c.species)) p.seen.push(c.species); p.lowRun = c.rarity === 0 ? (p.lowRun || 0) + 1 : 0; if (c.rarity >= 2) p.rares = (p.rares || 0) + 1; if (c.rarity >= 4) p.legends = (p.legends || 0) + 1;
  const d = s.dex[c.species] = s.dex[c.species] || { firstBy: who, firstAt: item.at, count: 0, maxKg: 0, maxBy: null };
  const record = c.kg > d.maxKg && d.count > 0; d.count++;
  if (c.kg > d.maxKg) { d.maxKg = c.kg; d.maxBy = who; }
  const first = d.count === 1; if (SPECIES.find((x) => x.id === c.species)?.lord) s.riverLord = nightKey(); // 夜河之主：今晚不再出

  p.mydex = p.mydex || {}; const md = (p.mydex[c.species] = p.mydex[c.species] || { firstAt: item.at, count: 0, maxKg: 0 }); md.count++; if (c.kg > md.maxKg) md.maxKg = c.kg; const mineFirst = md.count === 1;

  if (SPECIES.find((x) => x.id === c.species)?.pair) { const other = who === HOST ? PARTNER : HOST; const op = s.players[other]; if (op) { op.bucket.push({ ...item, id: item.id + "b", by: who, pairOf: who }); note(s, { type: "pair", who, to: other, name: c.name }); } }
  note(s, { type: "catch", who, item, first, record });
  betOnCatch(s, who, item);
  for (const f of CATCH_HOOKS) { try { f(s, who, item); } catch { /* 钩子出错不影响钓鱼 */ } }
  return { item, first, record, mineFirst };
}
const desc = (c) => `${c.name}（${RARITY[c.rarity]}·${c.stars}★·${c.kg}kg）`;
const pickFish = (pl, q) => { const b = pl.bucket; if (!b.length) return -1; if (!q) return b.length - 1; const i = b.findIndex((x) => x.id === q || x.name.includes(q) || q.includes(x.name)); return i >= 0 ? i : b.length - 1; };

function sellFish(s, who, q) {
  const p = gearOf(s.players[who]); const all = /^(全部|都|所有|all)$/i.test(String(q || "").trim());
  let picks; if (all) picks = p.bucket.filter((x) => !KEEPSAKE.has(x.species)); else { const i = pickFish(p, q); picks = i >= 0 ? [p.bucket[i]] : []; }
  if (!picks.length) return { error: all ? "桶里没有能卖的" : "桶是空的" };
  const kept = picks.filter((x) => KEEPSAKE.has(x.species)); if (!all && kept.length) return { error: `秤砣不收${kept[0].name}：「这是有人惦记的东西，自己留着。」`, keepsake: true };
  let got = 0; const sold = [];
  for (const f of picks) { const v = scalesOf(f, p); p.bucket.splice(p.bucket.indexOf(f), 1); got += v; sold.push({ id: f.id, species: f.species, name: f.name, rarity: f.rarity, stars: f.stars, kg: f.kg, scales: v }); }
  // 欠秤砣的（心软赊的饵钱）先扣
  const repay = Math.min(p.debt || 0, got); if (repay) p.debt -= repay;
  p.coins += got - repay; note(s, { type: "sell", who, n: sold.length, coins: got, item: sold.length === 1 ? sold[0] : undefined });
  return { got, repay, n: sold.length, sold, coins: p.coins, debt: p.debt || 0 };
}
function buyItem(s, who, q, n = 1) {
  const p = gearOf(s.players[who]); const f = findItem(q); if (!f) return { error: `店里没有「${q}」` };
  const { kind, id, it } = f; n = kind === "bait" || kind === "item" ? Math.max(1, Math.min(10, Math.floor(Number(n)) || 1)) : 1;
  if (id === "worm") return { error: "蚯蚓不卖。秤砣：「空手的才给。」" };
  if (kind === "bait" && !baitOnSale(id)) return { error: `${it.name}现在不卖（限时的，节日前后才有）` };
  if (it.price == null) return { error: `${it.name}买不到，钓到那件东西才有` };
  if (kind === "item") { // v2 道具：可以囤
    n = Math.max(1, Math.min(10, Math.floor(Number(n)) || 1)); if (p.coins < it.price * n) return { error: `亮鳞不够（${it.name} ×${n} 要 ${it.price * n}，你有 ${p.coins}）`, short: it.price * n - p.coins };
    p.coins -= it.price * n; p.items = p.items || {}; p.items[id] = (p.items[id] || 0) + n; note(s, { type: "buy", who, name: it.name, n });
    return { ok: true, n, text: `买了 ${n} 个${it.name}（花 ${it.price * n}，剩 ${p.coins}）。用的时候写 [钓鱼:用 ${it.name}]。`, item: { kind, id, name: it.name } };
  }
  if (kind !== "bait" && p.owned.includes(id)) { p.gear[kind] = id; return { ok: true, text: `你已经有${it.name}了，换上了。`, item: { kind, id, name: it.name } }; }
  if (n > 1 && p.coins < it.price * n) return { error: `亮鳞不够（${n} 袋${it.name}要 ${it.price * n}，你有 ${p.coins}）`, short: it.price * n - p.coins, debt: p.debt || 0 };
  if (p.coins < it.price) {

    if (kind === "bait" && !(p.debt > 0)) { const owe = it.price - p.coins; p.debt = owe; p.coins = 0; p.baits[id] = (p.baits[id] || 0) + it.pack; p.bait = id; note(s, { type: "buy", who, name: it.name, soft: true });
      return { ok: true, soft: true, owe, text: `秤砣：「不赊账……」（停了两秒）「……这次算了。」给了你 ${it.pack} 份${it.name}，欠他 ${owe} 亮鳞，下回卖鱼先扣。`, item: { kind, id, name: it.name } }; }
    return { error: `亮鳞不够（${it.name} 要 ${it.price}，你有 ${p.coins}${p.debt > 0 ? `，还欠秤砣 ${p.debt}` : ""}）`, short: it.price - p.coins, debt: p.debt || 0 };
  }
  p.coins -= it.price;
  if (kind === "bait") { p.coins -= it.price * (n - 1); p.baits[id] = (p.baits[id] || 0) + it.pack * n; p.bait = id; note(s, { type: "buy", who, name: it.name, n }); return { ok: true, n, text: `买了 ${n > 1 ? `${n} 袋共 ` : ""}${it.pack * n} 份${it.name}，换上了（花 ${it.price * n}，剩 ${p.coins}）。`, item: { kind, id, name: it.name } }; }
  p.owned.push(id); if (kind !== "decor") p.gear[kind] = id; note(s, { type: "buy", who, name: it.name }); // 摆设只记有没有，不是装备
  if (kind === "decor") return { ok: true, text: `买了${it.name}（花 ${it.price}，剩 ${p.coins}）。去小屋摆上。`, item: { kind, id, name: it.name } };
  return { ok: true, text: `买了${it.name}，换上了（花 ${it.price}，剩 ${p.coins}）。`, item: { kind, id, name: it.name } };
}
function equipItem(s, who, q, kind) {
  const p = gearOf(s.players[who]); const f = findItem(q, kind); if (!f) return { error: `没有「${q}」` };
  if (f.kind === "bait") { if (f.id !== "worm" && !(p.baits[f.id] > 0)) return { error: `没有${f.it.name}了` }; p.bait = f.id; return { ok: true, text: `换上${f.it.name}了。` }; }
  if (f.kind === "charm" && f.it.need) { if (!hasKeepsake(p, f.it.need)) return { error: `还没钓到过${f.it.name}` }; if (!p.owned.includes(f.id)) p.owned.push(f.id); }
  if (!p.owned.includes(f.id)) return { error: `还没有${f.it.name}，先去秤砣那儿买` };
  p.gear[f.kind] = f.id; return { ok: true, text: `换上${f.it.name}了。` };
}
/** 给前端的：钱包 + 装备 + 店里的东西（每样带说明、有没有、能不能买） */
function shopView(p) {
  gearOf(p);
  const catalog = Object.fromEntries(Object.entries(SHOP).filter(([kind]) => (kind !== "item" && kind !== "decor") || ENV.v2).map(([kind, items]) => [kind, Object.entries(items).filter(([id, it]) => !(kind === "bait" && id === "worm") && (!it.v2 || ENV.v2)).map(([id, it]) => ({
    id, name: it.name, price: it.price, pack: it.pack, note: it.note, owned: kind === "bait" ? p.baits[id] || 0 : kind === "item" ? (p.items || {})[id] || 0 : p.owned.includes(id) || (it.need ? hasKeepsake(p, it.need) : false),
    onSale: kind === "bait" ? baitOnSale(id) : it.price != null, need: it.need ? SPECIES.find((x) => x.id === it.need)?.name : undefined }))]));
  return { coins: p.coins, debt: p.debt || 0, bait: p.bait, baits: p.baits, gear: p.gear, bucketUsed: bucketUsed(p), bucketSize: bucketSize(p), catalog, slots: SLOT_NAME,
    sellable: p.bucket.map((f) => ({ id: f.id, scales: scalesOf(f, p) })) };
}
const shopLine = (p) => { gearOf(p); const g = p.gear; const bait = p.bait === "worm" ? "蚯蚓（秤砣塞的）" : `${SHOP.bait[p.bait].name} ×${p.baits[p.bait]}`; return `亮鳞 ${p.coins}${p.debt > 0 ? `（欠秤砣 ${p.debt}）` : ""}。饵：${bait}。竿：${SHOP.rod[g.rod].name}，浮漂：${SHOP.bobber[g.bobber].name}，线轴：${SHOP.reel[g.reel].name}，挂件：${SHOP.charm[g.charm].name}，桶 ${bucketUsed(p)}/${bucketSize(p)}${keptCount(p) ? `（另有 ${keptCount(p)} 件纪念品）` : ""}。`; };

function useItem(s, who, q) {
  const p = gearOf(s.players[who]); const f = findItem(q, "item"); if (!f) return { error: `没有「${q}」这种道具` };
  p.items = p.items || {}; if (!(p.items[f.id] > 0)) return { error: `你没有${f.it.name}，先去秤砣那儿买` };
  const spot = p.spot || "pond"; let text = "";
  if (f.id === "sunny_doll") { const cur = (s.wx = s.wx || {})[spot]; s.wx[spot] = { kind: "晴", since: Date.now(), until: Date.now() + 3600000, prev: cur ? cur.kind : null, doll: who }; text = `挂上了晴天娃娃，${SPOT_NAME[spot] || spot}接下来一小时是晴天。`; }
  else if (f.id === "rain_pot") { const w = s.farm && s.farm.water; if (!w) return { error: "伞树农场还没开" }; w.level = Math.min(w.max, w.level + 2); text = `往伞里倒了两格水，现在 ${w.level}/${w.max}。`; }
  else if (f.id === "wrap") { p.wrapNext = (p.wrapNext || 0) + 1; text = "包装纸备好了，下次送鱼会包起来。"; }
  else if (f.id === "rubbing") { const best = Object.entries(p.mydex || {}).sort((a, b) => b[1].maxKg - a[1].maxKg)[0]; if (!best) return { error: "你还没钓到过鱼" }; const sp = SPECIES.find((x) => x.id === best[0]); p.rubbings = (p.rubbings || []).concat({ at: Date.now(), species: best[0], name: sp ? sp.name : best[0], kg: best[1].maxKg }).slice(-20); text = `拓好了：${sp ? sp.name : best[0]} ${best[1].maxKg}kg，挂进小屋。`; }
  else if (f.id === "rumor") { const list = specialsNow(s, spot).concat(...["pond", "sea", "lake"].filter((x) => x !== spot).map((x) => specialsNow(s, x).map((y) => ({ ...y, at: x })))); const pick = list[Math.floor(Math.random() * list.length)];
    text = Math.random() < 0.2 || !pick ? "秤砣压低声音：「听说……今天没什么稀罕的。」（他好像在打瞌睡）" : `秤砣压低声音：「${pick.at ? (SPOT_NAME[pick.at] || pick.at) + "那边" : "就这儿"}，${pick.why}，有人见过${pick.name}。」`; }
  p.items[f.id]--; if (!p.items[f.id]) delete p.items[f.id]; note(s, { type: "use", who, name: f.it.name });
  return { ok: true, text };
}

function aiFail(p, fish, hard) {
  const r = fish.rarity; const gp = gearOf(p).gear;
  return Math.max(0.02, (hard ? (0.03 + r * 0.1) / SHOP.reel[gp.reel].cap : 0.05 + r * 0.055) - SHOP.rod[gp.rod].hold);
}
function fightParams(p, fish) {
  const r = fish.rarity; const gp = gearOf(p).gear; const rod = SHOP.rod[gp.rod], reel = SHOP.reel[gp.reel];
  // 装备：竿让张力涨得慢、线轴让收线快 + 线能扛更大张力（cap，前端超过 cap 才断）
  return { staminaMs: Math.round(9000 + r * 3500 + rnd(0, 2000)), pull: +((0.25 + r * 0.12 + rnd(0, 0.08)) * rod.pull).toFixed(3), jitter: +(0.08 + r * 0.05).toFixed(3), reelMs: Math.round((3500 + fish.kg * 250 + r * 1500) * reel.reel), recover: 0.35, cap: reel.cap, seed: Math.floor(Math.random() * 1e9) };
}

// ── 钓点和天气 ──
const SPOT_NAME = { pond: "小池塘", sea: "海边", lake: "湖", ...(RIVER_OPEN ? { river: "夜河" } : {}) };
const WX_W = { pond: { 晴: 40, 多云: 25, 小雨: 14, 大雨: 6, 雾: 10, 大风: 5 }, sea: { 晴: 34, 多云: 20, 小雨: 10, 大雨: 8, 雾: 8, 大风: 20 }, lake: { 晴: 26, 多云: 22, 小雨: 12, 大雨: 5, 雾: 30, 大风: 5 }, river: { 晴: 32, 多云: 26, 小雨: 16, 大雨: 6, 雾: 14, 大风: 6 } };
/** 某个钓点现在的天气：到点了就换一个（1～2.5 小时一换，尽量不连着一样）。每个世界（家里 / 联机）各算各的，存在 s.wx */
function weatherOf(s, spot) {
  s.wx = s.wx || {}; const now = Date.now(); const cur = s.wx[spot];
  if (cur && now < cur.until) return cur.kind;
  const w = WX_W[spot] || WX_W.pond; const kinds = Object.keys(w).filter((k) => !cur || k !== cur.kind || Math.random() < 0.3);
  const kind = pickW(kinds, (k) => w[k]); s.wx[spot] = { kind, since: now, until: now + rnd(60, 150) * 60000, prev: cur ? cur.kind : null }; return kind; // prev：v2 的「雨后」要知道上一段
}
const dexView = (s) => SPECIES.filter((sp) => (RIVER_OPEN || sp.spot !== "river") && (!sp.v2 || ENV.v2)).map((sp) => ({ id: sp.id, name: sp.name, spot: sp.spot, rarity: sp.r, stars: sp.r + 1, junk: !!sp.junk, hours: sp.hours || null, ...(s.dex[sp.id] ? { caught: true, ...s.dex[sp.id], sign: sp.sign } : { caught: false }) }));

// ── 岸边地形（跟前端 src/pixel/world.ts 是同一个池塘 / 海岸线 / 湖）──
const PC = { x: 384, y: 236 }, RX = 214, RY = 138;
const pondF = (a) => 1 + 0.11 * Math.sin(2 * a + 1) + 0.07 * Math.sin(3 * a + 2.2) + 0.04 * Math.sin(5 * a + 0.5);
const pondQ = (x, y) => { const dx = (x - PC.x) / RX, dy = (y - PC.y) / RY; return Math.hypot(dx, dy) / pondF(Math.atan2(dy, dx)); };
// 海边的「角度」其实是沿海岸线的参数，x = 384 + a*220（-1.55～1.55，差值不会超过 π，走路不绕反）
const seaShore = (x) => 300 + 16 * Math.sin(x / 68) + 9 * Math.sin(x / 29 + 1.3);
// 湖：一样是「一圈岸」，更大、形状参数不同（跟前端 world.ts setBasin("lake") 一样）
const LAKE = { CY: 250, RX: 290, RY: 158, BF: [0.08, 0.4, 0.06, 1.7, 0.03, 2] };
const lakeF = (a) => 1 + LAKE.BF[0] * Math.sin(2 * a + LAKE.BF[1]) + LAKE.BF[2] * Math.sin(3 * a + LAKE.BF[3]) + LAKE.BF[4] * Math.sin(5 * a + LAKE.BF[5]);
function bank(a, out = 15, place = "pond") {
  if (place === "lake") { const f = lakeF(a); return { x: PC.x + Math.cos(a) * (LAKE.RX * f + out), y: LAKE.CY + Math.sin(a) * (LAKE.RY * f + out * 0.6) }; }
  if (place === "sea") { const x = 384 + Math.max(-1.55, Math.min(1.55, a)) * 220; return { x, y: seaShore(x) - out }; }
  if (place === "river") { const y = 280 + Math.max(-1.55, Math.min(1.55, a)) * 140; return { x: rcx(y) + rhw(y) + out, y }; }
  let lo = 0.5, hi = 2; const c = Math.cos(a), sn = Math.sin(a);
  for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (pondQ(PC.x + c * RX * mid, PC.y + sn * RY * mid) > 1) hi = mid; else lo = mid; }
  return { x: PC.x + c * (RX * hi + out), y: PC.y + sn * (RY * hi + out * 0.6) };
}
const WALK_PX = 36; // 像素 / 秒，跟前端走路一样快
function walkMs(a0, a1, place) { let L = 0, p = bank(a0, 15, place); for (let i = 1; i <= 40; i++) { const q = bank(a0 + ((a1 - a0) * i) / 40, 15, place); L += Math.hypot(q.x - p.x, q.y - p.y); p = q; } return Math.round((L / WALK_PX) * 1000); }
const angNorm = (a) => { const t = 2 * Math.PI; return ((((a + Math.PI) % t) + t) % t) - Math.PI; };
// 岸边的地名（南边正中是栈桥，不当钓点）
const SPOTS = [["北岸", -Math.PI / 2], ["东北岸", -Math.PI / 4], ["东岸", 0], ["东南岸", Math.PI * 0.28], ["西南岸", Math.PI * 0.72], ["西岸", Math.PI], ["西北岸", -Math.PI * 0.75]];
const SEA_SPOTS = [["西边礁石", -1.3], ["西滩", -0.75], ["沙路口", -0.1], ["东滩", 0.55], ["东边浅湾", 1.25]];
// 夜河：沿东岸从上游到下游，y = 280 + a*140（-1.55～1.55，跟海边一样是一条线）
const rcx = (y) => 560 - y * 0.62 + 18 * Math.sin(y / 57) + 8 * Math.sin(y / 23 + 1);
const rhw = (y) => 44 + 5 * Math.sin(y / 41 + 2);
const RIVER_SPOTS = [["上游柳岸", -1.4], ["灯串底下", -0.6], ["石桥东头", 0.35], ["下游灯影", 1.05], ["河湾口", 1.45]];
const LAKE_SPOTS = [["东北松林", -0.75], ["东岸", -0.1], ["东南湾", 0.8], ["西南湾", 2.3], ["西岸", Math.PI], ["西北松林", -2.5]];
const spotsOf = (place) => (place === "sea" ? SEA_SPOTS : place === "lake" ? LAKE_SPOTS : place === "river" ? RIVER_SPOTS : SPOTS);
/** 这个钓点是一条线（海边 / 夜河）：角度不绕圈 */
const lineSpot = (place) => place === "sea" || place === "river";
const spotOf = (a, place = "pond") => spotsOf(place).reduce((b, x) => (Math.abs(lineSpot(place) ? x[1] - a : angNorm(x[1] - a)) < Math.abs(lineSpot(place) ? b[1] - a : angNorm(b[1] - a)) ? x : b))[0];

// 台词这类内容放 CHEER_LINES，开源时可以整段换掉。

// 传说鱼一起拉：夜河之主不再一个人钓（LORD_SOLO=false），只在这个事件里出。
const LORD_SOLO = false;
const LEGEND = {
  species: "river_lord",
  arriveMs: 3 * 60000,      // 提示后 3 分钟内到场
  giveUpMs: 30 * 60000,     // 叫了 30 分钟没人开拉，它沉下去
  fightMaxMs: 5 * 60000,    // 开拉 5 分钟还没报结果，算跑了
  cheerCdMs: 5000,          // 同一个人连着喊的冷却
  nightOdds: 1 / 3,         // 大概三晚出一次
  pityStep: 0.15,           // 没拉上来：下次出的概率 + 这么多，也更好拉
  helpers: COMPANIONS,  // 家里的帮手；联机里是在场的所有人
};
// 帮忙的两种喊法：前端按这个松张力。放线松得多，但鱼往远跑一截（体力条加长）
const CHEER = { 加油: { tension: -0.12 }, 放线: { tension: -0.3, staminaMs: 2500 } };
const CHEER_LINES = CONTENT.CHEER_LINES || { 加油: ["加油！"], 放线: ["放线！"] }; // 内容包里换

function legendTick(s, o = {}) {
  const now = Date.now(); const nk = nightKey(now); const L = s.legend; const out = {};
  if (L && (L.phase === "calling" || L.phase === "fight")) {
    if (L.phase === "calling" && (now - L.at > LEGEND.giveUpMs || !riverHour())) { L.phase = "gone"; L.endedAt = now; out.gone = L; }
    else if (L.phase === "fight" && now - L.fightAt > LEGEND.fightMaxMs) legendEnd(s, "escaped"), out.ended = s.legend;
    return out;
  }
  if (!o.riverOpen || !riverHour() || s.legendDone === nk) return out;
  if (!s.legendRoll || s.legendRoll.night !== nk) s.legendRoll = { night: nk, yes: Math.random() < LEGEND.nightOdds + LEGEND.pityStep * (s.legendPity || 0), at: now + rnd(2, 90) * 60000 };
  if (s.legendRoll.yes && now >= s.legendRoll.at && o.herHere) {
    const sp = SPECIES.find((x) => x.id === LEGEND.species);
    s.legend = { id: `L${now.toString(36)}`, night: nk, species: sp.id, name: sp.name, kg: Math.round(rnd(sp.kg[0], sp.kg[1]) * 100) / 100, phase: "calling", at: now, arriveBy: now + LEGEND.arriveMs, joined: {}, cheers: [], pity: s.legendPity || 0 };
    s.legendDone = nk; note(s, { type: "legend", phase: "calling", name: sp.name });
    out.spawned = s.legend;
  }
  return out;
}

function legendJoin(s, who) {
  const L = s.legend; if (!L || (L.phase !== "calling" && L.phase !== "fight") || L.joined[who]) return false;
  L.joined[who] = Date.now(); note(s, { type: "legend", phase: "join", who }); return true;
}

function legendStart(s, helpers = LEGEND.helpers) {
  const L = s.legend; if (!L || L.phase !== "calling") return { error: "现在没有传说鱼可以拉" };
  const now = Date.now(); const came = helpers.filter((w) => L.joined[w] && L.joined[w] <= Math.max(now, L.arriveBy)); const missing = helpers.length - came.length;
  const ease = Math.max(0.6, 1 - 0.08 * (L.pity || 0)); const hard = 1 + 0.12 * missing;
  L.phase = "fight"; L.fightAt = now; L.helpers = came;
  L.fight = { staminaMs: Math.round((32000 + rnd(0, 8000)) * hard * ease), pull: +(0.74 * hard * ease).toFixed(3), jitter: 0.32, reelMs: Math.round((9000 + L.kg * 250) * ease), recover: 0.3, cap: 1, seed: Math.floor(Math.random() * 1e9), legend: true, helpers: came, missing, cheer: CHEER, cheerCdMs: LEGEND.cheerCdMs };
  note(s, { type: "legend", phase: "fight", helpers: came }); return { ok: true, fight: L.fight };
}
/** 帮手喊一声。line 不给就挑一句默认的；只有到了夜河的才能喊；5 秒冷却 */
function legendCheer(s, who, kind, line) {
  const L = s.legend; if (!L || L.phase !== "fight") return { error: "现在没人在拉传说鱼" };
  if (!CHEER[kind]) return { error: "只有 加油 / 放线" };
  if (!L.joined[who]) return { error: "你还没到夜河，先 [钓鱼:去 夜河]" };
  const now = Date.now(); const last = [...L.cheers].reverse().find((c) => c.who === who);
  if (last && now - last.at < LEGEND.cheerCdMs) return { error: `喊太快了，${Math.ceil((LEGEND.cheerCdMs - (now - last.at)) / 1000)} 秒后再喊` };
  const text = String(line || "").replace(/\s+/g, " ").trim().slice(0, 20) || CHEER_LINES[kind][Math.floor(Math.random() * CHEER_LINES[kind].length)];
  const c = { at: now, who, kind, line: text }; L.cheers.push(c); L.cheers = L.cheers.slice(-60); return { ok: true, cheer: c };
}

function legendEnd(s, result, took = 0) {
  const L = s.legend; if (!L || L.phase !== "fight") return { error: "这条不在拉" };
  const now = Date.now();
  if (result === "landed" && took < L.fight.reelMs * 0.4) return { error: "收得太快了（前端计时对不上）", need: L.fight.reelMs };
  const names = [HOST, ...(L.helpers || []), ...Object.keys(L.joined).filter((w) => w !== HOST && !(L.helpers || []).includes(w))];
  L.endedAt = now;
  // 成就馆：在场的每个人记一次（拉上来 legendCoop / 断了 legendTry）
  for (const w of names) { const q = s.players[w]; if (q) { if (result === "landed") q.legendCoop = (q.legendCoop || 0) + 1; else q.legendTry = (q.legendTry || 0) + 1; } }
  if (result === "landed") {
    const r = addCatch(s, HOST, { species: L.species, name: L.name, rarity: 4, stars: 5, kg: L.kg, junk: false });
    s.legendBoard = (s.legendBoard || []).concat({ at: now, species: L.species, name: L.name, kg: L.kg, names }).slice(-50);
    s.legendPity = 0; L.phase = "won"; L.item = r.item; note(s, { type: "legend", phase: "won", names, name: L.name, kg: L.kg });
  } else {
    const scale = { id: `f${now.toString(36)}${crypto.randomBytes(2).toString("hex")}`, at: now, by: HOST, species: "lord_scale", name: `${L.name}的鳞`, rarity: 4, stars: 5, kg: 0.01, junk: false, note: "差一点", with: names };
    s.players[HOST].bucket.push(scale); s.legendPity = (s.legendPity || 0) + 1; L.phase = "lost"; L.item = scale;
    note(s, { type: "legend", phase: "lost", names, name: L.name });
  }
  return { ok: true, result: L.phase, item: L.item, names, board: s.legendBoard || [] };
}
const legendView = (s) => { const L = s.legend; if (!L) return null; const { fight, ...rest } = L; return { ...rest, fight: L.phase === "fight" ? fight : undefined, board: (s.legendBoard || []).slice(-10) }; };

// 打赌：三种；谁都能发起，其他人都接了才算；赌注只记账（欠条），兑现了本人划掉
const BET_KINDS = { heaviest: "今天谁钓的最重", first: "谁先钓到", most: "今晚谁钓得多" };
const BET_ACCEPT_MS = 30 * 60000;
const shMidnight = (t = Date.now()) => { const d = new Date(t + 8 * 3600000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - 8 * 3600000; };
const next5am = (t = Date.now()) => { const d = new Date(t + 8 * 3600000); let x = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 5) - 8 * 3600000; if (x <= t) x += 86400000; return x; };

function betCreate(s, who, o = {}, people = [HOST, ...COMPANIONS], coinsOnly = false) {
  const kind = o.kind; if (!BET_KINDS[kind]) return { error: "赌什么？最重 / 先钓到 某种鱼 / 条数" };
  if (!people.includes(who)) return { error: "你不在这局里" };
  const stake = String(o.stake || "").replace(/\s+/g, " ").trim().slice(0, 60); if (!stake) return { error: "赌注写一下（比如「输的给赢的唱首歌」）" };
  if (coinsOnly && !/^\d{1,5}\s*亮鳞$/.test(stake)) return { error: "朋友在场只能赌亮鳞，写「50 亮鳞」这样" };
  let sp = null; if (kind === "first") { const q = String(o.species || "").trim(); sp = SPECIES.find((x) => x.id === q || x.name === q) || SPECIES.find((x) => q && x.name.includes(q)); if (!sp || sp.junk || sp.lord) return { error: "先钓到哪种鱼？写图鉴里的名字（传说鱼不算）" }; }
  const now = Date.now(); s.bets = s.bets || [];
  if (s.bets.filter((b) => b.status === "open" || b.status === "on").length >= 3) return { error: "已经有 3 个赌没结了，先结掉再开" };
  const b = { id: `b${now.toString(36)}`, kind, title: kind === "first" ? `谁先钓到${sp.name}` : BET_KINDS[kind], species: sp ? sp.id : null, stake, by: who, at: now, people, accepted: { [who]: now }, status: "open", acceptBy: now + BET_ACCEPT_MS,
    settleAt: kind === "heaviest" ? shMidnight(now) : kind === "most" ? next5am(now) : now + 48 * 3600000, best: {}, counts: {}, winner: null, iou: [], coinsOnly };
  s.bets.push(b); s.bets = s.bets.slice(-30); note(s, { type: "bet", phase: "open", who, id: b.id, title: b.title }); return { ok: true, bet: b };
}
/** 接 / 不接。所有人都接了才开始算（开始之前钓的不算） */
function betAnswer(s, who, id, yes) {
  const b = (s.bets || []).find((x) => x.id === id) || [...(s.bets || [])].reverse().find((x) => x.status === "open" && !x.accepted[who] && x.people.includes(who));
  if (!b || b.status !== "open") return { error: "没有等你接的赌" };
  if (!b.people.includes(who)) return { error: "你不在这局里" };
  if (!yes) { b.status = "declined"; b.declinedBy = who; note(s, { type: "bet", phase: "declined", who, id: b.id }); return { ok: true, bet: b }; }
  b.accepted[who] = Date.now();
  if (b.people.every((p) => b.accepted[p])) { b.status = "on"; b.startAt = Date.now(); note(s, { type: "bet", phase: "on", id: b.id, title: b.title }); }
  return { ok: true, bet: b };
}
function betSettle(b, winner, s) {
  b.status = "settled"; b.settledAt = Date.now(); b.winner = winner || null;
  // 成就馆：参加过几场 / 赢过几场（s.bets 只留 30 场，所以记在人身上）
  if (s) for (const p of b.people) { const q = s.players[p]; if (q) { q.betsPlayed = (q.betsPlayed || 0) + 1; if (p === winner) q.betWins = (q.betWins || 0) + 1; } }
  b.iou = winner ? b.people.filter((p) => p !== winner).map((p) => ({ from: p, to: winner, stake: b.stake, paid: false })) : [];
}
/** 每钓上一条（addCatch 里调） */
function betOnCatch(s, who, item) {
  for (const b of s.bets || []) {
    if (b.status !== "on" || !b.people.includes(who) || item.at < b.startAt) continue;
    if (b.kind === "heaviest") b.best[who] = Math.max(b.best[who] || 0, item.kg || 0);
    else if (b.kind === "most") b.counts[who] = (b.counts[who] || 0) + 1;
    else if (b.kind === "first" && item.species === b.species) { betSettle(b, who, s); b.justSettled = true; }
  }
}
/** 到点结算 / 没人接过期。返回这次刚结的（世界去贴欠条） */
function betTick(s) {
  const now = Date.now(); const done = [];
  for (const b of s.bets || []) {
    if (b.justSettled) { delete b.justSettled; done.push(b); continue; }
    if (b.status === "open" && now > b.acceptBy) { b.status = "expired"; continue; }
    if (b.status !== "on" || now < b.settleAt) continue;
    const score = b.kind === "heaviest" ? b.best : b.counts; const top = Math.max(0, ...Object.values(score));
    const lead = Object.keys(score).filter((k) => score[k] === top && top > 0);
    betSettle(b, lead.length === 1 ? lead[0] : null, s); done.push(b); // 平局 / 都没钓到：不欠
  }
  return done;
}
/** 兑现了：欠的人自己划掉（id 不给就划掉他最早一张没还的） */
function betPay(s, who, id) {
  for (const b of s.bets || []) { if (id && b.id !== id) continue; const i = b.iou.find((x) => x.from === who && !x.paid); if (i) { i.paid = true; i.paidAt = Date.now(); const q = s.players[who]; if (q) q.betsPaid = (q.betsPaid || 0) + 1; return { ok: true, bet: b, iou: i }; } }
  return { error: "你没有欠着的" };
}
const betsView = (s) => (s.bets || []).slice(-10);

// 鱼缸：三个人共用，最多 TANK_CAP 条；放进去就不在鱼桶里了（不能卖），主人可以拿回鱼桶。纪念品不进鱼缸（在柜子里，柜子直接看各人桶里的纪念品）。
const TANK_CAP = 6;
const AI_TANK_MAX = 2;
const CABIN_OPEN = false;
function tankPut(s, who, q) {
  const p = gearOf(s.players[who]); s.cabin = s.cabin || { tank: [] };
  if (s.cabin.tank.length >= TANK_CAP) return { error: `鱼缸满了（${TANK_CAP} 条），先拿一条出来` };
  if (who !== HOST && s.cabin.tank.filter((x) => x.owner === who).length >= AI_TANK_MAX) return { error: `你已经放了 ${AI_TANK_MAX} 条了（一人最多 ${AI_TANK_MAX} 格，给${nameOf(HOST)}留位置），先 [钓鱼:出缸] 一条` };
  const i = pickFish(p, q); if (i < 0) return { error: "桶是空的" }; const f = p.bucket[i];
  if (KEEPSAKE.has(f.species)) return { error: `${f.name}是纪念品，放在小屋的柜子里，不进鱼缸` };
  if (f.junk) return { error: `${f.name}不是鱼，放不进鱼缸` };
  p.bucket.splice(i, 1); const t = { ...f, owner: who, inAt: Date.now() }; s.cabin.tank.push(t); note(s, { type: "tank", who, item: f });
  return { ok: true, text: `把${desc(f)}放进小屋的鱼缸了（${s.cabin.tank.length}/${TANK_CAP}）。`, item: t };
}
function tankTake(s, who, q) {
  const p = gearOf(s.players[who]); const tank = (s.cabin && s.cabin.tank) || [];
  const mine = tank.filter((x) => x.owner === who); if (!mine.length) return { error: "鱼缸里没有你放的鱼" };
  const f = mine.find((x) => x.id === q || (q && (x.name.includes(q) || String(q).includes(x.name)))) || mine[mine.length - 1];
  if (bucketUsed(p) >= bucketSize(p)) return { error: `桶满了（${bucketUsed(p)}/${bucketSize(p)}），拿不回来` };
  tank.splice(tank.indexOf(f), 1); const { owner, inAt, ...fish } = f; p.bucket.push(fish); note(s, { type: "untank", who, item: fish });
  return { ok: true, text: `把${desc(fish)}从鱼缸里捞回鱼桶了。`, item: fish };
}

const DECOR_SLOTS = ["hall_wall", "hall_shelf", "attic_hook", "kitchen_wall", "window", "door_top"];
const NOTE_MAX = 12, NOTE_LEN = 40;
const cabinOf = (s) => { s.cabin = s.cabin || { tank: [] }; s.cabin.decor = s.cabin.decor || {}; s.cabin.notes = s.cabin.notes || []; s.cabin.guests = s.cabin.guests || []; return s.cabin; };
const decorOwned = (s) => [...new Set(Object.values(s.players).flatMap((p) => (p.owned || []).filter((id) => SHOP.decor[id])))];
function cabinPlace(s, slot, item) {
  const c = cabinOf(s); if (!DECOR_SLOTS.includes(slot)) return { error: "没有这个位置：" + slot, code: 400 };
  if (item == null || item === "") { const was = c.decor[slot]; c.decor[slot] = null; return { ok: true, text: was ? "收起来了" : "那里本来就空着" }; }
  if (!SHOP.decor[item]) return { error: "不是摆设：" + item, code: 400 };
  if (!decorOwned(s).includes(item)) return { error: "还没买" + SHOP.decor[item].name, code: 409 };
  for (const k of DECOR_SLOTS) if (c.decor[k] === item) c.decor[k] = null; // 一个摆设同时只在一个位置
  c.decor[slot] = item; return { ok: true, text: "把" + SHOP.decor[item].name + "摆好了" };
}
function cabinNote(s, who, text) {
  const c = cabinOf(s); const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return { error: "留言是空的" }; if ([...t].length > NOTE_LEN) return { error: "留言最多 " + NOTE_LEN + " 个字" };
  const n = { id: "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), from: who, text: t, at: Date.now() };
  c.notes.unshift(n); c.notes.length = Math.min(c.notes.length, NOTE_MAX); return { ok: true, note: n };
}
/** 小屋全貌：鱼缸、纪念品柜（各人桶里的纪念品）、纪录板（每种鱼最重的那条是谁钓的）、每人一个角落（自己的图鉴 + 最得意的一条） */
function cabinView(s) {
  const tank = ((s.cabin && s.cabin.tank) || []).map((f) => ({ id: f.id, species: f.species, name: f.name, rarity: f.rarity, stars: f.stars, kg: f.kg, owner: f.owner, inAt: f.inAt }));
  const keepsakes = []; for (const [id, p] of Object.entries(s.players)) for (const f of p.bucket || []) if (KEEPSAKE.has(f.species)) keepsakes.push({ id: f.id, species: f.species, name: f.name, owner: id, at: f.at });
  const board = Object.entries(s.dex).filter(([sp, d]) => d.maxBy && (RIVER_OPEN || SPECIES.find((x) => x.id === sp)?.spot !== "river")).map(([sp, d]) => { const x = SPECIES.find((y) => y.id === sp) || {}; return { species: sp, name: x.name || sp, rarity: x.r || 0, junk: !!x.junk, maxKg: d.maxKg, maxBy: d.maxBy }; })
    .filter((r) => !r.junk).sort((a, b) => b.rarity - a.rarity || b.maxKg - a.maxKg).slice(0, 16);
  const corners = Object.fromEntries(Object.entries(s.players).map(([id, p]) => { const md = p.mydex || {}; const kinds = Object.keys(md).filter((sp) => RIVER_OPEN || SPECIES.find((x) => x.id === sp)?.spot !== "river");
    const best = kinds.map((sp) => ({ sp, x: SPECIES.find((y) => y.id === sp) })).filter((o) => o.x && !o.x.junk).sort((a, b) => b.x.r - a.x.r || md[b.sp].maxKg - md[a.sp].maxKg)[0];
    return [id, { name: p.name, catches: p.catches || 0, kinds: kinds.length, dex: Object.fromEntries(kinds.map((sp) => [sp, md[sp]])), best: best ? { species: best.sp, name: best.x.name, rarity: best.x.r, maxKg: md[best.sp].maxKg } : null }]; }));
  const c = cabinOf(s);
  const decor = Object.fromEntries(DECOR_SLOTS.map((k) => [k, c.decor[k] || null]));
  const rubbings = Object.entries(s.players).flatMap(([id, p]) => (p.rubbings || []).map((r) => ({ species: r.species, name: r.name, kg: r.kg, by: id, at: r.at }))).sort((a, b) => b.at - a.at);
  const guests = c.guests.map((g) => ({ id: g.id, name: g.name, firstAt: g.firstAt, lastAt: g.lastAt, here: !!g.here }));
  return { tank, tankCap: TANK_CAP, keepsakes, board, corners, decor, decorSlots: DECOR_SLOTS, decorOwned: decorOwned(s), notes: c.notes.slice(0, NOTE_MAX), rubbings, guests };
}

const HOLDINGS = ["coins", "debt", "bait", "baits", "gear", "owned", "bucket", "seen", "rares", "legends", "gifted", "catches"];
const holdingsOf = (p) => { gearOf(p); return JSON.parse(JSON.stringify(Object.fromEntries(HOLDINGS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])))); };
const applyHoldings = (p, h) => { for (const k of HOLDINGS) if (h[k] !== undefined) p[k] = JSON.parse(JSON.stringify(h[k])); return gearOf(p); };

module.exports = {
  CONTENT, ROLES, HOST, COMPANIONS, nameOf,
  rnd, pickW, shHour, isNight, RARITY, SPECIES, BITE_MS, PRICE, KEEPSAKE, SHOP, SLOT_NAME, baitOnSale,
  gearOf, keptCount, bucketUsed, bucketSize, charmOf, hasKeepsake, findItem, scalesOf, useBait, wormNo, aiFail, WORM_DAY, baitOdds, biteSecs, luckOf,
  rollCatch, note, addCatch, desc, pickFish, sellFish, buyItem, equipItem, shopView, shopLine, SHOP_HELP, fightParams,
  SPOT_NAME, WX_W, weatherOf, dexView,
  bank, walkMs, WALK_PX, angNorm, SPOTS, SEA_SPOTS, LAKE_SPOTS, RIVER_SPOTS, spotsOf, spotOf, lineSpot,
  RIVER_OPEN, riverHour, moonFull, nightKey,
  ENV, setEnv, FEST, festOn, COND, speciesOk, specialsNow, useItem, shDate,
  HOLDINGS, holdingsOf, applyHoldings,
  TANK_CAP, AI_TANK_MAX, CABIN_OPEN, tankPut, tankTake, cabinView,
  DECOR_SLOTS, NOTE_LEN, cabinPlace, cabinNote,
  LORD_SOLO, LEGEND, CHEER, CHEER_LINES, legendTick, legendJoin, legendStart, legendCheer, legendEnd, legendView,
  CATCH_HOOKS, BET_KINDS, betCreate, betAnswer, betOnCatch, betTick, betPay, betsView,
};
