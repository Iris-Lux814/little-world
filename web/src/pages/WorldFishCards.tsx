// 鱼桶牌。玩家点头的效果图 。
// 房间、椅子、桌沿那层和斗地主共用（table_bg / table_fg / Sitter），桌上换成一只装水的大木鱼桶（public/world-fishcards/tub.webp）。
// 一轮的动画：
// · 扣牌：手牌往上甩（或者按住往鱼桶拖）→ 牌背朝上滑进水里，一圈涟漪；别人扣好了，他那边的水面冒一串泡、头顶木牌「已扣牌」
// · 翻牌：三张牌同时破水翻上来 → 牌上的鱼「哗」地跃出水面，牌力越大跳得越高，空中亮出数字
// 最大那条甩着水花落进赢家的小木桶（桶一沉、溅水）；最小那条放生：慢慢游出桶沿、回头吐一个泡泡，泡泡里是下一张天气（只有放生的人看得见）
// · 天气牌是上方的小圆窗：扣着时两扇木窗关着，翻牌时「啪」地推开；雨真在下、雾在飘、夜里有星星
// · 开局：一叠牌从水里一张张跳进手里；打完：赢家桶里的鱼全跳一遍，输家欠的「替我钓一竿」从桶底浮上来
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import d from "./WorldDdz.module.css";
import s from "./WorldFishCards.module.css";
import { snd } from "../pixel/sound";
import { Sitter, SEAT_POS, cq, headTop } from "./WorldDdz";
import { fishCardsApi, WX_VIEW, SPOT_TXT, type FishCard, type FishRound, type FishTable, type FishPlayed } from "../lib/fishCards";

type Chat = { id: string; at: number; who: string; text: string };
const fishSrc = (sp?: string) => (sp ? `/world-fish/${sp}.png` : "");

/** 一张鱼牌：那条鱼自己的像素图、星星、重量，底边色带 = 在哪钓的；传说金边，垃圾灰一点 */
function Fish({ c, up, style, onPointerDown, small }: { c: FishCard | FishPlayed; up?: boolean; style?: React.CSSProperties; onPointerDown?: (e: React.PointerEvent) => void; small?: boolean }) {
  const spot = c.spot ?? "pond";
  return (
    <span className={`${s.card} ${small ? s.small : ""} ${up ? s.up : ""} ${c.legend ? s.legend : ""} ${c.junk ? s.junk : ""}`} style={style} onPointerDown={onPointerDown} data-cid={"cid" in c ? c.cid : undefined}>
      <i className={s.stars}>{Array.from({ length: Math.min(5, Math.max(1, c.stars || 1)) }, (_, i) => <em key={i} />)}</i>
      {c.species ? <img className={s.fishImg} src={fishSrc(c.species)} alt="" draggable={false} /> : <i className={s.fishGhost} />}
      <b className={s.cname}>{c.name}</b>
      <small className={s.kg}>{c.kg ? `${c.kg}kg` : ""}</small>
      <i className={`${s.band} ${s[`b_${spot}`] ?? ""}`}>{c.legend ? "传说" : c.junk ? "垃圾" : SPOT_TXT[spot] ?? ""}</i>
    </span>
  );
}

/** 天气小圆窗：wx 为空 = 天气牌扣着，两扇木窗关着 */
function WxWindow({ wx, peek, flash, rule, long }: { wx: string | null; peek?: boolean; flash?: number; rule: React.ReactNode; long?: boolean }) {
  return (
    <div className={`${s.wxWin} ${wx ? s.wxOpen : ""} ${peek ? s.wxPeek : ""}`} key={flash ?? 0}>
      <div className={s.wxView} style={wx ? { backgroundImage: `url(/weather-window/${WX_VIEW[wx] ?? "view_cloudy"}.webp)` } : undefined}>
        {wx === "雨" && <i className={s.rain} />}
        {wx === "雾" && <><i className={s.fog} /><i className={`${s.fog} ${s.fog2}`} /></>}
        {wx === "大风" && <i className={s.wind}>{Array.from({ length: 5 }, (_, i) => <em key={i} style={{ "--i": i } as React.CSSProperties} />)}</i>}
        {wx === "夜" && <i className={s.stars2}>{Array.from({ length: 9 }, (_, i) => <em key={i} style={{ "--i": i } as React.CSSProperties} />)}</i>}
        {wx === "晴" && <i className={s.sun} />}
        <i className={`${s.shutter} ${s.shL}`} /><i className={`${s.shutter} ${s.shR}`} />
      </div>
      <img className={s.wxFrame} src="/world-fishcards/window.webp" alt="" draggable={false} />
      <div className={`${s.wxPlate} ${long ? s.wxLong : ""}`}>{rule}</div>
    </div>
  );
}

