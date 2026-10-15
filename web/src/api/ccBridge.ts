// little-world 前端的接口：全是世界服务 /api/world/...（跟 little-world/server 的单人服务一一对应）
// 服务地址在「设置」里填，留空 = 跟页面同一个站点
export type Endpoint = { url: string; token?: string };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function base(ep: Endpoint): string { return (ep.url || "").replace(/\/+$/, ""); }

// 前端里三个人固定叫 player（你）/ buddy / pal（两个伙伴）。服务端的 id 由内容包定（state.roles），
// 不一样时在这里两头翻译：回来的数据里等于服务端 id 的字符串和键换成前端的，发出去的换回服务端的（只翻指人的字段，见 REF_KEYS）。
const SLOTS = ["player", "buddy", "pal"] as const;
let toFront = new Map<string, string>(), toServer = new Map<string, string>();
function learnRoles(r: unknown) {
  const ro = (r as { roles?: { host?: string; companions?: string[] } } | null)?.roles;
  if (!ro?.host) return;
  const ids = [ro.host, ...(ro.companions ?? [])].slice(0, SLOTS.length);
  toFront = new Map(); toServer = new Map();
  ids.forEach((id, i) => { if (id !== SLOTS[i]) { toFront.set(id, SLOTS[i]); toServer.set(SLOTS[i], id); } });
}
// 只翻明确指人的字段（白名单）：这些键下面的字符串（数组里的也算）等于服务端 id 才换；别的字符串（聊天、赌注、台词……）一律原样。
// 对象的键照旧换——比分、谁出了牌、各人的角落这些都是「人物 id → 东西」的表。
const REF_KEYS = new Set(["who", "by", "from", "to", "owner", "firstBy", "maxBy", "winner", "with", "id", "seats", "names", "landlord", "turn", "host", "companions", "partner",
  "creditor", "debtor", "freed", "favorFrom", "spoutBy", "giftFrom", "helpers"]);
function swap(v: unknown, m: Map<string, string>, ref = false): unknown {
  if (!m.size) return v;
  if (typeof v === "string") return ref ? m.get(v) ?? v : v;
  if (Array.isArray(v)) return v.map(x => swap(x, m, ref));
  if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) o[m.get(k) ?? k] = swap(x, m, REF_KEYS.has(k)); return o; }
  return v;
}
/** 自己发请求的数据层（斗地主 / 鱼桶牌）用：发出去前 roleOut，收到后 roleIn，路径里的 query 用 rolePath */
export const roleOut = (v: unknown) => swap(v, toServer);
export const roleIn = <T,>(v: unknown): T => { learnRoles(v); return swap(v, toFront) as T; };
export const rolePath = (path: string) => outPath(path);
function outPath(path: string): string {
  if (!toServer.size) return path;
  const [p, q] = path.split("?");
  return q == null ? p : p + "?" + q.split("&").map(kv => { const [k, x = ""] = kv.split("="); const id = REF_KEYS.has(k) ? toServer.get(decodeURIComponent(x)) : undefined; return id ? `${k}=${encodeURIComponent(id)}` : kv; }).join("&");
}

