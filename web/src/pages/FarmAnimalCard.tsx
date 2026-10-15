// 农场小动物：点一下弹出的大图卡片（预览玩家点过头：纸色底、粉色虚线缝边，大图会眨眼 / 鳞片冒星星眼，下面名字 + 一句话）
// 以及头顶气泡的内容（zz / 嘎 / ? / 哼 / 星星 / !），气泡本身用小世界说话气泡同款样式
import { useEffect, useState } from "react";
import s from "./FarmAnimalCard.module.css";
import { ANIMAL_INFO, type AnimalId } from "../pixel/farmAnimals";
import hengPng from "../assets/world/farm/expand/a_heng.png";
const CARD = import.meta.glob("../assets/world/farm/expand/card/*.webp", { eager: true, import: "default" }) as Record<string, string>;
const cardImg = (k: string) => CARD[`../assets/world/farm/expand/card/${k}.webp`];
const STAR = `<svg viewBox="0 0 20 20" class="${s.star}"><path d="M10 1.5l2.5 5.6 6 .6-4.5 4 1.3 6-5.3-3.1-5.3 3.1 1.3-6-4.5-4 6-.6z" fill="#FFC83C" stroke="#C88C28" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
/** 气泡里面那一点内容（每次换种类整段重写，冒出来的动画就会重播） */
export function animalBubHtml(kind: string, bubbleClass: string) {
  const inner = kind === "zz" ? `<b class="${s.z1}">z</b><b class="${s.z2}">z</b>` : kind === "star" ? STAR + STAR.replace(s.star, `${s.star} ${s.star2}`) : `<b>${kind}</b>`;
  return `<span class="${bubbleClass} ${s.aBub}">${inner}</span>`;
}
export function FarmAnimalCard({ id, night, onClose }: { id: AnimalId; night: boolean; onClose: () => void }) {
  const info = ANIMAL_INFO[id]; const [blink, setBlink] = useState(false); const [star, setStar] = useState(false); const [line, setLine] = useState(0);
  useEffect(() => {
    setLine(0); setStar(false); setBlink(false);
    const hasBlink = !!cardImg(`${id}_blinkfix`);
    let b2 = 0, s2 = 0; // 里面那层（眨眼 160ms 睁开、星星 1.9 秒收回）也要在关卡片时取消
    const bi = hasBlink ? window.setInterval(() => { setBlink(true); window.clearTimeout(b2); b2 = window.setTimeout(() => setBlink(false), 160); }, 2600) : 0;
    const st = id === "cat" ? window.setTimeout(() => { setStar(true); s2 = window.setTimeout(() => setStar(false), 1900); }, 900) : 0;
    const ln = window.setTimeout(() => setLine(1), 2600);
    return () => { window.clearInterval(bi); window.clearTimeout(st); window.clearTimeout(ln); window.clearTimeout(b2); window.clearTimeout(s2); };
  }, [id]);
  const lines = id === "firefly" && !night ? [...info.lines].reverse() : info.lines;
  const src = id === "heng" ? hengPng : star ? cardImg(`${id}_star`) : blink ? cardImg(`${id}_blinkfix`) : cardImg(id);
  return (
    <div className={s.veil} onClick={onClose}>
      <div className={s.card} onClick={e => e.stopPropagation()}>
        <button type="button" className={s.x} onClick={onClose} aria-label="合上">×</button>
        <div className={s.pic}>{id === "heng" ? <div className={s.heng} style={{ backgroundImage: `url(${src})` }} /> : <img src={src} alt={info.name} draggable={false} />}</div>
        <div className={s.name}>{info.name}</div>
        <div className={s.who}>{info.who}</div>
        <div key={line} className={s.line}>{lines[line]}</div>
      </div>
    </div>
  );
}
