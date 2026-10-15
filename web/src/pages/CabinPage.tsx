// 小屋（第 4 步）里走到东西跟前点开的几页：鱼缸 / 纪念品柜 / 纪录板。伙伴的角落直接用 WorldPage 的集邮册（Album who=buddy|pal）。
// 奶白纸 + 粉缝线；每页一个跟东西本身有关的动画：鱼缸里鱼真的在游、放进去扑通一声；柜子玻璃门拉开、纪念品点一下翻到签名；纪录板纸卡一张张钉上去。
import { useEffect, useMemo, useState } from "react";
import s from "./CabinPage.module.css";
import type { WCabin, WDex, WFish } from "../api/ccBridge";
import { snd } from "../pixel/sound";

const NAME: Record<string, string> = { player: "你", buddy: "伙伴甲", pal: "伙伴乙" };
const RC = ["#C9B8BF", "#8FC7A8", "#8FB3E8", "#C39BE8", "#F2B45A"];
const fishSrc = (sp: string) => `/world-fish/${sp}.png`;

/** 鱼缸：上半是缸（鱼在里面游），下半两栏：缸里的 / 你桶里的 */
export function TankSheet({ cabin, bucket, busy, onPut, onTake, onClose, nm }: { cabin: WCabin; bucket: WFish[]; busy: boolean; onPut: (id: string) => void; onTake: (id: string) => void; onClose: () => void; nm: (w: string) => string }) {
  const [splash, setSplash] = useState(0); const [drop, setDrop] = useState<string | null>(null);
  const can = bucket.filter(f => !f.junk && !["buddy_note", "buddy_pencil", "pal_card", "player_clip", "bottle"].includes(f.species)).slice().reverse();
  const full = cabin.tank.length >= cabin.tankCap;
  // 每条鱼一个固定的游法（按 id 算），列表变了不重排
  const swim = (id: string, i: number) => { let h = 7; for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0; return { top: 16 + ((i * 23) % 58), dur: 8 + (i % 4) * 2.3 + (h % 3), delay: -((i * 3.7 + (h % 5)) % 9), dir: i % 2 ? "reverse" : "normal" }; }; // 按顺序错开高度、快慢、方向
  useEffect(() => { snd.sfx("bubble"); }, []);
  const put = (f: WFish) => { if (busy || full) return; setDrop(f.species); setSplash(v => v + 1); snd.sfx("plop"); window.setTimeout(() => setDrop(null), 700); onPut(f.id); };
  return (
    <div className={s.mask} onClick={onClose}>
      <div className={s.card} onClick={e => e.stopPropagation()}>
        <div className={s.head}><img src="/fanart/b2-bubble.png" alt="" /><b>小屋的鱼缸</b><span>{cabin.tank.length}/{cabin.tankCap} 条 · 三个人一起养</span><button type="button" onClick={onClose} aria-label="合上">×</button></div>
        <div className={s.tank}>
          <i className={s.sand} /><i className={s.weedA} /><i className={s.weedB} />
          {cabin.tank.map((f, i) => { const w = swim(f.id, i); return (
            <div key={f.id} className={s.swimmer} style={{ top: `${w.top}%`, animationDuration: `${w.dur}s`, animationDelay: `${w.delay}s`, animationDirection: w.dir } as React.CSSProperties}>
              <img src={fishSrc(f.species)} alt={f.name} style={{ animationDuration: `${w.dur}s`, animationDelay: `${w.delay}s`, animationDirection: w.dir }} />
            </div>); })}
          {drop && <img key={splash} className={s.dropIn} src={fishSrc(drop)} alt="" />}
          {splash > 0 && <i key={`r${splash}`} className={s.ripple} />}
          {!cabin.tank.length && <span className={s.emptyTank}>缸是空的。钓到喜欢的，放进来养着。</span>}
          {Array.from({ length: 6 }, (_, i) => <i key={i} className={s.bub} style={{ left: `${12 + i * 15}%`, animationDelay: `${i * 0.9}s` }} />)}
        </div>
        <div className={s.two}>
          <div className={s.col}><em>缸里的</em>
            {cabin.tank.map(f => (
              <div key={f.id} className={s.row} style={{ "--rc": RC[f.rarity] } as React.CSSProperties}><img src={fishSrc(f.species)} alt="" /><span><b>{f.name}</b><small>{f.kg}kg · {nm(f.owner) || NAME[f.owner]}放的</small></span>
                {f.owner === "player" && <button type="button" className={s.ghost} disabled={busy} onClick={() => { snd.sfx("plop"); onTake(f.id); }}>捞回来</button>}</div>))}
            {!cabin.tank.length && <p className={s.none}>还没有。</p>}
          </div>
          <div className={s.col}><em>你桶里的{full ? " · 缸满了" : ""}</em>
            {can.map(f => (
              <div key={f.id} className={s.row} style={{ "--rc": RC[f.rarity] } as React.CSSProperties}><img src={fishSrc(f.species)} alt="" /><span><b>{f.name}</b><small>{"★".repeat(f.stars)} · {f.kg}kg</small></span>
                <button type="button" className={s.pink} disabled={busy || full} onClick={() => put(f)}>放进去</button></div>))}
            {!can.length && <p className={s.none}>桶里没有能养的鱼。</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 纪念品柜：玻璃门往两边拉开，三层架子；点一件翻到背面看签名 */
export function CabinetSheet({ cabin, dex, onClose, nm }: { cabin: WCabin; dex: WDex[]; onClose: () => void; nm: (w: string) => string }) {
  const [flip, setFlip] = useState<string | null>(null);
  const sign = useMemo(() => new Map(dex.map(d => [d.id, d.sign])), [dex]);
  useEffect(() => { snd.sfx("creak"); }, []);
  const rows = [0, 1, 2].map(r => cabin.keepsakes.filter((_, i) => i % 3 === r));
  return (
    <div className={s.mask} onClick={onClose}>
      <div className={s.card} onClick={e => e.stopPropagation()}>
        <div className={s.head}><img src="/fanart/b2-heart-stitch.png" alt="" /><b>纪念品柜</b><span>有人惦记的东西，秤砣不收，放这儿</span><button type="button" onClick={onClose} aria-label="合上">×</button></div>
        <div className={s.cabinet}>
          <i className={s.doorL} /><i className={s.doorR} />
          {rows.map((row, r) => (
            <div key={r} className={s.shelf}>
              {row.map((k, i) => (
                <button key={k.id} type="button" className={`${s.keep}${flip === k.id ? ` ${s.keepFlip}` : ""}`} style={{ animationDelay: `${0.5 + (r * 3 + i) * 0.07}s` }} onClick={() => { snd.sfx("flip"); setFlip(flip === k.id ? null : k.id); }}>
                  <span className={s.keepFront}><img src={fishSrc(k.species)} alt="" /><b>{k.name}</b><small>{nm(k.owner) || NAME[k.owner]}的</small></span>
                  <span className={s.keepBack}>「{sign.get(k.species) || "……"}」</span>
                </button>))}
            </div>))}
          {!cabin.keepsakes.length && <p className={s.none}>柜子还空着。钓到瓶中信、纸条、发卡这些，会自己出现在这里。</p>}
        </div>
      </div>
    </div>
  );
}

/** 纪录板：软木板，每种鱼最重的那条一张纸卡，粉色图钉钉上去（一张张落下来） */
export function BoardSheet({ cabin, onClose, nm }: { cabin: WCabin; onClose: () => void; nm: (w: string) => string }) {
  useEffect(() => { snd.sfx("paper"); const t = cabin.board.slice(0, 12).map((_, i) => window.setTimeout(() => snd.sfx("tap"), 300 + i * 90)); return () => t.forEach(x => window.clearTimeout(x)); }, [cabin.board]);
  return (
    <div className={s.mask} onClick={onClose}>
      <div className={s.card} onClick={e => e.stopPropagation()}>
        <div className={s.head}><img src="/fanart/b2-star.png" alt="" /><b>纪录板</b><span>每种鱼最重的那条，是谁钓的</span><button type="button" onClick={onClose} aria-label="合上">×</button></div>
        <div className={s.cork}>
          {cabin.board.map((b, i) => (
            <div key={b.species} className={s.note} style={{ "--rot": `${((i * 37) % 9) - 4}deg`, "--rc": RC[b.rarity], animationDelay: `${0.25 + i * 0.09}s` } as React.CSSProperties}>
              <i className={s.pin} /><img src={fishSrc(b.species)} alt="" /><b>{b.name}</b><span>{b.maxKg}kg</span><em className={s[`by_${b.maxBy}`]}>{nm(b.maxBy) || NAME[b.maxBy]}</em>
            </div>))}
          {!cabin.board.length && <p className={s.none}>还没有纪录。</p>}
        </div>
      </div>
    </div>
  );
}
