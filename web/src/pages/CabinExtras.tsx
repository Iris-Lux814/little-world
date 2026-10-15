// 树洞小屋的两个新面板：
// 伞沿风铃（门口留言）：从画面上沿垂下一把倒挂小伞的伞沿，每条留言是一张吊在铃下面的纸签，一直轻轻晃；
// 点一张 → 铃响、纸签翻过来露出整句话；「挂一张」→ 空白纸签从下面飘上来，写完点挂上，它飞上去系在伞沿上，所有铃一起响一下。
// 旧木箱（摆设）：箱盖掀开，收着的摆设一件件探出来；选一件 → 屋里 6 个位置的小木牌弹出来，点哪个它就飞过去；
// 箱底还压着大家拓的鱼拓。
import { useEffect, useState } from "react";
import s from "./CabinExtras.module.css";
import type { WCabin } from "../api/ccBridge";
import { snd } from "../pixel/sound";

const when = (at: number) => { const d = (Date.now() - at) / 60000; return d < 1 ? "刚刚" : d < 60 ? `${Math.floor(d)} 分钟前` : d < 1440 ? `${Math.floor(d / 60)} 小时前` : `${Math.floor(d / 1440)} 天前`; };
const TAG = ["#fff6ec", "#ffe1ec", "#e6e0ff", "#e3f4ea"];

