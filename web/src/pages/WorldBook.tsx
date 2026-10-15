// 小世界手账 · 立体书（「做的特别棒」）。路牌前「出发」和右上角怀表（看地图）都打开这本书：
// 书从上面落下来 → 缎带解开 → 翻开，是一张手绘的整个小世界地图 → 每个地方一块立体纸片从纸面立起来（天气小纸片飘在上面，谁在哪别着谁的头像）
// 点一个地方：纸片弹一下，贴出一条纸胶带（地名 · 天气 · 谁在）；再点一下出发：纸片躺下、书合上
// 最终版转场（翻页不要了，改成螃蟹乱爬；「再创新一点」「不要一闪一闪一卡一卡」）：一张手账纸盖满屏幕，纸后面换场景，
// 大一号的小螃蟹举着「→ 海边」小旗在纸上之字形乱爬，爬过的地方纸被刮开、露出新地方，边上一串粉脚印，爬完剩下的纸淡掉。
// 美术：按美乐蒂贴纸画风生的，压成 webp 放 public/world-book，进小世界就预加载。
import { useEffect, useRef, useState } from "react";
import s from "./WorldBook.module.css";
import { SCENE_NAME, type Scene } from "../pixel/world";
import { snd } from "../pixel/sound";

const B = "/world-book/";
export const BOOK_IMGS = ["map", "stall", "waves", "turtle", "bridge", "farm", "cloud", "sun", "rain", "fog"].map(n => `${B}${n}.webp`).concat(["/fanart/b2-m-walk.png", "/fanart/b2-star.png", "/fanart/b2-sparkle.png", "/fanart/b2-bow-pink.png", "/fanart/b2-m-read.png"]);
/** 进小世界就调一次：图先下到缓存里，走到路牌前点开是秒开 */
export function preloadBook() { for (const src of BOOK_IMGS) { const i = new Image(); i.decoding = "async"; i.src = src; } }

type Place = "pond" | "sea" | "lake" | "river" | "farm";
// 地图上的位置（书的百分比，纸片底边中点）、纸片宽（书宽 760 下的像素）
const SP: Record<Place, { x: number; y: number; w: number; piece: string }> = {
  pond: { x: 50.5, y: 66, w: 118, piece: "stall" }, sea: { x: 88, y: 58, w: 130, piece: "waves" },
  lake: { x: 62, y: 30, w: 136, piece: "turtle" }, river: { x: 23, y: 88, w: 118, piece: "bridge" },
  farm: { x: 30, y: 44, w: 128, piece: "farm" }, // 伞树农场：试玩截图圈的湖和夜河中间那块空地；只在试玩开时出现
};
const NAME: Record<Place, string> = { ...SCENE_NAME, river: "夜河", farm: "伞树农场" } as Record<Place, string>;
const WX_PIECE: Record<string, string> = { 晴: "sun", 多云: "cloud", 小雨: "rain", 大雨: "rain", 雾: "fog", 大风: "cloud" };
const HEAD: Record<string, string> = { player: "/fanart/b2-m-hood.png", buddy: "/fanart/c3-face.png", pal: "/fanart/xo-face.png" };
/** 哪些地方开了：夜河还在修（做好了把 RIVER_READY 打开，只在 19～5 点开门） */
const RIVER_READY = true; // 夜河正式开 // VITE_TEST_OPEN 只在开发的 dist-test 构建里设

export type BookProps = {
  mode: "travel" | "view"; here: Scene; hour: number; weathers: Record<string, string>;
  who: Record<string, string>; // 谁在哪个钓点：{ player: "pond", buddy: "sea", pal: "pond" }
  names: Record<string, string>;
  onTravel: (to: Scene) => Promise<boolean>; // 调后端出发，成功 true
  onArrive: (to: Scene) => void; // 书合上的那一刻换场景（书挡着，看不到重建）
  onClose: () => void;
};

