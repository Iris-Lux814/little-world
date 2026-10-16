// 我的小人：给自己（或伙伴）换一张标准小人图。
// 选图 → 当场检查（PNG / 240×320 / ≤512KB / 透明底 / 每格都有画 / 脚踩第 60 行）→ 镜子里先走一圈（朝下 → 朝右 → 朝上 → 朝左 → 甩竿 → 坐）
// 走完一圈「换上」才亮，点了才传给后端。镜子底下的地砖跟着走路方向往反方向滚，看着像真在走。
import { useEffect, useRef, useState } from "react";
import w from "./WorldSettings.module.css";
import s from "./DollPage.module.css";
import { snd } from "../pixel/sound";
import { bridgeUrl, worldApi, type Endpoint } from "../api/ccBridge";
import { CELL_H, CELL_W, FOOT_Y, STARTER } from "../pixel/doll";

const SHEET_W = CELL_W * 5, SHEET_H = CELL_H * 5, MAX_BYTES = 512 * 1024;
type Check = { lv: "ok" | "warn" | "bad"; text: string };
type Cand = { file: File; url: string; checks: Check[]; bad: boolean };

/** 当场检查：硬伤（不是 PNG / 尺寸不对 / 太大 / 读不出来）不让换；软毛病（没透明底、有空格、脚底不齐）提醒但能换 */
async function inspect(file: File): Promise<Cand> {
  const url = URL.createObjectURL(file); const checks: Check[] = [];
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => head[i] === b);
  checks.push(png ? { lv: "ok", text: "PNG 图片" } : { lv: "bad", text: "不是 PNG（要 .png，别的格式改个后缀也不行）" });
  checks.push(file.size <= MAX_BYTES ? { lv: "ok", text: `${Math.ceil(file.size / 1024)}KB，不超过 512KB` } : { lv: "bad", text: `${Math.ceil(file.size / 1024)}KB，超过 512KB 了` });
  const img = await new Promise<HTMLImageElement | null>(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
  if (!img) { checks.push({ lv: "bad", text: "图读不出来" }); return { file, url, checks, bad: true }; }
  if (img.naturalWidth !== SHEET_W || img.naturalHeight !== SHEET_H) { checks.push({ lv: "bad", text: `尺寸要 ${SHEET_W}×${SHEET_H}，这张是 ${img.naturalWidth}×${img.naturalHeight}` }); return { file, url, checks, bad: true }; }
  checks.push({ lv: "ok", text: `${SHEET_W}×${SHEET_H}` });
  const c = document.createElement("canvas"); c.width = SHEET_W; c.height = SHEET_H; const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, SHEET_W, SHEET_H).data; const A = (x: number, y: number) => d[(y * SHEET_W + x) * 4 + 3];
  let clear = 0; for (let i = 3; i < d.length; i += 4) if (d[i] === 0) clear++;
  checks.push(clear / (SHEET_W * SHEET_H) > 0.3 ? { lv: "ok", text: "透明底" } : { lv: "warn", text: "好像没有透明底，人会带着一块底色" });
  const empty: string[] = [], feet: string[] = []; const ROW = ["朝下", "朝左", "朝右", "朝上", "动作"], COL = ["站", "走1", "走2", "走3", "走4"];
  for (let r = 0; r < 5; r++) for (let col = 0; col < 5; col++) {
    if (r === 4 && col === 4) continue; // 最后一格本来就空
    let low = -1; for (let y = CELL_H - 1; y >= 0 && low < 0; y--) for (let x = 0; x < CELL_W; x++) if (A(col * CELL_W + x, r * CELL_H + y)) { low = y; break; }
    const name = r === 4 ? ["甩竿1", "甩竿2", "甩竿3", "坐"][col] : `${ROW[r]}${COL[col]}`;
    if (low < 0) empty.push(name); else if (r < 4 && Math.abs(low - FOOT_Y) > 2) feet.push(`${name}（第 ${low + 1} 行）`);
  }
  checks.push(empty.length ? { lv: "warn", text: `空着的格子：${empty.slice(0, 4).join("、")}${empty.length > 4 ? ` 等 ${empty.length} 格` : ""}` } : { lv: "ok", text: "24 格都有画" });
  checks.push(feet.length ? { lv: "warn", text: `脚底要踩在第 60 行：${feet.slice(0, 3).join("、")}${feet.length > 3 ? " 等" : ""}，在游戏里会浮起来或陷下去` } : { lv: "ok", text: "脚都踩在第 60 行" });
  return { file, url, checks, bad: checks.some(k => k.lv === "bad") };
}

