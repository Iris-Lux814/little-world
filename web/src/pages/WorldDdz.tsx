// 斗地主。联机以后换 DdzHost 就能用同一份。
// 底图 public/world-ddz/table_bg.webp，上面叠：
// · 上方左右两把奶白椅子：谁坐下就把谁的小人叠上去（椅子不分人，联机谁坐都行）；空椅子上是「叫伙伴 / 秤砣来」
// · 桌子对面站着发牌的横横（Claude 官方像素吉祥物，heng_idle / heng_deal 两条帧表）：开局头顶一叠牌一张张弹出去 → 发完趴扁 → 喘口气
// · 两块小木牌写剩几张、小黑板写底分 / 炸弹；地主头上戴小叶子王冠，轮到谁谁旁边一个小沙漏
// · 手牌一排在最下面，点一张选一张，按住横着划连选 / 连取消；出牌 / 不要 / 提示三颗按钮在桌子右边
// 动画：横横蹦着发牌；出的牌从出牌的人那边飞到桌子中间；炸弹桌子一跳、王炸撒花瓣；不要 = 敲两下桌子；输了的人飘来一张小纸条。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import s from "./WorldDdz.module.css";
import { snd } from "../pixel/sound";
import { dollUrl } from "../pixel/doll";
import { ddzApi, homeHost, rankOf, RANK_TXT, suitOf, sortHand, shape, type DdzHost, type DdzSeat, type DdzTable } from "../lib/ddz";

const WHO_NAME: Record<string, string> = { player: "我" };
/** 坐在椅子上的人：public/world-ddz/sit_<谁>.png，两帧一行（0 捧着牌 / 1 托着下巴想 = 轮到他），脚底对齐格子底边。
 * 秤砣 / 托管的人用 public/world-ddz/sit_pel.png（两帧一行）。cw = 一格宽（格子高 300）；hip = 屁股在格子里的高度比例（对到椅面）；H = 显示高度（cqw）。秤砣 / 泥鳅 / 没有坐姿图的人先用秤砣那套 */
const SIT: Record<string, { cw: number; hip: number; H: number }> = {
  pel: { cw: 192, hip: 0.74, H: 14.6 },
};
/** 三个人坐牌桌用自己的小人图（标准图第 5 行第 4 格是坐）；hip = 椅面在格子里的高度比例 */
const DOLL_IDS = new Set(["player", "buddy", "pal"]);
const DOLL_SIT = { H: 18, hip: 0.8 };
const SEAT_Y = 26.6; // 椅面在牌桌上的高度（cqw）
const sitKey = (id: string) => (SIT[id] ? id : "pel");
/** 头顶高度（cqw），王冠 / 沙漏跟着放 */
export const headTop = (id: string) => { if (DOLL_IDS.has(id)) return SEAT_Y - DOLL_SIT.H * (DOLL_SIT.hip - 10 / 64) + 0.5; const q = SIT[sitKey(id)]; return SEAT_Y - q.H * q.hip + 0.5; };
export function Sitter({ id, turn }: { id: string; turn: boolean }) {
  if (DOLL_IDS.has(id)) { // 三个人：用各自小人图第 5 行的「坐」（48×64 一格），轮到谁就晃
    const H = DOLL_SIT.H, px = H / 64, W = 48 * px;
    return <span className={`${s.sitter} ${turn ? s.sitTurn : ""}`} style={{ top: `${SEAT_Y - H * DOLL_SIT.hip}cqw`, width: `${W}cqw`, height: `${H}cqw`, marginLeft: `${-W / 2}cqw`, backgroundImage: `url(${dollUrl(id)})`, backgroundSize: `${240 * px}cqw ${320 * px}cqw`, backgroundPosition: `${-144 * px}cqw ${-256 * px}cqw` }} />;
  }
  const k = sitKey(id), q = SIT[k], W = q.H * q.cw / 300;
  return <span className={`${s.sitter} ${turn ? s.sitTurn : ""}`} style={{ top: `${SEAT_Y - q.H * q.hip}cqw`, width: `${W}cqw`, height: `${q.H}cqw`, marginLeft: `${-W / 2}cqw`, backgroundImage: `url(/world-ddz/sit_${k}.png)`, backgroundSize: `${W * 2}cqw ${q.H}cqw`, backgroundPosition: `${turn ? -W : 0}cqw 0`, filter: id === "bot2" ? "hue-rotate(-25deg) saturate(1.2)" : undefined }} />;
}