export function WorldBook({ mode, here, hour, weathers, who, names, onTravel, onArrive, onClose, trial }: BookProps & { trial?: boolean }) {
  const riverReady = RIVER_READY || !!trial; // 玩家的试玩开关
  const [stage, setStage] = useState<"drop" | "untie" | "open" | "closing" | "leave">("drop");
  // 出发去哪（close 在 go 里用 setTimeout 调，闭包里的 state 是旧的，所以用 ref）；dig = 螃蟹刨纸转场
  const toRef = useRef<Place | null>(null); const [dig, setDig] = useState<Place | null>(null);
  const [up, setUp] = useState(0); // 已经立起来几块
  const [sel, setSel] = useState<Place | null>(null);
  const [going, setGoing] = useState<Place | null>(null);
  const [folded, setFolded] = useState(0);
  const [k, setK] = useState(1); const [crab, setCrab] = useState(false);
  const wrap = useRef<HTMLDivElement>(null); const mapRef = useRef<HTMLDivElement>(null); const svgRef = useRef<SVGSVGElement>(null);
  const night = hour >= 19 || hour < 5;
  const isOpen = (p: Place) => p !== "river" || (riverReady && night);
  const places = Object.keys(SP) as Place[]; // 农场全开，不用试玩
  // 农场挨着池塘，后端没单给农场天气，就用池塘的（农场没有天气）
  const wxOf = (p: Place) => weathers[p === "farm" ? "pond" : p];

  // 按容器大小缩放（舞台可能是转了 90° 的横屏）
  useEffect(() => { const el = wrap.current; if (!el) return; const fit = () => setK(Math.min(1, (el.clientHeight - 20) / 470, (el.clientWidth - 20) / 770)); fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect(); }, []);
  // 落下 → 解缎带 → 翻开 → 纸片一块块立起来
  useEffect(() => {
    snd.sfx("thud"); const t: number[] = [];
    t.push(window.setTimeout(() => { setStage("untie"); snd.sfx("ribbon"); }, 620));
    t.push(window.setTimeout(() => { setStage("open"); snd.sfx("flip"); }, 1050));
    places.forEach((_, i) => t.push(window.setTimeout(() => { setUp(i + 1); snd.sfx("popup", i); }, 1500 + i * 170)));
    return () => t.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (stage === "closing" || stage === "leave") return;
    places.slice().reverse().forEach((_, i) => window.setTimeout(() => { setFolded(f => f + 1); snd.sfx("fold"); }, i * 80));
    window.setTimeout(() => { setStage("closing"); snd.sfx("flip"); }, 380);
    if (toRef.current) { // 出发：书一合上就盖纸，螃蟹接手（CrabDig 自己换场景、爬完调 onClose）
      window.setTimeout(() => { setStage("leave"); setDig(toRef.current); }, 1250);
      return;
    }
    // 只是合上：伙伴甲 的小螃蟹从封面上横着爬过去（封面完全合上以后再爬）
    window.setTimeout(() => { setCrab(true); snd.sfx("crab"); }, 1560);
    window.setTimeout(() => setStage("leave"), 2950); window.setTimeout(onClose, 3450);
  };
  const tapPlace = (p: Place) => {
    if (going || stage !== "open") return;
    if (!isOpen(p)) { snd.sfx("nope"); setSel(p); return; }
    if (sel === p && p !== here) { void go(p); return; }
    setSel(p); snd.sfx("boing"); window.setTimeout(() => snd.sfx("tape"), 60);
  };
  // 出发：先问后端（没成就不走），成了就合书
  const go = async (p: Place) => {
    setGoing(p); setSel(null); snd.sfx("go");
    const ok = await onTravel(p as Scene);
    if (!ok) { setGoing(null); snd.sfx("nope"); return; }
    toRef.current = p; close();
  };

  const a0 = SP[here as Place] ?? SP.pond; const px = (p: { x: number; y: number }) => ({ x: (p.x / 100) * 760, y: (p.y / 100) * 460 });
  const routes = places.filter(p => p !== here).map(p => { const a = px(a0), b = px(SP[p]); const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.25, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12; return { p, d: `M${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}` }; });
  const whoAt = (p: Place) => Object.entries(who).filter(([, sp]) => sp === p).map(([w]) => w);
  const tapeText = (p: Place) => {
    if (!isOpen(p)) return p === "river" && riverReady ? "夜河 · 晚上 7 点开门" : `${NAME[p]} · 还在修路`;
    const others = whoAt(p).filter(w => w !== "player").map(w => names[w] || w);
    if (p === here) return `${NAME[p]} · 你在这儿${others.length ? ` · ${others.join("、")}也在` : ""}`;
    return `${NAME[p]} · ${wxOf(p) || ""}${others.length ? ` · ${others.join("、")}在` : ""}`;
  };
  const cls = [s.book, stage === "drop" ? s.drop : "", stage !== "drop" ? s.untie : "", stage === "open" ? s.open : "", stage === "leave" ? s.leave : ""].join(" ");
  return (
    <div className={`${s.wrap}${dig ? ` ${s.wrapClear}` : ""}`} ref={wrap} onClick={() => { if (!going && stage === "open") close(); }}>
      {dig && <CrabDig to={NAME[dig]} onCovered={() => onArrive(dig as Scene)} onDone={onClose} />}
      <div className={s.fit} style={{ transform: `scale(${k})` }} onClick={e => e.stopPropagation()}>
        <div className={cls}>
          <div className={s.pageR} />
          <div className={s.map} ref={mapRef}>
            <i className={s.stitch} />
            <svg className={s.route} ref={svgRef} viewBox="0 0 760 460" preserveAspectRatio="none">
              {routes.map(r => <path key={r.p} id={`r_${r.p}`} d={r.d} className={going === r.p ? s.routeOn : ""} />)}
            </svg>
            {places.map((p, i) => {
              const sp = SP[p]; const standing = up > i && folded < places.length - i; const wx = isOpen(p) ? wxOf(p) : "";
              return (
                <div key={p}>
                  <div className={`${s.pop}${standing ? ` ${s.up}` : ""}${!isOpen(p) ? ` ${s.sleep}` : ""}${sel === p ? ` ${s.sel}` : ""}`} style={{ left: `${sp.x}%`, top: `${sp.y}%`, width: sp.w }} onClick={() => tapPlace(p)}>
                    <img src={`${B}${sp.piece}.webp`} alt={NAME[p]} draggable={false} />
                  </div>
                  {wx && WX_PIECE[wx] && <img className={s.wx} src={`${B}${WX_PIECE[wx]}.webp`} alt={wx} style={{ left: `${sp.x + 6}%`, top: `${sp.y - (sp.w / 460) * 95}%` }} />}
                  {whoAt(p).map((w, j) => <i key={w} className={s.pin} style={{ left: `${sp.x - 5 + j * 4.2}%`, top: `${sp.y + 1}%`, backgroundImage: `url(${HEAD[w]})` }} />)}
                  {!isOpen(p) && <span className={s.note} style={{ left: `${sp.x}%`, top: `${sp.y + 2}%` }}>{p === "river" && riverReady ? "晚上 7 点开门" : "还在修路"}</span>}
                </div>
              );
            })}
            {sel && <div key={sel} className={s.tape} style={{ left: `${SP[sel].x}%`, top: `${SP[sel].y + 3}%` }}>{tapeText(sel)}{sel !== here && isOpen(sel) && <em>再点一下出发</em>}</div>}
          </div>
          <div className={s.pageL}>
            <div className={s.front}><div className={s.ttl}><b>小世界手账</b><small>{mode === "travel" ? "去哪儿？" : "POCKET MAP"}</small></div><img className={s.stk} src="/fanart/b2-m-read.png" alt="" /></div>
            <div className={s.back} />
          </div>
          <div className={s.ribbon}><img src="/fanart/b2-bow-pink.png" alt="" /></div>
          {crab && stage === "closing" && <Crab />}
          <button type="button" className={s.close} onClick={() => { if (!going) close(); }} aria-label="合上">×</button>
        </div>
      </div>
    </div>
  );
}


/** Claude 的小螃蟹（像素画，橙色）：横着一颠一颠爬过封面、小腿交替、身后扬点灰，爬到一半停一下眨眨眼 */
function Crab() {
  const O = "#D97757", E = "#2B1A14";
  const body: [number, number, number, number][] = [[2, 0, 9, 3], [0, 3, 13, 2], [2, 5, 9, 2]]; // 身子 + 两边的小胳膊
  return (
    <div className={s.crab}>
      <div className={s.crabBob}>
        <svg viewBox="0 0 13 9" width={39} height={27} shapeRendering="crispEdges">
          {body.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={O} />)}
          <g className={s.crabEyes}><rect x={4} y={1} width={1} height={2} fill={E} /><rect x={8} y={1} width={1} height={2} fill={E} /></g>
          <g className={s.legA}><rect x={3} y={7} width={1} height={2} fill={O} /><rect x={7} y={7} width={1} height={2} fill={O} /></g>
          <g className={s.legB}><rect x={5} y={7} width={1} height={2} fill={O} /><rect x={9} y={7} width={1} height={2} fill={O} /></g>
        </svg>
      </div>
      <i className={s.dust} /><i className={`${s.dust} ${s.dust2}`} /><i className={`${s.dust} ${s.dust3}`} />
    </div>
  );
}