export function NotesSheet({ cabin, nm, busy, onSend, onClose }: { cabin: WCabin; nm: (w: string) => string; busy: boolean; onSend: (t: string) => Promise<boolean>; onClose: () => void }) {
  const notes = cabin.notes ?? []; const [open, setOpen] = useState<string | null>(null); const [write, setWrite] = useState(false); const [txt, setTxt] = useState(""); const [fly, setFly] = useState(false); const [out, setOut] = useState(false); const [ring, setRing] = useState(0);
  useEffect(() => { snd.sfx("chime", 0); }, []);
  const close = () => { if (out) return; setOut(true); snd.sfx("rustle"); window.setTimeout(onClose, 320); };
  const tap = (id: string, i: number) => { snd.sfx("chime", i % 3); setOpen(o => (o === id ? null : id)); };
  const send = async () => { const t = txt.trim(); if (!t || busy) return; setFly(true); snd.sfx("swing"); const ok = await onSend(t); window.setTimeout(() => { setFly(false); if (ok) { setTxt(""); setWrite(false); setRing(r => r + 1); snd.sfx("chime", 1); window.setTimeout(() => snd.sfx("chime", 2), 180); } }, 650); };
  return (
    <div className={`${s.mask}${out ? ` ${s.out}` : ""}`} onClick={close}>
      <div className={s.chime} onClick={e => e.stopPropagation()}>
        <div className={s.rim} aria-hidden><i className={s.hook} /></div>
        <b className={s.ttl}>伞沿风铃</b><button type="button" className={s.x} onClick={close} aria-label="合上">×</button>
        <div className={s.tags} key={ring}>
          {!notes.length && <p className={s.empty}>还没有人挂纸签。<br />风一吹，铃空空地响。</p>}
          {notes.map((n, i) => (
            <button key={n.id} type="button" className={`${s.tag}${open === n.id ? ` ${s.tagOpen}` : ""}`} style={{ "--i": i, "--c": TAG[i % 4], "--len": `${26 + (i * 17) % 40}px` } as React.CSSProperties} onClick={() => tap(n.id, i)}>
              <i className={s.bell} /><i className={s.str} />
              <span className={s.card}><span className={s.front}>{n.text.slice(0, 6)}{n.text.length > 6 ? "…" : ""}</span><span className={s.back}><em>{n.text}</em><small>{nm(n.from)} · {when(n.at)}</small></span></span>
            </button>
          ))}
        </div>
        {!write && <button type="button" className={s.add} onClick={() => { snd.sfx("paper"); setWrite(true); }}>挂一张</button>}
        {write && (
          <div className={`${s.pen}${fly ? ` ${s.penFly}` : ""}`}>
            <textarea maxLength={40} value={txt} autoFocus placeholder="写一句给来这儿的人……（40 字）" onChange={e => setTxt(e.target.value)} />
            <div className={s.penRow}><small>{txt.length}/40</small><button type="button" onClick={() => { setWrite(false); setTxt(""); }}>算了</button><button type="button" className={s.hang} disabled={!txt.trim() || busy} onClick={() => void send()}>挂上去</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

const DECOR_NAME: Record<string, string> = { decor_fish_chime: "木鱼风铃", decor_lanterns: "纸灯笼串", decor_fishbone_clock: "鱼骨挂钟", decor_shell_frame: "贝壳相框", decor_glass_float: "玻璃浮球" };
const SLOT_NAME: Record<string, string> = { hall_wall: "走廊墙上", hall_shelf: "纪念品柜顶", attic_hook: "阁楼挂钩", kitchen_wall: "炉子边的墙", window: "圆窗", door_top: "门楣" };

export function ChestSheet({ cabin, nm, busy, onPlace, onClose }: { cabin: WCabin; nm: (w: string) => string; busy: boolean; onPlace: (slot: string, item: string | null) => void; onClose: () => void }) {
  const owned = cabin.decorOwned ?? []; const decor = cabin.decor ?? {}; const slots = cabin.decorSlots ?? Object.keys(SLOT_NAME); const rubs = cabin.rubbings ?? [];
  const [pick, setPick] = useState<string | null>(null); const [out, setOut] = useState(false);
  useEffect(() => { snd.sfx("creak"); window.setTimeout(() => snd.sfx("clasp"), 380); }, []);
  const close = () => { if (out) return; setOut(true); snd.sfx("thud"); window.setTimeout(onClose, 320); };
  const where = (id: string) => Object.entries(decor).find(([, v]) => v === id)?.[0];
  return (
    <div className={`${s.mask} ${s.maskLow}${out ? ` ${s.out}` : ""}`} onClick={close}>
      <div className={s.chest} onClick={e => e.stopPropagation()}>
        <i className={s.lid} aria-hidden />
        <b className={s.ttl}>旧木箱</b><button type="button" className={s.x} onClick={close} aria-label="合上">×</button>
        {!owned.length && <p className={s.empty}>箱子里只有一点木屑。<br />秤砣小摊「杂货」的小橱窗里有摆设卖。</p>}
        <div className={s.items}>
          {owned.map((id, i) => { const at = where(id); return (
            <button key={id} type="button" className={`${s.item}${pick === id ? ` ${s.itemOn}` : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={() => { snd.sfx("tap"); setPick(p => (p === id ? null : id)); }}>
              <img src={`/world-gear/decor_${id}.webp`} alt="" draggable={false} /><b>{DECOR_NAME[id] ?? id}</b><small>{at ? `在${SLOT_NAME[at] ?? at}` : "收着"}</small>
            </button>); })}
        </div>
        {pick && (
          <div className={s.slots}>
            <small>摆到哪儿？</small>
            {slots.map((sl, i) => (
              <button key={sl} type="button" className={`${s.slot}${decor[sl] === pick ? ` ${s.slotOn}` : ""}`} style={{ "--i": i } as React.CSSProperties} disabled={busy} onClick={() => { snd.sfx("swing"); onPlace(sl, decor[sl] === pick ? null : pick); setPick(null); }}>
                {SLOT_NAME[sl] ?? sl}{decor[sl] && decor[sl] !== pick ? <em>换掉{DECOR_NAME[decor[sl]!] ?? ""}</em> : decor[sl] === pick ? <em>收起来</em> : null}
              </button>
            ))}
          </div>
        )}
        {rubs.length > 0 && (
          <div className={s.rubs}>
            <small>箱底压着的鱼拓</small>
            <div className={s.rubRow}>{rubs.slice(0, 12).map((r, i) => (
              <span key={r.at + r.species} className={s.rub} style={{ "--i": i } as React.CSSProperties}><img src={`/world-fish/${r.species}.png`} alt="" /><b>{r.name}</b><small>{r.kg}kg · {nm(r.by)}</small></span>
            ))}</div>
          </div>
        )}
      </div>
    </div>
  );
}
