
// 跑法：node online/test/ddz-flow.test.js
"use strict";
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");
const assert = require("assert");
const ddz = require("../engine/ddz.js");

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lwd-"));
fs.writeFileSync(path.join(DATA, "secret.json"), JSON.stringify({ online: "test-online-secret-123", sign: "test-sign-secret-456" }));
const PORT = 29991;
const srv = spawn(process.execPath, [path.join(__dirname, "..", "server", "server.js")], { env: { ...process.env, PORT: String(PORT), DATA_DIR: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => (log += d)); srv.stderr.on("data", (d) => (log += d));
const B = `http://127.0.0.1:${PORT}/online`;
const HOME = { "x-online-secret": "test-online-secret-123" };
const call = async (method, p, body, headers = {}) => { const r = await fetch(B + p, { method, headers: { "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined }); return { code: r.status, j: await r.json() }; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { assert.ok(c, m); console.log("✓", m); };
const holdings = { coins: 100, bucket: [] };

(async () => {
  for (let i = 0; i < 40; i++) { try { await call("GET", "/api/ping"); break; } catch { await wait(150); } }
  const tk = (await call("POST", "/api/home/ticket", null, HOME)).j.ticket; const HOST = { Authorization: `Bearer ${tk}` };
  ok((await call("POST", "/api/home/enter", { who: "player", holdings }, HOME)).j.ok, "你进联机");
  ok((await call("POST", "/api/ddz/add", { who: "buddy" }, HOST)).code === 409, "阿树没进联机时拉不上桌");
  ok((await call("POST", "/api/home/enter", { who: "buddy", holdings }, HOME)).j.ok, "阿树进联机");
  ok((await call("POST", "/api/ddz/sit", {}, HOST)).j.mySeat >= 0, "你坐下");
  ok((await call("POST", "/api/ddz/start", {}, HOST)).code === 409, "人不够开不了");
  ok((await call("POST", "/api/ddz/add", { who: "buddy" }, HOST)).j.ok, "拉阿树坐下");
  ok((await call("POST", "/api/ddz/add", { who: "bot" }, HOST)).j.ok, "拉一个托管（秤砣）");
  let t = (await call("POST", "/api/ddz/start", {}, HOST)).j; ok(t.ok && t.game.phase === "bid" && t.game.hand.length === 17, "开局，你拿到 17 张");
  ok(!("hands" in t.game) && t.game.counts.buddy === 17, "看不到别人的手牌，只知道张数");
  let since = 0; const aiSaid = [];
  const pullFeed = async () => { const f = (await call("GET", `/api/home/feed?since=${since}`, null, HOME)).j; since = f.seq; for (const e of f.events) if (e.type === "ai" && e.pid === "buddy") aiSaid.push(e.text); };

  let steps = 0, aiTyped = 0;
  while (steps++ < 400) {
    t = (await call("GET", "/api/ddz", null, HOST)).j; const g = t.game; if (g.phase === "done") break;
    await pullFeed();
    if (g.turn === "player") {
      if (g.phase === "bid") await call("POST", "/api/ddz/bid", { score: 0 }, HOST);
      else { const h = (await call("GET", "/api/ddz/hint", null, HOST)).j.ids; await call("POST", "/api/ddz/play", { ids: h && (!g.canPass || h.length) ? h : [] }, HOST); }
    } else if (g.turn === "buddy") {
      const said = aiSaid[aiSaid.length - 1] || ""; const m = said.match(/你的牌 ([^。；]+)/); const hand = m ? m[1].trim() : "";
      if (g.phase === "bid") { await call("POST", "/api/home/ai", { who: "buddy", text: "叫 3" }, HOME); aiTyped++; }
      else {
        const text = said.includes("该你先出") ? hand.split(" ")[0] : "不要";
        const r = (await call("POST", "/api/home/ai", { who: "buddy", text: text === "不要" ? "不要" : `出 ${text}` }, HOME)).j; aiTyped++;
        if (!r.ok || /凑不出|压不过|不能不要/.test(r.text || "")) await call("POST", "/api/home/ai", { who: "buddy", text: "不要" }, HOME);
      }
    } else await wait(1700); // 托管 1.5 秒走一步
    await wait(30);
  }
  t = (await call("GET", "/api/ddz", null, HOST)).j;
  ok(t.game.phase === "done", `打完了（${steps} 步，阿树打了 ${aiTyped} 次字）`);
  ok(Object.values(t.game.score).reduce((a, b) => a + b, 0) === 0 && t.seats.every((s) => typeof s.score === "number"), `算分对：${t.seats.map((s) => `${s.name} ${s.score}`).join("，")}`);
  await pullFeed();
  ok(aiSaid.some((x) => /斗地主叫分/.test(x)) && aiSaid.some((x) => /斗地主：/.test(x) && /总分/.test(x)), "阿树收到了叫分提示和结果");
  ok(aiSaid.some((x) => /地主是 阿树|地主是/.test(x)), "阿树收到了出牌提示");
  srv.kill(); console.log("\n全部通过"); process.exit(0);
})().catch((e) => { console.error("✗", e.message, "\n", log.slice(-1500)); srv.kill(); process.exit(1); });
