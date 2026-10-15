// 秤砣新货 v2 的「用了就没的」道具：右边标签多一个「布袋」，点开是玩家有的道具，点「用」会有各自的一段动画。
// 晴天娃娃：从上面垂下来晃两下，云往两边散开，出太阳
// 雨壶：壶一歪，水哗哗往下倒（只有伞树农场能用）
// 包装纸：一张粉纸卷起来、系上蝴蝶结（下次送鱼会包好）
// 鱼拓纸：纸盖下来按一下、揭开，墨色鱼印在上面，飞走（挂进小屋）
// 小道消息：秤砣从边上探头，压低声音冒一个悄悄话气泡
// 还有「秤砣的怀表」：挂着它的时候右上角有一只小怀表在滴答走，点开表盖弹开，里面游着这会儿正在出的特别鱼的影子。
import { useEffect, useState } from "react";
import s from "./ItemBag.module.css";
import type { WSpecial } from "../api/ccBridge";
import { snd } from "../pixel/sound";
import actsPng from "../assets/world/shop/pelican_acts.png";

export const ITEM_META: Record<string, { name: string; how: string }> = {
  sunny_doll: { name: "晴天娃娃", how: "挂上，这个钓点接下来一小时天晴" },
  rain_pot: { name: "雨壶", how: "往伞树农场的伞里倒两格水" },
  wrap: { name: "包装纸", how: "下次送鱼包起来，对方拆开有动画" },
  rubbing: { name: "鱼拓纸", how: "把你钓过最重的那条拓下来，挂进小屋" },
  rumor: { name: "秤砣的小道消息", how: "秤砣悄悄告诉你今天哪儿有稀罕货" },
};
const img = (id: string) => `/world-gear/item_${id}.webp`;

/** 布袋：一个抽绳布袋从下面弹上来，袋口松开，道具一个个探出头 */
export function BagSheet({ items, busy, onUse, onClose }: { items: Record<string, number>; busy: boolean; onUse: (id: string) => void; onClose: () => void }) {
  const [out, setOut] = useState(false); const ids = Object.keys(ITEM_META).filter(k => (items[k] ?? 0) > 0);
  useEffect(() => { snd.sfx("rustle"); }, []);
  const close = () => { if (out) return; setOut(true); snd.sfx("rustle"); window.setTimeout(onClose, 300); };
  return (
    <div className={`${s.mask}${out ? ` ${s.maskOut}` : ""}`} onClick={close}>
      <div className={s.bag} onClick={e => e.stopPropagation()}>
        <i className={s.cord} aria-hidden><i /><i /></i>
        <div className={s.bagHead}><img src="/fanart/b2-m-gift.png" alt="" /><b>布袋</b><small>在秤砣那儿买的小道具，用了就没了</small><button type="button" onClick={close} aria-label="合上">×</button></div>
        {!ids.length && <p className={s.empty}>袋子是空的。<br />秤砣的小摊「杂货」那一格有卖。</p>}
        <div className={s.list}>
          {ids.map((id, i) => (
            <div key={id} className={s.row} style={{ animationDelay: `${0.12 + i * 0.07}s` }}>
              <span className={s.pic}><img src={img(id)} alt="" draggable={false} /><em>×{items[id]}</em></span>
              <span className={s.txt}><b>{ITEM_META[id].name}</b><small>{ITEM_META[id].how}</small></span>
              <button type="button" className={s.use} disabled={busy} onClick={() => { snd.sfx("clack"); onUse(id); }}>用</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 用道具的那一段动画（盖在整个画面上，放完自己消失）。text = 后端回的那句话，动画放到一半浮出来 */
export function ItemFx({ id, text, fish, onDone }: { id: string; text: string; fish?: string; onDone: () => void }) {
  useEffect(() => {
    const T: number[] = []; const at = (ms: number, f: () => void) => T.push(window.setTimeout(f, ms));
    if (id === "sunny_doll") { snd.sfx("swing"); at(700, () => snd.sfx("chime", 1)); at(1500, () => snd.sfx("slide", 1)); }
    else if (id === "rain_pot") { snd.sfx("clack"); at(500, () => snd.sfx("scoop")); at(900, () => snd.sfx("bubble")); at(1300, () => snd.sfx("plop")); }
    else if (id === "wrap") { snd.sfx("paper"); at(700, () => snd.sfx("fold")); at(1200, () => snd.sfx("ribbon")); }
    else if (id === "rubbing") { snd.sfx("paper"); at(650, () => snd.sfx("stamp")); at(1300, () => snd.sfx("flip")); }
    else if (id === "rumor") { snd.sfx("rustle"); at(500, () => snd.sfx("squawk", 0, 0.4)); }
    at(3400, onDone); return () => T.forEach(x => window.clearTimeout(x));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={s.fx} data-k={id} aria-live="polite">
      {id === "sunny_doll" && <>
        <i className={`${s.cloud} ${s.cloudL}`} /><i className={`${s.cloud} ${s.cloudR}`} /><i className={s.sun} />
        <div className={s.doll}><i className={s.string} /><img src={img(id)} alt="" /></div>
      </>}
      {id === "rain_pot" && <div className={s.pot}><img src={img(id)} alt="" />{Array.from({ length: 12 }, (_, i) => <i key={i} className={s.drop} style={{ "--i": i } as React.CSSProperties} />)}</div>}
      {id === "wrap" && <div className={s.wrapBox}><i className={s.paperL} /><i className={s.paperR} /><img className={s.bowTie} src="/fanart/b2-bow-pink.png" alt="" /></div>}
      {id === "rubbing" && <div className={s.rub}><div className={s.rubPaper}>{fish ? <img className={s.inkFish} src={`/world-fish/${fish}.png`} alt="" /> : <i className={s.ink} />}</div><i className={s.press} /></div>}
      {id === "rumor" && <div className={s.rumor}><i className={s.pelPeek} style={{ backgroundImage: `url(${actsPng})` }} /><div className={s.whisper}><i>嘘——</i></div></div>}
      {text && <p className={s.fxText}>{text}</p>}
    </div>
  );
}

/** 挂着秤砣的怀表：右上角一只小怀表，秒针在走；点开表盖弹开，里面是这会儿在出的特别鱼的影子 */
export function WatchTag({ specials }: { specials: WSpecial[] }) {
  const [open, setOpen] = useState(false); const n = specials.length;
  return (
    <div className={s.watchWrap}>
      <button type="button" className={`${s.watch}${n ? ` ${s.watchBusy}` : ""}`} onClick={() => { snd.sfx(open ? "clack" : "tick"); setOpen(o => !o); }} aria-label="秤砣的怀表">
        <img src="/world-gear/charm_watch.webp" alt="" draggable={false} /><i className={s.hand} />{n > 0 && <em>{n}</em>}
      </button>
      {open && (
        <div className={s.face} onClick={() => setOpen(false)}>
          <i className={s.lid} aria-hidden />
          <b className={s.faceTtl}>这会儿这儿……</b>
          {!n && <p className={s.quiet}>针很安静。<br />这会儿没什么特别的鱼。</p>}
          {specials.map((f, i) => (
            <div key={f.id} className={s.spec} style={{ animationDelay: `${0.25 + i * 0.12}s` }}>
              <img className={s.shadow} src={`/world-fish/${f.id}.png`} alt="" style={{ animationDelay: `${i * 0.7}s` }} />
              <span><b>{f.name}</b><em>{"★".repeat(f.stars)}</em><small>{f.why}</small></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
