// 真实星空画布（望远镜和看窗外共用）。星星 / 银河 / 月亮 / 行星 / 星座连线 / 深空天体照片都按此刻玩家头顶的真实位置画。
// interactive：拖着转、捏着放大（带惯性）；对准星座停一下连线一笔笔亮、名字飘出来；对准深空天体镜头「对焦」从糊到清楚显出真照片。
// 竖着拿手机时外面整个舞台 rotate(90deg)，手指位移换成本地坐标（见 local）。
import { useEffect, useMemo, useRef } from "react";
import { altAz as altAzRaw, galToEq, lst, precessor, projector, sep, starColor, type SkyCatalog, type SkyNow, type View, type SkyLine, type SkyDeep } from "../lib/sky";

export type SkyFocus = { kind: "line"; line: SkyLine; k: number } | { kind: "deep"; deep: SkyDeep; k: number } | null;
type Props = {
  cat: SkyCatalog; now: SkyNow; view: View; interactive?: boolean; round?: boolean;
  focusable?: boolean; // 对准了自动连线 / 对焦，跟能不能拖分开（截图模式不能拖，但对准的星座照样亮）
  minHalf?: number; maxHalf?: number; minAlt?: number;
  onView?: (v: View) => void; onFocus?: (f: SkyFocus) => void; onTick?: (k: "turn" | "focus" | "line") => void;
  dim?: number; // 0~1 云 / 雾让星星变淡
};

const imgCache = new Map<string, HTMLImageElement>();
/** 肉眼分辨不出的暗星底：按银纬分布（靠银河越密），固定种子，所以每次打开都在同样的位置 */
const FAINT: [number, number, number][] = (() => { let x = 20261006; const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); const out: [number, number, number][] = [];
  for (let i = 0; i < 12000; i++) { const l = rnd() * 360; const b = (rnd() - 0.5) * 2 * (rnd() < 0.66 ? 11 : 90) * rnd(); const [ra, dec] = galToEq(l, b); out.push([ra, dec, rnd()]); } return out; })();
const FCOL = ["#dfe6ff", "#ffe9d6", "#e9dcff", "#d6f0ff"];
/** 银河里的彩色星云团（固定种子）：紫 / 粉 / 蓝，沿银道撒，银心附近多 */
const NEB: [number, number, number, string][] = (() => { let x = 1006; const rnd = () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); const out: [number, number, number, string][] = []; const cols = ["170,120,255", "255,140,200", "120,170,255", "200,150,255"];
  for (let i = 0; i < 70; i++) { const l = (rnd() < 0.45 ? (rnd() - 0.5) * 90 : rnd() * 360 + 360) % 360; const b = (rnd() - 0.5) * 14; const [ra, dec] = galToEq(l, b); out.push([ra, dec, 4 + rnd() * 9, cols[i % 4]]); } return out; })();
function img(src: string) { let i = imgCache.get(src); if (!i) { i = new Image(); i.src = src; imgCache.set(src, i); } return i; }
/** 照片边缘羽化（一次做好缓存）：中间原样、往外慢慢淡掉，融进星空，不是一块硬圆片 */
const softCache = new Map<string, HTMLCanvasElement>();
function soft(src: string, I: HTMLImageElement) { let c = softCache.get(src); if (c) return c; c = document.createElement("canvas"); const n = 512; c.width = c.height = n; const x = c.getContext("2d")!;
  x.drawImage(I, 0, 0, n, n); x.globalCompositeOperation = "destination-in"; const g = x.createRadialGradient(n / 2, n / 2, n * 0.18, n / 2, n / 2, n / 2); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, n, n); softCache.set(src, c); return c; }

