// 一对一打赌 + 欠条。规则在后端 little-world/engine/duel.js，前端只画：
// 立字据：一张粉边小赌约，选跟谁赌 / 赌什么 / 多久 / 输了干嘛，玩家的名字先签好；按「盖章」印章咚地落下，纸折成纸飞机飞走（递给他）
// 他接了：他的签名一笔一笔写上；赌着：两条小鱼在跑道上比谁游得远（按斤两 / 条数），顶上一条小丝带倒计时
// 结算：赢的撒彩纸，输的那张欠条滑出来，挂到小屋门边的小麻绳上；债主点「撕掉」——纸从中间撕成两半飘下去
import { useEffect, useRef, useState } from "react";
import { worldApi, type WBetState, type WIou, type WBetWho } from "../api/ccBridge";
import type { Endpoint } from "../api/ccBridge";
import { snd } from "../pixel/sound";
import { betMock } from "./betMock";
import s from "./WorldBet.module.css";

const MOCK = import.meta.env.VITE_TEST_OPEN === "1" && typeof location !== "undefined" && new URLSearchParams(location.search).has("betmock");
const api = {
  get: (ep: Endpoint) => (MOCK ? betMock.bet() : worldApi.bet(ep)),
  start: (ep: Endpoint, b: { with: "buddy" | "pal"; kind: string; span: string; stake: string }) => (MOCK ? betMock.betStart(b) : worldApi.betStart(ep, b)),
  cancel: (ep: Endpoint) => (MOCK ? betMock.betCancel() : worldApi.betCancel(ep)),
  paid: (ep: Endpoint, id: string) => (MOCK ? betMock.iouPaid(id) : worldApi.iouPaid(ep, id)),
  tear: (ep: Endpoint, id: string) => (MOCK ? betMock.iouTear(id) : worldApi.iouTear(ep, id)),
};
const FACE: Record<string, string> = { buddy: "/fanart/c3-face.png", pal: "/fanart/xo-face.png", player: "/fanart/b2-m-wink.png" };
const KIND0 = [{ k: "biggest", name: "谁钓的最大" }, { k: "count", name: "谁钓得多" }];
const SPAN0 = [{ k: "30m", name: "30 分钟" }, { k: "1h", name: "1 小时" }, { k: "tonight", name: "到今晚 12 点" }];
const PRESET0 = ["唱首歌", "讲个睡前故事", "夸对方十句", "请喝奶茶"];
const mmss = (ms: number) => { const t = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
const day = (at: number) => { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()}`; };
function useWenkai() { useEffect(() => { if (!document.getElementById("wenkai-css")) { const l = document.createElement("link"); l.id = "wenkai-css"; l.rel = "stylesheet"; l.href = "/fonts/wenkai/lxgwwenkaigbscreen.css"; document.head.appendChild(l); } }, []); }

/** 小世界页面用：拿打赌 / 欠条的状态（平时 30 秒一次，开着赌约或正在赌时 4 秒一次） */
export function useBet(ep: Endpoint | null, fast: boolean) {
  const [data, setRaw] = useState<WBetState | null>(null);
  const ver = useRef(0); // 每次真的换了状态版本 +1；请求（GET 或 POST）发出时记下版本，回来时版本变过 = 这是旧快照
  const epRef = useRef(ep); epRef.current = ep;
  const apply = (d: WBetState) => { ver.current++; setRaw(d); };
  /** POST 用：跑请求，回包没过期就用；过期了（期间轮询 / 别的请求已经换过状态）就重新 GET 一次 */
  const run = async (f: () => Promise<WBetState>) => { const v = ver.current; const r = await f(); if (v === ver.current) apply(r); else { try { const v2 = ver.current; const g = await api.get(epRef.current!); if (v2 === ver.current) apply(g); } catch { /* 下一轮轮询会补 */ } } return r; };
  const setData = apply;
  const live = data?.bet && (data.bet.phase === "asking" || data.bet.phase === "on");
  useEffect(() => { if (!ep && !MOCK) return; let alive = true; let t = 0;
    const tick = async () => { const v = ver.current; try { const r = await api.get(ep!); if (alive && v === ver.current) apply(r); } catch { /* 后端没有就算了 */ } if (alive) t = window.setTimeout(tick, fast || live ? 4000 : 30000); };
    void tick(); return () => { alive = false; clearTimeout(t); }; }, [ep, fast, live]);
  return [data, setData, run] as const;
}

/** 顶上的小丝带：赌着的时候一直在，点开赌约 */
export function BetRibbon({ data, nm, onOpen }: { data: WBetState | null; nm: (w: string) => string; onOpen: () => void }) {
  const [, tick] = useState(0); useEffect(() => { const t = window.setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const b = data?.bet; if (!b || (b.phase !== "on" && b.phase !== "asking")) return null;
  const me = b.score.player, he = b.score[b.with]; const big = b.kind === "biggest";
  const v = (x?: { w?: number; n: number }) => (big ? (x?.w ? `${x.w}kg` : "—") : `${x?.n ?? 0} 条`);
  return <button type="button" className={s.ribbon} onClick={() => { snd.sfx("paper"); onOpen(); }}>
    <img src={FACE[b.with]} alt="" />{b.phase === "asking" ? <span>等{nm(b.with)}接赌约……</span> : <span>跟{nm(b.with)}打赌中 · 你 <b>{v(me)}</b> / {nm(b.with)} <b>{v(he)}</b> · 还剩 {mmss(b.endAt - Date.now())}</span>}
  </button>;
}

/** 欠条：一张手写小纸条。债主是玩家 → 「撕掉」；玩家欠的 → 「我还了」 */
export function IouCard({ iou, nm, busy, onTear, onPaid, onClose }: { iou: WIou; nm: (w: string) => string; busy?: boolean; onTear: () => Promise<boolean>; onPaid: () => void; onClose: () => void }) {
  useWenkai(); const [tearing, setTearing] = useState(false);
  const who = (w: WBetWho) => nm(w);
  const [asking, setAsking] = useState(false); const on = useRef(true); const tT = useRef<number[]>([]);
  useEffect(() => { on.current = true; return () => { on.current = false; tT.current.forEach(clearTimeout); }; }, []);
  const tear = async () => { if (busy || tearing || asking) return; setAsking(true); const ok = await onTear(); if (!on.current) return; setAsking(false); if (!ok) return; setTearing(true); snd.sfx("paper"); tT.current.push(window.setTimeout(() => snd.sfx("flip"), 180), window.setTimeout(() => { if (on.current) onClose(); }, 1350)); }; // 卸载了（换了一张）就不再关 // 先等后端说撕掉了，再演撕纸（慢请求不会留个空遮罩）
  return <div className={s.mask} onClick={() => !tearing && onClose()}>
    <div className={`${s.iou}${tearing ? ` ${s.torn}` : ""}`} onClick={e => e.stopPropagation()}>
      {[0, 1].map(h => <div key={h} className={`${s.iouHalf} ${h ? s.iouR : s.iouL}`}>
        <div className={s.iouInner}>
          <i className={s.tape} />
          <b className={s.iouTitle}>欠 条</b>
          <p className={s.iouText}>今欠 <u>{who(iou.creditor)}</u>：<br /><em>{iou.stake}</em></p>
          <div className={s.iouSign}><span>欠款人 <i>{who(iou.debtor)}</i></span><span>{day(iou.at)} 立</span></div>
          {iou.paidMark && !iou.tornAt && <i className={s.paidStamp}>已还</i>}
          {iou.tornAt && !tearing && <i className={s.paidStamp}>撕了</i>}
        </div>
      </div>)}
      {!tearing && (!iou.tornAt || asking) && <div className={s.iouBtns}>
        {iou.creditor === "player" && <button type="button" className={s.go} disabled={busy || asking} onClick={() => void tear()}>{asking ? "在撕……" : iou.paidMark ? "收到了，撕掉" : "撕掉（就当还了）"}</button>}
        {iou.debtor === "player" && !iou.paidMark && <button type="button" className={s.go} disabled={busy} onClick={() => { snd.sfx("stamp"); onPaid(); }}>我还了</button>}
        {iou.debtor === "player" && iou.paidMark && <span className={s.wait}>等{nm(iou.creditor)}撕掉</span>}
        <button type="button" onClick={onClose}>收起来</button>
      </div>}
    </div>
  </div>;
}

/** 打赌的纸（右边「打赌」标签点开） */
export function WorldBet({ ep, data, run, nm, flash, onClose, onIou }: { ep: Endpoint | null; data: WBetState | null; run: (f: () => Promise<WBetState>) => Promise<WBetState>; nm: (w: string) => string; flash: (t: string) => void; onClose: () => void; onIou: (id: string) => void }) {
  useWenkai();
  const [who, setWho] = useState<"buddy" | "pal">("buddy");
  const [kind, setKind] = useState("biggest"); const [span, setSpan] = useState("30m"); const [stake, setStake] = useState("");
  const [fx, setFx] = useState<"" | "stamp" | "fly">(""); const [fresh, setFresh] = useState(false); /* 结果页点「再赌一局」回到空白赌约 */ const [busy, setBusy] = useState(false); const [shut, setShut] = useState(false);
  const [, tick] = useState(0); useEffect(() => { const t = window.setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const alive = useRef(true); const fxT = useRef<number[]>([]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; fxT.current.forEach(clearTimeout); fxT.current = []; }; }, []);
  const b = data?.bet; const kinds = data?.kinds?.length ? data.kinds : KIND0; const spans = data?.spans?.length ? data.spans : SPAN0; const presets = data?.presets?.length ? data.presets : PRESET0;
  const close = () => { if (shut) return; setShut(true); snd.sfx("paper"); window.setTimeout(onClose, 320); };

  const sign = async () => {
    const t = stake.trim(); if (!t) { flash("写上输了的人要做什么"); return; } if (busy) return; setBusy(true); setFx("stamp"); snd.sfx("stamp");
    try { await run(() => api.start(ep!, { with: who, kind, span, stake: t.slice(0, 40) })); if (!alive.current) return; setFresh(false); setStake(""); // 数据马上提交；动画单独计时，演完才换成「递过去了」
      fxT.current.push(window.setTimeout(() => { if (!alive.current) return; setFx("fly"); snd.sfx("ribbon"); }, 550), window.setTimeout(() => { if (alive.current) setFx(""); }, 1500)); }
    catch (e) { setFx(""); flash((e as Error).message || "赌约没递出去"); } finally { setBusy(false); }
  };
  const cancel = async () => { if (busy) return; setBusy(true); try { await run(() => api.cancel(ep!)); snd.sfx("fold"); } catch (e) { flash((e as Error).message || "收不回来了"); } finally { setBusy(false); } };

  const open = data?.ious.filter(i => !i.tornAt) ?? []; const torn = data?.ious.filter(i => i.tornAt) ?? [];
  const showForm = !b || b.phase === "declined" || b.phase === "cancelled" || fx !== "" || (fresh && b.phase === "done");
  const nameOf = (w: string) => nm(w);
  const big = b?.kind === "biggest"; const sc = (w: string) => b?.score[w as WBetWho]; const val = (w: string) => (big ? sc(w)?.w ?? 0 : sc(w)?.n ?? 0);
  const top = Math.max(1, val("player"), b ? val(b.with) : 0);

  return <div className={`${s.mask}${shut ? ` ${s.maskOut}` : ""}`} onClick={close}>
    <div className={`${s.paper}${shut ? ` ${s.paperOut}` : ""}${fx === "fly" ? ` ${s.fly}` : ""}`} onClick={e => e.stopPropagation()}>
      <button type="button" className={s.x} onClick={close}>×</button>
      {showForm && <>
        <b className={s.title}>赌 约</b>
        {b?.phase === "declined" && !b.result?.cancelled && fx === "" && <p className={s.said}><img src={FACE[b.with]} alt="" />{b.lines?.slice(-1)[0]?.line ?? `${nm(b.with)}这回没接`}</p>}
        <div className={s.row}><span>跟谁赌</span><div className={s.whos}>{(["buddy", "pal"] as const).map(w => <button key={w} type="button" className={who === w ? s.on : ""} onClick={() => { snd.sfx("tap"); setWho(w); }}><img src={FACE[w]} alt="" />{nm(w)}</button>)}</div></div>
        <div className={s.row}><span>赌什么</span><div className={s.pills}>{kinds.map(k => <button key={k.k} type="button" className={kind === k.k ? s.on : ""} onClick={() => { snd.sfx("tap"); setKind(k.k); }}>{k.name}</button>)}</div></div>
        <div className={s.row}><span>多久</span><div className={s.pills}>{spans.map(k => <button key={k.k} type="button" className={span === k.k ? s.on : ""} onClick={() => { snd.sfx("tap"); setSpan(k.k); }}>{k.name}</button>)}</div></div>
        <div className={s.row}><span>输了的人</span><input value={stake} maxLength={40} placeholder="要做什么…" onChange={e => setStake(e.target.value)} /></div>
        <div className={s.presets}>{presets.map(p => <button key={p} type="button" onClick={() => { snd.sfx("tap"); setStake(p); }}>{p}</button>)}</div>
        <div className={s.signs}><span>立约人 <i className={s.hand}>{nm("player")}</i></span><span>应战 <i className={s.blank}>{nm(who)}（等他签）</i></span></div>
        <button type="button" className={s.stampBtn} disabled={busy || fx !== ""} onClick={() => void sign()}>盖章</button>
        {fx === "stamp" && <i className={s.seal}>赌</i>}
      </>}
      {!showForm && b && <>
        <b className={s.title}>{b.phase === "asking" ? "赌约递过去了" : b.phase === "on" ? "赌着呢" : "结果出来啦"}</b>
        <p className={s.terms}>跟 <b>{nm(b.with)}</b> 赌 <b>{kinds.find(k => k.k === b.kind)?.name ?? b.kind}</b>，输了的人：<em>{b.stake}</em></p>
        {b.phase === "asking" && <div className={s.asking}><img className={s.plane} src="/fanart/plane.png" alt="" /><span>{nm(b.with)}还没接……</span><button type="button" disabled={busy} onClick={() => void cancel()}>收回来</button></div>}
        {(b.phase === "on" || b.phase === "done") && <div className={s.race}>
          {(["player", b.with] as const).map(w => <div key={w} className={s.lane}><img src={FACE[w]} alt="" /><div className={s.track}><i className={s.fishRun} style={{ left: `${Math.min(88, (val(w) / top) * 88)}%` }} /></div><b>{big ? (sc(w)?.w ? `${sc(w)!.w}kg` : "还没钓到") : `${sc(w)?.n ?? 0} 条`}</b></div>)}
          {b.phase === "on" && <span className={s.left}>还剩 {mmss(b.endAt - Date.now())}</span>}
        </div>}
        <div className={s.signs}><span>立约人 <i className={s.hand}>{nm("player")}</i></span><span>应战 {b.phase === "asking" ? <i className={s.blank}>等他签</i> : <i key="sig" className={`${s.hand} ${s.write}`}>{nm(b.with)}</i>}</span></div>
        {(b.lines ?? []).slice(-2).map((l, i) => <p key={i} className={s.said}><img src={FACE[l.who] ?? FACE.player} alt="" />{l.line}</p>)}
        {b.phase === "done" && <div className={s.result}>
          {b.result?.winner === "player" && <i className={s.confetti} aria-hidden>{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ left: `${8 + i * 7.5}%`, animationDelay: `${(i % 4) * 0.12}s` }} />)}</i>}
          <b>{!b.result?.winner ? "平手，这把不算" : b.result.winner === "player" ? `你赢了！${nm(b.with)}欠你一张欠条` : `${nm(b.with)}赢了，你欠他一张欠条`}</b>
          {b.result?.winner && <small>欠条挂在小屋一楼门边的小麻绳上</small>}
          <button type="button" className={s.againBtn} onClick={() => { snd.sfx("paper"); setFresh(true); }}>再赌一局</button>
        </div>}
      </>}
      {(open.length > 0 || torn.length > 0) && <div className={s.ious}>
        <span className={s.iousHead}>欠条 {open.length} 张{torn.length ? ` · 撕掉的 ${torn.length} 张` : ""}</span>
        <div className={s.slips}>{[...open, ...[...torn].sort((a, b) => (b.tornAt ?? 0) - (a.tornAt ?? 0)).slice(0, 12)].map((i, k) => <button key={i.id} type="button" className={`${s.slip}${i.tornAt ? ` ${s.slipTorn}` : ""}`} style={{ "--r": `${((k * 37) % 9) - 4}deg` } as React.CSSProperties} onClick={() => { snd.sfx("paper"); onIou(i.id); }}><b>{nameOf(i.debtor)}欠{nameOf(i.creditor)}</b><span>{i.stake}</span></button>)}</div>
      </div>}
    </div>
  </div>;
}
export { api as betApi };