async function request<T>(ep: Endpoint, path: string, init: RequestInit & { timeoutMs?: number; exact?: boolean } = {}): Promise<T> {
  const { timeoutMs = 15000, exact: _exact, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const outer = rest.signal;
  if (outer) outer.addEventListener("abort", () => ctrl.abort(), { once: true });
  const body = typeof rest.body === "string" && toServer.size ? JSON.stringify(swap(JSON.parse(rest.body), toServer)) : rest.body;
  try {
    const res = await fetch(base(ep) + outPath(path), { ...rest, body, signal: ctrl.signal, headers: { ...(ep.token ? { "X-World-Token": ep.token } : {}), "Content-Type": "application/json", ...(rest.headers || {}) } });
    if (!res.ok) { let msg = res.statusText; try { msg = (await res.json()).error || msg; } catch { /* ignore */ } throw new ApiError(res.status, msg); }
    const data = await res.json(); learnRoles(data);
    return swap(data, toFront) as T;
  } finally { clearTimeout(timer); }
}

export function bridgeUrl(ep: Endpoint, rel: string): string { return base(ep) + rel; }

// 世界里的聊天（伙伴在单人版里是假人，回几句固定台词）
export type SocialMsg = { id: string; at: number; from: string; text: string };
export const socialApi = {
  // 服务回 { chat: [{ id, at, who, name, text, auto? }] }，这里换成页面用的 { messages: [{ id, at, from, text }] }
  messages: async (ep: Endpoint, _room: "group", since = 0, limit = 40) => {
    const r = await request<{ ok?: boolean; chat?: { id: string; at: number; who: string; text: string }[] }>(ep, `/api/world/chat?since=${since}&limit=${limit}`, { timeoutMs: 12000 });
    return { ok: r.ok !== false, messages: (r.chat ?? []).map(m => ({ id: m.id, at: m.at, from: m.who, text: m.text })) };
  },
  send: (ep: Endpoint, text: string, _via?: "game") => request<{ ok: boolean; error?: string }>(ep, "/api/world/chat", { method: "POST", body: JSON.stringify({ text }), timeoutMs: 15000 }),
};

export type WFish = { id: string; at: number; by: string; species: string; name: string; rarity: number; stars: number; kg: number; junk: boolean; giftFrom?: string };
export type WPlayer = { id: "player" | "buddy" | "pal"; name: string; spot: string; catches: number; bucket: WFish[]; coins: number; here: boolean; /** 开源版：上传的小人图地址，没有 = null */ sprite?: string | null };
export type WDex = { id: string; name: string; spot: string; rarity: number; stars: number; junk: boolean; hours: [number, number] | null; caught: boolean; firstBy?: string; firstAt?: number; count?: number; maxKg?: number; maxBy?: string; sign?: string; mine?: { firstAt: number; count: number; maxKg: number } | null };
export type WEvent = { at: number; type: string; who: string; item?: WFish; to?: string; first?: boolean; record?: boolean; name?: string; rarity?: number };
export type WSpecial = { id: string; name: string; stars: number; why: string };
export type WState = { legend?: WLegend | null; items?: Record<string, number>; specials?: WSpecial[] | null; ok: boolean; open: boolean; trial?: boolean; now: number; hour: number; /** 世界时区比 UTC 快几分钟（老后端没有） */ tzOffsetMin?: number; weather: string; spots: { id: string; name: string }[]; players: WPlayer[]; dex: WDex[]; events: WEvent[];
  me: null | { castId: string; phase: "wait" | "bite" | "fight" | "missed" | "early"; distance: number; dir: number };
  ai?: Record<"buddy" | "pal", { ang: number; walk: { from: number; to: number; at: number; dur: number } | null; act: string; spot: string; place?: string; cab?: { spot: string } | null; gear?: { rod?: string; bobber?: string } }>;
  wallet?: WWallet; mePos?: { x: number; y: number; dir: number; at: number; spot?: string } | null; meScene?: { scene: string; at: number; x?: number; y?: number; dir?: number; use?: string } | null; weathers?: Record<string, string> };
// 第 2 步：亮鳞 + 秤砣的店。catalog 按格子分：bait / rod / bobber / reel / charm / bucket
export type WShopItem = { id: string; name: string; price: number | null; pack?: number; note?: string; owned: number | boolean; onSale: boolean; need?: string };
export type WWallet = { coins: number; debt: number; bait: string; baits: Record<string, number>; gear: Record<string, string>; bucketUsed: number; bucketSize: number;
  catalog: Record<string, WShopItem[]>; slots: Record<string, string>; sellable: { id: string; scales: number | null }[] };
export type WTrade = { ok: boolean; error?: string; text?: string; soft?: boolean; owe?: number; got?: number; repay?: number; n?: number; sold?: { species: string; name: string; rarity: number; scales: number }[]; wallet: WWallet };
// 小屋（第 4 步）：鱼缸（三个人共用，最多 tankCap 条）、纪念品柜、纪录板、每人一个角落（自己的图鉴 + 最得意的一条）
export type WTankFish = { id: string; species: string; name: string; rarity: number; stars: number; kg: number; owner: string; inAt: number };
export type WCabin = { tank: WTankFish[]; tankCap: number; keepsakes: { id: string; species: string; name: string; owner: string; at: number }[];
  board: { species: string; name: string; rarity: number; maxKg: number; maxBy: string }[];
  corners: Record<string, { name: string; catches: number; kinds: number; dex: Record<string, { firstAt: number; count: number; maxKg: number }>; best: null | { species: string; name: string; rarity: number; maxKg: number } }>;
  // 树洞小屋：摆设放哪（slot → 摆设 id）、门口风铃留言、鱼拓、客房（联机以后才有）
  decor?: Record<string, string | null>; decorSlots?: string[]; decorOwned?: string[];
  notes?: { id: string; from: string; text: string; at: number }[];
  rubbings?: { species: string; name: string; kg: number; by: string; at: number }[];
  guests?: { id: string; name: string; firstAt: number; lastAt: number; here: boolean }[]; };
export type WFight = { staminaMs: number; pull: number; jitter: number; reelMs: number; recover: number; seed: number; cap?: number; legend?: boolean; helpers?: string[]; missing?: number; cheer?: Record<string, { tension: number; staminaMs?: number }> };
/** 传说鱼一起拉（后端 little-world/engine/core.js legend*）：夜河之主浮上来 → 3 分钟内大家到夜河 → 玩家开拉，伙伴喊「加油 / 放线」帮玩家松张力 */
export type WCheer = { at: number; who: string; kind: string; line: string };
export type WLegend = { id: string; name: string; kg: number; phase: "calling" | "fight" | "won" | "lost" | "gone"; at: number; arriveBy: number; joined: Record<string, number>; cheers: WCheer[]; helpers?: string[]; fightAt?: number; endedAt?: number; item?: WFish; board?: { at: number; name: string; kg: number; names: string[] }[] };
const W = "/api/world";
const wpost = <T,>(ep: Endpoint, p: string, b: unknown) => request<T>(ep, W + p, { method: "POST", body: JSON.stringify(b), timeoutMs: 12000 });
// 一对一打赌 + 欠条（后端 little-world/engine/duel.js；需求 设计说明）
export type WBetWho = "player" | "buddy" | "pal";
export type WBet = { id: string; with: "buddy" | "pal"; kind: string; stake: string; startAt: number; endAt: number; phase: "asking" | "on" | "done" | "declined" | "cancelled";
  score: Partial<Record<WBetWho, { w?: number; n: number; fish?: string; wAt?: number; wSeq?: number }>>; lines?: { who: string; line: string; at: number }[]; result?: { winner: WBetWho | null; line?: string; cancelled?: boolean } | null };
export type WIou = { id: string; debtor: WBetWho; creditor: WBetWho; stake: string; at: number; betId?: string; paidMark?: number | null; tornAt?: number | null; note?: string };
export type WBetState = { bet: WBet | null; ious: WIou[]; presets: string[]; kinds: { k: string; name: string }[]; spans: { k: string; name: string }[] };
export const worldApi = {
  // 小人图：正文直接放 PNG（240×320、≤512KB）；who 不给 = 自己；回来的 sprite 是相对地址，没传过 = null
  spriteUpload: (ep: Endpoint, png: Blob, who = "player") => request<{ ok: boolean; who: string; sprite: string | null; error?: string }>(ep, `${W}/sprite${who !== "player" ? `?who=${who}` : ""}`, { method: "POST", body: png, headers: { "Content-Type": "image/png" }, timeoutMs: 20000 }),
  spriteReset: (ep: Endpoint, who = "player") => request<{ ok: boolean; who: string; sprite: null }>(ep, `${W}/sprite${who !== "player" ? `?who=${who}` : ""}`, { method: "DELETE" }),
  // pos：玩家在世界里站在哪
  state: (ep: Endpoint, pos?: { x: number; y: number; dir: number }, sc?: string, use?: string | null) => { const q = [pos ? `px=${Math.round(pos.x)}&py=${Math.round(pos.y)}&pd=${pos.dir}` : "", sc ? `sc=${sc}` : "", use ? `use=${encodeURIComponent(use)}` : ""].filter(Boolean).join("&"); return request<WState>(ep, W + (q ? `?${q}` : ""), { timeoutMs: 8000 }); }, // sc=cabin：玩家在小屋里
  open: (ep: Endpoint, open: boolean) => wpost<{ ok: boolean; open: boolean }>(ep, "/open", { open }),
  legend: (ep: Endpoint, since = 0) => request<{ ok: boolean; legend: WLegend | null; cheers: WCheer[] }>(ep, `${W}/legend?since=${since}`, { timeoutMs: 6000 }),
  legendStart: (ep: Endpoint) => wpost<{ ok: boolean; fight: WFight; legend: WLegend }>(ep, "/legend/start", {}),
  legendLand: (ep: Endpoint, result: "landed" | "escaped") => wpost<{ ok: boolean; result: "won" | "lost"; item?: WFish & { name: string }; names?: string[]; error?: string }>(ep, "/legend/land", { result }),
  /** 玩家的试玩开关：小屋 / 夜河先只对玩家开 */
  trial: (ep: Endpoint, on: boolean) => wpost<{ ok: boolean; trial: boolean; spot: string }>(ep, "/trial", { on }),
  // 甩竿原来 12 秒 × 壳里放宽 2.5 倍 = 按钮卡在「…」半分钟（试玩截图）。改成 7 秒硬超时，页面那边再补试一次
  cast: (ep: Endpoint, power: number, dir: number) => request<{ ok: boolean; castId: string; distance: number; biteIn?: number; biteMs?: number }>(ep, W + "/cast", { method: "POST", body: JSON.stringify({ power, dir }), timeoutMs: 7000, exact: true }),
  // 提竿要快：不吃 iOS 壳的 2.5 倍放宽（超过 20 秒才不放宽），6 秒没回就当没成，别让按钮一直卡在「…」
  hook: (ep: Endpoint, castId: string) => request<{ ok: boolean; result: "hooked" | "early" | "missed"; fight?: WFight; hint?: { rarity: number; big: boolean } }>(ep, W + "/hook", { method: "POST", body: JSON.stringify({ castId }), timeoutMs: 6000, exact: true }),
  land: (ep: Endpoint, castId: string, result: "landed" | "snapped" | "escaped") => wpost<{ ok: boolean; result: string; fish: WFish & { name: string; rarity: number; big?: boolean }; sign?: string; first?: boolean; record?: boolean; error?: string }>(ep, "/land", { castId, result }),
  act: (ep: Endpoint, action: "show" | "gift" | "release", fish: string, to?: "buddy" | "pal") => wpost<{ ok: boolean }>(ep, "/act", { action, fish, to }),
  // 秤砣的店：卖鱼（fish = 鱼 id 或「全部」）/ 买 / 换上。出错也回 wallet（ApiError 里拿不到，所以前端自己再拉一次状态）
  // 第 3 步：从路牌出发去别的钓点
  travel: (ep: Endpoint, to: string) => wpost<{ ok: boolean; spot: string; name: string; weather: string }>(ep, "/travel", { to }),
  // 走到秤砣跟前：每天第一次 / 饵用完了他塞点东西
  visit: (ep: Endpoint) => wpost<{ ok: boolean; gift: null | { kind: "daily" | "empty"; n: number; name: string; line: string }; wallet: WWallet }>(ep, "/visit", {}),
  sell: (ep: Endpoint, fish: string) => wpost<WTrade>(ep, "/sell", { fish }),
  buy: (ep: Endpoint, item: string, n = 1) => wpost<WTrade>(ep, "/buy", { item, n }), // 饵可以一次买 n 袋
  equip: (ep: Endpoint, item: string, kind?: string) => wpost<WTrade>(ep, "/equip", { item, kind }),
  // v2：用道具（晴天娃娃 / 雨壶 / 包装纸 / 鱼拓纸 / 小道消息），失败 409
  use: (ep: Endpoint, item: string) => wpost<{ ok: boolean; text?: string; error?: string; items?: Record<string, number> }>(ep, "/use", { item }),
  // 小屋：全貌 / 鱼缸放鱼、拿鱼
  cabin: (ep: Endpoint) => request<WCabin & { ok: boolean }>(ep, W + "/cabin", { timeoutMs: 8000 }),
  tank: (ep: Endpoint, action: "put" | "take", fish: string) => wpost<{ ok: boolean; text?: string; error?: string; cabin: WCabin }>(ep, "/cabin/tank", { action, fish }),
  place: (ep: Endpoint, slot: string, item: string | null) => wpost<{ ok: boolean; text?: string; cabin: WCabin }>(ep, "/cabin/place", { slot, item }),
  note: (ep: Endpoint, text: string) => wpost<{ ok: boolean; note: { id: string; from: string; text: string; at: number }; cabin: WCabin }>(ep, "/cabin/note", { text }),
  // 摆家具：挪过的那几件 {家具key:{room,x,y}}（世界坐标，treehouse.ts 的单位）；null = 回默认，{reset:true} 全回默认
  cabinLayout: (ep: Endpoint) => request<{ ok: boolean; layout: Record<string, { room?: string; x: number; y: number }>; at?: number; by?: string }>(ep, W + "/cabin/layout", { timeoutMs: 8000 }),
  bet: (ep: Endpoint) => request<WBetState>(ep, W + "/bet", { timeoutMs: 8000 }),
  betStart: (ep: Endpoint, body: { with: "buddy" | "pal"; kind: string; span: string; stake: string }) => wpost<WBetState>(ep, "/bet/start", body),
  betCancel: (ep: Endpoint) => wpost<WBetState>(ep, "/bet/cancel", {}),
  iouPaid: (ep: Endpoint, id: string) => wpost<WBetState>(ep, "/bet/iou/paid", { id }),
  iouTear: (ep: Endpoint, id: string) => wpost<WBetState>(ep, "/bet/iou/tear", { id }),
  cabinLayoutSave: (ep: Endpoint, body: { moves?: Record<string, { room?: string; x: number; y: number } | null>; reset?: boolean }) => wpost<{ ok: boolean; layout: Record<string, { room?: string; x: number; y: number }> }>(ep, "/cabin/layout", body),
  // 伞树农场：种 / 摇伞浇水 / 收菜 / 买种子；只在试玩开着时有（没开回 farm: null）
  farm: (ep: Endpoint) => request<{ ok: boolean } & WFarmRes>(ep, W + "/farm", { timeoutMs: 8000 }),
  farmBuy: (ep: Endpoint, seed: string, n = 1) => wpost<{ ok: boolean; text?: string } & WFarmRes>(ep, "/farm/buy", { seed, n }),
  farmPlant: (ep: Endpoint, seed: string, tile?: number | string) => wpost<{ ok: boolean; text?: string } & WFarmRes>(ep, "/farm/plant", typeof tile === "string" ? { seed, plot: tile } : { seed, tile }),
  farmShake: (ep: Endpoint) => wpost<{ ok: boolean; text?: string; empty?: boolean } & WFarmRes>(ep, "/farm/shake", {}),
  farmSpout: (ep: Endpoint, to: string) => wpost<{ ok: boolean; text?: string } & WFarmRes>(ep, "/farm/spout", { to }),
  farmHarvest: (ep: Endpoint, tile?: number | string) => wpost<{ ok: boolean; text?: string } & WFarmRes>(ep, "/farm/harvest", typeof tile === "string" ? { plot: tile } : { tile }),
  farmWater: (ep: Endpoint, plot: string) => wpost<{ ok: boolean; text?: string } & WFarmRes>(ep, "/farm/water", { plot }), // 地上的菜手浇
  // 菜篮里的菜卖给秤砣（不给 id 卖全部；杂交价 = 两个亲本平均 ×1.5）
  farmSell: (ep: Endpoint, id?: string) => wpost<{ ok: boolean; text?: string; got?: number; wallet?: WWallet } & WFarmRes>(ep, "/farm/sell", { id })
};
export type WCrop = { seed: string; name: string; stage: number; ripe: boolean; wet: number; dryDays: number; pollen?: unknown };
export type WFarmSlot = { who: string; name: string; owner: string; kind: string; sign: string | null; tiles: { crop: WCrop | null }[] };
export type WFarm = { day: string; water: { level: number; max: number; rainAt: number }; spout: string | null; spoutBy: string | null; board: { at: number; who: string; text: string }[];
  hybrids: Record<string, unknown>; slots: WFarmSlot[]; /** 菜园地上 18 格（共用，by = 谁种的） */ ground?: { id: string; crop: (WCrop & { by?: string; byName?: string }) | null }[]; shop: { id: string; name: string; price: number; pack: number; sell: number }[]; stages: number };
export type WFarmBag = { seeds: Record<string, number>; basket: { seed?: string; name?: string; at?: number }[] };
export type WFarmRes = { farm: WFarm | null; bag: WFarmBag };
