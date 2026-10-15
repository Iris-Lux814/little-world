// 单人服务整套流程：临时目录起服务 → 看世界 → 甩竿 → 提竿 → 拉上来 → 卖 → 聊天 → 小人图 → 农场 / 牌桌 / 小屋接口都在
// 跑法：node test/solo.test.js
"use strict";
const WORLD_TZ = process.env.WORLD_TZ || "Etc/GMT-8"; // 游戏按 UTC+8 走（节日、夜河的钟点都按这个时区）
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");
const assert = require("assert");
const zlib = require("zlib");

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lw-solo-"));
const PORT = 29991;
const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "solo.js")], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
const B = `http://127.0.0.1:${PORT}`;
const call = async (method, p, body, raw) => { const r = await fetch(B + p, { method, headers: raw ? { "Content-Type": "image/png" } : { "Content-Type": "application/json" }, body: raw || (body ? JSON.stringify(body) : undefined) }); const ct = r.headers.get("content-type") || ""; return { code: r.status, j: ct.includes("json") ? await r.json() : null, buf: ct.includes("png") ? Buffer.from(await r.arrayBuffer()) : null }; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { assert.ok(c, m); console.log("✓", m); };
// 最小的 PNG：w×h 透明
function png(w, h, o = {}) {
  const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, "ascii"), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const color = o.color == null ? 6 : o.color; const chn = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = color; ihdr[10] = o.comp || 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.alloc(1 + w * chn); row[0] = o.filter || 0; const idat = zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)));
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr)];
  if (o.plte != null) parts.push(chunk("PLTE", Buffer.alloc(o.plte)));
  return Buffer.concat([...parts, chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// 进程内：替钓钩子、传说鱼补到场、PNG 整张校验（不起服务，用另一个临时存档目录）
{
  // 夜河只在晚上开：挑一个「现在是 20 点」的时区，传说鱼那条才测得到
  const want = (20 - new Date().getUTCHours() + 24) % 24; const o2 = want > 14 ? want - 24 : want;   // 时区偏移 -9..14 小时
  process.env.WORLD_TZ = o2 === 0 ? "Etc/GMT" : `Etc/GMT${o2 > 0 ? "-" : "+"}${Math.abs(o2)}`;
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "lw-solo-unit-"));
  const solo = require(path.join(__dirname, "..", "server", "solo.js")); const core = require(path.join(__dirname, "..", "engine", "core.js"));
  const s = solo.load(); const [c1] = core.COMPANIONS;
  s.cards = { favors: [{ from: core.HOST, to: c1 }] };
  core.addCatch(s, core.HOST, { species: core.SPECIES[0].id, name: core.SPECIES[0].name, rarity: 0, stars: 1, kg: 0.1, junk: false });
  ok(s.players[c1].bucket.length === 1 && s.players[c1].bucket[0].favor && s.players[core.HOST].bucket.length === 0 && !s.cards.favors.length, "替钓：钓上来的转进赢家的桶，欠钓划掉");
  s.players[c1].spot = "river"; s.legend = { phase: "calling", at: Date.now(), name: "x", species: core.SPECIES[0].id, kg: 10, joined: {}, helpers: core.COMPANIONS, cheers: [] };
  solo.save(s); solo.worldTick(); const s2 = solo.load();
  ok(s2.legend && s2.legend.joined && s2.legend.joined[c1], "鱼出来（calling）以后才到夜河的伙伴也算到场，而且存下来了");
  const fake = Buffer.concat([png(240, 320).subarray(0, 33), Buffer.from("garbage")]);
  ok(solo.pngSize(fake) === null && solo.pngSize(png(240, 320)) && solo.pngSize(png(240, 320)).w === 240, "只有 PNG 头没有图像数据的不认，完整的认");
  const bad = png(240, 320); bad[40] ^= 0xff; ok(solo.pngSize(bad) === null, "改了一个字节（CRC 对不上）不认");
  ok(solo.pngSize(png(240, 320, { filter: 5 })) === null, "行滤波值 5 不认");
  ok(solo.pngSize(png(240, 320, { comp: 1 })) === null, "压缩方法 1 不认");
  ok(solo.pngSize(png(240, 320, { color: 3 })) === null, "索引图没有 PLTE 不认");
  ok(solo.pngSize(png(240, 320, { color: 3, plte: 0 })) === null && solo.pngSize(png(240, 320, { color: 3, plte: 1 })) === null, "PLTE 长度 0 / 1 字节不认");
  ok(solo.pngSize(png(240, 320, { color: 3, plte: 6 })) && solo.pngSize(png(240, 320, { color: 3, plte: 6 })).w === 240, "带 2 条调色板的索引图认");
  ok(solo.pngSize(png(4000, 4000)) === null, "超过 240×320 的在解压前就拒");
}