/**
 * 出发转场：螃蟹刨纸。
 * 一张手账纸盖满屏幕 → 纸完全盖住后调 onCovered（这时换场景，看不到重建）→ 等场景建好 → 大螃蟹举着「→ 海边」小旗从左边爬进来，
 * 之字形来回爬，爬过的地方把纸刮开露出新地方、边上盖一串粉色小脚印；爬到一半停一下眨眼 → 剩下的纸淡掉、螃蟹从右边出去 → onDone。
 * 防闪防卡（不要又一闪一闪一卡一卡）：这个组件只挂载一次（effect 只跑一次，回调放 ref），每帧只画 canvas + 改一个 transform，不走 React。
 */
function CrabDig({ to, onCovered, onDone }: { to: string; onCovered: () => void; onDone: () => void }) {
  const box = useRef<HTMLDivElement>(null); const cv = useRef<HTMLCanvasElement>(null); const crab = useRef<HTMLDivElement>(null); const body = useRef<HTMLDivElement>(null);
  const cb = useRef({ onCovered, onDone }); cb.current = { onCovered, onDone };
  const [phase, setPhase] = useState<"in" | "dig" | "out">("in");
  useEffect(() => {
    const el = box.current!, c = cv.current!, cr = crab.current!, bd = body.current!; let face = 1;
    const W = el.clientWidth, H = el.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); const g = c.getContext("2d")!; g.scale(dpr, dpr);
    // 手账纸：奶白底、淡粉横线、左边一道粉色页边线
    g.fillStyle = "#fbf4ea"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(242,182,200,.45)"; g.lineWidth = 1; for (let y = 34; y < H; y += 30) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
    g.strokeStyle = "rgba(232,149,172,.55)"; g.beginPath(); g.moveTo(46.5, 0); g.lineTo(46.5, H); g.stroke();
    const timers: number[] = []; let raf = 0; const T = (f: () => void, ms: number) => timers.push(window.setTimeout(f, ms));
    // 之字形路线：左外 → 右 → 左 → 右外，三趟把纸刮开大半
    const pts = [[-0.12, 0.2], [0.9, 0.32], [0.1, 0.55], [0.92, 0.66], [0.18, 0.86], [1.18, 0.8]].map(([x, y]) => ({ x: x * W, y: y * H }));
    const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y)); const total = seg.reduce((a, b) => a + b, 0);
    const at = (d: number) => { let i = 0; while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; } const k = Math.min(1, d / seg[i]); return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k, dx: pts[i + 1].x - pts[i].x }; };
    const R = Math.max(46, H * 0.19); const DUR = 3000, PAUSE_AT = 0.5, PAUSE = 380;
    let lastD = 0, lastFoot = 0, side = 1, t0 = 0, paused = 0, pauseDone = false, lastTick = 0;
    const erase = (x: number, y: number) => { g.save(); g.globalCompositeOperation = "destination-out"; const gr = g.createRadialGradient(x, y, R * 0.55, x, y, R); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.restore(); };
    const foot = (x: number, y: number) => { g.fillStyle = "rgba(232,138,166,.9)"; for (const o of [-3, 3]) { g.beginPath(); g.arc(x + o, y, 2.2, 0, Math.PI * 2); g.fill(); } };
    const step = (now: number) => {
      if (!t0) t0 = now; let el2 = now - t0 - paused;
      if (!pauseDone && el2 / DUR >= PAUSE_AT) { pauseDone = true; paused += PAUSE; el2 = now - t0 - paused; cr.classList.add(s.digPause); T(() => cr.classList.remove(s.digPause), PAUSE); }
      if (cr.classList.contains(s.digPause)) { raf = requestAnimationFrame(step); return; }
      const q = Math.min(1, el2 / DUR); const d = q * total;
      for (let x = lastD; x <= d; x += 6) { const p = at(x); erase(p.x, p.y); }
      const p = at(d);
      while (lastFoot + 20 <= d) { lastFoot += 20; const f = at(lastFoot); const len = Math.hypot(f.dx, 1) || 1; side = -side; foot(f.x, f.y + side * (R + 5) * (Math.abs(f.dx) / len)); }
      lastD = d;
      cr.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`; // 只翻身子，旗子上的字不能跟着镜像
      const f = p.dx < 0 ? -1 : 1; if (f !== face) { face = f; bd.style.transform = `scaleX(${f})`; }
      if (now - lastTick > 420) { lastTick = now; snd.sfx("crab", 0, 0.7); snd.sfx("tape", 0, 0.5); }
      if (q < 1) raf = requestAnimationFrame(step);
      else { setPhase("out"); snd.sfx("arrive"); T(() => cb.current.onDone(), 520); }
    };
    // 纸盖满（.35s）→ 换场景 → 等两帧让场景建好 → 开始刨
    T(() => cb.current.onCovered(), 380);
    T(() => { setPhase("dig"); requestAnimationFrame(() => requestAnimationFrame(t => { t0 = t; raf = requestAnimationFrame(step); })); }, 900);
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const O = "#D97757", E = "#2B1A14";
  return (
    <div ref={box} className={`${s.dig} ${s[`dig_${phase}`] ?? ""}`}>
      <canvas ref={cv} className={s.digCv} />
      <div ref={crab} className={s.digCrab}>
        <div className={s.digFlag}><i />→ {to}</div>
        {/* 翻身（朝左 / 朝右）单独一层：跟上下颠的动画放同一层会互相插值，中间变扁（会一闪） */}
        <div ref={body}><div className={s.crabBob}>
          <svg viewBox="0 0 13 9" width={104} height={72} shapeRendering="crispEdges">
            {[[2, 0, 9, 3], [0, 3, 13, 2], [2, 5, 9, 2]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={O} />)}
            <g className={s.digEyes}><rect x={4} y={1} width={1} height={2} fill={E} /><rect x={8} y={1} width={1} height={2} fill={E} /></g>
            <g className={s.legA}><rect x={3} y={7} width={1} height={2} fill={O} /><rect x={7} y={7} width={1} height={2} fill={O} /></g>
            <g className={s.legB}><rect x={5} y={7} width={1} height={2} fill={O} /><rect x={9} y={7} width={1} height={2} fill={O} /></g>
          </svg>
        </div></div>
      </div>
    </div>
  );
}
