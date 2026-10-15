// 开源版：只有一台世界服务。地址存在本机（设置里改），留空 = 跟页面同一个站点
import { useSyncExternalStore } from "react";
import type { Endpoint } from "../api/ccBridge";

const KEY = "lw.server";
const subs = new Set<() => void>();
const read = (): string => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
let cur: Endpoint = { url: read() };

export function primaryEndpoint(): Endpoint { return cur; }
export function setServer(url: string) { try { localStorage.setItem(KEY, url.trim()); } catch { /* ignore */ } cur = { url: read() || url.trim() }; subs.forEach(f => f()); }
export function useEndpoints(): { endpoints: Endpoint[] } {
  const ep = useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => cur);
  return { endpoints: [ep] };
}
