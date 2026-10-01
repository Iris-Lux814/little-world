
// 跑法：node online/test/flow.test.js
"use strict";
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");
const assert = require("assert");

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lw-"));
fs.writeFileSync(path.join(DATA, "secret.json"), JSON.stringify({ online: "test-online-secret-123", sign: "test-sign-secret-456" }));
const PORT = 29990;
const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
const B = `http://127.0.0.1:${PORT}/online`;
const HOME = { "x-online-secret": "test-online-secret-123" };
const call = async (method, p, body, headers = {}) => { const r = await fetch(B + p, { method, headers: { "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined }); return { code: r.status, j: await r.json() }; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { assert.ok(c, m); console.log("✓", m); };

(async () => {
  for (let i = 0; i < 40; i++) { try { await call("GET", "/api/ping"); break; } catch { await wait(150); } }
  // 没登录什么都不给
  ok((await call("GET", "/api/world")).code === 401, "没登录拿不到世界");

  const tk = (await call("POST", "/api/home/ticket", null, HOME)).j.ticket; const HOST = { Authorization: `Bearer ${tk}` };
  ok(/^host\.\d+\./.test(tk), "家里的桥能给你发短期票");
  ok((await call("POST", "/api/home/ticket", null, { "x-online-secret": "wrong" })).code === 401, "钥匙不对发不了票");
  const bad = { Authorization: `Bearer host.${Date.now() + 99999}.deadbeef` }; ok((await call("GET", "/api/invites", null, bad)).code === 401, "伪造的票不认");
  // 发邀请
  const inv = (await call("POST", "/api/invites", { label: "小A", password: "abcd", hours: 12, canTalk: true }, HOST)).j;
  ok(inv.ok && inv.path.includes(inv.invite.id), "你发了一个邀请（12 小时，能跟阿树说话）");
  // 朋友：密码错 / 对
  ok((await call("POST", "/api/join", { invite: inv.invite.id, password: "wrong", device: "dev-phone-A-1234567" })).code === 403, "密码错进不来");
  const j1 = await call("POST", "/api/join", { invite: inv.invite.id, password: "abcd", device: "dev-phone-A-1234567", name: "阿A" });
  ok(j1.code === 202 && j1.j.pending, "第一台设备：等你同意");
  ok((await call("GET", `/api/join/${j1.j.request}?device=dev-phone-A-1234567`)).j.pending, "朋友在等");
  // 家里的桥能看到「有人要进来」
  const feed1 = (await call("GET", "/api/home/feed?since=0", null, HOME)).j; ok(feed1.events.some((e) => e.type === "request" && e.name === "阿A"), "家里的桥取到「阿A 想进来」（推给你）");
  const pend = (await call("GET", "/api/invites", null, HOST)).j.pending; ok(pend.length === 1, "你的邀请列表里有一个待同意");
  ok((await call("POST", "/api/approve", { request: pend[0].id, allow: true }, HOST)).j.ok, "你点了同意");
  const g1 = await call("GET", `/api/join/${j1.j.request}?device=dev-phone-A-1234567`); ok(g1.j.token, "朋友拿到会话");
  const G = { Authorization: `Bearer ${g1.j.token}` };
  ok((await call("GET", `/api/join/${j1.j.request}?device=dev-phone-A-1234567`)).j.token === undefined, "会话只能领一次");
  // 别的设备拿同一个链接 + 密码：进不来
  ok((await call("POST", "/api/join", { invite: inv.invite.id, password: "abcd", device: "dev-other-B-7654321" })).code === 403, "转给别人（另一台设备）进不来");
  // 同一台设备再输一次密码：直接进（不用再同意）
  const again = await call("POST", "/api/join", { invite: inv.invite.id, password: "abcd", device: "dev-phone-A-1234567" }); ok(again.j.token, "同一台设备再来，不用再等同意");
  // 进世界、钓鱼
  const w = (await call("GET", "/api/world", null, G)).j; if (!w.ok) console.log("  world:", JSON.stringify(w).slice(0, 300)); ok(w.ok && w.players.some((p) => p.guest && p.name === "阿A"), "朋友进了联机世界");
  const cast = (await call("POST", "/api/cast", { power: 0.8 }, G)).j; ok(cast.castId && cast.biteIn > 0, `甩竿了（${Math.round(cast.biteIn / 1000)} 秒后咬钩）`);
  await wait(Math.min(cast.biteIn + 150, 25000));
  const hook = (await call("POST", "/api/hook", { castId: cast.castId }, G)).j;
  if (hook.result === "hooked") { await wait(hook.fight.reelMs * 0.45); const land = (await call("POST", "/api/land", { castId: cast.castId, result: "landed" }, G)).j; ok(land.result === "landed", `拉上来了：${land.fish.name}`); }
  else console.log("  （这竿没挂上：", hook.result, "）");
  const sell = (await call("POST", "/api/sell", { fish: "全部" }, G)).j; ok(sell.ok || /桶里没有/.test(sell.error), `卖鱼：${sell.ok ? `得 ${sell.got} 亮鳞` : sell.error}`);
  // 聊天：朋友说话，家里的桥取到，且带 canTalk
  ok((await call("POST", "/api/chat", { text: "阿树你好呀" }, G)).j.ok, "朋友在公共聊天说话");
  const feed2 = (await call("GET", `/api/home/feed?since=${feed1.seq}`, null, HOME)).j; ok(feed2.events.some((e) => e.type === "chat" && e.canTalk && e.text === "阿树你好呀"), "家里的桥取到朋友的话（标着能递给阿树）");
  for (let i = 0; i < 5; i++) await call("POST", "/api/chat", { text: `刷${i}` }, G);
  ok((await call("POST", "/api/chat", { text: "再刷" }, G)).code === 429, "朋友刷屏被限速");
  // 存档：导出 → 改一个字导不进 → 原样导入成功
  const ex = (await call("GET", "/api/me/export", null, G)).j.file; ok(ex && ex.sig, "朋友导出了存档（带签名）");
  const tampered = { ...ex, data: ex.data.replace(/"coins":(\d+)/, '"coins":999999') };
  ok((await call("POST", "/api/me/import", { file: tampered }, G)).code === 400, "改过亮鳞的存档导不进来");
  ok((await call("POST", "/api/me/import", { file: ex }, G)).j.ok, "原样的存档能导入");
  ok(fs.existsSync(path.join(DATA, "players", `g_${inv.invite.id}.json`)), "朋友有自己的一份存档文件");

  const holdings = { coins: 777, bucket: [{ id: "fx", species: "crucian", name: "小鲫鱼", rarity: 0, stars: 1, kg: 0.2 }], baits: { jelly: 5 }, bait: "jelly" };
  ok((await call("POST", "/api/home/enter", { who: "buddy", holdings }, HOME)).j.ok, "阿树带着家当进了联机（777 亮鳞、1 条鱼）");
  const look = (await call("POST", "/api/home/ai", { who: "buddy", text: "看看" }, HOME)).j.text; ok(/阿A/.test(look) && /亮鳞 777/.test(look), "阿树在联机里看得到阿A，家当也在");
  ok(/甩出去了/.test((await call("POST", "/api/home/ai", { who: "buddy", text: "甩竿" }, HOME)).j.text), "阿树在联机里甩竿");
  ok((await call("POST", "/api/home/ai", { who: "buddy", text: "卖 全部" }, HOME)).j.ok, "阿树卖鱼");
  const back = (await call("POST", "/api/home/leave", { who: "buddy" }, HOME)).j; ok(back.holdings && back.holdings.coins > 777, `阿树带回家的亮鳞 ${back.holdings.coins}（多了卖鱼的钱）`);

  ok((await call("GET", "/api/world", null, HOST)).code === 409, "你没带家当进来前，世界不让她玩");
  await call("POST", "/api/home/enter", { who: "player", holdings: { coins: 50 } }, HOME);
  ok((await call("GET", "/api/world", null, HOST)).j.wallet.coins === 50, "你进来了，钱包是带过来的 50");
  // 改密码：朋友当场被请出去
  ok((await call("PUT", `/api/invites/${inv.invite.id}`, { password: "newpw" }, HOST)).j.ok, "你改了密码");
  ok((await call("GET", "/api/world", null, G)).code === 401, "朋友的旧会话失效了");
  // 收回邀请
  await call("PUT", `/api/invites/${inv.invite.id}`, { revoke: true }, HOST);
  ok((await call("POST", "/api/join", { invite: inv.invite.id, password: "newpw", device: "dev-phone-A-1234567" })).code === 404, "收回后连新密码也进不来");
  // 过期
  const inv2 = (await call("POST", "/api/invites", { label: "小B", password: "zzzz", hours: 0.0001 }, HOST)).j; await wait(600);
  ok((await call("POST", "/api/join", { invite: inv2.invite.id, password: "zzzz", device: "dev-B-00000000000" })).code === 404, "过期的邀请进不来");
  ok(fs.readdirSync(path.join(DATA, "backup")).length >= 1, "有备份");
  console.log("\n全部通过");
})().catch((e) => { console.log("✗", e.message); console.log(log.slice(-800)); process.exitCode = 1; }).finally(() => srv.kill());