(async () => {
  for (let i = 0; i < 40; i++) { try { await call("GET", "/api/world/ping"); break; } catch { await wait(150); } }
  const w0 = (await call("GET", "/api/world?px=10&py=20&pd=1")).j;
  ok(w0.ok && w0.players.length === 3 && w0.roles.host && w0.roles.companions.length === 2, "世界里有你和两个伙伴");
  ok(Object.keys(w0.ai).length === 2 && w0.dex.length > 10 && w0.wallet && w0.mePos.x === 10, "ai / 图鉴 / 钱包 / 站位都在");
  ok(w0.players.every((p) => p.sprite === null), "没传过小人图时 sprite 是 null");
  ok((await call("POST", "/api/world/farm/shake", {})).j.ok !== undefined, "农场接口在");
  ok((await call("GET", "/api/world/cabin")).j.ok, "小屋接口在");
  ok((await call("GET", "/api/world/cabin/layout")).j.ok, "家具布局接口在");
  ok((await call("GET", "/api/world/bet")).j.ok, "打赌接口在");
  ok((await call("GET", "/api/world/ddz")).j.ok, "斗地主接口在");
  ok((await call("GET", "/api/world/cards")).j.ok, "鱼桶牌接口在");
  ok((await call("GET", "/api/world/legend")).j.ok, "传说鱼接口在");
  ok((await call("GET", "/api/world/hide")).code === 404, "捉迷藏不带");
  // 钓一条：甩竿 → 等咬钩 → 提竿 → 拉 → 报结果
  const c = (await call("POST", "/api/world/cast", { power: 0.5, dir: 0 })).j; ok(c.ok && c.castId, "甩竿");
  await wait(c.biteIn + 300);
  const h = (await call("POST", "/api/world/hook", { castId: c.castId })).j; ok(h.ok && h.result === "hooked" && h.fight.reelMs > 0, "提竿上钩");
  await wait(h.fight.reelMs * 0.5);
  const l = (await call("POST", "/api/world/land", { castId: c.castId, result: "landed" })).j; ok(l.ok && l.result === "landed" && l.fish.name, `拉上来：${l.fish.name}`);
  ok((await call("POST", "/api/world/land", { castId: c.castId, result: "landed" })).j.result === "landed", "重复报同一竿回上次结果");
  const w1 = (await call("GET", "/api/world")).j; const mine = w1.players.find((p) => p.id === w1.roles.host); ok(mine.bucket.length === 1 && mine.catches === 1, "鱼进桶了");
  const sold = (await call("POST", "/api/world/sell", { fish: "全部" })).j; ok(sold.ok && sold.wallet, "卖给秤砣");
  // 聊天
  ok((await call("POST", "/api/world/chat", { text: "你好呀" })).j.chat.some((m) => m.text === "你好呀"), "发一句话");
  await wait(7000);
  const ch = (await call("GET", "/api/world/chat")).j.chat; ok(ch.some((m) => m.auto && m.who !== w1.roles.host), "伙伴会接一句");
  // 小人图
  ok((await call("POST", "/api/world/sprite", null, png(48, 64))).code === 400, "尺寸不对不收");
  ok((await call("POST", "/api/world/sprite", null, Buffer.from("not png"))).code === 400, "不是 PNG 不收");
  const up = (await call("POST", "/api/world/sprite", null, png(240, 320))).j; ok(up.ok && /\/api\/world\/sprite\/\w+\?v=\d+/.test(up.sprite), "传小人图");
  const got = await call("GET", `/api/world/sprite/${w1.roles.host}`); ok(got.code === 200 && got.buf && got.buf.length > 50, "能取回来");
  ok((await call("GET", "/api/world")).j.players.find((p) => p.id === w1.roles.host).sprite === up.sprite, "state 里带 sprite");
  ok((await call("DELETE", "/api/world/sprite")).j.ok && (await call("GET", `/api/world/sprite/${w1.roles.host}`)).code === 404, "删掉回默认");

  const [a1, a2] = w1.roles.companions;
  for (let i = 0; i < 3; i++) await call("POST", "/api/world/cast", { power: 0.3, dir: 0 }).then(async (c2) => { await wait(c2.j.biteIn + 300); const h2 = (await call("POST", "/api/world/hook", { castId: c2.j.castId })).j; if (h2.fight) { await wait(h2.fight.reelMs * 0.5); await call("POST", "/api/world/land", { castId: c2.j.castId, result: "landed" }); } });
  const cn = (await call("POST", "/api/world/cards/new", { with: [a1, a2] })).j; ok(cn.ok && cn.game && cn.game.status === "invite", "开一桌鱼桶牌");
  await wait(8000);
  const cg = (await call("GET", "/api/world/cards")).j.game; ok(cg && cg.status === "on", "伙伴自己接了牌，开局");
  const cp = (await call("POST", "/api/world/cards/play", { card: "1" })).j; ok(cp.ok, "出一张");
  await wait(7000);
  const cg2 = (await call("GET", "/api/world/cards")).j.game; ok(cg2 && (cg2.round >= 2 || cg2.status === "done"), "伙伴跟着出了，到下一轮");
  // 斗地主：坐下、拉两个伙伴、开局，伙伴托管自己打
  ok((await call("POST", "/api/world/ddz/sit", {})).j.ok, "斗地主坐下");
  ok((await call("POST", "/api/world/ddz/add", { who: a1 })).j.ok && (await call("POST", "/api/world/ddz/add", { who: a2 })).j.ok, "拉两个伙伴坐下");
  const dz = (await call("POST", "/api/world/ddz/start", {})).j; ok(dz.ok && dz.game, "斗地主开局");
  // 轮到我就叫 3 分 / 出牌（托管给的提示），伙伴那边 1.5 秒自动走；看 10 秒内局面有没有往前走
  const dz0 = (await call("GET", "/api/world/ddz")).j.game; const plays0 = dz0.plays.length + dz0.bid.log.length;
  for (let i = 0; i < 12; i++) {
    const g = (await call("GET", "/api/world/ddz")).j.game; if (!g || g.phase === "done") break;
    if (g.turn === w1.roles.host) { if (g.phase === "bid") await call("POST", "/api/world/ddz/bid", { score: 3 }); else { const hint = (await call("GET", "/api/world/ddz/hint")).j.ids; await call("POST", "/api/world/ddz/play", { ids: hint || [] }); } }
    await wait(800);
  }
  const dz2 = (await call("GET", "/api/world/ddz")).j.game; ok(dz2 && (dz2.phase === "done" || dz2.plays.length + dz2.bid.log.length > plays0), "伙伴托管着跟我打");
  // 伙伴自己会动：等几个 tick 看事件
  await wait(2500);
  const w2 = (await call("GET", "/api/world")).j; ok(w2.events.length >= 2, "世界在记事件");
  console.log("全部通过");
  srv.kill(); process.exit(0);
})().catch((e) => { console.error("✗", e.message); console.error(log.slice(-2000)); srv.kill(); process.exit(1); });
