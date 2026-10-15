// 一条命令起两边：后端单人服务（server/solo.js）+ 前端开发页（web/，vite）。
// 先装一次前端依赖：npm --prefix web install
// 然后：node dev.js   （Ctrl+C 两边一起停；只给本机）
//       node dev.js --lan   （手机和电脑连同一个 WiFi 时，手机也能打开）
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const vite = path.join(root, "web", "node_modules", "vite", "bin", "vite.js");
if (!fs.existsSync(vite)) {
  console.error("前端依赖还没装：先跑 npm --prefix web install");
  process.exit(1);
}
const dataDir = process.env.DATA_DIR || path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

const kids = [];
function run(name, args, opts) {
  const p = spawn(process.execPath, args, { stdio: "inherit", ...opts });
  p.on("exit", (code) => { console.log(`[dev] ${name} 停了（${code}）`); stopAll(code || 0); });
  kids.push(p);
}
let stopping = false;
function stopAll(code) {
  if (stopping) return; stopping = true;
  for (const p of kids) { try { p.kill(); } catch { /* 已经停了 */ } }
  setTimeout(() => process.exit(code), 300);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

const port = process.env.PORT || "29901";
run("后端", [path.join(root, "server", "solo.js")], { cwd: root, env: { ...process.env, DATA_DIR: dataDir, PORT: port } });
// 默认只给本机开；node dev.js --lan 才对同一个 WiFi 开放（手机来玩）。单人版没有鉴权，别在公共网络里加 --lan
const lan = process.argv.includes("--lan");
run("前端", [vite, ...(lan ? ["--host"] : ["--host", "127.0.0.1"])], { cwd: path.join(root, "web"), env: { ...process.env, WORLD_API: `http://127.0.0.1:${port}` } });
