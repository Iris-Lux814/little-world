// 种菜的种子袋（伞树农场，后端 little-world/engine/farm.js）：点自己盆里的空格弹出来。
// 一只系麻绳的小布袋从底下弹上来 → 绳结松开 → 一包包纸种子袋扇形滑出来（正面画着这种菜熟了的样子、右上角写还剩几颗）；
// 没有的那几包灰着、挂一张小价签「N 亮鳞」，点了跟秤砣买一包（3 颗）。点有的那包：纸袋一抖，种子蹦出去，袋子收回，盆里那格鼓一下（world.ts 画）。
import { useEffect, useState } from "react";
import s from "./WorldSeeds.module.css";
import B2 from "../components/B2";
import { snd } from "../pixel/sound";
import type { WFarm, WFarmBag } from "../api/ccBridge";

/** 作物图一行 5 帧（public/world-farm/crops），第 5 帧 = 熟了的样子，拿来当种子袋正面的画 */
function CropPic({ seed, size }: { seed: string; size: number }) {
  const [wh, setWh] = useState<[number, number] | null>(null);
  useEffect(() => { const im = new Image(); im.onload = () => setWh([im.naturalWidth, im.naturalHeight]); im.src = `/world-farm/crops/${seed}.png`; }, [seed]);
  if (!wh) return <span style={{ width: size, height: size, display: "inline-block" }} />;
  const fw = wh[0] / 5, k = size / Math.max(fw, wh[1]);
  return <span className={s.pic} style={{ width: Math.round(fw * k), height: Math.round(wh[1] * k), backgroundImage: `url(/world-farm/crops/${seed}.png)`, backgroundSize: `${Math.round(wh[0] * k)}px ${Math.round(wh[1] * k)}px`, backgroundPosition: `-${Math.round(fw * 4 * k)}px 0` }} />;
}

export function WorldSeeds({ farm, bag, coins, busy, onPlant, onBuy, onClose }: { farm: WFarm; bag: WFarmBag; coins: number; busy: boolean; onPlant: (seed: string) => void; onBuy: (seed: string) => void; onClose: () => void }) {
  const [open, setOpen] = useState(false); const [going, setGoing] = useState<string | null>(null); const [closing, setClosing] = useState(false);
  useEffect(() => { snd.sfx("popup"); const t = window.setTimeout(() => { setOpen(true); snd.sfx("rustle"); }, 380); return () => clearTimeout(t); }, []);
  const close = () => { if (closing) return; setClosing(true); snd.sfx("fold"); window.setTimeout(onClose, 300); };
  const plant = (id: string) => { if (busy || going) return; setGoing(id); snd.sfx("flip"); window.setTimeout(() => { onPlant(id); close(); }, 420); };
  const list = farm.shop.map(it => ({ ...it, have: bag.seeds[it.id] || 0 })).sort((a, b) => (b.have ? 1 : 0) - (a.have ? 1 : 0));
  const extra = Object.entries(bag.seeds).filter(([id, n]) => n > 0 && !farm.shop.some(x => x.id === id)); // 杂交种子
  const total = list.reduce((a, x) => a + x.have, 0) + extra.reduce((a, [, n]) => a + n, 0);
  return (
    <div className={`${s.mask} ${closing ? s.out : ""}`} onClick={close}>
      <div className={`${s.pouch} ${open ? s.open : ""}`} onClick={e => e.stopPropagation()}>
        <div className={s.head}>
          <B2 n="m-strawberry" w={46} className={s.mel} />
          <span className={s.title}>种点什么<em>{total ? `袋里还有 ${total} 颗` : "袋子空了，挑一包跟秤砣买"}</em></span>
          <span className={s.knot} aria-hidden />
          <span className={s.coins}><i />{coins}</span>
        </div>
        <div className={s.fan}>
          {list.map((it, i) => (
            <button key={it.id} type="button" className={`${s.pack} ${it.have ? "" : s.none} ${going === it.id ? s.going : ""}`} style={{ "--i": i, "--r": `${(i - (list.length - 1) / 2) * 3}deg` } as React.CSSProperties}
              disabled={busy} onClick={() => (it.have ? plant(it.id) : coins >= it.price ? (snd.sfx("coin"), onBuy(it.id)) : snd.sfx("nope"))}>
              <span className={s.flap} aria-hidden />
              <CropPic seed={it.id} size={40} />
              <b>{it.name}</b>
              {it.have ? <span className={s.cnt}>{it.have}</span> : <span className={s.tag}>{it.price} 亮鳞</span>}
              {going === it.id && <span className={s.seed} aria-hidden />}
            </button>
          ))}
          {extra.map(([id, n], i) => (
            <button key={id} type="button" className={`${s.pack} ${s.hyb}`} style={{ "--i": list.length + i, "--r": "0deg" } as React.CSSProperties} disabled={busy} onClick={() => plant(id)}>
              <span className={s.flap} aria-hidden /><CropPic seed={id.startsWith("h:") ? id.slice(2).split("+")[0] : id} size={40} /><b>杂交种</b><span className={s.cnt}>{n}</span>
            </button>
          ))}
        </div>
        <div className={s.foot}>没有的那包点一下就跟秤砣买（一包 3 颗）</div>
      </div>
    </div>
  );
}