// 一圈：四个方向各走 1.6 秒，再甩竿、坐一会儿、站一下
const LOOP: { label: string; frames: [number, number][]; fps: number; dur: number; dx: number; dy: number }[] = [
  { label: "朝下走", frames: [[0, 1], [0, 2], [0, 3], [0, 4]], fps: 7, dur: 1.6, dx: 0, dy: 1 },
  { label: "朝右走", frames: [[2, 1], [2, 2], [2, 3], [2, 4]], fps: 7, dur: 1.6, dx: 1, dy: 0 },
  { label: "朝上走", frames: [[3, 1], [3, 2], [3, 3], [3, 4]], fps: 7, dur: 1.6, dx: 0, dy: -1 },
  { label: "朝左走", frames: [[1, 1], [1, 2], [1, 3], [1, 4]], fps: 7, dur: 1.6, dx: -1, dy: 0 },
  { label: "甩竿", frames: [[4, 0], [4, 1], [4, 2], [4, 2], [4, 2]], fps: 4, dur: 1.25, dx: 0, dy: 0 },
  { label: "坐一会儿", frames: [[4, 3]], fps: 1, dur: 1.3, dx: 0, dy: 0 },
  { label: "站好", frames: [[0, 0]], fps: 1, dur: 0.8, dx: 0, dy: 0 },
];
const LOOP_T = LOOP.reduce((t, p) => t + p.dur, 0);

/** 小镜子：画一张标准图走一圈；第一次走完叫 onLoop（带上是哪张图，免得把上一张走完的算到新图头上） */
function Mirror({ src, onLoop, onPhase }: { src: string; onLoop: (src: string) => void; onPhase: (label: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null); const cb = useRef({ onLoop, onPhase }); cb.current = { onLoop, onPhase };
  useEffect(() => {
    const cv = ref.current!; const g = cv.getContext("2d")!; const im = new Image(); let raf = 0, t0 = 0, done = false, last = "", gx = 0, gy = 0, prev = 0;
    const SC = 3, CW = cv.width, CH = cv.height;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw); if (!t0) { t0 = now; prev = now; } const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      const e = (now - t0) / 1000; if (!done && e >= LOOP_T) { done = true; cb.current.onLoop(src); }
      let k = e % LOOP_T, i = 0; while (k > LOOP[i].dur) { k -= LOOP[i].dur; i++; } const P = LOOP[i];
      if (P.label !== last) { last = P.label; cb.current.onPhase(P.label); }
      gx -= P.dx * dt * 34; gy -= P.dy * dt * 34; // 地砖往反方向滚
      g.imageSmoothingEnabled = false; g.fillStyle = "#e6f2d4"; g.fillRect(0, 0, CW, CH);
      const T = 24, ox = ((gx % T) + T) % T, oy = ((gy % T) + T) % T; g.fillStyle = "#d8ebc2";
      for (let y = -T; y < CH + T; y += T) for (let x = -T; x < CW + T; x += T) if ((Math.floor((x - ox) / T) + Math.floor((y - oy) / T)) % 2 === 0) g.fillRect(x + ox, y + oy, T, T);
      g.fillStyle = "rgba(60,80,40,.18)"; g.beginPath(); g.ellipse(CW / 2, CH - 26, 30, 7, 0, 0, Math.PI * 2); g.fill();
      if (!im.complete || !im.naturalWidth) return;
      const [r, c] = P.frames[Math.floor(k * P.fps) % P.frames.length];
      g.drawImage(im, c * CELL_W, r * CELL_H, CELL_W, CELL_H, Math.round(CW / 2 - CELL_W * SC / 2), Math.round(CH - 26 - (FOOT_Y + 1) * SC + 3), CELL_W * SC, CELL_H * SC);
    };
    im.src = src; raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [src]);
  return <canvas ref={ref} className={s.mirror} width={168} height={216} />;
}

