// 伞树农场的「小菜摊」（菜篮 + 杂交图鉴）。玩家在两张效果图里挑了 A：木头小菜摊 + 架子上的种子玻璃瓶。
// 底图 public/world-farm/stall_bg.webp；上面叠真东西：
// · 六个木箱 = 六种菜，箱里堆玩家篮子里真有的菜（熟了那帧的小图），箱前小牌写「草莓 ×3」——试玩反馈效果图里看不见自己要卖的菜在哪
// · 秤砣用游戏里真的像素图（pelican_acts.png）站在柜台后面，平时隔一会儿掂一下秤，卖的时候做成交那排动作——试玩反馈 画的秤砣跟游戏不一样
// · 小黑板写今天收了几样；12 个瓶子按发现顺序装杂交种子（瓶里两种菜的小图），没发现的空瓶写「？」
// 卖：菜从箱子里一个个飞进秤砣的皮囊，亮鳞叮叮飞走，然后才真的调接口（onSell）。
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./WorldBasket.module.css";
import { snd } from "../pixel/sound";
import type { WFarm, WFarmBag } from "../api/ccBridge";
import pelActs from "../assets/world/shop/pelican_acts.png";

const BW = 1553, BH = 863; // 底图尺寸；下面坐标都是底图像素
const px = (x: number) => `${(x / BW) * 100}%`, py = (y: number) => `${(y / BH) * 100}%`;
const CRATES = [[300, 567], [472, 567], [645, 567], [295, 737], [468, 737], [638, 737]]; // 每个箱子底部中间（菜站在这条线上）
const TAGS = [[305, 574], [478, 574], [650, 574], [300, 744], [470, 744], [640, 744]]; // 箱前小牌中心
const JARS = [935, 1057, 1180, 1302].flatMap(x => [[x, 290], [x, 470], [x, 650]]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); // 瓶身中心，一排排
const JAR_TAG = (y: number) => y + 68;
const PEL = { x: 445, bottom: 445, h: 170 }; // 柜台后面，下半身被柜台挡住

function Crop({ seed, size, gray = false }: { seed: string; size: number; gray?: boolean }) {
  const [wh, setWh] = useState<[number, number] | null>(null);
  useEffect(() => { const im = new Image(); im.onload = () => setWh([im.naturalWidth, im.naturalHeight]); im.src = `/world-farm/crops/${seed}.png`; }, [seed]);
  if (!wh) return <span style={{ width: size, height: size, display: "inline-block" }} />;
  const fw = wh[0] / 5, k = size / Math.max(fw, wh[1]);
  return <span className={`${s.crop} ${gray ? s.gray : ""}`} style={{ width: Math.round(fw * k), height: Math.round(wh[1] * k), backgroundImage: `url(/world-farm/crops/${seed}.png)`, backgroundSize: `${Math.round(wh[0] * k)}px ${Math.round(wh[1] * k)}px`, backgroundPosition: `-${Math.round(fw * 4 * k)}px 0` }} />;
}
const baseSeed = (id?: string) => (id && id.startsWith("h:") ? id.slice(2).split("+")[0] : id || "strawberry");

/** 秤砣：pelican_acts.png 一行 3 帧（64×74），行号见 pelican_acts.json */
function Pelican({ row, t0, unit }: { row: number; t0: number; unit: number }) {
  const [f, setF] = useState(0);
  useEffect(() => { setF(0); const id = window.setInterval(() => setF(v => Math.min(2, v + 1)), 700); return () => clearInterval(id); }, [row, t0]);
  const k = unit / 74; // 一帧画多高
  return <span className={s.pel} style={{ width: 64 * k, height: 74 * k, backgroundImage: `url(${pelActs})`, backgroundSize: `${192 * k}px ${666 * k}px`, backgroundPosition: `-${f * 64 * k}px -${row * 74 * k}px` }} />;
}

