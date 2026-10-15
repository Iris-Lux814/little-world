import type { CSSProperties } from "react";

// 第二批美乐蒂素材（切出来的 public/fanart/b2-*.png）
// 注意几个名字：banner 其实是云朵边框、frame-cloud 是坐在云上挂草莓的美乐蒂、mouse2 是美乐蒂抱小老鼠、m-mouse 是美乐蒂和小老鼠一起看书
export default function B2({ n, w, className, style }: { n: string; w: number; className?: string; style?: CSSProperties }) {
  return <img src={`/fanart/b2-${n}.png`} alt="" aria-hidden draggable={false} className={className} style={{ width: w, height: "auto", display: "block", ...style }} />;
}

// 伙伴甲没设头像时的占位——玉桂狗的小脸（c3-face.png，从 c3-sit-bow 截的头）。玉桂狗 = 他，美乐蒂 = 玩家
export function HimFace({ size, className }: { size: number; className?: string }) {
  return <img src="/fanart/c3-face.png" alt="" aria-hidden draggable={false} className={className} style={{ width: size, height: size, objectFit: "cover", borderRadius: "50%", display: "block" }} />;
}