export function DollPage({ ep, names, sprites, onClose, onSaved }: {
  ep: Endpoint | null; names: Record<string, string>; sprites: Record<string, string | null | undefined>;
  onClose: () => void; onSaved: (who: string, url: string | null) => void;
}) {
  const [out, setOut] = useState(false); const [who, setWho] = useState("player");
  const [cand, setCand] = useState<Cand | null>(null); const [looped, setLooped] = useState(false); const [phase, setPhase] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [pop, setPop] = useState(0);
  const pickSeq = useRef(0); // 连着选了两张 / 检查到一半切了人：只认最后一次
  const candSeq = useRef(0); // 现在这张候选是第几次选的（走完一圈要跟 pickSeq 对上才算）
  const close = () => { setOut(true); snd.sfx("paper"); window.setTimeout(onClose, 420); };
  useEffect(() => () => { if (cand) URL.revokeObjectURL(cand.url); }, [cand]);
  const cur = sprites[who] ? bridgeUrl(ep ?? { url: "" }, sprites[who]!) : null;
  const shown = cand && !cand.bad ? cand.url : cur ?? STARTER;
  // 选新图：旧候选马上撤掉（镜子先回到现在用的那张），新候选落地时再把「走完一圈」清零——不然旧图在检查期间走完一圈会把新图带过关
  const pick = async (f: File | undefined) => { if (!f) return; const seq = ++pickSeq.current; snd.sfx("tap"); setMsg(""); setCand(null); setLooped(false); const c = await inspect(f);
    if (seq !== pickSeq.current) { URL.revokeObjectURL(c.url); return; } candSeq.current = seq; setLooped(false); setCand(c); snd.sfx(c.bad ? "nope" : "pop"); };
  const save = async () => {
    if (!ep || !cand || cand.bad || !looped || busy) return; setBusy(true);
    try { const r = await worldApi.spriteUpload(ep, cand.file, who); onSaved(who, r.sprite ? bridgeUrl(ep, r.sprite) : null); snd.sfx("arrive"); setPop(p => p + 1); setMsg("换好了，回到画面里就是它"); setCand(null); }
    catch (e) { snd.sfx("nope"); setMsg(`没换成：${(e as Error).message || "连不上后端"}`); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    if (!ep || busy) return; setBusy(true);
    try { await worldApi.spriteReset(ep, who); onSaved(who, null); snd.sfx("fold"); setMsg("换回通用小人了"); setCand(null); }
    catch (e) { setMsg(`没换成：${(e as Error).message || "连不上后端"}`); }
    finally { setBusy(false); }
  };
  const tabs = ["player", "buddy", "pal"];
  return (
    <div className={`${w.mask}${out ? ` ${w.maskOut}` : ""}`} onClick={close}>
      <div className={`${w.page} ${s.page}${out ? ` ${w.pageOut}` : ""}`} onClick={e => e.stopPropagation()}>
        <i className={w.tape} />
        <div className={w.head}><img src="/fanart/b2-m-hood.png" alt="" /><b>我的小人</b><button type="button" onClick={close} aria-label="合上">×</button></div>
        <div className={s.tabs}>{tabs.map(t => <button key={t} type="button" className={t === who ? s.tabOn : ""} disabled={busy} onClick={() => { if (t === who) return; pickSeq.current++; snd.sfx("tap"); setWho(t); setCand(null); setLooped(false); setMsg(""); }}>{t === "player" ? "我" : names[t] ?? t}</button>)}</div>
        <div className={s.body}>
          <div className={s.stage}>
            <div className={s.frame} key={pop}><Mirror src={shown} onLoop={u => { if (cand && !cand.bad && u === cand.url && pickSeq.current === candSeq.current) setLooped(true); }} onPhase={setPhase} />{pop > 0 && <i className={s.sparkle} />}</div>
            <div className={s.phase}>{phase}</div>
            <div className={s.which}>{cand && !cand.bad ? "新的这张（还没换上）" : cur ? "现在用的" : "通用小人"}</div>
          </div>
          <div className={s.side}>
            <label className={s.pick}>选一张图<input type="file" accept="image/png" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {cand ? (
              <ul className={s.checks}>{cand.checks.map((k, i) => <li key={i} className={s[k.lv]} style={{ animationDelay: `${i * 0.07}s` }}>{k.text}</li>)}</ul>
            ) : (
              <p className={s.hint}>透明 PNG，240×320，一格 48×64、5 行 × 5 格，脚踩每格第 60 行。<br />可以拿通用小人改：<a href={STARTER} download="starter.png">下载通用小人</a> · <a href="/sprites/guide.png" target="_blank" rel="noreferrer">看格子说明</a></p>
            )}
            {cand && !cand.bad && <button type="button" className={s.save} disabled={!looped || busy} onClick={() => void save()}>{busy ? "换上中…" : looped ? "就它了，换上" : "先看它走完一圈…"}</button>}
            {!cand && cur && <button type="button" className={s.reset} disabled={busy} onClick={() => void reset()}>换回通用小人</button>}
            {msg && <p className={s.msg}>{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