export default function SkyCanvas({ cat: cat0, now, view, interactive, focusable = interactive, round, minHalf = 3, maxHalf = 60, minAlt = -10, onView, onFocus, onTick, dim = 0 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // J2000 → 当天历元（星表只转一次，按天缓存）
  const day0 = Math.floor(now.at / 86400000);
  const cat = useMemo<SkyCatalog>(() => { const P = precessor(now.at); return { stars: cat0.stars.map(x => { const [r, d] = P(x[0], x[1]); return [r, d, x[2], x[3], x[4]] as SkyCatalog["stars"][number]; }),
    lines: cat0.lines.map(l => ({ ...l, segs: l.segs.map(sg => sg.map(q => P(q[0], q[1])) as [[number, number], [number, number]]) })), deep: cat0.deep.map(o => { const [r, d] = P(o.ra, o.dec); return { ...o, ra: r, dec: d }; }) }; }, [cat0, day0]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useRef({ v: { ...view }, vel: { az: 0, alt: 0 }, ptrs: new Map<number, { x: number; y: number }>(), pinch: 0, focus: null as SkyFocus, focusAt: 0, cand: "" as string, candAt: 0, lastTurn: 0, skew: now.at - Date.now() });
  const props = useRef({ cat, now, onView, onFocus, onTick, dim, minHalf, maxHalf, minAlt, focusable }); props.current = { cat, now, onView, onFocus, onTick, dim, minHalf, maxHalf, minAlt, focusable };
  useEffect(() => { st.current.v = { ...view }; }, [view.az, view.alt, view.half]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { st.current.skew = now.at - Date.now(); }, [now.at]);

  // 每颗星一个闪烁相位（固定，不然每帧乱闪）
  const twk = useRef<Float32Array | null>(null);
  if (!twk.current || twk.current.length !== cat.stars.length) { const a = new Float32Array(cat.stars.length); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 6.28; twk.current = a; }

  useEffect(() => {
    const cv = ref.current!; const ctx = cv.getContext("2d")!; let raf = 0; let alive = true; const base = document.createElement("canvas"); let baseKey = "";
    const resize = () => { const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); void r; };
    resize(); const ro = new ResizeObserver(resize); ro.observe(cv);
    const draw = (t: number) => {
      if (!alive) return; raf = requestAnimationFrame(draw);
      const S = st.current, P = props.current; const { cat: C, now: N } = P;
      if (round && S.v.alt < S.v.half) S.v.alt = Math.min(89.5, S.v.half); // 望远镜：镜头下沿最多贴着地平线（捏小、一打开对着低处的月亮也一样），不露地面
      // 惯性
      if (!S.ptrs.size && (Math.abs(S.vel.az) > 0.001 || Math.abs(S.vel.alt) > 0.001)) { S.v.az += S.vel.az; S.v.alt = Math.max(P.minAlt, round ? S.v.half : -90, Math.min(89.5, S.v.alt + S.vel.alt)); S.vel.az *= 0.92; S.vel.alt *= 0.92; P.onView?.({ ...S.v }); }
      const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, R = round ? Math.min(W, H) / 2 : Math.hypot(W, H) / 2;
      const ms = Date.now() + S.skew; const L = lst(ms, N.where.lon), lat = N.where.lat; const PR = precessor(ms);
      const altAzJ = (ra: number, dec: number, la: number, ls: number) => { const [r, d] = PR(ra, dec); return altAzRaw(r, d, la, ls); }; // 后端给的 J2000（月亮 / 行星 / 太阳）
      const pj = projector(S.v, R, cx, cy);
      const sunAlt = altAzJ(N.sun.ra, N.sun.dec, lat, L)[0]; /* 按此刻重算（开着看一会儿天色也会跟着变） */ const day = Math.max(0, Math.min(1, (sunAlt + 8) / 14)); // -8° 以下全黑夜，+6° 以上白天
      const starA = Math.max(0, 1 - day * 1.15) * (1 - P.dim * 0.85);
      // 底图（天色 + 银河 + 暗星）画进离屏画布，视野 / 尺寸变了或者过了 5 秒才重画；平时每帧只画亮星
      const bkey = `${S.v.az.toFixed(2)},${S.v.alt.toFixed(2)},${S.v.half.toFixed(2)},${W},${H},${Math.floor(ms / 5000)},${P.dim}`;
      if (bkey !== baseKey) { baseKey = bkey; if (base.width !== W || base.height !== H) { base.width = W; base.height = H; } const bctx = base.getContext("2d")!; { const ctx = bctx; const zoom = 30 / S.v.half;
        // 天色：夜深蓝 → 黄昏紫粉 → 白天浅蓝；看得越高越深
        const g = ctx.createLinearGradient(0, 0, 0, H);
        const mix = (a: number[], b: number[], k: number) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
        const top = day < 0.5 ? mix([6, 10, 34], [58, 48, 108], day * 2) : mix([58, 48, 108], [96, 160, 226], (day - 0.5) * 2);
        const bot = day < 0.5 ? mix([20, 26, 64], [196, 120, 140], day * 2) : mix([196, 120, 140], [190, 222, 246], (day - 0.5) * 2);
        g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${bot})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // 银河：沿银道撒一串很淡的光团，银心附近亮一点
        if (starA > 0.05) {
          ctx.globalCompositeOperation = "lighter";
          for (let l = 0; l < 360; l += 4) for (const b of [-6, 0, 6]) {
            const [ra, dec] = galToEq(l + (b ? 1.5 : 0), b); const [al, az] = altAzRaw(ra, dec, lat, L); const p = pj(al, az); if (!p) continue;
            const core = Math.max(0, Math.cos((l > 180 ? l - 360 : l) * Math.PI / 180)) ** 2; const rad = (R / S.v.half) * (b ? 7 : 9);
            const gg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad); const a = (0.08 + core * 0.12) * starA * (b ? 0.65 : 1);
            gg.addColorStop(0, `rgba(${b ? "190,170,255" : "220,200,255"},${a})`); gg.addColorStop(1, "rgba(160,140,255,0)"); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p[0], p[1], rad, 0, 6.29); ctx.fill();
          }
          ctx.globalCompositeOperation = "source-over";
        }
    
        // 暗星底
        if (starA > 0.05) { const fr = Math.max(1.2, W / 800) * Math.min(1.6, 0.7 + zoom * 0.15);
          // 星云团
          ctx.globalCompositeOperation = "lighter"; for (const n of NEB) { const [al, az] = altAzRaw(n[0], n[1], lat, L); const p = pj(al, az); if (!p) continue; const rad = (R / S.v.half) * n[2];
            const gg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad); gg.addColorStop(0, `rgba(${n[3]},${0.09 * starA})`); gg.addColorStop(1, `rgba(${n[3]},0)`); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p[0], p[1], rad, 0, 6.29); ctx.fill(); }
          ctx.globalCompositeOperation = "source-over";
          for (let i = 0; i < FAINT.length; i++) { const f = FAINT[i]; const [al, az] = altAzRaw(f[0], f[1], lat, L); if (al < -2) continue; const p = pj(al, az); if (!p || p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) continue;
            ctx.globalAlpha = starA * (0.22 + f[2] * 0.55); ctx.fillStyle = FCOL[i & 3]; const q = fr * (0.6 + f[2] * 0.8); ctx.fillRect(p[0], p[1], q, q); }
          ctx.globalAlpha = 1; }
        // 地平线→ 用代码画一圈远山和伞树的剪影：颜色跟天边接近、边缘糊一点、上面盖一层薄雾，
        // 山脚几点暖灯；跟着方位转（同一片山），没有任何硬边
        const hz = pj(0, S.v.az);
        if (hz && hz[1] < H * 1.1) {
          const mc = day > 0.75 ? "232,240,250" : day > 0.2 ? "255,186,196" : "120,96,170"; const mg = ctx.createLinearGradient(0, hz[1] - H * 0.12, 0, hz[1] + H * 0.1);
          mg.addColorStop(0, `rgba(${mc},0)`); mg.addColorStop(0.55, `rgba(${mc},${day > 0.75 ? 0.4 : 0.38})`); mg.addColorStop(1, `rgba(${mc},0)`); ctx.fillStyle = mg; ctx.fillRect(0, hz[1] - H * 0.12, W, H * 0.22);
        }
        } }
      ctx.drawImage(base, 0, 0);
      // 星星：越亮越大；放大时暗星也看得见；带一点闪
      const zoom = 30 / S.v.half; const magLim = 5.6;
      const tw = twk.current!; const ts = t / 1000;
      for (let i = 0; i < C.stars.length; i++) {
        const s = C.stars[i]; if (s[2] > magLim) continue; const [al, az] = altAzRaw(s[0], s[1], lat, L); if (al < 0.6) continue; const p = pj(al, az); if (!p) continue;
        if (p[0] < -10 || p[1] < -10 || p[0] > W + 10 || p[1] > H + 10) continue;
        const b = Math.max(0, (magLim - s[2]) / (magLim + 1.5)); const r = (1.3 + b * b * 5.5) * (W / 1000) * Math.min(1.9, Math.sqrt(zoom) * 0.7 + 0.5);
        const a = Math.min(1, (0.55 + b) * starA * (0.82 + 0.18 * Math.sin(ts * 2.3 + tw[i])) * (al < 0 ? 0.25 : 1));
        if (a < 0.02) continue;
        ctx.fillStyle = starColor(s[3]); ctx.globalAlpha = a;
        if (b > 0.42) { const gl = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 4); gl.addColorStop(0, ctx.fillStyle as string); gl.addColorStop(1, "rgba(0,0,0,0)"); ctx.globalAlpha = a * 0.35; ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p[0], p[1], r * 4, 0, 6.29); ctx.fill(); ctx.fillStyle = starColor(s[3]); ctx.globalAlpha = a; }
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.29); ctx.fill();
        if (s[2] < 1.6) { const sp = r * (5 + (1.6 - s[2]) * 3) * (0.85 + 0.15 * Math.sin(ts * 1.7 + tw[i])); const gx = ctx.createLinearGradient(p[0] - sp, 0, p[0] + sp, 0); gx.addColorStop(0, "rgba(255,255,255,0)"); gx.addColorStop(0.5, `rgba(255,250,240,${0.55 * a})`); gx.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = 1; ctx.fillStyle = gx; ctx.fillRect(p[0] - sp, p[1] - r * 0.18, sp * 2, r * 0.36); const gy = ctx.createLinearGradient(0, p[1] - sp, 0, p[1] + sp); gy.addColorStop(0, "rgba(255,255,255,0)"); gy.addColorStop(0.5, `rgba(255,250,240,${0.55 * a})`); gy.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = gy; ctx.fillRect(p[0] - r * 0.18, p[1] - sp, r * 0.36, sp * 2); }
      }
      ctx.globalAlpha = 1;
      // 行星：稳稳的不闪，小名字
      for (const pl of N.planets) { const [al, az] = altAzJ(pl.ra, pl.dec, lat, L); const p = pj(al, az); if (!p || al < -2) continue; const r = Math.max(2, (2.6 - pl.mag * 0.4)) * (W / 900) * 1.4;
        ctx.globalAlpha = Math.max(0.15, starA + 0.2); ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.29); ctx.fill();
        ctx.font = `${Math.round(11 * W / 900 * 1.3)}px system-ui, sans-serif`; ctx.fillStyle = "rgba(255,236,200,.85)"; ctx.fillText(pl.name, p[0] + r + 4, p[1] + 4); }
      ctx.globalAlpha = 1;
      // 月亮：真月相，亮面朝太阳那边
      { const m = N.moon; const [al, az] = altAzJ(m.ra, m.dec, lat, L); const p = pj(al, az);
        if (p && al > -3) { const mr = Math.max(10 * W / 900, (0.27 / S.v.half) * R * 1.0 * 4); const [sal, saz] = altAzJ(N.sun.ra, N.sun.dec, lat, L); const ps = pj(sal, saz);
          const ang = ps ? Math.atan2(ps[1] - p[1], ps[0] - p[0]) : 0; drawMoon(ctx, p[0], p[1], mr, m.illum, ang); } }
      // 深空天体：对准了、放大了才显出真照片（先糊后清楚）
      const center = invCenter(S.v);
      let cand = ""; let candObj: SkyFocus = null;
      for (const o of C.deep) { const [al, az] = altAzRaw(o.ra, o.dec, lat, L); const dd = sep(al, az, center[0], center[1]); const p = pj(al, az); if (!p) continue;
        const sz = Math.max(28 * W / 900, (o.size / 60 / S.v.half) * R * 2.2);
        if (dd < Math.max(3, S.v.half * 0.25) && S.v.half < 30) { cand = "d:" + o.id; candObj = { kind: "deep", deep: o, k: 0 }; }
        const isF = S.focus?.kind === "deep" && S.focus.deep.id === o.id; const I = img(o.img);
        if (I.complete && I.naturalWidth && starA > 0.1) { const k = isF ? Math.min(1, (Date.now() - S.focusAt) / 900) : 0; const a = (isF ? 0.35 + k * 0.65 : 0.22) * starA;
          ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = "lighter"; ctx.filter = `blur(${isF ? (1 - k) * 8 : 3}px)`;
          ctx.drawImage(soft(o.img, I), p[0] - sz / 2, p[1] - sz / 2, sz, sz); ctx.restore(); }
      }
      // 星座：对准中心附近的那个，停 0.5 秒连线一笔一笔亮
      if (!cand && S.v.half < 45) { let best = 1e9; for (const ln of C.lines) { let sx = 0, sy = 0, n = 0; for (const sg of ln.segs) for (const q of sg) { sx += q[0]; sy += q[1]; n++; } if (!n) continue;
          const [al, az] = altAzRaw(meanRa(ln), sy / n, lat, L); const dd = sep(al, az, center[0], center[1]); if (dd < best && dd < Math.max(10, S.v.half * 0.5)) { best = dd; cand = "l:" + ln.name; candObj = { kind: "line", line: ln, k: 0 }; } void sx; } }
      if (!P.focusable) { cand = ""; candObj = null; }
      if (cand !== S.cand) { S.cand = cand; S.candAt = Date.now(); }
      const fkey = S.focus ? (S.focus.kind === "deep" ? "d:" + S.focus.deep.id : "l:" + S.focus.line.name) : "";
      if (cand && cand !== fkey && (Date.now() - S.candAt > 500 || !interactive) && !S.ptrs.size) { S.focus = candObj; S.focusAt = Date.now(); P.onFocus?.(candObj); P.onTick?.(candObj?.kind === "deep" ? "focus" : "line"); }
      else if (!cand && S.focus && Date.now() - S.candAt > 300) { S.focus = null; P.onFocus?.(null); }
      if (S.focus?.kind === "line" && starA > 0.05) { const segs = S.focus.line.segs; const k = Math.min(1, (Date.now() - S.focusAt) / 1300) * segs.length;
        ctx.strokeStyle = "rgba(255,226,160,.75)"; ctx.lineWidth = Math.max(1, W / 700); ctx.lineCap = "round"; ctx.shadowColor = "rgba(255,210,120,.8)"; ctx.shadowBlur = 6;
        for (let i = 0; i < segs.length && i < k; i++) { const f = Math.min(1, k - i); const [a1, z1] = altAzRaw(segs[i][0][0], segs[i][0][1], lat, L), [a2, z2] = altAzRaw(segs[i][1][0], segs[i][1][1], lat, L); const p1 = pj(a1, z1), p2 = pj(a2, z2); if (!p1 || !p2) continue;
          ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p1[0] + (p2[0] - p1[0]) * f, p1[1] + (p2[1] - p1[1]) * f); ctx.stroke(); }
        ctx.shadowBlur = 0; }
    };
    raf = requestAnimationFrame(draw);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [round]);

  // ── 手势：拖着转 / 捏着放大 / 滚轮 ──
  // 圆镜头是正方形，看宽高比认不出转没转 → 顺着祖先把 transform 里的旋转角加起来，再把屏幕位移转回本地
  const local = (dx: number, dy: number) => { let ang = 0; for (let el: HTMLElement | null = ref.current; el; el = el.parentElement) { const tf = getComputedStyle(el).transform; if (tf && tf !== "none") { const m = new DOMMatrix(tf); ang += Math.atan2(m.b, m.a); } }
    const c = Math.cos(-ang), s2 = Math.sin(-ang); return { dx: dx * c - dy * s2, dy: dx * s2 + dy * c }; };
  const down = (e: React.PointerEvent) => { if (!interactive) return; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* 合成事件没有真指针 */ } const S = st.current; S.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); S.vel = { az: 0, alt: 0 }; if (S.ptrs.size === 2) { const [a, b] = [...S.ptrs.values()]; S.pinch = Math.hypot(a.x - b.x, a.y - b.y); } };
  const move = (e: React.PointerEvent) => { const S = st.current; const p = S.ptrs.get(e.pointerId); if (!p) return; const P = props.current;
    if (S.ptrs.size >= 2) { S.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...S.ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (S.pinch > 0) { S.v.half = Math.max(P.minHalf, Math.min(P.maxHalf, S.v.half * S.pinch / d)); P.onView?.({ ...S.v }); } S.pinch = d; return; }
    const { dx, dy } = local(e.clientX - p.x, e.clientY - p.y); S.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const cv = ref.current!; const R = Math.min(cv.clientWidth, cv.clientHeight) / 2; const k = (S.v.half / R) * 1.1;
    const daz = -dx * k / Math.max(0.3, Math.cos(S.v.alt * Math.PI / 180)), dal = dy * k;
    S.v.az = (S.v.az + daz + 360) % 360; S.v.alt = Math.max(P.minAlt, round ? S.v.half : -90, Math.min(89.5, S.v.alt + dal)); S.vel = { az: daz, alt: dal }; P.onView?.({ ...S.v });
    if (Date.now() - S.lastTurn > 90) { S.lastTurn = Date.now(); P.onTick?.("turn"); } };
  const up = (e: React.PointerEvent) => { const S = st.current; S.ptrs.delete(e.pointerId); S.pinch = 0; if (e.type === "pointercancel") S.vel = { az: 0, alt: 0 }; };
  const wheel = (e: React.WheelEvent) => { if (!interactive) return; const S = st.current, P = props.current; S.v.half = Math.max(P.minHalf, Math.min(P.maxHalf, S.v.half * (e.deltaY > 0 ? 1.1 : 0.9))); P.onView?.({ ...S.v }); };
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block", touchAction: "none", borderRadius: round ? "50%" : undefined }}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel} />;
}

