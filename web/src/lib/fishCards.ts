// 鱼桶牌前端的数据层。规则全在后端：家里 /api/world/cards*。
// 牌 = 自己图鉴里钓到过的每一种鱼（按钓过最重的那条）+ 鱼桶里还没卖的；5 张打 5 轮，每轮同时扣一张，翻开比牌力，最小的放生偷看下一张天气。
import { primaryEndpoint } from "../store/useEndpoints";
import { bridgeUrl, roleIn, roleOut, rolePath } from "../api/ccBridge";

export type FishCard = { cid: string; species: string; name: string; stars: number; rarity: number; kg: number; spot: string; junk: boolean; legend: boolean; empty?: boolean; from: string; power: number };
export type FishPlayed = { name: string; stars: number; kg: number; power: number; auto?: boolean; thrown?: boolean; species?: string; spot?: string; legend?: boolean; junk?: boolean; empty?: boolean };
export type FishRound = { round: number; wx: string; played: Record<string, FishPlayed>; winner: string | null; freed: string | null; text: string };
export type FishGame = {
  id: string; by: string; seats: string[]; status: "invite" | "on" | "done"; accepted: Record<string, boolean>; deadline: number;
  round: number; rounds: number; wx: string | null; wxRule: string | null; peeked: boolean;
  hand: FishCard[]; handCount: Record<string, number>; played: Record<string, boolean>; taken: Record<string, number>; pot: number;
  log: (FishRound | { round: 0; text: string })[]; winner: string | null; endText: string | null; favorFrom: string[];
};
export type FishTable = { ok?: boolean; error?: string; open: boolean; rules: { hand: number; rounds: number; stake: number; wx: Record<string, string> }; game: FishGame | null; result?: FishRound | null };

function host() { const ep = primaryEndpoint(); if (!ep) return null; return { base: bridgeUrl(ep, "/api/world/cards"), token: ep.token ?? "" }; }
async function call(path: string, body?: unknown): Promise<FishTable> {
  const h = host(); if (!h) throw new Error("还没连上世界服务");
  const r = await fetch(h.base + rolePath(path), { method: body === undefined ? "GET" : "POST", headers: { ...(h.token ? { "X-World-Token": h.token } : {}), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(roleOut(body)) });
  const j = await r.json().catch(() => ({})) as FishTable;
  if (!r.ok) throw new Error(j.error || `没成（${r.status}）`);
  return roleIn<FishTable>(j); // 人物 id 跟 ccBridge 一样两头翻译
}
export const fishCardsApi = {
  table: () => call(""),
  create: (withWho: string[]) => call("/new", { with: withWho }),
  answer: (yes: boolean) => call("/answer", { yes }),
  play: (cid: string) => call("/play", { card: cid }),
  favor: (from: string) => call("/favor", { from }),
};

/** 天气牌：圆窗里画哪张景（public/weather-window），雨 / 雾 / 风在上面用代码加 */
export const WX_VIEW: Record<string, string> = { 晴: "view_cloudy", 多云: "view_cloudy", 雨: "view_rain", 雾: "view_cloudy", 大风: "view_cloudy", 夜: "view_night" };
/** 卡片底边色带：在哪钓的 */
export const SPOT_TXT: Record<string, string> = { pond: "池塘", lake: "湖", sea: "海", river: "夜河" };
