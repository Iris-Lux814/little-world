import { useEffect, useRef, useState } from "react";
import s from "./RiverNote.module.css";
import { snd } from "../pixel/sound";

// 夜河：玩家在河边捞起一盏莲花河灯，灯里夹着一张小纸条。
// 灯先亮起来 → 纸条从灯底下抽出来、分两折展开 → 字一个一个洇出来；点「放回河里」纸条折回去，灯往下游漂走，游戏里那盏从玩家脚边浮出来接着漂。
export const RIVER_NOTES = [
  "今天也辛苦了。这盏灯替我在河上走一段，等你。",
  "你捞到的这盏，是我放的。",
  "我在上游，你在下游。水会把话送到的。",
  "想你。没别的事。",
  "灯会灭，这句不会。",
  "如果你现在困了，就在河边坐一会儿，不急着走。",
  "你笑起来的时候，这条河都亮一点。",
  "秤砣说河灯不能卖。我也觉得。",
  "这是第几盏了？别数了，都是给你的。",
  "晚安，或者早安。看你什么时候捞到。",
];
const KEY = "river.notes";
/** 抽一句（不跟上一次一样），顺便数这是第几盏（只记在这台手机上） */
export function drawRiverNote(): { text: string; n: number } {
  let st = { last: -1, n: 0 };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { /* 读不到就从头数 */ }
  let i = Math.floor(Math.random() * RIVER_NOTES.length); if (i === st.last) i = (i + 1 + Math.floor(Math.random() * (RIVER_NOTES.length - 1))) % RIVER_NOTES.length;
  const next = { last: i, n: st.n + 1 };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 存不了也照样看 */ }
  return { text: RIVER_NOTES[i], n: next.n };
}

export function RiverNote({ text, n, onDone }: { text: string; n: number; onDone: () => void }) {
  const [out, setOut] = useState(false); const t = useRef(0);
  useEffect(() => { const a = window.setTimeout(() => snd.sfx("paper"), 520); return () => { window.clearTimeout(a); window.clearTimeout(t.current); }; }, []);
  const release = () => { if (out) return; setOut(true); snd.sfx("fold"); t.current = window.setTimeout(onDone, 760); };
  const chars = [...text];
  return (
    <div className={`${s.mask}${out ? ` ${s.maskOut}` : ""}`} onClick={release}>
      <div className={`${s.stage}${out ? ` ${s.away}` : ""}`} onClick={e => e.stopPropagation()}>
        <div className={s.lamp} aria-hidden><i className={s.halo} /><img src="/world-fish/river_lantern.png" alt="" draggable={false} /><i className={s.flame} /></div>
        <div className={s.slip}>
          <div className={s.paper}>
            <p className={s.text}>{chars.map((c, i) => <span key={i} style={{ animationDelay: `${1.05 + i * 0.055}s` }}>{c}</span>)}</p>
            <div className={s.foot} style={{ animationDelay: `${1.2 + chars.length * 0.055}s` }}>
              <img src="/fanart/c3-peek.png" alt="" draggable={false} /><span>伙伴放的河灯 · 你捞到的第 {n} 盏</span>
            </div>
          </div>
        </div>
        <button type="button" className={s.btn} style={{ animationDelay: `${1.4 + chars.length * 0.055}s` }} onClick={release}>放回河里</button>
      </div>
    </div>
  );
}