// 桌上的位置（cqw）：左边对手 / 右边对手 / 我 —— 扣下的牌浮在鱼桶水面靠他那边，翻牌时从那里跃起
const WATER = { x: 50, y: 31 };
const SLOT = [{ x: 42, y: 30.6 }, { x: 58, y: 30.6 }, { x: 50, y: 32.4 }];
const BUCKET = [{ x: cqn(SEAT_POS[0].plate), y: 29 }, { x: cqn(SEAT_POS[1].plate), y: 29 }, { x: 9, y: 47 }];
function cqn(px: number) { return (px / 1672) * 100; }

type Reveal = { r: FishRound; k: number };
// fixed + me：伙伴截图用（worldshot 页塞进服务器此刻他视角的牌桌，不轮询、不能点；他坐在下面）
export function WorldFishCards({ names, onClose, onSwitch, chat = [], onSay, fixed, me = "player" }: { names: Record<string, string>; onClose: () => void; onSwitch?: () => void; chat?: Chat[]; onSay?: () => void; fixed?: FishTable; me?: string }) {
  const [t, setT] = useState<FishTable | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<string | null>(null); const [sunk, setSunk] = useState<{ c: FishCard; k: number } | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null); const [phase, setPhase] = useState(0); // reveal 的第几拍
  const [dealK, setDealK] = useState(0); const [chatOpen, setChatOpen] = useState(false);
  const nm = (id: string) => (id === me ? "我" : names[id] ?? id);
  // 慢的 GET 晚于出牌 POST 回来会把状态倒回去（甚至重播翻牌）→ 每次请求领一个号，只认最新的号；轮询不重叠
  const reqNo = useRef(0); const polling = useRef(false); const acting = useRef(false); // 出牌这些 POST 在路上时不轮询（不然 GET 先领到新号、POST 的结果反被当成过期丢掉）
  const pull = useCallback(async () => { if (fixed) { setT(fixed); return; } if (polling.current || acting.current) return; polling.current = true; const no = ++reqNo.current;
    try { const r = await fishCardsApi.table(); if (no === reqNo.current) { setT(r); setErr(""); } } catch (e) { if (no === reqNo.current) setErr((e as Error).message); } finally { polling.current = false; } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void pull(); if (fixed) return; const id = window.setInterval(() => void pull(), 1500); return () => clearInterval(id); }, [pull, fixed]);
  useEffect(() => { if (!fixed) snd.sfx("creak"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const g = t?.game ?? null;
  const live = g && g.status !== "done";
  const others = useMemo(() => (g ? g.seats.filter(w => w !== me) : []), [g]);
  const posOf = (w: string) => (w === me ? 2 : Math.max(0, others.indexOf(w)));

  // 新的一轮结果 → 翻牌动画（第一次拉到的不放，免得一进来就重播上一轮）
  const lastR = useMemo(() => { const l = g?.log ?? []; for (let i = l.length - 1; i >= 0; i--) if (l[i].round > 0) return l[i] as FishRound; return null; }, [g?.log]);
  const rKey = lastR && g ? `${g.id}:${lastR.round}` : ""; const seenR = useRef<string | null>(null);
  useEffect(() => {
    if (!t) return; // 还没拉到牌桌：别把「空」记成看过，不然第一次拉到的上一轮会被当成新的一轮重播
    if (seenR.current === null) { seenR.current = rKey; return; }
    if (!rKey || rKey === seenR.current || !lastR) return; seenR.current = rKey;
    setReveal({ r: lastR, k: Date.now() }); setPhase(0); setSunk(null);
  }, [rKey, !!t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!reveal) return; const r = reveal.r; const T: number[] = []; const at = (ms: number, f: () => void) => T.push(window.setTimeout(f, ms));
    snd.sfx("rise"); // 0：三张牌破水翻上来
    at(650, () => { setPhase(1); snd.sfx("flip"); }); // 1：翻开
    at(1050, () => { setPhase(2); const top = Math.max(...Object.values(r.played).map(p => p.power)); Object.values(r.played).forEach((p, i) => window.setTimeout(() => snd.sfx("leap", Math.round((p.power / Math.max(1, top)) * 3), 0.8), i * 90)); }); // 2：鱼跃
    at(2100, () => { setPhase(3); if (r.winner) snd.sfx("plunk"); if (r.freed) window.setTimeout(() => snd.sfx("free"), 300); }); // 3：落桶 / 放生
    at(4200, () => { setReveal(null); setPhase(0); });
    return () => T.forEach(clearTimeout);
  }, [reveal?.k]); // eslint-disable-line react-hooks/exhaustive-deps

  // 开局发牌：牌从水里一张张跳进手里
  const prevStatus = useRef(g?.status); useEffect(() => { if (g?.status === "on" && g.round === 1 && prevStatus.current === "invite") { setDealK(Date.now()); snd.sfx("riffle"); } prevStatus.current = g?.status; }, [g?.status, g?.round]);
  // 别人扣好了：他那边冒泡
  const playedKey = g ? others.map(w => (g.played[w] ? 1 : 0)).join("") : ""; const prevPlayed = useRef(playedKey);
  useEffect(() => { if (playedKey !== prevPlayed.current && playedKey.includes("1")) snd.sfx("bubble", 0, 0.7); prevPlayed.current = playedKey; }, [playedKey]);
  const done = g?.status === "done"; const prevDone = useRef(done);
  useEffect(() => { if (done && !prevDone.current) window.setTimeout(() => snd.sfx(g?.winner === me ? "arrive" : "paper"), reveal ? 4200 : 300); prevDone.current = done; }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (f: () => Promise<FishTable>, ok?: string) => { if (busy || fixed || acting.current) return false; setBusy(true); acting.current = true; const no = ++reqNo.current; try { const r = await f(); if (no === reqNo.current) setT(r); if (ok) snd.sfx(ok); return true; } catch (e) { setErr((e as Error).message); snd.sfx("nope"); return false; } finally { acting.current = false; setBusy(false); } };
  const myPlayed = !!g?.played[me];
  const canPlay = g?.status === "on" && !myPlayed && !reveal;
  const play = async (cid: string) => { const c = (g?.hand ?? []).find(x => x.cid === cid); if (!canPlay || !c) return; setSunk({ c, k: Date.now() }); snd.sfx("sink"); setSel(null); if (!(await act(() => fishCardsApi.play(cid)))) setSunk(null); };

  // 按住手牌往上拖（拖到鱼桶上方松手 = 扣下）；轻点 = 选中，再点一次扣下
  const drag = useRef<{ cid: string; sy: number; sx: number; el: HTMLElement; moved: boolean } | null>(null);
  const down = (cid: string) => (e: React.PointerEvent) => { if (!canPlay) return; const el = e.currentTarget as HTMLElement; el.setPointerCapture(e.pointerId); drag.current = { cid, sy: e.clientY, sx: e.clientX, el, moved: false }; };
  // 竖着拿手机时 WorldPage 把整个舞台 rotate(90deg)，屏幕上的 x / y 跟牌桌的不是一回事 → 换成牌桌自己的坐标（顺时针转 90°：本地 x = 屏幕 y，本地 y = -屏幕 x）
  const local = (el: HTMLElement, dx: number, dy: number) => { const t = el.closest(`.${d.table}`) as HTMLElement | null; const r = t?.getBoundingClientRect(); return r && t && t.clientWidth > t.clientHeight && r.height > r.width ? { dx: dy, dy: -dx } : { dx, dy }; };
  const move = (e: React.PointerEvent) => { const q = drag.current; if (!q) return; const { dx, dy } = local(q.el, e.clientX - q.sx, e.clientY - q.sy); if (!q.moved && Math.hypot(dx, dy) < 8) return; q.moved = true; q.el.style.transform = `translate(${dx}px, ${Math.min(0, dy)}px) rotate(${dx / 30}deg)`; q.el.classList.add(s.dragging); };
  const up = (e: React.PointerEvent) => { const q = drag.current; drag.current = null; if (!q) return; q.el.style.transform = ""; q.el.classList.remove(s.dragging);
    if (e.type === "pointercancel") return; // 手势被系统取消（来电、下拉通知）只收拾，不出牌
    const W = (q.el.closest(`.${d.table}`) as HTMLElement | null)?.clientWidth ?? 1000; const { dy } = local(q.el, e.clientX - q.sx, e.clientY - q.sy);
    if (q.moved) { if (-dy > W * 0.09) void play(q.cid); else snd.sfx("fold"); return; }
    if (sel === q.cid) void play(q.cid); else { setSel(q.cid); snd.sfx("tap"); } };

  const hand = g?.hand ?? [];
  const showWx = reveal ? reveal.r.wx : g?.status === "on" ? g.wx : null;
  const rv = reveal?.r; const topPw = rv ? Math.max(...Object.values(rv.played).map(p => p.power)) : 1;
  const ruleTxt = reveal ? t?.rules.wx[reveal.r.wx] : g?.wxRule ? g.wxRule : g?.status === "on" ? "天气牌扣着，跟牌一起翻" : "鱼桶牌 · 牌是你们钓过的鱼";
  const lastChat = chat[chat.length - 1];
  return (
    <div className={d.mask}>
      <div className={d.table}>
        <img className={d.wide} src="/world-ddz/table_wide.webp" alt="" draggable={false} />
        <img className={d.bg} src="/world-ddz/table_bg.webp" alt="" draggable={false} />
        {!fixed && <button type="button" className={d.close} onClick={() => { snd.sfx("fold"); onClose(); }} aria-label="离开牌桌" />}
        <div className={d.board}>{g && g.status === "on" ? <>第 {g.round} 轮 / {g.rounds}</> : <>鱼桶牌</>}</div>
        {onSwitch && !live && <button type="button" className={s.switch} onClick={() => { snd.sfx("riffle"); onSwitch(); }}>换斗地主</button>}

        {/* 天气小圆窗 + 下面的小木牌 */}
        <WxWindow wx={showWx} peek={!reveal && !!g?.peeked} flash={reveal?.k} long={(ruleTxt ?? "").length > 15} rule={<>{g?.peeked && !reveal ? <em>偷看到的 · </em> : null}{ruleTxt}</>} />

        {/* 对手：椅子上的人 + 头顶木牌 */}
        {others.slice(0, 2).map((w, k) => {
          const P = SEAT_POS[k]; const playedNow = g?.status === "on" && g.played[w];
          const waitAcc = g?.status === "invite" && !g.accepted[w];
          return (
            <div key={w}>
              <div className={d.seat} style={{ left: cq(P.x) }}>
                <div className={`${d.sitWrap} ${waitAcc ? s.ghost : ""}`}><Sitter id={w} turn={g?.status === "on" && !g.played[w]} /></div>
                <span className={d.nameTag}>{nm(w)}</span>
                {(playedNow || waitAcc || (g?.status === "invite" && g.accepted[w])) && <span className={`${s.sign} ${playedNow ? s.signOn : ""}`} style={{ top: `${headTop(w) - 4.2}cqw` }} key={String(playedNow) + String(waitAcc)}>{playedNow ? "已扣牌" : waitAcc ? "还没接" : "接了"}</span>}
                {(() => { const m = [...chat].reverse().find(c => c.who === w); return m && Date.now() - m.at < 9000 ? <span key={m.id} className={`${d.headSay} ${k ? d.headSayR : ""}`} style={{ top: `${headTop(w) - 7}cqw` }}>{m.text}</span> : null; })()}
              </div>
            </div>
          );
        })}
        <img className={d.fg} src="/world-ddz/table_fg.png" alt="" draggable={false} />

        {/* 每人一只小木桶：收了几张；落桶时一沉 */}
        {g && g.seats.map(w => { const p = BUCKET[posOf(w)]; const hit = phase >= 3 && rv?.winner === w;
          return <div key={w} className={`${s.bucket} ${hit ? s.bucketHit : ""} ${done && g.winner === w && !reveal ? s.bucketWin : ""}`} style={{ left: `${p.x}cqw`, top: `${p.y}cqw` }}>
            <img src="/world-fishcards/bucket.webp" alt="" draggable={false} />
            <b>收 {g.taken[w] ?? 0}</b>
            {done && g.winner === w && !reveal && <i className={s.jumpers}>{[0, 1, 2].map(i => <em key={i} style={{ "--i": i } as React.CSSProperties} />)}</i>}
          </div>; })}

        {/* 大木鱼桶 + 水面 */}
        <div className={s.tub}>
          <img src="/world-fishcards/tub.webp" alt="" draggable={false} />
          <div className={s.water}>
            <i className={s.ripple} /><i className={`${s.ripple} ${s.ripple2}`} />
            {/* 扣下的牌浮在水里（牌背朝上） */}
            {g?.status === "on" && !reveal && g.seats.filter(w => g.played[w]).map(w => { const q = SLOT[posOf(w)]; return <i key={w + g.round} className={`${s.sunkCard} ${w === me ? s.sunkMine : ""}`} style={{ left: `${((q.x - WATER.x) / 24.4) * 100 + 50}%`, top: `${((q.y - WATER.y) / 6) * 100 + 50}%` }} />; })}
            {g?.status === "on" && !reveal && others.filter(w => g.played[w]).map(w => <i key={`b${w}${g.round}`} className={s.bubbles} style={{ left: `${((SLOT[posOf(w)].x - WATER.x) / 24.4) * 100 + 50}%` }}><em /><em /><em /></i>)}
            {g?.pot ? <span className={s.pot}>桌上压着 {g.pot} 张</span> : null}
          </div>
        </div>
        {sunk && Date.now() - sunk.k < 1400 && <div className={s.sinking} key={sunk.k}><Fish c={sunk.c} /></div>}

        {/* 翻牌：三张牌破水翻上来 → 鱼跃 → 落桶 / 放生 */}
        {rv && <div className={s.reveal} key={reveal!.k}>
          {Object.entries(rv.played).map(([w, p]) => { const q = SLOT[posOf(w)]; const hgt = 4 + (p.power / Math.max(1, topPw)) * 9; const win = rv.winner === w, freed = rv.freed === w; const b = BUCKET[posOf(rv.winner ?? w)];
            return <div key={w} className={s.rvSlot} style={{ left: `${q.x}cqw`, top: `${q.y}cqw`, "--h": `${hgt}cqw`, "--bx": `${b.x - q.x}cqw`, "--by": `${b.y - q.y}cqw` } as React.CSSProperties}>
              <div className={`${s.rvCard} ${phase >= 1 ? s.rvFlip : ""}`}>{phase >= 1 ? <Fish c={p} small /> : <i className={s.back} />}<span className={s.rvWho}>{nm(w)}</span></div>
              {phase >= 2 && !p.thrown && <div className={`${s.leaper} ${phase >= 3 && win ? s.toBucket : ""} ${phase >= 3 && freed ? s.swimAway : ""} ${phase >= 3 && !win && !freed ? s.dive : ""}`}>
                {p.species ? <img src={fishSrc(p.species)} alt="" /> : <i className={s.fishGhost} />}
                <b className={s.pw}>{p.power}</b>
                <i className={s.splash}><em /><em /><em /><em /></i>
              </div>}
              {phase >= 3 && freed && w === me && g && g.round > rv.round && g.wx && <span className={s.peekBubble}>下一张：{g.wx}</span>}
              {phase >= 3 && freed && w !== me && <span className={s.peekBubble}>放生，偷看了下一张</span>}
            </div>; })}
          <div className={s.rvText}>{(() => { const P = rv.played; const parts = [rv.winner ? `${nm(rv.winner)}的${P[rv.winner]?.name}最大，收走` : "平了，牌留在桶里归下一轮"]; if (rv.freed) parts.push(`${nm(rv.freed)}的${P[rv.freed]?.name}最小，放生`); for (const [w, p] of Object.entries(P)) if (p.thrown) parts.push(`${nm(w)}把${p.name}扔了`); return `第 ${rv.round} 轮（${rv.wx}）：${parts.join("；")}`; })()}</div>
        </div>}

        {/* 中间：开局 / 等人接 / 打完 */}
        <div className={d.center}>
          {!g || (done && !reveal) ? <div className={s.idleBox}>
            {done && g && <div className={d.result}><b>{g.winner ? (g.winner === me ? "我赢了" : `${nm(g.winner)}赢了`) : "平局"}</b><span>{g.endText}</span>
              {g.winner === me && g.favorFrom.length > 0 && <span className={s.favorRow}>{g.favorFrom.map(w => <button key={w} type="button" className={s.favor} onClick={() => void act(() => fishCardsApi.favor(w), "coin")}>叫{nm(w)}替我钓一竿</button>)}</span>}
            </div>}
            <span className={s.startRow}>
              <button type="button" className={d.big} onClick={() => void act(() => fishCardsApi.create(["buddy", "pal"]), "go")}>{done ? "再来一局" : "叫"}{done ? "" : `${names.buddy ?? "伙伴甲"}和${names.pal ?? "伙伴乙"}`}</button>
              <button type="button" className={s.small2} onClick={() => void act(() => fishCardsApi.create(["buddy"]), "go")}>只叫{names.buddy ?? "伙伴甲"}</button>
              <button type="button" className={s.small2} onClick={() => void act(() => fishCardsApi.create(["pal"]), "go")}>只叫{names.pal ?? "伙伴乙"}</button>
            </span>
          </div> : g.status === "invite" ? <div className={s.idleBox}>
            {g.by === me || g.accepted[me] ? <span className={s.waitTxt}>等{others.filter(w => !g.accepted[w]).map(nm).join("、")}接牌…</span>
              : <><span className={s.waitTxt}>{nm(g.by)}叫你打鱼桶牌</span><span className={s.startRow}><button type="button" className={d.big} onClick={() => void act(() => fishCardsApi.answer(true), "go")}>接牌</button><button type="button" className={s.small2} onClick={() => void act(() => fishCardsApi.answer(false), "tap")}>不打</button></span></>}
          </div> : null}
        </div>

        {/* 我：小名牌 + 手牌 */}
        {g?.status === "on" && <div className={`${d.mine} ${canPlay ? d.mineTurn : ""}`}><span className={d.nameTag}>{canPlay ? "扣一张" : myPlayed ? "等他们扣" : "我"}</span></div>}
        <div className={s.hand} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          {g?.status === "on" && hand.filter(c => c.cid !== sunk?.c.cid).map((c, i, a) => <Fish key={c.cid} c={c} up={sel === c.cid} onPointerDown={down(c.cid)}
            style={{ "--i": i, "--n": a.length, animationDelay: `${dealK && Date.now() - dealK < 2500 ? i * 180 : i * 40}ms` } as React.CSSProperties} />)}
        </div>
        {canPlay && sel && <div className={d.btns}><button type="button" className={d.bPlay} disabled={busy} onClick={() => void play(sel)}><i className={d.icoHeart} />扣下这张</button></div>}

        {/* 「大家」小纸条（跟斗地主那张一样） */}
        {!fixed && <>{chatOpen && <div className={d.chatMask} onClick={() => { setChatOpen(false); snd.sfx("fold"); }} />}
        <div className={`${d.chatNote}${chatOpen ? ` ${d.chatOpen}` : ""}`} key={chatOpen ? "o" : "c"} onClick={() => { if (!chatOpen) { setChatOpen(true); snd.sfx("paper"); } }}>
          <b className={d.chatHead}>大家</b>
          <div className={d.chatList}>
            {(chatOpen ? chat.slice(-14) : chat.slice(-2)).map(m => <p key={m.id} className={d[`cw_${m.who}`] || ""}><em>{nm(m.who)}</em>{m.text}</p>)}
            {!lastChat && <p className={d.chatEmpty}>还没人说话</p>}
          </div>
          {chatOpen && onSay && <button type="button" className={d.chatSay} onClick={e => { e.stopPropagation(); setChatOpen(false); onSay(); }}>说一句</button>}
        </div></>}
        {t && t.open === false && <div className={s.closedTip}>鱼桶牌还在试玩（设置里开了试玩才能打）</div>}
        {err && <div className={d.err} onClick={() => setErr("")}>{err}</div>}
      </div>
    </div>
  );
}

/** 点牌桌先弹的小牌盒：盒盖一翻，里面竖着几副牌，抽哪副打哪副（以后加新牌就往盒里插一副） */
export function CardBox({ onPick, onClose }: { onPick: (k: "ddz" | "fish") => void; onClose: () => void }) {
  useEffect(() => { snd.sfx("creak"); }, []);
  const decks: { k: "ddz" | "fish"; name: string; sub: string }[] = [{ k: "ddz", name: "斗地主", sub: "三个人 · 抢地主" }, { k: "fish", name: "鱼桶牌", sub: "牌是你们钓过的鱼" }];
  const [pulled, setPulled] = useState<string | null>(null); const pickT = useRef(0);
  useEffect(() => () => clearTimeout(pickT.current), []); // 抽出来 0.5 秒内关了牌盒，别再打开牌桌
  return (
    <div className={s.boxMask} onClick={() => { clearTimeout(pickT.current); snd.sfx("fold"); onClose(); }}>
      <div className={s.box} onClick={e => e.stopPropagation()}>
        <i className={s.boxLid} />
        <div className={s.decks}>
          {decks.map((q, i) => <button key={q.k} type="button" className={`${s.deck} ${s[`deck_${q.k}`]} ${pulled === q.k ? s.pulled : ""}`} style={{ "--i": i } as React.CSSProperties}
            onClick={() => { if (pulled) return; setPulled(q.k); snd.sfx("riffle"); pickT.current = window.setTimeout(() => onPick(q.k), 520); }}>
            <i className={s.deckFace} /><b>{q.name}</b><small>{q.sub}</small>
          </button>)}
        </div>
        <i className={s.boxFront}>今天打什么</i>
      </div>
    </div>
  );
}