export function WorldBasket({ farm, bag, names, onClose, onSell }: { farm: WFarm; bag: WFarmBag; names: Record<string, string>; onClose: () => void; onSell?: () => void }) {
  const [closing, setClosing] = useState(false); const [selling, setSelling] = useState(false);
  const stage = useRef<HTMLDivElement>(null); const [scale, setScale] = useState(1);
  useEffect(() => { const el = stage.current; if (!el) return; const fit = () => setScale(el.clientWidth / BW); fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect(); }, []);
  useEffect(() => { snd.sfx("popup"); }, []);
  // 秤砣平时：站着（nap 行第 2 帧当站姿太困，用 peek 行），每 5 秒掂一下秤（weigh）
  const [pel, setPel] = useState({ row: 4, t0: 0 });
  useEffect(() => { if (selling) return; const id = window.setInterval(() => { setPel({ row: 1, t0: Date.now() }); window.setTimeout(() => setPel({ row: 4, t0: Date.now() }), 2300); }, 5200); return () => clearInterval(id); }, [selling]);
  const close = () => { if (closing) return; setClosing(true); snd.sfx("fold"); window.setTimeout(onClose, 280); };
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const it of bag.basket) { const k = baseSeed(it.seed); c[k] = (c[k] || 0) + 1; } return c; }, [bag.basket]);
  const crops = farm.shop.slice(0, 6);
  const total = bag.basket.length;
  const found = Object.entries(farm.hybrids as Record<string, { name: string; parents: string[]; by: string[] }>);
  const pairsN = (crops.length * (crops.length + 1)) / 2;
  const sell = () => { if (!onSell || !total || selling) return; setSelling(true); setPel({ row: 6, t0: Date.now() }); snd.sfx("scoop"); [0, 1, 2, 3, 4].forEach(i => window.setTimeout(() => snd.sfx("coin"), 700 + i * 120)); window.setTimeout(() => { onSell(); }, 1300); window.setTimeout(() => { setSelling(false); setPel({ row: 4, t0: Date.now() }); }, 2600); };
  const u = (n: number) => n * scale; // 底图像素 → 屏幕像素
  return (
    <div className={`${s.mask} ${closing ? s.out : ""}`} onClick={close}>
      <div ref={stage} className={s.stage} onClick={e => e.stopPropagation()}>
        <img className={s.bg} src="/world-farm/stall_bg.webp" alt="" draggable={false} />
        {/* 秤砣：柜台后面，只露柜台以上 */}
        <div className={s.pelClip} style={{ left: px(PEL.x - 120), top: py(PEL.bottom - PEL.h - 10), width: px(240), height: py(PEL.h + 10) }}>
          <div className={s.pelPos} style={{ bottom: -u(48) }}><Pelican row={pel.row} t0={pel.t0} unit={u(PEL.h + 48)} /></div>
        </div>
        {/* 六个木箱 */}
        {crops.map((c, i) => { const n = counts[c.id] || 0; const [x, y] = CRATES[i]; const pile = Math.min(n, 5);
          return (
            <div key={c.id}>
              <div className={`${s.crate} ${selling && n ? s.flyAway : ""}`} style={{ left: px(x), top: py(y), "--d": `${i * 90}ms` } as React.CSSProperties}>
                {Array.from({ length: pile }, (_, k) => <span key={k} className={s.veg} style={{ "--k": k, left: u((k % 3 - 1) * 34 + (k >= 3 ? 17 : 0)), bottom: u(k >= 3 ? 26 : 0) } as React.CSSProperties}><Crop seed={c.id} size={u(62)} /></span>)}
              </div>
              <span className={`${s.tag} ${n ? "" : s.tagEmpty}`} style={{ left: px(TAGS[i][0]), top: py(TAGS[i][1]), fontSize: u(26) }}>{c.name}{n ? <b> ×{n}</b> : ""}</span>
            </div>);
        })}
        {/* 小黑板 */}
        <div className={s.board} style={{ left: px(726), top: py(668), width: px(116), fontSize: u(25) }}>{total ? <>今天收了<b style={{ fontSize: u(46) }}>{total}</b>样</> : <>篮子<br />还空着</>}</div>
        {/* 杂交图鉴：瓶子 */}
        <span className={s.dexN} style={{ left: px(1262), top: py(170), fontSize: u(24) }}>{found.length}/{pairsN}</span>
        {JARS.map(([x, y], i) => { const h = found[i]?.[1];
          return (
            <div key={i}>
              {h && <div className={s.jarIn} style={{ left: px(x), top: py(y), "--i": i } as React.CSSProperties}><Crop seed={h.parents[0]} size={u(38)} /><Crop seed={h.parents[1]} size={u(38)} /><i className={s.glint} /></div>}
              <span className={`${s.jarTag} ${h ? s.jarGot : ""}`} style={{ left: px(x), top: py(JAR_TAG(y)), fontSize: u(h ? 20 : 26) }} title={h ? h.by.map(w => names[w] ?? w).join(" × ") : ""}>{h ? h.name : "？"}</span>
            </div>);
        })}
        {/* 卖 / 关：叠在底图那两个按钮上 */}
        <button type="button" className={`${s.hit} ${s.sellHit} ${!total || selling ? s.off : ""}`} style={{ left: px(1373), top: py(642), width: px(176), height: py(176) }} aria-label="卖给秤砣" onClick={sell} />
        <button type="button" className={`${s.hit} ${s.closeHit}`} style={{ left: px(1350), top: py(44), width: px(96), height: py(96) }} aria-label="关上" onClick={close} />
        {selling && <span className={s.coins} style={{ left: px(PEL.x), top: py(PEL.bottom - 80) }}>{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}</span>}
      </div>
    </div>
  );
}
