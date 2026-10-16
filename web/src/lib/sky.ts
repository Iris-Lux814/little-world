// 小屋望远镜 / 看窗外：真实星空的数据和天文小算法。星表、此刻的太阳月亮行星从世界服务来（/api/world/sky/*，星表跟着仓库走、本机算，不联网），
// 这里只做：赤道坐标 → 玩家头顶的地平坐标（按设置里填的位置 + 此刻时间，所以星星会跟着时间慢慢转）、银河带的位置、星色。
import { primaryEndpoint } from "../store/useEndpoints";
import { bridgeUrl } from "../api/ccBridge";

export type SkyStar = [number, number, number, number, string?]; // ra 度, dec 度, 星等, B-V, 中文名
export type SkyLine = { name: string; segs: [[number, number], [number, number]][]; story?: string };
export type SkyDeep = { id: string; name: string; ra: number; dec: number; size: number; img: string; dist?: string; credit?: string; license?: string; source?: string };
export type SkyCatalog = { stars: SkyStar[]; lines: SkyLine[]; deep: SkyDeep[] };
export type SkyNow = {
  at: number; where: { lat: number; lon: number; city?: string; /** 没填过、按时区估的 */ approx?: boolean };
  sun: { ra: number; dec: number; alt: number };
  moon: { ra: number; dec: number; alt: number; az: number; phase: number; illum: number; name: string };
  planets: { name: string; ra: number; dec: number; mag: number }[];
  /** 世界服务不给天气时是 null（页面用游戏里的天气补） */
  weather: { text: string; cloud?: number } | null;
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const ep = primaryEndpoint(); if (!ep) throw new Error("还没连上世界服务");
  const r = await fetch(bridgeUrl(ep, path), { method: body === undefined ? "GET" : "POST", headers: { ...(ep.token ? { "X-World-Token": ep.token } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) { let msg = `没拿到星空（${r.status}）`; try { msg = (await r.json()).error || msg; } catch { /* ignore */ } throw new Error(msg); }
  return r.json() as Promise<T>;
}
let catCache: SkyCatalog | null = null;
export const skyApi = {
  catalog: async () => { if (catCache) return catCache; const c = await call<SkyCatalog>("/api/world/sky/catalog"); catCache = c; return c; },
  now: async () => { const n = await call<SkyNow>("/api/world/sky/now"); return devShift(n); },
  /** 看星星的位置（设置页填）：纬度 -90～90、经度 -180～180，城市名只用来显示 */
  where: (lat: number, lon: number, city?: string) => call<{ ok: boolean; where?: SkyNow["where"]; error?: string }>("/api/world/sky/where", { lat, lon, city }),
  /** 清掉填过的位置，回到按时区估 */
  clearWhere: () => call<{ ok: boolean; where?: SkyNow["where"]; error?: string }>("/api/world/sky/where", { clear: true }),
};

const D = Math.PI / 180;
/** 本地恒星时（度） */
export function lst(ms: number, lon: number) {
  const jd = ms / 86400000 + 2440587.5;
  return (((280.46061837 + 360.98564736629 * (jd - 2451545) + lon) % 360) + 360) % 360;
}
/** 赤道 → 地平：返回 [高度, 方位]（度，方位从北往东） */
export function altAz(ra: number, dec: number, lat: number, lstDeg: number): [number, number] {
  const H = (lstDeg - ra) * D, d = dec * D, p = lat * D;
  const sa = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sa)));
  const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
  return [alt / D, ((az / D) % 360 + 360) % 360];
}
/** 银道 → 赤道（画银河带用） */
export function galToEq(l: number, b: number): [number, number] {
  const aG = 192.85948 * D, dG = 27.12825 * D, lN = 122.93192 * D, L = l * D, B = b * D;
  const sd = Math.sin(dG) * Math.sin(B) + Math.cos(dG) * Math.cos(B) * Math.cos(lN - L);
  const ra = aG + Math.atan2(Math.cos(B) * Math.sin(lN - L), Math.cos(dG) * Math.sin(B) - Math.sin(dG) * Math.cos(B) * Math.cos(lN - L));
  return [((ra / D) % 360 + 360) % 360, Math.asin(sd) / D];
}
/** B-V 色指数 → 星星颜色（蓝白 → 白 → 黄 → 橙红） */
export function starColor(bv: number) {
  const t = Math.max(-0.4, Math.min(2, bv));
  const stops: [number, [number, number, number]][] = [[-0.4, [155, 176, 255]], [0, [202, 216, 255]], [0.4, [255, 250, 240]], [0.8, [255, 232, 196]], [1.2, [255, 206, 150]], [2, [255, 168, 110]]];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const k = (t - a) / (b - a); return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(",")})`; }
  return "rgb(255,168,110)";
}
export const DIRS = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
export const dirName = (az: number) => DIRS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

/** 视野：正对 (az0, alt0)，半视场 half（度）；立体投影（边缘不糊、像真的透过镜片看） */
export type View = { az: number; alt: number; half: number };
export function projector(v: View, R: number, cx: number, cy: number) {
  const a0 = v.az * D, h0 = v.alt * D;
  const d = [Math.cos(h0) * Math.sin(a0), Math.cos(h0) * Math.cos(a0), Math.sin(h0)];
  const r = [Math.cos(a0), -Math.sin(a0), 0];
  const u = [r[1] * d[2] - r[2] * d[1], r[2] * d[0] - r[0] * d[2], r[0] * d[1] - r[1] * d[0]];
  const s = R / (2 * Math.tan((v.half * D) / 2));
  return (alt: number, az: number): [number, number, number] | null => {
    const A = alt * D, Z = az * D; const w = [Math.cos(A) * Math.sin(Z), Math.cos(A) * Math.cos(Z), Math.sin(A)];
    const z = w[0] * d[0] + w[1] * d[1] + w[2] * d[2]; if (z < -0.1) return null;
    const k = 2 / (1 + z); const x = (w[0] * r[0] + w[1] * r[1]) * k, y = (w[0] * u[0] + w[1] * u[1] + w[2] * u[2]) * k;
    return [cx + x * s, cy - y * s, z];
  };
}
/** 两个天球方向的夹角（度） */
export function sep(alt1: number, az1: number, alt2: number, az2: number) {
  const a = alt1 * D, b = alt2 * D, dz = (az1 - az2) * D;
  return Math.acos(Math.max(-1, Math.min(1, Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos(dz)))) / D;
}

/** 自测：localStorage lw.dev.skyoff = 往后挪几小时（白天测夜空用），太阳 / 月亮高度按挪过的时间重算 */
function devShift(n: SkyNow): SkyNow {
  let off = 0; try { off = Number(localStorage.getItem("lw.dev.skyoff") || 0); } catch { /* ignore */ }
  if (!off) return n;
  const at = n.at + off * 3600000; const L = lst(at, n.where.lon);
  const [sa] = altAz(n.sun.ra, n.sun.dec, n.where.lat, L); const [ma, mz] = altAz(n.moon.ra, n.moon.dec, n.where.lat, L);
  return { ...n, at, sun: { ...n.sun, alt: sa }, moon: { ...n.moon, alt: ma, az: mz } };
}

/** 星表给的都是 J2000 坐标，配当天的恒星时会差半度（26 年岁差）→ 先转到当天历元（IAU 1976 岁差，ζ / z / θ 三个角） */
export function precessor(ms: number) {
  const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525; const as = D / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * as, z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * as, th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * as;
  const ct = Math.cos(th), st = Math.sin(th);
  return (ra: number, dec: number): [number, number] => {
    const a = ra * D, d = dec * D; const A = Math.cos(d) * Math.sin(a + zeta), B = ct * Math.cos(d) * Math.cos(a + zeta) - st * Math.sin(d), C = st * Math.cos(d) * Math.cos(a + zeta) + ct * Math.sin(d);
    const ra2 = Math.atan2(A, B) + z; return [((ra2 / D) % 360 + 360) % 360, Math.asin(Math.max(-1, Math.min(1, C))) / D];
  };
}
