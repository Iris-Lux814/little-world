// node test/engine.test.js —— 规则引擎冒烟测试：用当前内容包（谁是谁从 core.ROLES 拿）钓鱼、买卖、成对的鱼、农场、鱼桶牌各走一遍
"use strict";
const core = require("../engine/core.js");
const farm = require("../engine/farm.js");
const cards = require("../engine/cards.js");
let fail = 0; const ok = (c, m) => { if (c) console.log(`✓ ${m}`); else { fail++; console.log(`✗ ${m}`); } };
const H = core.HOST, [A, B] = core.COMPANIONS;
const mk = (id) => ({ id, name: core.nameOf(id), spot: "pond", bucket: [], coins: 3000, catches: 0 });
const s = { players: { [H]: mk(H), [A]: mk(A), [B]: mk(B) }, dex: {}, events: [], wx: {} };

ok(core.SPECIES.length > 20 && core.SHOP.bait.bread && core.SHOP.rod.pole, `内容包读到了（${core.SPECIES.length} 种鱼）`);
for (const spot of ["pond", "sea", "lake", "river"]) { s.players[H].spot = spot; const f = core.rollCatch(s.players[H], null, "晴", s); ok(f && f.name && f.kg >= 0, `${core.SPOT_NAME[spot] || spot}能钓：${f.name}`); }
const r = core.addCatch(s, H, { species: "crucian", name: "小鲫鱼", rarity: 0, stars: 1, kg: 0.2, junk: false }); ok(r.first && s.players[H].bucket.length === 1, "钓上来进鱼桶、记图鉴");
const sold = core.sellFish(s, H, "全部"); ok(sold.got > 0 && s.players[H].bucket.length === 0, `卖鱼得 ${sold.got}`);
const bought = core.buyItem(s, H, "草莓软糖"); ok(bought.ok, "买饵");
const pair = core.SPECIES.find((x) => x.pair);
if (pair) { core.addCatch(s, H, { species: pair.id, name: pair.name, rarity: pair.r, stars: pair.r + 1, kg: 0.2, junk: false }); ok(s.players[core.ROLES.partner].bucket.some((x) => x.species === pair.id), "成对的鱼另一条给了另一半"); }
ok(core.betCreate(s, A, { kind: "most", stake: "10 亮鳞" }).ok, "伙伴能开赌");
// 农场
ok(farm.buySeed(s, A, "草莓").ok && farm.plant(s, A, null, "草莓").ok, "伙伴种下草莓");
for (let d = 0; d < 6; d++) { farm.farmOf(s).water.level = 6; farm.spout(s, A, A); farm.farmDay(s); }
ok(farm.harvest(s, A).ok, "浇水长大、收菜");
// 鱼桶牌
const c = cards.create(s, H, [H, A, B], { SPECIES: core.SPECIES, weatherOf: core.weatherOf, hour: 12 }); ok(!c.error, "开一桌鱼桶牌");
cards.answer(s, A, true, { SPECIES: core.SPECIES }); const st = cards.answer(s, B, true, { SPECIES: core.SPECIES }); ok(st.started, "三个人都接了，开局");
for (let i = 0; i < cards.ROUNDS; i++) for (const w of [H, A, B]) cards.play(s, w, 1, { names: core.ROLES.names });
ok(s.cards.cur.status === "done" && s.cards.cur.endText, `打完：${s.cards.cur.endText}`);
console.log(fail ? `\n${fail} 项没过` : "\n全部通过"); process.exit(fail ? 1 : 0);
