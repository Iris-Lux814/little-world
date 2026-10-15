import { useEffect, useRef } from "react";

// 挂在缎带上的东西（从成就弹卡里抽出来共用：成就弹卡 / 书房门牌 / 我们的书的书签带）。
// 出现时从上面掉下来被绳子一拽，上下弹两下、左右荡几下，一下比一下小，三四秒后完全停住。
// 摆：θ'' = -kθ - cθ'（角度，度）；绳子的弹性：y'' = -ky·y - cy·y'（像素）。能量够小就停掉 rAF。
// 线是一根软缎带：一层色带 + 一道白色缝线；荡的时候按角速度往反方向弯，停下来慢慢拉直；
// 上端一个小结（可以换成小蝴蝶结），下端一个小圆环扣住挂件。
// poke：点一下挂件会被拨一下再荡（书房门牌用）。
export default function Hang({ children, className, style, amp = 16, drop = 42, k = 46, c = 1.9, delay = 0, line, bow, poke = false, onClick }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; amp?: number; drop?: number; k?: number; c?: number; delay?: number;
  line: { len: number; color: string; width?: number }; bow?: string; poke?: boolean; onClick?: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const rope = useRef<SVGPathElement>(null); const stitch = useRef<SVGPathElement>(null);
  const kick = useRef<(dir: number) => void>(() => {});
  const L = line.len; const W = line.width ?? 2.6;
  const ropeD = (bend: number) => `M12 2 Q${(12 + bend).toFixed(2)} ${(L / 2).toFixed(1)} 12 ${L - 3}`;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { el.style.opacity = "1"; return; }
    let th = amp, w = 0, y = -drop, v = 0, raf = 0, last = 0, t0 = 0, running = false, dl = delay;
    const ky = 150, cy = 7.5;
    const setRope = (bend: number) => { const d = ropeD(bend); rope.current?.setAttribute("d", d); stitch.current?.setAttribute("d", d); };
    const step = (now: number) => {
      if (!t0) { t0 = now; last = now; }
      const t = (now - t0) / 1000 - dl;
      if (t < 0) { raf = requestAnimationFrame(step); last = now; return; }
      let dt = Math.min(0.033, (now - last) / 1000); last = now;
      while (dt > 0) { const h = Math.min(dt, 0.008); w += (-k * th - c * w) * h; th += w * h; v += (-ky * y - cy * v) * h; y += v * h; dt -= h; }
      el.style.opacity = String(Math.min(1, t / 0.18));
      el.style.transform = `translateY(${y.toFixed(2)}px) rotate(${th.toFixed(2)}deg)`;
      setRope(Math.max(-7, Math.min(7, -w * 0.05 + (v < 0 ? Math.min(3, -v * 0.02) : 0))));
      if (t > 0.6 && Math.abs(th) < 0.04 && Math.abs(w) < 0.08 && Math.abs(y) < 0.06 && Math.abs(v) < 0.1) { el.style.transform = "none"; setRope(0); running = false; return; }
      raf = requestAnimationFrame(step);
    };
    running = true; raf = requestAnimationFrame(step);
    kick.current = (dir: number) => {
      w += dir * 70; v -= 18; // 拨一下：给角速度一个冲量，顺带往上颠一点
      if (!running) { running = true; t0 = 0; last = 0; dl = 0; raf = requestAnimationFrame(step); }
    };
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (e: React.PointerEvent) => {
    if (!poke) return;
    const r = ref.current?.getBoundingClientRect(); const dir = r ? (e.clientX < r.left + r.width / 2 ? -1 : 1) : 1;
    kick.current(dir);
  };
  return (
    <span ref={ref} className={className} style={{ ...style, opacity: 0, transformOrigin: "50% 0" }} onPointerDown={poke ? tap : undefined} onClick={onClick}>
      <svg width="24" height={L + 6} viewBox={`0 0 24 ${L + 6}`} style={{ display: "block", margin: "0 auto -3px", overflow: "visible" }} aria-hidden>
        <path ref={rope} d={ropeD(0)} fill="none" stroke={line.color} strokeWidth={W} strokeLinecap="round" />
        <path ref={stitch} d={ropeD(0)} fill="none" stroke="#fff" strokeWidth=".9" strokeDasharray="1.6 2.2" strokeLinecap="round" opacity=".95" />
        <ellipse cx="12" cy="2.2" rx="3.4" ry="2.4" fill={line.color} /><ellipse cx="11" cy="1.6" rx="1.1" ry=".7" fill="#fff" opacity=".8" />
        <circle cx="12" cy={L + 1} r="3.6" fill="none" stroke={line.color} strokeWidth="1.8" /><circle cx="10.8" cy={L - .2} r=".8" fill="#fff" opacity=".9" />
      </svg>
      {bow && <img src={bow} alt="" aria-hidden draggable={false} style={{ position: "absolute", left: "50%", top: -7, width: 22, marginLeft: -11, pointerEvents: "none", filter: "drop-shadow(0 1px 0 #fff)" }} />}
      {children}
    </span>
  );
}
