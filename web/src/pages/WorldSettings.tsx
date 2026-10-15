// 小世界设置（怀表和音乐按钮去掉，做一个设置页，音乐能调大小、走路和钓鱼的音效单独调；以后邀请朋友也放这里）。
// 一页手账从左边翻进来（左上角贴纸胶带）；声音每一类是一根缎带，拖上面的蝴蝶结调大小，蝴蝶结被拖着会晃，松手放一声试听；
// 缎带一行一行依次滑进来。底下「我的小人」进换小人那页。
import { useRef, useState } from "react";
import s from "./WorldSettings.module.css";
import { snd, type VolKey } from "../pixel/sound";

const ROWS: { k: VolKey; name: string; note: string; icon: string }[] = [
  { k: "music", name: "音乐", note: "八音盒", icon: "/fanart/b2-m-teacup.png" },
  { k: "amb", name: "环境声", note: "雨 · 风 · 海浪 · 虫鸣", icon: "/fanart/b2-cloud.png" },
  { k: "fish", name: "钓鱼", note: "甩竿 · 咬钩 · 收线 · 钓到", icon: "/fanart/b2-cat-fish.png" },
  { k: "step", name: "脚步", note: "草地 · 沙滩 · 木板 · 石板", icon: "/fanart/b2-m-walk.png" },
  { k: "life", name: "动静", note: "秤砣 · 别人钓到 · 冒泡", icon: "/fanart/b2-mouse.png" },
  { k: "ui", name: "按钮", note: "翻书 · 点按", icon: "/fanart/b2-heart.png" },
];

function Ribbon({ k }: { k: VolKey }) {
  const [v, setV] = useState(snd.vol[k]); const [drag, setDrag] = useState(false); const ref = useRef<HTMLDivElement>(null);
  const at = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); const rot = Math.abs(r.height) > Math.abs(r.width); // 舞台可能转了 90°
    const x = rot ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width; const nv = Math.round(Math.max(0, Math.min(1, x)) * 20) / 20; setV(nv); snd.setVol(k, nv); };
  return (
    <div ref={ref} className={`${s.ribbon}${drag ? ` ${s.drag}` : ""}`} style={{ "--v": v } as React.CSSProperties}
      onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(true); snd.unlock(); at(e); }}
      onPointerMove={e => { if (drag) at(e); }} onPointerUp={() => { setDrag(false); snd.preview(k); }} onPointerCancel={() => setDrag(false)}>
      <i className={s.track} /><i className={s.fill} />
      <img className={s.knob} src="/fanart/b2-bow-pink.png" alt="" draggable={false} />
      <span className={s.pct}>{v === 0 ? "关" : Math.round(v * 100)}</span>
    </div>
  );
}

export function WorldSettings({ onClose, trial, onTrial, onDoll }: { onClose: () => void; trial?: boolean; onTrial?: (on: boolean) => void; onDoll?: () => void }) {
  const [out, setOut] = useState(false); const [vibe, setVibe] = useState(snd.vibeOn);
  const close = () => { setOut(true); snd.sfx("paper"); window.setTimeout(onClose, 420); };
  return (
    <div className={`${s.mask}${out ? ` ${s.maskOut}` : ""}`} onClick={close}>
      <div className={`${s.page}${out ? ` ${s.pageOut}` : ""}`} onClick={e => e.stopPropagation()}>
        <i className={s.tape} />
        <div className={s.head}><img src="/fanart/b2-m-teacup.png" alt="" /><b>小世界设置</b><button type="button" onClick={close} aria-label="合上">×</button></div>
        <div className={s.sec}>声音<small>拖蝴蝶结调大小，松手听一下</small></div>
        {ROWS.map((r, i) => (
          <div key={r.k} className={s.row} style={{ animationDelay: `${0.25 + i * 0.06}s` }}>
            <img className={s.ico} src={r.icon} alt="" /><div className={s.lbl}><b>{r.name}</b><small>{r.note}</small></div>
            <Ribbon k={r.k} />
          </div>
        ))}
        <div className={s.sec}>其他</div>
        <div className={s.row} style={{ animationDelay: ".65s" }}>
          <img className={s.ico} src="/fanart/b2-sparkle.png" alt="" /><div className={s.lbl}><b>咬钩震动</b><small>浮漂动了手机震一下</small></div>
          <button type="button" className={`${s.heart}${vibe ? ` ${s.on}` : ""}`} onClick={() => { const n = !vibe; setVibe(n); snd.setVibe(n); if (n) snd.vibe([40, 30, 40]); }} aria-label="咬钩震动"><i /></button>
        </div>
        {onTrial && (
          <div className={s.row} style={{ animationDelay: ".7s" }}>
            <img className={s.ico} src="/fanart/b2-heart-stitch.png" alt="" /><div className={s.lbl}><b>试玩：伞树农场</b><small>树屋就是小屋。只对你开，伙伴进不来；做完了再正式开</small></div>
            <button type="button" className={`${s.heart}${trial ? ` ${s.on}` : ""}`} onClick={() => { snd.sfx(trial ? "paper" : "clasp"); onTrial(!trial); }} aria-label="试玩伞树农场"><i /></button>
          </div>
        )}
        {onDoll && <>
          <div className={s.sec}>我的小人</div>
          <div className={s.row} style={{ animationDelay: ".72s" }}>
            <img className={s.ico} src="/fanart/b2-m-hood.png" alt="" /><div className={s.lbl}><b>换小人</b><small>传一张自己画的小人图</small></div>
            <button type="button" className={s.go} onClick={() => { snd.sfx("tap"); onDoll(); }}>去换 ›</button>
          </div>
        </>}
      </div>
    </div>
  );
}
