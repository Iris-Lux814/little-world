// 斗地主前端的数据层。规则全在后端；家里 /api/world/ddz*、联机版 /online/api/ddz* 字段一样，
// 这里只管：请求、牌的显示（点数 / 花色 / 排序）、本地认一下选的牌是什么牌型（只为按钮亮不亮、提示文字，真判定在后端）。
import { primaryEndpoint } from "../store/useEndpoints";
import { bridgeUrl, roleIn, roleOut, rolePath } from "../api/ccBridge";

export type DdzSeat = { id: string; name: string; kind: "human" | "ai" | "bot"; score: number } | null;
export type DdzCard = { id: number; rank: number; name: string };
export type DdzPlay = { who: string; pass?: boolean; ids?: number[]; names?: string[]; type?: string; typeName?: string };
export type DdzGame = {
  phase: "bid" | "play" | "done"; turn: string; turnAt: number; landlord: string | null;
  bid: { cur: number; by: string | null; log: { who: string; score: number }[] }; bottom: number[] | null; hand: DdzCard[] | null;
  counts: Record<string, number>; last: { by: string; type: string; typeName: string; ids: number[]; names: string[] } | null;
  plays: DdzPlay[]; bombs: number; canPass: boolean; winner: string | null; score: Record<string, number> | null;
  result: { lordWin: boolean; spring: boolean; mult: number; bombs: number; bid: number } | null; names: Record<string, string>; seats: string[];
};
export type DdzTable = { ok?: boolean; seats: DdzSeat[]; mySeat: number; timeouts?: Record<string, number>; game: DdzGame | null };

/** 家里 / 联机两套：前缀和带不带票不一样，别的都一样 */
export type DdzHost = { base: string; headers: () => Record<string, string> };
export function homeHost(): DdzHost | null {
  const ep = primaryEndpoint(); if (!ep) return null;
  return { base: bridgeUrl(ep, "/api/world/ddz"), headers: () => ({ ...(ep.token ? { "X-World-Token": ep.token } : {}), "Content-Type": "application/json" }) };
}
async function call<T>(h: DdzHost, path: string, body?: unknown): Promise<T> {
  const r = await fetch(h.base + rolePath(path), { method: body === undefined ? "GET" : "POST", headers: h.headers(), body: body === undefined ? undefined : JSON.stringify(roleOut(body)) });
  const j = await r.json().catch(() => ({})) as T & { error?: string };
  if (!r.ok) throw new Error((j as { error?: string }).error || `没成（${r.status}）`);
  return roleIn<T>(j); // 人物 id 跟 ccBridge 一样两头翻译
}
export const ddzApi = {
  table: (h: DdzHost) => call<DdzTable>(h, ""),
  sit: (h: DdzHost) => call<DdzTable>(h, "/sit", {}),
  add: (h: DdzHost, who: "bot" | "buddy" | "pal") => call<DdzTable>(h, "/add", { who }),
  stand: (h: DdzHost, who?: string) => call<DdzTable>(h, "/stand", who ? { who } : {}),
  start: (h: DdzHost) => call<DdzTable>(h, "/start", {}),
  bid: (h: DdzHost, score: number) => call<DdzTable>(h, "/bid", { score }),
  play: (h: DdzHost, ids: number[]) => call<DdzTable>(h, "/play", { ids }),
  hint: (h: DdzHost) => call<{ ids: number[] }>(h, "/hint"),
};

// ── 牌面 ──
export const RANK_TXT: Record<number, string> = { 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "小王", 17: "大王" };
export const rankOf = (id: number) => (id === 52 ? 16 : id === 53 ? 17 : 3 + Math.floor(id / 4));
/** 四种花色换成可爱的：草莓（红）/ 小花（粉）/ 四叶草（绿）/ 星星（蓝） */
export const SUIT = ["berry", "flower", "clover", "star"] as const;
export const suitOf = (id: number) => (id >= 52 ? null : SUIT[id % 4]);
export const sortHand = (ids: number[]) => ids.slice().sort((a, b) => rankOf(b) - rankOf(a) || b - a); // 手牌大的在左

/** 本地粗认牌型：只用来决定「出牌」按钮亮不亮 + 给一句提示（真的能不能出看后端） */
export function shape(ids: number[]): string | null {
  const rs = ids.map(rankOf).sort((a, b) => a - b), n = rs.length; if (!n) return null;
  const c = new Map<number, number>(); for (const r of rs) c.set(r, (c.get(r) || 0) + 1);
  const by = (k: number) => [...c].filter(([, v]) => v === k).map(([r]) => r); const keys = [...c.keys()].sort((a, b) => a - b);
  const run = keys.every((r, i) => i === 0 || r === keys[i - 1] + 1) && keys[keys.length - 1] <= 14;
  if (n === 2 && rs[0] === 16 && rs[1] === 17) return "王炸";
  if (n === 1) return "单张"; if (n === 2 && c.size === 1) return "对子"; if (n === 3 && c.size === 1) return "三张"; if (n === 4 && c.size === 1) return "炸弹";
  if (n === 4 && by(3).length === 1) return "三带一"; if (n === 5 && by(3).length === 1 && by(2).length === 1) return "三带二";
  if (n === 6 && by(4).length === 1) return "四带二"; if (n === 8 && by(4).length === 1 && by(2).length === 2) return "四带两对";
  if (n >= 5 && c.size === n && run) return "顺子";
  if (n >= 6 && n % 2 === 0 && [...c.values()].every(v => v === 2) && run) return "连对";
  const tri = keys.filter(r => (c.get(r) || 0) >= 3 && r <= 14); if (tri.length >= 2 && tri.every((r, i) => i === 0 || r === tri[i - 1] + 1)) { const k = tri.length; if (n === 3 * k) return "飞机"; if (n === 4 * k || n === 5 * k) return "飞机带翅膀"; }
  return null;
}
