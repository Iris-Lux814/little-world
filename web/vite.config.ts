import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 开发时把 /api 转给本机的 little-world 服务（默认 29901；根目录 node dev.js 换了 PORT 会经 WORLD_API 传过来）
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": process.env.WORLD_API || "http://127.0.0.1:29901" } },
});