/** 视野中心对着的 [高度, 方位] 就是 view 本身 */
function invCenter(v: View): [number, number] { return [v.alt, v.az]; }
/** 星座连线端点的平均赤经（跨 0° 的要绕回来） */
function meanRa(ln: SkyLine) { let x = 0, y = 0; for (const sg of ln.segs) for (const q of sg) { x += Math.cos(q[0] * Math.PI / 180); y += Math.sin(q[0] * Math.PI / 180); } return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360; }
/** 月亮：亮面比例 illum（0~1），ang = 亮面朝向（画布角度，朝太阳） */
function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, illum: number, ang: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const glow = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 3); glow.addColorStop(0, `rgba(255,244,214,${0.18 + illum * 0.25})`); glow.addColorStop(1, "rgba(255,244,214,0)"); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, 6.29); ctx.fill();
  ctx.fillStyle = "rgba(60,62,80,.55)"; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.29); ctx.fill(); // 暗面（地照）
  // 亮面：右半圆（朝 ang 方向）+ 终止线椭圆
  const k = 1 - 2 * illum; // 1 = 新月，-1 = 满月
  ctx.fillStyle = "#fff6dc"; ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false); ctx.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0); ctx.fill();
  ctx.globalAlpha = 0.18; ctx.fillStyle = "#c9c2b0"; for (const [mx, my, mr] of [[0.3, -0.2, 0.18], [-0.1, 0.35, 0.12], [0.45, 0.3, 0.1]]) { ctx.beginPath(); ctx.arc(mx * r, my * r, mr * r, 0, 6.29); ctx.fill(); }
  ctx.restore();
}