const FACE: Record<number, string> = { 11: "j", 12: "q", 13: "k", 16: "sj", 17: "bj" };
/** 一张牌：奶白卡片，左上点数，右下花色小图（草莓 / 小花 / 四叶草 / 星星），王是一颗闪闪的爱心 */
export function Card({ id, small = false, up = false, dim = false, style, onPointerDown }: { id: number; small?: boolean; up?: boolean; dim?: boolean; style?: React.CSSProperties; onPointerDown?: (e: React.PointerEvent) => void }) {
  const r = rankOf(id), su = suitOf(id), joker = r >= 16;
  const face = FACE[r]; // J 横横 / Q 美乐蒂 / K 玉桂狗 / 小王 酷企鹅 / 大王 三个一起的全家福
  return (
    <span className={`${s.card} ${small ? s.small : ""} ${up ? s.up : ""} ${dim ? s.dim : ""} ${face ? s.hasFace : ""} ${joker ? (r === 17 ? s.bigJ : s.smallJ) : s[`s_${su}`]}`} style={style} onPointerDown={onPointerDown} data-id={id}>
      <b>{joker ? (r === 17 ? "大王" : "小王") : RANK_TXT[r]}</b>
      {face && <i className={s.face} style={{ backgroundImage: `url(/world-ddz/face_${face}.png)` }} />}
      {!joker && <i className={s.pip} />}
    </span>
  );
}

// 横横：idle 6 帧（0 站 / 1 眨眼 / 2 举牌 / 3 弹一张 / 4 蹦起来 / 5 走）、deal 8 帧（5 趴扁 / 6 喘气 / 7 眯眼小懊恼）
const SEQ: Record<string, { f: number[]; ms: number }> = {
  idle: { f: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 4, 0], ms: 260 },
  reveal: { f: [2, 2, 2, 3, 3, 0], ms: 260 }, // 叫完分：举起三张底牌亮给大家看
};
function HengSprite({ sheet, f }: { sheet: "idle" | "deal"; f: number }) {
  const n = sheet === "idle" ? 6 : 8;
  return <span className={s.heng} style={{ backgroundImage: `url(/world-ddz/heng_${sheet}.png)`, backgroundSize: `${n * 100}% 100%`, backgroundPosition: `${(f / (n - 1)) * 100}% 0` }} />;
}
function Heng({ seq, k }: { seq: string; k: number }) {
  const q = SEQ[seq] ?? SEQ.idle; const [i, setI] = useState(0);
  useEffect(() => { setI(0); const id = window.setInterval(() => setI(n => n + 1), q.ms); return () => clearInterval(id); }, [seq, k, q.ms]);
  const f = q.f[seq !== "idle" ? Math.min(i, q.f.length - 1) : i % q.f.length];
  return <HengSprite sheet="idle" f={f} />;
}

/* 发牌：一整叠牌顶在横横头上，一跳一跳地发；每跳一下头顶弹出一张，翻着跟头飞到那个人手里（左 → 右 → 我 轮着）；
 * 跳得越来越快，最后几张像连珠炮；牌叠越来越矮，最后一张弹出去，它「啪」地趴成一块小方砖，喘口气。
 * 中间有一张弹歪了掉在桌上：它原地蹦一下、眯成两条横线，横着挪过去用头顶回去，再挪回来接着发。
 * 横横身子用帧图，头顶那叠牌单独画（这样才能一张张变矮）。 */
const HOPS = 24, STRAY = 7;
const hopMs = (i: number) => Math.max(70, Math.round(380 * Math.pow(0.88, i)));
const STRAY_MS = 1300, END_MS = 1500;
const DEAL_MS = Array.from({ length: HOPS }, (_, i) => hopMs(i)).reduce((a, b) => a + b, 0) + STRAY_MS + END_MS;
// 飞到哪（相对横横头顶，cqw）：左边椅子 / 右边椅子 / 我的手牌
const TARGET = [{ dx: -26, dy: 6 }, { dx: 25.5, dy: 6 }, { dx: 0, dy: 34 }];
type Fly = { id: number; dx: number; dy: number; ms: number; from: number };
type Pose = "stand" | "crouch" | "hop" | "flat" | "puff" | "oops";
function Dealer({ onDone, onHop }: { onDone: () => void; onHop: (i: number) => void }) {
  const [st, setSt] = useState<{ pose: Pose; left: number; x: number }>({ pose: "stand", left: HOPS, x: 0 });
  const [flies, setFlies] = useState<Fly[]>([]); const [stray, setStray] = useState(false);
  useEffect(() => {
    const T: number[] = []; let t = 0;
    const at = (ms: number, f: () => void) => { T.push(window.setTimeout(f, ms)); };
    const pose = (p: Pose, x?: number) => setSt(o => ({ ...o, pose: p, x: x ?? o.x }));
    const pop = (i: number, from = 0) => { const g = TARGET[i % 3]; setFlies(p => [...p.slice(-6), { id: i, dx: g.dx, dy: g.dy, ms: Math.max(320, 620 - i * 14), from }]); };
    for (let i = 0; i < HOPS; i++) {
      const d = hopMs(i), left = HOPS - i - 1, k = i;
      at(t, () => pose("crouch"));
      at(t + d * 0.35, () => { setSt(o => ({ ...o, pose: "hop", left })); onHop(k); if (k !== STRAY) pop(k); else setStray(true); });
      at(t + d * 0.8, () => pose("stand"));
      t += d;
      if (i === STRAY) { // 弹歪了：眯眼蹦一下 → 横着挪过去 → 用头顶回去 → 挪回来
        at(t, () => pose("oops"));
        at(t + 380, () => pose("stand", 8));
        at(t + 800, () => { pose("hop"); setStray(false); pop(k, 8); });
        at(t + 1000, () => pose("stand", 0));
        t += STRAY_MS;
      }
    }
    at(t, () => pose("flat"));
    at(t + 650, () => pose("puff"));
    at(t + END_MS, onDone);
    return () => T.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sprite = st.pose === "flat" ? <HengSprite sheet="deal" f={5} /> : st.pose === "puff" ? <HengSprite sheet="deal" f={6} /> : st.pose === "oops" ? <HengSprite sheet="deal" f={7} /> : <HengSprite sheet="idle" f={st.pose === "hop" ? 4 : 0} />;
  const lift = st.pose === "hop" ? -1.4 : st.pose === "crouch" ? 1.2 : 0; // 蹦起来那帧身子高 23px；蹲下压扁
  const showStack = st.left > 0 && st.pose !== "flat" && st.pose !== "puff" && st.pose !== "oops";
  return (
    <>
      <div className={`${s.dealer} ${st.pose === "crouch" ? s.crouch : ""}`} style={{ transform: `translateX(calc(-50% + ${st.x}cqw))` }}>
        {sprite}
        {showStack && <i className={s.stack} style={{ height: `${Math.max(.47, st.left * 0.105)}cqw`, transform: `translate(-50%, calc(-100% + ${lift}cqw))` }} />}
      </div>
      {stray && <i className={`${s.flyCard2} ${s.strayLie}`} />}
      {flies.map(q => <span key={q.id} className={s.fly} style={{ "--dx": `${q.dx}cqw`, "--from": `${q.from}cqw`, animationDuration: `${q.ms}ms` } as React.CSSProperties}><i className={s.flyCard2} style={{ "--dy": `${q.dy}cqw`, animationDuration: `${q.ms}ms` } as React.CSSProperties} /></span>)}
    </>
  );
}

// 座位在底图上的位置（bg px）：左上椅子 / 右上椅子
export const SEAT_POS = [{ x: 400, plate: 202 }, { x: 1263, plate: 1472 }];
const BW = 1672;
export const cq = (x: number) => `${(x / BW) * 100}cqw`;

export type DdzChat = { id: string; at: number; who: string; text: string };
export function WorldDdz({ names, onClose, host: host0, chat = [], onSay }: { names: Record<string, string>; onClose: () => void; host?: DdzHost | null; chat?: DdzChat[]; onSay?: () => void }) {
  const host = useMemo(() => host0 ?? homeHost(), [host0]);
  const [t, setT] = useState<DdzTable | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set()); const [shake, setShake] = useState(0); const [boom, setBoom] = useState<{ k: number; rocket: boolean } | null>(null);
  const [heng, setHeng] = useState<{ seq: string; k: number }>({ seq: "idle", k: 0 }); const [knock, setKnock] = useState<{ who: string; k: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false); const chatRef = useRef<HTMLDivElement>(null);
  const lastChat = chat[chat.length - 1]; const [chatPing, setChatPing] = useState(false); const seenChat = useRef(lastChat?.id);
  useEffect(() => { if (!lastChat || lastChat.id === seenChat.current) return; seenChat.current = lastChat.id; if (lastChat.who !== "player") { snd.sfx("paper", 0, 0.6); setChatPing(true); const t = window.setTimeout(() => setChatPing(false), 900); return () => clearTimeout(t); } }, [lastChat?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const el = chatRef.current; if (el) el.scrollTop = el.scrollHeight; }, [chatOpen, lastChat?.id]);
  const nm = (id: string) => WHO_NAME[id] ?? names[id] ?? t?.game?.names?.[id] ?? t?.seats.find(q => q?.id === id)?.name ?? id;
  const pull = useCallback(async () => { if (!host) return; try { const r = await ddzApi.table(host); setT(r); setErr(""); } catch (e) { setErr((e as Error).message); } }, [host]);
  useEffect(() => { void pull(); const id = window.setInterval(() => void pull(), 1500); return () => clearInterval(id); }, [pull]);
  useEffect(() => { snd.sfx("creak"); }, []);
  const g = t?.game; const me = t?.mySeat != null && t.mySeat >= 0 ? t.seats[t.mySeat]?.id ?? "player" : "player";
  const myTurn = !!g && g.turn === me && g.phase !== "done";
  const hand = useMemo(() => sortHand((g?.hand ?? []).map(c => c.id)), [g?.hand]);
  useEffect(() => { setSel(p => { const n = new Set([...p].filter(x => hand.includes(x))); return n.size === p.size ? p : n; }); }, [hand]);

  // 新一局（发牌）：横横蹦着发牌；手牌等它发完再一张张落下
  const gameKey = g ? `${g.seats.join(",")}:${g.counts && Object.values(g.counts).join(",")}` : "";
  const dealt = useRef(false); const [dealAt, setDealAt] = useState(0);
  useEffect(() => {
    const fresh = !!g && g.phase === "bid" && g.bid.log.length === 0 && Object.values(g.counts).every(n => n === 17);
    if (fresh && !dealt.current) { dealt.current = true; setDealAt(Date.now()); }
    if (!g || g.phase !== "bid") dealt.current = false;
  }, [gameKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // 叫完分：横横举起底牌
  const prevPhase = useRef(g?.phase); useEffect(() => { if (prevPhase.current === "bid" && g?.phase === "play") { setHeng({ seq: "reveal", k: Date.now() }); snd.sfx("popup", 2); window.setTimeout(() => setHeng({ seq: "idle", k: Date.now() }), 1700); } prevPhase.current = g?.phase; }, [g?.phase]);
  // 有人出了牌：炸弹桌子一跳、王炸撒花瓣；有人「不要」：敲两下桌子
  const lastKey = g?.last ? `${g.last.by}:${g.last.ids.join(",")}` : "";
  const prevLast = useRef(""); useEffect(() => { if (lastKey && lastKey !== prevLast.current) { if (g?.last && (g.last.type === "bomb" || g.last.type === "rocket")) { setBoom({ k: Date.now(), rocket: g.last.type === "rocket" }); snd.sfx("thud"); window.setTimeout(() => snd.sfx("sparkle"), 200); } else snd.sfx("flip"); } prevLast.current = lastKey; }, [lastKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // 后端只回最近 12 手 → 用「最后一手 + 轮到谁的时间」认新的一手
  const lp = g?.plays[g.plays.length - 1]; const nPlays = lp ? `${g!.turnAt}:${lp.who}:${lp.pass ? "p" : lp.ids?.join(",")}` : ""; const prevPlays = useRef(nPlays);
  useEffect(() => { if (lp && nPlays !== prevPlays.current && prevPlays.current !== "" && lp.pass) { setKnock({ who: lp.who, k: Date.now() }); snd.sfx("tap"); window.setTimeout(() => snd.sfx("tap"), 160); } prevPlays.current = nPlays; }, [nPlays]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevTurn = useRef(""); useEffect(() => { if (myTurn && prevTurn.current !== "me") snd.sfx("chime", 1); prevTurn.current = myTurn ? "me" : g?.turn ?? ""; }, [myTurn, g?.turn]);
  useEffect(() => { if (g?.phase === "done" && g.result) snd.sfx(g.score && (g.score[me] ?? 0) > 0 ? "arrive" : "paper"); }, [g?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (f: () => Promise<DdzTable>, ok?: string) => { if (!host || busy) return; setBusy(true); try { const r = await f(); setT(r); if (ok) snd.sfx(ok); return true; } catch (e) { setErr((e as Error).message); setShake(Date.now()); snd.sfx("nope"); return false; } finally { setBusy(false); } };
  // ── 划着选牌（手机上按住时 pointerenter 不来 → pointermove + elementFromPoint 找手指下面那张）──
  const drag = useRef<{ mode: boolean; last: number } | null>(null);
  const toggle = (id: number, mode: boolean) => setSel(p => { if (p.has(id) === mode) return p; const n = new Set(p); if (mode) n.add(id); else n.delete(id); return n; });
  const down = (id: number) => (e: React.PointerEvent) => { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); const mode = !sel.has(id); drag.current = { mode, last: id }; toggle(id, mode); snd.sfx("tap"); };
  const move = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-id]") as HTMLElement | null; if (!el) return; const id = Number(el.dataset.id); if (id === d.last || !hand.includes(id)) return; d.last = id; toggle(id, d.mode); snd.sfx("tap"); };
  useEffect(() => { const up = () => { drag.current = null; }; window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up); return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }; }, []);

  const picked = hand.filter(x => sel.has(x)); const pickedShape = shape(picked);
  const doPlay = async () => { if (!pickedShape) { setShake(Date.now()); snd.sfx("nope"); return; } if (await act(() => ddzApi.play(host!, picked), "popup")) setSel(new Set()); };
  const doHint = async () => { if (!host) return; try { const r = await ddzApi.hint(host); if (!r.ids?.length) { setErr("没有能压过的，点「不要」吧"); snd.sfx("nope"); return; } setSel(new Set(r.ids)); snd.sfx("sparkle"); } catch (e) { setErr((e as Error).message); } };

  const seats = t?.seats ?? [null, null, null]; const mi = t?.mySeat ?? -1; const sitting = mi >= 0;
  // 我在下面；上一家在左上、下一家在右上（逆时针出牌）
  const others: DdzSeat[] = mi >= 0 ? [seats[(mi + 2) % 3], seats[(mi + 1) % 3]] : [seats[1], seats[2]];
  const recent = (who?: string) => g?.plays.slice().reverse().find(p => p.who === who);
  // 出的牌从谁那边飞过来：左上 / 右上 / 下面
  const fromOf = (who?: string) => (who === me ? "me" : others[0]?.id === who ? "l" : "r");
  const dealing = dealAt > 0 && Date.now() - dealAt < DEAL_MS + 500;
  const lost = g?.phase === "done" && g.score && (g.score[me] ?? 0) < 0;
  return (
    <div className={s.mask}>
      <div className={`${s.table} ${boom && Date.now() - boom.k < 900 ? s.boom : ""}`} key={boom?.k ?? 0}>
        {/* 两边别露出游戏 → 底图往左右加宽（table_wide，中间就是 table_bg 原图），铺满整屏，牌桌坐标不变 */}
        <img className={s.wide} src="/world-ddz/table_wide.webp" alt="" draggable={false} />
        <img className={s.bg} src="/world-ddz/table_bg.webp" alt="" draggable={false} />
        <button type="button" className={s.close} onClick={() => { snd.sfx("fold"); onClose(); }} aria-label="离开牌桌" />
        {/* 小黑板：底分 / 炸弹，粉笔字 */}
        <div className={s.board}>{g ? <>底分 {Math.max(1, g.bid.cur)} · 炸弹 ×{g.bombs}</> : <>斗地主 · 三个人开局</>}</div>

        {/* 两把椅子 + 木牌 */}
        {others.map((q, k) => {
          const P = SEAT_POS[k]; const turn = !!q && g?.turn === q.id && g.phase !== "done";
          const bid = g?.phase === "bid" && q ? g.bid.log.filter(b => b.who === q.id).pop() : undefined;
          const said = q && g?.phase === "play" && recent(q.id)?.pass && g.last?.by !== q.id ? "不要" : bid ? (bid.score ? `叫 ${bid.score} 分` : "不叫") : "";
          return (
            <div key={k}>
              <div className={s.seat} style={{ left: cq(P.x) }}>
                {q ? <>
                  <div className={`${s.sitWrap} ${knock?.who === q.id ? s.knock : ""}`} key={knock?.who === q.id ? knock.k : 0}><Sitter id={q.id} turn={turn} /></div>
                  {q.id === g?.landlord && <i className={s.crown} style={{ top: `${headTop(q.id) - 1.6}cqw` }} />}
                  {turn && <i className={s.glass} style={{ top: `${headTop(q.id) + 1}cqw` }} />}
                  <span className={s.nameTag}>{nm(q.id)}{q.kind === "bot" ? " · 托管" : ""}</span>
                  {(() => { const m = [...chat].reverse().find(c => c.who === q.id); return m && Date.now() - m.at < 9000 ? <span key={m.id} className={`${s.headSay} ${k ? s.headSayR : ""}`} style={{ top: `${headTop(q.id) - 7}cqw` }}>{m.text}</span> : null; })()}
                  {said && <span className={`${s.said} ${k ? s.saidR : ""}`} key={said + nPlays}>{said}</span>}
                  {knock?.who === q.id && <span className={s.knockFx} key={knock.k}><i /><i /></span>}
                  {/* 打完一局伙伴就固定在桌上了，换不了人——没在打的时候，别人的座位下面给「请他起来」，空出来再叫别人 */}
                  {(!g || g.phase === "done") && sitting && <span className={`${s.addRow} ${s.standRow}`}><button type="button" className={s.standBtn} onClick={() => void act(() => ddzApi.stand(host!, q.id), "tap")}>请{nm(q.id)}起来</button></span>}
                </> : ((!g || g.phase === "done") && sitting && <span className={s.addRow}>
                  <button type="button" onClick={() => void act(() => ddzApi.add(host!, "buddy"), "popup")}>叫{names.buddy ?? "伙伴甲"}来</button>
                  <button type="button" onClick={() => void act(() => ddzApi.add(host!, "pal"), "popup")}>叫{names.pal ?? "伙伴乙"}来</button>
                  <button type="button" onClick={() => void act(() => ddzApi.add(host!, "bot"), "popup")}>秤砣来凑数</button>
                </span>)}
              </div>
              <div className={s.plate} style={{ left: cq(P.plate) }}>{q && g ? <><span>剩余</span><b>{g.counts[q.id]}</b><span>张</span></> : <span>{q ? "等开局" : "空位"}</span>}</div>
            </div>
          );
        })}

        {/* 桌面前沿那一层（从底图抠的，table_fg.png）：盖在坐着的人上面，腿藏到桌子底下 */}
        <img className={s.fg} src="/world-ddz/table_fg.png" alt="" draggable={false} />
        {/* 横横站在桌子对面；底牌放在它面前 */}
        {dealing ? <div className={s.dealBox} key={dealAt}><Dealer onHop={i => snd.sfx(i % 3 === 2 ? "fold" : "tap", 0, .6)} onDone={() => { snd.sfx("thud"); setDealAt(0); }} /></div>
          : <div className={s.hengWrap}><Heng seq={heng.seq} k={heng.k} /></div>}
        {g?.bottom && <div className={s.bottomCards}>{g.bottom.map((id, i) => <Card key={id} id={id} small style={{ animationDelay: `${i * 90}ms` }} />)}</div>}
        {g && !g.bottom && g.phase === "bid" && <div className={s.bottomCards}>{[0, 1, 2].map(i => <i key={i} className={s.back} />)}</div>}

        {/* 桌子中间：最近一手 */}
        <div className={s.center}>
          {g?.last && g.phase !== "done" && <div className={`${s.lastPlay} ${s[`from_${fromOf(g.last.by)}`]}`} key={lastKey}>
            <div className={`${s.lastCards} ${g.last.type === "straight" || g.last.type === "pairs" ? s.domino : ""} ${g.last.type?.startsWith("plane") ? s.plane : ""}`}>{sortHand(g.last.ids).map((id, i) => <Card key={id} id={id} style={{ "--i": i } as React.CSSProperties} />)}</div>
            <span className={s.lastTag}>{nm(g.last.by)} · {g.last.typeName}</span>
          </div>}
          {/* 出了牌桌上没显示——别人都「不要」这一圈就结束了、桌面清空、又轮到玩家，看着像没出成。桌面空着时把上一圈最后那手淡淡留着，标「都不要」 */}
          {!g?.last && g?.phase === "play" && (() => { const t = g.plays.slice().reverse().find(p => !p.pass && p.ids?.length); if (!t) return null; return <div className={`${s.lastPlay} ${s.staleTrick}`} key={`old-${t.who}-${t.ids!.join(",")}`}>
            <div className={s.lastCards}>{sortHand(t.ids!).map((id, i) => <Card key={id} id={id} style={{ "--i": i } as React.CSSProperties} />)}</div>
            <span className={s.lastTag}>{nm(t.who)} · {t.typeName} · 都不要，{g.turn === me ? "该你" : nm(g.turn)}先出</span>
          </div>; })()}
          {g?.phase === "done" && g.result && sitting && <div className={s.result}>
            <b>{g.result.lordWin ? `地主 ${nm(g.landlord!)} 赢了` : "农民赢了"}</b>
            <span>{g.result.spring ? "春天！" : ""}倍数 ×{g.result.mult}{g.score && ` · 我 ${(g.score[me] ?? 0) > 0 ? "+" : ""}${g.score[me] ?? 0}`}</span>
            {!lost && <i className={s.confetti} />}
          </div>}
          {/* 打完点了「起来」以后卡住——上一局还在（done），人不在座上：以前只有「没有牌局」才给「坐下」、只有「坐着」才给「再来一局」，两头都不出。现在上一局打完、人不在座上也给「坐下」 */}
          {(!g || (g.phase === "done" && !sitting)) && <div className={s.idle}>{sitting ? (seats.every(Boolean) ? <button type="button" className={s.big} onClick={() => void act(() => ddzApi.start(host!), "go")}>开局</button> : <span className={s.hintTxt}>叫两个人来坐</span>) : <button type="button" className={s.big} onClick={() => void act(() => ddzApi.sit(host!), "popup")}>坐下</button>}</div>}
        </div>
        {boom?.rocket && Date.now() - boom.k < 2000 && <div className={s.petals} key={boom.k}>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}</div>}
        {lost && <i className={s.note} key={`n${nPlays}`} />}

        {/* 我：手牌左边一个小名牌，地主戴王冠 */}
        {sitting && <div className={`${s.mine} ${myTurn ? s.mineTurn : ""}`}>
          {me === g?.landlord && <i className={s.crown} />}
          <span className={s.nameTag}>{nm(me)}</span>
          {g && g.phase === "play" && g.last?.by !== me && recent(me)?.pass && <span className={s.said}>不要</span>}
        </div>}
        <div className={`${s.hand} ${shake && Date.now() - shake < 500 ? s.handShake : ""}`} key={`h${shake}`} onPointerMove={move}>
          {sitting && hand.map((id, i) => <Card key={id} id={id} up={sel.has(id)} style={{ "--i": i, "--n": hand.length, animationDelay: `${(dealing ? Math.max(0, DEAL_MS - 600 - (Date.now() - dealAt)) : 0) + i * 45}ms` } as React.CSSProperties} onPointerDown={down(id)} />)}
        </div>

        {/* 按钮 */}
        {g?.phase === "bid" && myTurn && !dealing && <div className={s.btns}>
          {[0, 1, 2, 3].filter(n => n === 0 || n > g.bid.cur).map(n => <button key={n} type="button" className={n ? s.bPlay : s.bPass} disabled={busy} onClick={() => void act(() => ddzApi.bid(host!, n), n ? "coin" : "tap")}>{n ? `${n} 分` : "不叫"}</button>)}
        </div>}
        {g?.phase === "play" && myTurn && <div className={s.btns}>
          <button type="button" className={s.bPlay} disabled={!pickedShape || busy} onClick={() => void doPlay()}><i className={s.icoHeart} />出牌{pickedShape ? <em>{pickedShape}</em> : null}</button>
          <button type="button" className={s.bPass} disabled={!g.canPass || busy} onClick={() => void act(() => ddzApi.play(host!, []), "tap").then(() => setSel(new Set()))}><i className={s.icoX} />不要</button>
          <button type="button" className={s.bHint} onClick={() => void doHint()}><i className={s.icoStar} />提示</button>
        </div>}
        {g?.phase === "done" && sitting && <div className={s.btns}>
          <button type="button" className={s.bPlay} onClick={() => void act(() => ddzApi.start(host!), "go")}>再来一局</button>
          <button type="button" className={s.bPass} onClick={() => void act(() => ddzApi.stand(host!), "tap")}>起来</button>
        </div>}
        {/* 打牌时看不到「大家」群 → 左下角一张小纸条：最近几句，点开看更多、能说一句；他们说话时头顶也冒泡 */}
        {chatOpen && <div className={s.chatMask} onClick={() => { setChatOpen(false); snd.sfx("fold"); }} />}
        <div className={`${s.chatNote}${chatOpen ? ` ${s.chatOpen}` : ""}${chatPing ? ` ${s.chatPing}` : ""}`} key={chatOpen ? "o" : "c"} onClick={() => { if (!chatOpen) { setChatOpen(true); snd.sfx("paper"); } }}>
          <b className={s.chatHead}>大家</b>
          <div className={s.chatList} ref={chatRef}>
            {(chatOpen ? chat.slice(-14) : chat.slice(-2)).map(m => <p key={m.id} className={s[`cw_${m.who}`] || ""}><em>{nm(m.who)}</em>{m.text}</p>)}
            {!chat.length && <p className={s.chatEmpty}>还没人说话</p>}
          </div>
          {chatOpen && onSay && <button type="button" className={s.chatSay} onClick={e => { e.stopPropagation(); setChatOpen(false); onSay(); }}>说一句</button>}
        </div>
        {err && <div className={s.err} onClick={() => setErr("")}>{err}</div>}
      </div>
    </div>
  );
}
