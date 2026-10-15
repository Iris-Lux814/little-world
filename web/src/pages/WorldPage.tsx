import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { native } from "../lib/native";
import s from "./WorldPage.module.css";
import { PixelWorld, RARITY_PX } from "../pixel/world";
import { setDollUrl } from "../pixel/doll";
import Hang from "../components/Hang";
import { primaryEndpoint } from "../store/useEndpoints";
import { bridgeUrl, socialApi, worldApi, type WDex, type WEvent, type WFight, type WFish, type WState, type WTrade, type WCabin, type WFarmRes } from "../api/ccBridge";
import { StallShop } from "./StallShop";
import { TankSheet, CabinetSheet, BoardSheet } from "./CabinPage";
import { WorldGear, preloadGear } from "./WorldGear";
import { WorldSeeds } from "./WorldSeeds";
import { WorldBasket } from "./WorldBasket";
import { WorldDdz } from "./WorldDdz";
import { WorldFishCards, CardBox } from "./WorldFishCards";
import { NotesSheet, ChestSheet } from "./CabinExtras";
import { SCENE_NAME, type CabinSpot, type FarmAct, type PelAct, type Scene } from "../pixel/world";
import { TH_FURN, TH_DOOR_X, TH_FLOOR } from "../pixel/treehouse";
import { WorldBook, preloadBook } from "./WorldBook";
import { WorldSettings } from "./WorldSettings";
import { DollPage } from "./DollPage";
import { snd } from "../pixel/sound";
import { WorldBet, BetRibbon, IouCard, useBet, betApi } from "./WorldBet";
import { FarmAnimalCard, animalBubHtml } from "./FarmAnimalCard";
import type { AnimalId } from "../pixel/farmAnimals";
/** 摆家具时顶上写选中的是哪件 */
const FURN_NAME: Record<string, string> = { mid_01: "衣柜", mid_15: "床", mid_16: "床头柜", mid_17: "她画的画", mid_02: "梳妆台", mid_18: "烬椒", mid_20: "地毯", mid_26: "小灯串", mid_27: "照片绳", mid_28: "挂钟", mid_10b: "花藤", mid_03: "贴纸板", mid_30: "小镜子", mid_29: "外套挂钩", mid_06: "纪念品柜", mid_13b: "图鉴柜", mid_13a: "照片墙", mid_12: "书架", attic_12b: "唱片机", attic_11: "收音机", mid_25: "书桌", mid_24: "椅子", mid_14: "小床", mid_21: "地铁图", mid_22: "天气图", mid_23: "温度计", mid_31: "挂历", attic_06: "晾衣绳", attic_10: "星图挂毯", attic_04: "望远镜", attic_07: "旧木箱", attic_05: "萤火虫罐", attic_01: "吊床", attic_02: "吊床", attic_03: "小吊床", attic_09: "枕头堆", attic_14: "邮票册", attic_08: "风车", attic_12a: "鸽笼", mid_07: "写字桌", attic_15: "书架", attic_18: "早晨盒子", ground_18: "小圆桌", ground_10: "地毯", ground_02: "果酱架", ground_15: "锅铲架", ground_19: "小世界地图", ground_13: "布谷钟", ground_16: "柴筐", ground_01: "炉子", ground_09: "钓竿架", ground_06: "茶壶", ground_03: "牌桌", ground_04: "椅子", ground_05: "椅子", ground_17: "沙发", ground_22: "螃蟹玩偶", ground_14: "留声机", ground_08: "伞筒", ground_07: "鞋架", ground_21: "拖鞋", ground_11: "猫窝" };
import { RiverNote, drawRiverNote } from "./RiverNote";
import { BagSheet, ItemFx, WatchTag, ITEM_META } from "./ItemBag";

// 钓鱼小世界：像素俯视（星露谷那种），摇杆 / WASD 走；走到岸边、栈桥上就能钓。
// 画面全在 pixel/world.ts（Canvas 2D），React 只管按钮、表、弹卡、头顶气泡。
// 手机竖着拿：整个舞台转 90° 变横屏（摇杆方向跟着换算）；电脑：WASD / 方向键走，空格或 E 钓鱼，T 说话。
// 拉鱼手感：服务器给参数（张力涨多快 / 抖多凶 / 要收多久 / 鱼体力），前端按参数模拟，拉完报结果。
// 接口给的参数稀有以上拉不上来（要累计收线的时间比鱼的体力还长），这里把松手回落和体力按比例放宽，
// 保证每种鱼都拉得上来、越稀有越难；后端只查"不能太快"，不受影响。
const RARITY = ["普通", "优秀", "稀有", "史诗", "传说"];
type Mode = "walk" | "aim" | "flying" | "wait" | "bite" | "fight" | "busy";
type Card = { ok: true; fish: WFish; sign?: string; first?: boolean; record?: boolean } | { ok: false; text: string; rarity: number; big?: boolean };
// 世界的钟跟后端走（后端时区 WORLD_TZ 可改）：GET /api/world 给 tzOffsetMin（世界时区比 UTC 快几分钟，+8 = 480、+5:30 = 330、纽约夏令时 = -240）就用它；
// 老后端没这个字段就拿 hour / now 推整点；还没拉到之前先用手机本地时间。钟按「UTC 分钟数 + 偏移」取模，半小时时区也不会跳
let worldOffsetMin: number | null = null;
const learnWorldClock = (r: { tzOffsetMin?: number; hour?: number; now?: number }) => {
  if (typeof r.tzOffsetMin === "number" && Number.isFinite(r.tzOffsetMin)) { worldOffsetMin = r.tzOffsetMin; return; }
  if (typeof r.hour === "number" && typeof r.now === "number" && Number.isFinite(r.hour) && Number.isFinite(r.now)) worldOffsetMin = ((((r.hour - new Date(r.now).getUTCHours()) % 24) + 24) % 24) * 60;
};
const hourNow = () => { const d = new Date(); if (worldOffsetMin == null) return d.getHours() + d.getMinutes() / 60; const m = d.getUTCHours() * 60 + d.getUTCMinutes() + worldOffsetMin; return (((m % 1440) + 1440) % 1440) / 60; };
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export default function WorldPage() {
  const nav = useNavigate();
  const ep = primaryEndpoint();
  const hostRef = useRef<HTMLDivElement>(null);
  const W = useRef<PixelWorld | null>(null);
  const [st, setSt] = useState<WState | null>(null);
  const [trial, setTrial] = useState(trialLocal); // 玩家的试玩开关（小屋 / 夜河只对玩家开）
  const applyTrial = (v: boolean) => { try { localStorage.setItem(TRIAL_KEY, v ? "1" : "0"); } catch { /* ignore */ } PixelWorld.cabinReady = CABIN_READY || v; setTrial(v); };
  useEffect(() => { if (typeof st?.trial === "boolean" && st.trial !== trial) applyTrial(st.trial); }, [st?.trial]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setModeS] = useState<Mode>("walk");
  const modeRef = useRef<Mode>("walk"); const setMode = (m: Mode) => { modeRef.current = m; setModeS(m); };
  const [nearWater, setNearWater] = useState(false); const [nearShop, setNearShop] = useState(false); const [nearSign, setNearSign] = useState(false);
  // 第 3 步：玩家在哪个钓点（换钓点 = 按新场景重建画面）；出发时翻一页手账盖住屏幕，翻走时已经到了
  // 在小屋里退出、再进来被放回池塘——钓点后端会记，小屋 / 农场没人记。本机记住最后在哪、站哪，12 小时内回来放回去
  // 上楼 / 下楼按钮有时反——上楼口、下楼口只隔 12 像素，按钮字 0.2 秒才刷新一次，按下去时又重新算一遍玩家站哪，边走边按就跟看到的字不一样。按看到的那个走
  const farmActRef = useRef<FarmAct | null>(null);
  const [scene, setScene] = useState<Scene>(() => lastWhere()?.scene ?? "pond"); const sceneRef = useRef<Scene>(scene); sceneRef.current = scene;
  // 立体书手账：路牌前「出发」= travel，右上角怀表 = view（只看地图）
  const [book, setBook] = useState<null | "travel" | "view">(null); const travelRef = useRef(book); travelRef.current = book;
  const [power, setPower] = useState(0);
  const [fightUi, setFightUi] = useState({ tension: 0.3, stamina: 1, progress: 0, slack: 0 });
  const [card, setCard] = useState<Card | null>(null);
  const [aCard, setACard] = useState<AnimalId | null>(null); const animalLayerRef = useRef<HTMLDivElement>(null); // 农场小动物
  const [toast, setToast] = useState("");
  // 夜河：身边漂过一盏河灯就能捞（钓鱼键变「捞河灯」），捞上来看伙伴甲夹在里面的纸条；早上 5 点散场
  const [nearLamp, setNearLamp] = useState(false); const [rnote, setRnote] = useState<null | { text: string; n: number }>(null); const [dawn, setDawn] = useState<"" | "card" | "curtain" | "lift">("");
  const [sheet, setSheet] = useState<"" | "dex" | "bucket" | "shop" | "gear" | "tank" | "cabinet" | "board" | "buddydex" | "paldex" | "bag" | "notes" | "chest" | "basket" | "wardrobe" | "ddz" | "fish" | "cardbox" | "scope" | "window" | "bet">(() => { const q = new URLSearchParams(location.search).get("sheet"); return q === "ddz" || q === "fish" || q === "scope" || q === "window" ? q : ""; }); // ?sheet=ddz 直接开牌桌（截图自测用）
  const [nearCab, setNearCab] = useState<CabinSpot | null>(null); const [nearCabAll, setNearCabAll] = useState<string[]>([]); const [nearDoor, setNearDoor] = useState(false); const [farmAct, setFarmAct] = useState<FarmAct | null>(null); const [cabin, setCabin] = useState<WCabin | null>(null); const [doorFx, setDoorFx] = useState<"" | "close" | "open">("");
  const spawnRef = useRef<null | { x: number; y: number; dir: 0 | 1 | 2 | 3; saved?: boolean }>((() => { const l = lastWhere(); return l ? { x: l.x, y: l.y, dir: l.dir, saved: true } : null; })());
  const [chat, setChat] = useState("");
  const q = new URLSearchParams(location.search);
  const forceHour = q.get("hour") ? Number(q.get("hour")) : null; const forceWeather = q.get("weather");
  const cast_ = useRef<{ id: string } | null>(null);
  const fight = useRef<{ p: WFight; t0: number; tension: number; progress: number; rng: () => number; wob: number; wobT: number; surge: number; el: number; over: number; clk?: number; slack: number; legend?: boolean } | null>(null);
  const holding = useRef(false);
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const bangRef = useRef<HTMLDivElement | null>(null);
  const noteRef = useRef<HTMLDivElement | null>(null); const chalkRef = useRef<HTMLDivElement | null>(null); // 小屋床头的小纸条「和伙伴甲在一起 N 天」
  const [bubbles, setBubbles] = useState<Record<string, { text: string; at: number }>>({});

  // ── 舞台：竖着拿手机就转 90° ──
  const skyT = useRef(0); useEffect(() => () => clearTimeout(skyT.current), []);
  const [rot, setRot] = useState(false); const [dim, setDim] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const fit = () => { const r = isTouch() && window.innerHeight > window.innerWidth; setRot(r); setDim({ w: r ? window.innerHeight : window.innerWidth, h: r ? window.innerWidth : window.innerHeight }); };
    fit(); window.addEventListener("resize", fit); window.addEventListener("orientationchange", fit);
    // 壳是新版：整个 app 真的转成横屏（系统键盘跟着横）；转完 resize 会触发 fit，rot 自然变 false。出游戏转回来
    void native.setOrientation(true);
    return () => { window.removeEventListener("resize", fit); window.removeEventListener("orientationchange", fit); void native.setOrientation(false); };
  }, []);
  // 按住摇杆 / 按钮久一点会冒出一个透明的放大镜（iOS 选字的放大镜）→ 游戏里不许选字、不弹长按菜单（输入框除外）
  useEffect(() => {
    const field = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input, textarea, [contenteditable]");
    const stop = (e: Event) => { if (!field(e.target)) e.preventDefault(); };
    document.addEventListener("selectstart", stop); document.addEventListener("contextmenu", stop);
    const st = document.body.style as CSSStyleDeclaration & { webkitUserSelect: string; webkitTouchCallout?: string };
    const prev = [st.webkitUserSelect, st.webkitTouchCallout ?? ""];
    st.webkitUserSelect = "none"; st.webkitTouchCallout = "none";
    return () => { document.removeEventListener("selectstart", stop); document.removeEventListener("contextmenu", stop); st.webkitUserSelect = prev[0]; st.webkitTouchCallout = prev[1]; };
  }, []);
  const rotRef = useRef(false); rotRef.current = rot;
  /** 屏幕上的位移 → 舞台里的位移（转了 90° 时 x←y、y←-x） */
  const toStage = (dx: number, dy: number) => (rotRef.current ? { x: dy, y: -dx } : { x: dx, y: dy });

  // ── 像素世界 ──
  useEffect(() => {
    const host = hostRef.current!;
    const w = new PixelWorld(host, { scene,
      onSfx: (name, arg, x, y) => { const m = W.current?.me; const d = m ? Math.hypot(x - m.x, y - m.y) : 0; snd.sfx(name, arg, Math.max(0, 1 - d / 280)); },
      onFrame: pos => {
        // 两个人挨着站时名牌 / 气泡叠在一起（试玩反馈「一直闪」）→ 横着错开；也别顶出屏幕上沿
        const xs: Record<string, number> = {}; for (const w of Object.keys(pos)) xs[w] = pos[w].x;
        // 第二版：只有两个人头上都挂着气泡才横着错开（原来玩家一走近就把他们的气泡挤跑）；人在屏幕外名牌和气泡都不显示（原来被拉回屏幕上沿，试玩反馈不在附近也看得到名字——看位置用小地图）
        const hasBub = (w: string) => !!bubbleRefs.current[w]?.firstElementChild?.className.includes(s.bubble);
        const ws = Object.keys(pos).filter(hasBub);
        for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) { const a = ws[i], b = ws[j]; const dx = xs[b] - xs[a]; if (Math.abs(dx) < 96 && Math.abs(pos[a].y - pos[b].y) < 60) { const push = (96 - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1); xs[a] -= push; xs[b] += push; } }
        const host = hostRef.current; const VW = host?.clientWidth ?? 9999, VH = host?.clientHeight ?? 9999;
        for (const [who, el] of Object.entries(bubbleRefs.current)) { const p = pos[who]; if (!el || !p) continue; const onScreen = p.x > -30 && p.x < VW + 30 && p.y > 8 && p.y < VH + 70; el.style.visibility = onScreen ? "" : "hidden"; if (!onScreen) continue; const y = Math.max(p.y, el.offsetHeight + 6); el.style.transform = `translate(${xs[who]}px, ${y}px) translate(-50%, -100%)`;
          { const sp = el.firstElementChild as HTMLElement | null; if (sp?.className.includes(s.bubble)) { const hw = sp.offsetWidth / 2, rm = y < 220 ? 86 : 12, lm = y < 220 ? 70 : 12; const cx = Math.max(hw + lm, Math.min(VW - hw - rm, xs[who])); const dx = Math.round(cx - xs[who]); sp.style.translate = `${dx}px 0`; sp.style.setProperty("--tail", `${-dx}px`); } } } // 气泡别出屏幕 / 别钻到两边按钮底下（只挪气泡，名牌照旧在人头上；尖角挪回去指着人）
        for (const who of ["buddy", "pal"]) { const el = edgeRefs.current[who]; const p = pos[who]; if (!el) continue; const away = !p || p.x < -5000; const inView = p && p.x > -10 && p.x < VW + 10 && p.y > 0 && p.y < VH + 60;
          if (away || inView) { el.style.opacity = "0"; continue; } const cx = Math.min(VW - 34, Math.max(34, p.x)), cy = Math.min(VH - 40, Math.max(58, p.y + 30)); const ang = Math.atan2(p.y + 30 - cy, p.x - cx);
          el.style.opacity = "1"; el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`; (el.lastElementChild as HTMLElement).style.transform = `rotate(${ang}rad) translateX(24px)`; }
        if (bangRef.current && pos.player) bangRef.current.style.transform = `translate(${pos.player.x}px, ${pos.player.y - 6}px) translate(-50%, -100%)`;
        if (noteRef.current && pos.note) { const p = pos.note; const on = p.x > -60 && p.x < VW + 60 && p.y > -20 && p.y < VH + 20; noteRef.current.style.visibility = on ? "" : "hidden"; if (on) noteRef.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) rotate(-3deg)`; }
        // 农场小动物头顶的小气泡（zz / 嘎 / ? / 哼 / 星星 / !）：按只建一个，换种类就重写（冒出来的动画重播）
        const al = animalLayerRef.current; if (al) { const seen = new Set<string>();
          for (const b of W.current?.animalBubs ?? []) { seen.add(b.id); let el = al.querySelector<HTMLElement>(`[data-a="${b.id}"]`); if (!el) { el = document.createElement("div"); el.dataset.a = b.id; el.className = s.headTag; al.appendChild(el); }
            if (el.dataset.k !== b.kind) { el.dataset.k = b.kind; el.innerHTML = animalBubHtml(b.kind, s.bubble); }
            const on = b.x > -40 && b.x < VW + 40 && b.y > 30 && b.y < VH + 20; el.style.visibility = on ? "" : "hidden"; if (on) el.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -100%)`; }
          for (const el of Array.from(al.children) as HTMLElement[]) if (!seen.has(el.dataset.a ?? "")) el.remove(); }
        if (potHintRef.current && pos.pot) { const p = pos.pot; const on = p.x > -60 && p.x < VW + 60 && p.y > 10 && p.y < VH + 20; potHintRef.current.style.visibility = on ? "" : "hidden"; if (on) potHintRef.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`; }
        if (chalkRef.current && pos.chalk) { const p = pos.chalk; const on = p.x > -60 && p.x < VW + 60 && p.y > -20 && p.y < VH + 20; chalkRef.current.style.visibility = on ? "" : "hidden"; if (on) chalkRef.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`; }
      },
    });
    w.onPotArrive = () => potArriveRef.current(); // 「种菜」按钮走到盆跟前
    w.onAnimalTap = id => setACard(id); // 点农场小动物 → 大图卡片
    w.onPotTap = (who, tile) => potTapRef.current(who, tile); w.onGroundTap = i => groundTapRef.current(i); w.onFarmShake = () => shakeRef.current(); // 种菜
    w.onCabinArrive = id => void cabinDoRef.current(id as CabinSpot); // 点家具自己走过去，到了再用
    W.current = w; Object.assign(window as unknown as Record<string, unknown>, { __pw: w, __wui: { setScene, setCard, setSheet, setSt, push, setMailOpen, cabin: (c: string) => cabinDoRef.current(c as CabinSpot) } }); // 调试用
    w.hour = forceHour ?? hourNow(); if (forceWeather) w.weather = forceWeather;
    const hr = window.setInterval(() => { w.hour = forceHour ?? hourNow(); }, 30000);
    const amb = window.setInterval(() => { snd.setWeather(w.wx.rain, w.wx.wind); snd.setScene(sceneRef.current, w.hour); saveWhere(sceneRef.current, w.me, modeRef.current); }, 2000);
    const near = window.setInterval(() => { if (modeRef.current === "walk") { setNearWater(w.waterDir() !== -1); setNearShop(w.nearShop()); setNearSign(w.nearSign()); setNearLamp(w.nearRLamp() >= 0); setNearCab(w.nearCabin()); { const all = w.nearCabinAll(); setNearCabAll(p => (p.join() === all.join() ? p : all)); } setNearDoor(w.nearCabinDoor()); { const fa = w.farmAct(); farmActRef.current = fa; setFarmAct(fa); } } }, 200);
    if (scene === "cabin" && !cabin) void loadCabin(); // 一进来就在屋里（记住位置）
    placedRef.current = false; // 新场景：等第一次拉状态把玩家放回这个钓点上次站的地方
    if (spawnRef.current?.saved && !w.walkable(spawnRef.current.x, spawnRef.current.y)) spawnRef.current = null; // 记的位置现在走不了（家具挪了）就站门口默认处
    if (spawnRef.current) { const { x, y, dir } = spawnRef.current; Object.assign(w.me, { x, y, dir }); w.cam = { x: w.me.x - w.vw / 2, y: w.me.y - w.vh / 2 }; spawnRef.current = null; placedRef.current = true; } // 进屋 / 出门：站在门口
    if (scene === "cabin" && cabin) w.setTank(cabin.tank.map(f => f.species));
    return () => { clearInterval(hr); clearInterval(near); clearInterval(amb); w.destroy(); W.current = null; };
  }, [scene, trial]); // eslint-disable-line react-hooks/exhaustive-deps —— trial 变了重画一遍（池塘边的小屋要出现 / 消失）

  const edgeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [setOpen, setSetOpen] = useState(false); // 设置页
  const [dollOpen, setDollOpen] = useState(false); // 我的小人
  // 点过屏幕声音还是没起来（iOS 的 AudioContext 坏了）→ 冒一个「没声音？点一下」，点了整套重建
  const [mute, setMute] = useState(false);
  useEffect(() => { const t = window.setInterval(() => setMute(snd.touched && !snd.ok), 1500); return () => clearInterval(t); }, []);
  useEffect(() => {
    preloadBook(); preloadGear();
    const un = (e: Event) => snd.unlock(e); const tap = (e: MouseEvent) => { if ((e.target as HTMLElement).closest?.("button")) snd.sfx("tap"); };
    const evs = ["pointerdown", "touchend", "click", "keydown"]; // iOS 要在 touchend / click 里才算用户手势
    for (const e of evs) document.addEventListener(e, un, true); document.addEventListener("click", tap, true);
    return () => { for (const e of evs) document.removeEventListener(e, un, true); document.removeEventListener("click", tap, true); snd.pause(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 电脑键盘 ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") { if (e.key === "Escape") setMailOpen(false); return; }
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { W.current?.keys.add(k); e.preventDefault(); return; }
      if ((k === " " || k === "e") && !e.repeat) { e.preventDefault(); bigDown(0); return; }
      if (k === "t" && modeRef.current === "walk") { e.preventDefault(); openMail(true); return; }
      if (k === "escape") { setSheet(""); setCard(null); setMailOpen(false); setACard(null); }
    };
    const up = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); W.current?.keys.delete(k); if (k === " " || k === "e") bigUp(); };
    const blur = () => W.current?.keys.clear();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  });

  // ── 世界状态轮询（2 秒；等咬钩时 0.45 秒）──
  const lastEv = useRef(0); const placedRef = useRef(false);
  useEffect(() => {
    if (!ep) return; let alive = true; let timer = 0;
    const tick = async () => {
      try {
        // 玩家退出再进来要站回原地：第一次拉状态先不报位置（不然拿初始位置把存着的盖掉），拿到上次的位置放回去再开始报
        // 小屋 / 农场里也报位置（sc=cabin|farm，后端存进 meScene：截图画玩家、退出再进来回原处）+ 正在用哪件家具（use）；还没放回原处之前什么都不报，免得把存着的冲掉
        const sc0 = sceneRef.current === "cabin" || sceneRef.current === "farm" ? sceneRef.current : undefined;
        const me0 = placedRef.current ? W.current?.me : undefined; const r = await worldApi.state(ep, me0 ? { x: me0.x, y: me0.y, dir: me0.dir } : undefined, placedRef.current ? sc0 : undefined, sc0 === "cabin" ? me0?.cact?.spot : undefined); if (!alive) return;
        { const ms = r.meScene; if (!placedRef.current && !travelRef.current && sceneRef.current === "pond" && ms && (ms.scene === "cabin" || ms.scene === "farm") && ms.x != null && ms.y != null && Date.now() - ms.at < 12 * 3600e3 && (ms.scene !== "cabin" || CABIN_READY || trialLocal())) { spawnRef.current = { x: ms.x, y: ms.y, dir: ((ms.dir ?? 0) | 0) as 0 | 1 | 2 | 3, saved: true }; setScene(ms.scene as Scene); timer = window.setTimeout(tick, 600); return; } } // 本机没记、后端记着玩家在小屋 / 农场：换过去（换手机也能回原处）
        const mySpot = (r.players.find(p => p.id === "player")?.spot || "pond") as Scene; if (!travelRef.current && sceneRef.current !== "cabin" && sceneRef.current !== "farm" && mySpot !== sceneRef.current && SCENE_NAME[mySpot]) setScene(mySpot); // 玩家上次在别的钓点：切过去（不能 return，return 了轮询就停了）
        if (!placedRef.current && W.current) { const mp = r.mePos; const w0 = W.current; if (mp && (mp.spot ?? "pond") === sceneRef.current && w0.walkable(mp.x, mp.y) && modeRef.current === "walk") { w0.me.x = mp.x; w0.me.y = mp.y; w0.me.dir = (mp.dir as 0 | 1 | 2 | 3) ?? w0.me.dir; } placedRef.current = true; } setSt(r); learnWorldClock(r); if (!forceWeather && W.current) W.current.weather = r.weather;
        // 开放世界：伙伴的位置和动作以服务器为准
        if (r.wallet && W.current) { W.current.bobSkin = r.wallet.gear.bobber; W.current.rodSkin = r.wallet.gear.rod; }
        // 开源版：每个人用自己上传的小人图（state 里 sprite = /api/world/sprite/<pid>?v=…，没有就是 null → 自带的通用小人）
        for (const p of r.players) { const u = p.sprite ? bridgeUrl(ep, p.sprite) : null; setDollUrl(p.id, u); if (W.current) void W.current.setSprite(p.id, u); }
        if (r.ai && W.current) { const skew = r.now - Date.now(); for (const who of ["buddy", "pal"] as const) if (r.ai[who]) W.current.syncAi(who, r.ai[who], skew); }
        const mm = modeRef.current; const w = W.current;
        if ((mm === "wait" || mm === "bite") && r.me && cast_.current && r.me.castId === cast_.current.id) {
          if (r.me.phase === "bite" && mm === "wait") { setMode("bite"); w?.setBite(true); snd.vibe([60, 40, 60]); }
          if (r.me.phase === "missed") { w?.clearBobber(); setMode("walk"); flash("慢了一步，鱼跑了"); }
        }
        // 池塘动静进信箱；新的飘弹幕
        const fishEv = r.events.filter(e => (e.type === "catch" || e.type === "show" || e.type === "gift") && e.item && Date.now() - e.at < 6 * 3600e3)
          .map(e => ({ id: `e${e.at}${e.type}${e.who}`, at: e.at, who: e.who, kind: "fish" as const, text: evText(e), rarity: e.item?.rarity, species: e.item?.species, fresh: e.at > lastEv.current }));
        push(fishEv.filter(x => !x.fresh), false); push(fishEv.filter(x => x.fresh), true);
        // 伙伴刚钓到：头顶举条鱼 + 一句
        for (const e of r.events) { if (e.at <= lastEv.current) continue; if ((e.who === "buddy" || e.who === "pal") && (e.type === "catch" || e.type === "show") && e.item && Date.now() - e.at < 60000) { w?.celebrate(e.who, e.item.rarity, e.item.species); const a = w?.ai[e.who as "buddy" | "pal"]; snd.sfx("far", 0, a && a.x > -5000 ? Math.max(0.15, 1 - Math.hypot(a.x - w!.me.x, a.y - w!.me.y) / 400) : 0.12); say(e.who, `${e.type === "show" ? "看！" : "钓到了"}${e.item.name} ${e.item.kg}kg`); } }
        if (r.events.length) lastEv.current = Math.max(lastEv.current, r.events[r.events.length - 1].at);
      } catch { /* 下一轮 */ }
      if (alive) timer = window.setTimeout(tick, modeRef.current === "wait" || modeRef.current === "bite" ? 450 : 2000);
    };
    lastEv.current = Date.now() - 5000; void tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [ep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 群聊 + 池塘动静：头顶冒气泡、上方飘弹幕、信箱里留历史（试玩反馈气泡一闪就没，地图大了根本不知道谁说话）──
  // 同一句还挂着就不重冒（重冒会从头放一遍弹出动画，看着像在闪）
  const say = (who: string, text: string) => { if (who !== "player") snd.sfx("pop", 0, 0.8); sayRaw(who, text); };
  const sayRaw = (who: string, text: string) => setBubbles(b => (b[who]?.text === text ? b : { ...b, [who]: { text, at: Date.now() } }));
  const [log, setLog] = useState<LogItem[]>([]);
  const [dms, setDms] = useState<Danmu[]>([]);
  const [unread, setUnread] = useState(0);
  const [mailOpen, setMailOpen] = useState(false); const mailRef = useRef(false); mailRef.current = mailOpen;
  const seen = useRef(new Set<string>());
  const lanes = useRef([0, 0, 0]);
  const push = (items: LogItem[], live: boolean) => {
    const fresh = items.filter(i => !seen.current.has(i.id)); if (!fresh.length) return; fresh.forEach(i => seen.current.add(i.id));
    setLog(l => [...l, ...fresh].sort((a, b) => a.at - b.at).slice(-120));
    if (!live) return;
    if (!mailRef.current) setUnread(u => u + fresh.filter(i => i.who !== "player").length);
    for (const i of fresh) {
      if (i.kind === "say") continue; // 说的话头顶已经冒气泡了，不再飘一遍弹幕（试玩反馈上面一直闪）；信箱里照样有
      const lane = lanes.current.indexOf(Math.min(...lanes.current)); lanes.current[lane] = Date.now();
      setDms(d => [...d.slice(-8), { ...i, lane }]);
    }
  };
  useEffect(() => {
    if (!ep) return; let alive = true; let since = Date.now() - 6 * 3600e3; let first = true;
    const tick = async () => {
      try {
        const { messages } = await socialApi.messages(ep, "group", since, first ? 40 : 20); if (!alive) return;
        const items: LogItem[] = [];
        for (const m of messages) {
          since = Math.max(since, m.at); items.push({ id: m.id, at: m.at, who: m.from, kind: "say", text: m.text });
          // 自己刚发的那条已经冒过气泡了，轮询回来别再冒一次（原来会闪一下）
          // 网卡时第一次轮询失败，下一次成功的被当成「刚进来」，他们刚回的话就不冒气泡（试玩截图：信箱里回了，头上没有）。
          // 刚进来那次也冒：90 秒内他们说的话照样冒
          if (m.from !== "player" ? (!first || Date.now() - m.at < 90000) : (!first && Date.now() - myLast.current >= 15000)) say(m.from, m.text);
        }
        push(items, !first); first = false;
      } catch { /* ignore */ }
    };
    void tick(); const t = window.setInterval(tick, 3000);
    // 气泡按字数留 9～20 秒
    const clear = window.setInterval(() => setBubbles(b => { const n = { ...b }; let ch = false; for (const k of Object.keys(n)) if (Date.now() - n[k].at > Math.min(20000, 9000 + n[k].text.length * 220)) { delete n[k]; ch = true; } return ch ? n : b; }), 1000);
    return () => { alive = false; clearInterval(t); clearInterval(clear); };
  }, [ep]); // eslint-disable-line react-hooks/exhaustive-deps
  const myLast = useRef(0);
  const evText = (e: WEvent) => {
    const it = e.item ? `${e.item.name} ${e.item.kg}kg` : e.name ?? "";
    return e.type === "catch" ? `钓到了 ${it}${e.first ? "（图鉴第一次！）" : e.record ? "（破纪录！）" : ""}` : e.type === "show" ? `举起了 ${it} 在炫耀` : e.type === "gift" ? `把 ${it} 送给了${nm(e.to || "")}` : "";
  };

  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast(""), 2200); };

  // ── 甩竿 / 提竿 / 拉鱼 ──
  // 第三轮：试玩反馈落点只能前后、而且不是自己控制的（原来力度自动来回摆）。改成猛兽派对那种：
  // 按住钓鱼键 → 水面上冒一个粉色落点圈；按着不放往哪拖，圈就往哪走（左右前后都行，离人越远甩得越远）；左手摇杆也能推圈；松手就甩到圈那儿
  const holdStart = useRef<number | null>(null); const dragLast = useRef<{ x: number; y: number } | null>(null);
  const applyCabin = (r: WCabin) => { setCabin(r); const w = W.current; if (!w) return; w.setTank(r.tank.map(f => f.species)); w.setDecor(r.decor ?? {}); w.thNotes = r.notes?.length ?? 0; applyGuests(r.guests ?? []); };
  // 客房：这台手机上没见过的朋友 → 演一遍树枝长出来、花球开
  const applyGuests = (gs: NonNullable<WCabin["guests"]>) => {
    const w = W.current; if (!w) return; let seen: string[] = []; try { seen = JSON.parse(localStorage.getItem("lw.guestSeen") || "[]"); } catch { /* 没存过 */ }
    const fresh = new Set(gs.map(g => g.id).filter(id => !seen.includes(id))); w.setGuests(gs, fresh);
    if (fresh.size) try { localStorage.setItem("lw.guestSeen", JSON.stringify([...seen, ...fresh])); } catch { /* 存不了下次再演一遍 */ }
  };
  const loadCabin = async () => { if (!ep) return null; void loadLayout(); try { const r = await worldApi.cabin(ep); applyCabin(r); return r; } catch { return null; } };
  // 自由摆家具。摆的时候不拿服务器的（免得拖到一半被刷回去）
  const [editing, setEditing] = useState(false); const editingRef = useRef(false); const [editSaving, setEditSaving] = useState(false); const [editSel, setEditSel] = useState<string | null>(null); const [editFold, setEditFold] = useState(false); const [editSize, setEditSize] = useState(1);
  const loadLayout = async () => { if (!ep || editingRef.current) return; try { const r = await worldApi.cabinLayout(ep); if (!editingRef.current) W.current?.setLayout(r.layout ?? {}); } catch { /* 拿不到就用默认摆法 */ } };
  const editPtr = useRef<{ id: number; x: number; y: number } | null>(null);
  const toWorld = (w: PixelWorld, ox: number, oy: number) => { const k = (window.devicePixelRatio || 1) / w.scale; return { x: w.cam.x + ox * k, y: w.cam.y + oy * k }; };
  const editBegin = () => { const w = W.current; if (!w || w.scene !== "cabin") return; snd.sfx("pop"); setMode("walk"); w.editStart(); editingRef.current = true; setEditing(true); setEditSel(null); };
  const editSz = (m: number) => { const v = W.current?.editScale(m); if (v != null) setEditSize(v); };
  const editFinish = async (save: boolean) => {
    const w = W.current; if (!w) return; const moves = w.editEnd(save); editingRef.current = false; setEditing(false); snd.sfx(save ? "clasp" : "pop");
    if (!save || !ep || !Object.keys(moves).length) return;
    setEditSaving(true);
    try { const r = await worldApi.cabinLayoutSave(ep, { moves }); w.setLayout(r.layout ?? {}); flash("摆好了，伙伴进来看到的也是这样"); }
    catch { flash("没存上，网不好，等一下再摆一次"); void loadLayout(); }
    setEditSaving(false);
  };
  const editReset = async () => {
    const w = W.current; if (!w || !ep) return; if (!window.confirm("所有家具放回一开始的位置？")) return;
    w.editEnd(false); editingRef.current = false; setEditing(false);
    try { await worldApi.cabinLayoutSave(ep, { reset: true }); w.setLayout({}); snd.sfx("boing"); flash("都放回原位了"); } catch { flash("没放回去，等一下再试"); }
  };
  /** 木门合上 → 换场景 → 再打开 */
  const goDoor = (to: "farm" | "cabin") => {
    if (doorFx) return; setDoorFx("close"); snd.sfx("creak"); lockUntil.current = Date.now() + 1400;
    window.setTimeout(() => { spawnRef.current = to === "cabin" ? { x: TH_DOOR_X - 20, y: TH_FLOOR[2].y, dir: 1 } /* 树洞小屋：进门站在一楼门口（加宽后门挪了，跟着 TH_DOOR_X） */ : { x: 538, y: 764, dir: 0 }; /* 小屋搬进农场：出门站在树屋门廊上 */ setScene(to); setMode("walk"); if (to === "cabin") void loadCabin(); snd.sfx("clasp"); setDoorFx("open"); }, 460);
    window.setTimeout(() => setDoorFx(""), 1100);
  };
  const [bet, , betRun] = useBet(ep, sheet === "bet"); const [iouOpen, setIouOpen] = useState<string | null>(null); // 打赌欠条
  useEffect(() => { W.current?.setIous(bet?.ious ?? []); }, [bet, scene]);
  // 结算了而玩家没开着那张纸：自动弹开一次给玩家看结果（同一局只弹一次，记在本机）
  useEffect(() => { const b = bet?.bet; if (!b || b.phase !== "done") return; let seen = ""; try { seen = localStorage.getItem("lw.bet.seen") || ""; } catch { /* ignore */ } if (seen === b.id || Date.now() - b.endAt > 6 * 3600e3) return;
    if (sheet !== "" && sheet !== "bet") return; // 别的面板开着：等它关了再弹（sheet 变了这里会再跑）
    try { localStorage.setItem("lw.bet.seen", b.id); } catch { /* ignore */ } if (sheet === "bet") return; snd.sfx(b.result?.winner === "player" ? "arrive" : "paper"); setSheet("bet"); }, [bet?.bet?.id, bet?.bet?.phase, sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  const cabinDoRef = useRef<(c: CabinSpot) => Promise<void>>(async () => {});
  const cabinDo = async (c: CabinSpot) => {
    const w = W.current; if (!w) return;
    if (c === "door") { w.thTap.door = w.t; goDoor("farm"); return; } // 门先开一条缝再换场景
    clearTimeout(skyT.current); // 点了别的家具，之前望远镜 / 圆窗那个「0.9 秒后推进去」作废
    w.cabinPoke(c); lockUntil.current = Date.now() + 500;
    if (c === "table") { setSheet("cardbox"); return; } // 牌桌先弹牌盒挑斗地主 / 鱼桶牌 // 牌桌 = 斗地主
    // 好多家具没动作 → 有玩家动作图的家具一律先做动作（循环，再点一次 / 推摇杆停），台词、面板照旧
    const acted = w.cabinAct("player", c); if (acted && !w.me.cact) return; // 再点一次 = 停下来
    // 望远镜 = 真实星空、圆窗 = 此刻真实的天：先做凑上去 / 扶窗台的动作，0.9 秒后画面推进去
    // 0.9 秒内又点了一下停下、或者推摇杆走开了，就别再推进去（定时器存着，开之前看玩家是不是还在用这件家具）
    // 开源版没有天象页：望远镜 / 窗外只冒一句台词（下面 lines 里）
    if (c === "bed" && acted) { flash(pickLine(["美乐蒂被挤到一边去了。", "被子是晒过的味道。", "坐在床边晃晃腿。"])); return; }
    if (c === "hammock" && acted) { flash(pickLine(["吊床晃呀晃。", "躺一会儿……就一会儿。"])); return; }
    if (!acted && (c === "bed" || c === "hammock")) { if (w.sittingOf("player")) { w.sit("player", false); return; } w.sit("player"); flash(pickLine(c === "bed" ? ["美乐蒂被挤到一边去了。", "被子是晒过的味道。", "躺一会儿……就一会儿。"] : ["吊床晃啊晃。", "从这儿能看见圆窗外面。", "晃着晃着有点困了。"])); return; }
    const LINE: Record<string, string[]> = {
      telescope: ["望远镜里：月亮今天有点胖。", "看见伞树农场的花在夜里还开着。", "镜头里一只萤火虫飞过去，吓一跳。"], jar: ["罐子里的萤火虫一闪一闪。", "敲一下罐子，它们一起亮了。"],
      window: ["圆窗外面是真的天。", "枕头堆软得能陷进去。"], pinwheel: ["风车呼呼转起来。", "吹一口气，它就转。"], hammock2: ["小吊床，叠得整整齐齐。", "吊床里掉出来一张邮票。"],
      record: ["唱片机咯吱咯吱转起来。", "老唱片，有点跑调。"], wardrobe: ["衣柜门吱呀一下开了。换装明天就做好，先别急。", "衣柜里挂着好多空衣架，等着新衣服。"],
      mirror: ["镜子里冒出一颗星星。", "照一照……今天也很可爱。"], books: ["书架上抽出一本《鱼的一百种表情》。", "书里夹着一片干花。"],
      buddybed: ["枕头上有个猫形的坑（鳞片睡过）。", "被子没叠。"], stove: ["锅里咕嘟咕嘟。", "炉子里的柴噼啪响了一下。", "汤还没好，再等等。"],
      rods: ["钓竿架上挂着三根竿。", "摸了一下自己那根竿，线还是湿的。"], table: ["牌桌。以后在这儿打牌——三把椅子正好。", "桌上的绣球是今天刚摘的。"],
      cat: ["猫窝还是暖的，鳞片刚走。", "猫窝里有一根小鱼干。"], gramo: ["留声机转起来了。", "咔哒一声，换了一张。"], shoes: ["鞋架上一排鞋，一人一双。", "谁在屋里，谁的鞋就在这儿。"], clock: ["布谷！", "挂钟走的是真的时间。"],
    };
    if (LINE[c]) { flash(pickLine(LINE[c])); return; }
    snd.sfx("tap"); const r = cabin ?? await loadCabin(); if (!r) { flash("小屋的门卡住了，等一下再试"); return; }
    if (c === "dex") { setSheet("dex"); return; }
    setSheet(c === "buddy" ? "buddydex" : c === "pal" ? "paldex" : (c as "tank" | "cabinet" | "board" | "notes" | "chest")); void loadCabin();
  };
  const placeDo = async (slot: string, item: string | null) => {
    if (!ep || busyTrade) return; setBusyTrade(true);
    try { const r = await worldApi.place(ep, slot, item); applyCabin(r.cabin); if (r.text) flash(r.text); } catch (e) { flash((e as Error).message || "没摆上"); } finally { setBusyTrade(false); }
  };
  const noteDo = async (text: string) => {
    if (!ep || busyTrade) return false; setBusyTrade(true);
    try { const r = await worldApi.note(ep, text); applyCabin(r.cabin); W.current?.cabinPoke("notes"); return true; } catch (e) { flash((e as Error).message || "没挂上"); return false; } finally { setBusyTrade(false); }
  };
  const tankDo = async (action: "put" | "take", id: string) => {
    if (!ep || busyTrade) return; setBusyTrade(true);
    try { const r = await worldApi.tank(ep, action, id); applyCabin(r.cabin); if (r.text) flash(r.text); try { setSt(await worldApi.state(ep)); } catch { /* ignore */ } }
    catch (e) { flash((e as Error).message || "没成"); } finally { setBusyTrade(false); }
  };
  const bigDown = (x: number, y = 0) => {
    const w = W.current; const m = modeRef.current; if (!w) return;
    if (m === "walk" && Date.now() < lockUntil.current) return;
    if (m === "walk" && w.scene === "cabin") { const a = farmActRef.current ?? w.farmAct(); if (a) { w.farmDo(a); lockUntil.current = Date.now() + 600; return; } const c = w.nearCabin(); if (c) void cabinDo(c); return; } // 屋里没有水，大按钮只管楼梯和屋里的东西
    if (m === "walk" && w.nearCabinDoor()) { goDoor("cabin"); return; } // 树洞小屋开门
    if (m === "walk" && w.scene === "farm") { const a = w.farmAct(); if (a) { w.farmDo(a); lockUntil.current = Date.now() + 600; return; } } // 吊篮 / 楼梯 / 梯子：站到跟前按大按钮
    if (m === "walk" && w.nearShop() && w.waterDir() === -1) { setSheet("shop"); return; }
    if (m === "walk" && w.nearSign() && w.waterDir() === -1) { setBook("travel"); return; }
    if (m === "walk") { const li = w.nearRLamp(); if (li >= 0) { if (w.scoopLamp(li)) { lockUntil.current = Date.now() + 1500; window.setTimeout(() => setRnote(drawRiverNote()), 720); } return; } } // 夜河：捞河灯 // 路牌跟前：钓鱼键变「出发」 // 站在秤砣跟前：钓鱼键变「找秤砣」
    if (m === "walk" && w.waterDir() !== -1) {
      w.setAim(true); setMode("aim"); holdStart.current = performance.now(); dragLast.current = { x, y }; setPower(w.aimPower()); return;
    }
    if (m === "wait" || m === "bite") { void hook(); return; }
    if (m === "fight") holding.current = true;
  };
  const bigMove = (x: number, y: number) => {
    const w = W.current; if (!w || modeRef.current !== "aim" || !dragLast.current) return;
    const d = toStage(x - dragLast.current.x, y - dragLast.current.y); dragLast.current = { x, y };
    w.moveAimCss(d.x * 1.6, d.y * 1.6); setPower(w.aimPower());
  };
  const bigUp = () => {
    if (modeRef.current === "aim" && holdStart.current != null) { holdStart.current = null; dragLast.current = null; const w = W.current; if (w) void cast(Math.max(0.08, w.aimPower())); return; }
    holding.current = false;
  };
  // 咬钩：服务器在甩竿时告诉还有多久咬（biteIn），前端本地准点冒「！」、震一下；咬了 biteMs 没提竿就算跑了。
  // 原来靠 0.45 秒轮询发现咬钩，隧道一慢，「！」冒出来时窗口已经过了一大半（试玩反馈"只是一瞬间"）
  const biteT = useRef<number[]>([]);
  const clearBiteT = () => { biteT.current.forEach(t => clearTimeout(t)); biteT.current = []; };
  const lockUntil = useRef(0); // 刚跑了一条鱼，手指还按着，别马上又开始蓄力
  const cast = async (pw: number) => {
    const w = W.current; if (!ep || !w) return; setMode("flying"); clearBiteT();
    const to = w.aimTarget(); if (!to) { w.setAim(false); w.me.rod = false; setMode("walk"); flash("圈要拖到水上才能甩"); return; } w.castTo(to);
    try {
      let r: Awaited<ReturnType<typeof worldApi.cast>>;
      try { r = await worldApi.cast(ep, pw, 0); } catch (e) { if ((e as { status?: number }).status) throw e; flash("网有点卡，再甩一下……"); r = await worldApi.cast(ep, pw, 0); }
      cast_.current = { id: r.castId };
      window.setTimeout(() => { if (modeRef.current === "flying") setMode("wait"); }, 650);
      if (r.biteIn != null) {
        const id = r.castId; const live = () => cast_.current?.id === id;
        biteT.current.push(window.setTimeout(() => { if (live() && (modeRef.current === "wait" || modeRef.current === "flying")) { setMode("bite"); W.current?.setBite(true); snd.vibe([60, 40, 60]); } }, Math.max(700, r.biteIn)));
        biteT.current.push(window.setTimeout(() => { if (live() && modeRef.current === "bite") { W.current?.clearBobber(); setMode("walk"); lockUntil.current = Date.now() + 900; flash("慢了一步，鱼跑了"); } }, Math.max(700, r.biteIn) + (r.biteMs ?? 4000)));
      }
    } catch (e) { w.clearBobber(); setMode("walk"); flash((e as Error).message || "甩竿没成"); }
  };
  const hook = async () => { snd.sfx("hook");
    const w = W.current; if (!ep || !cast_.current || !w) return; const was = modeRef.current; setMode("busy"); w.setBite(false); clearBiteT();
    const id = cast_.current.id;
    // 网不好时 6 秒没回再试一次；两次都不行就收竿，别让按钮卡在「…」（玩家第二竿遇到过 Load failed）
    let r: Awaited<ReturnType<typeof worldApi.hook>> | null = null; let err: unknown = null;
    for (let i = 0; i < 2 && !r; i++) { try { r = await worldApi.hook(ep, id); } catch (e) { err = e; if ((e as { status?: number }).status) break; } }
    if (!r) { w.clearBobber(); setMode("walk"); lockUntil.current = Date.now() + 900; flash(`网断了一下，这竿没提上来${err && (err as { status?: number }).status ? "" : "（再甩一竿）"}`); return; }
    if (r.result !== "hooked" || !r.fight) { w.clearBobber(); setMode("walk"); lockUntil.current = Date.now() + 900; flash(r.result === "early" ? (was === "wait" ? "提早了，鱼吓跑了" : "提早了") : "慢了一步，鱼跑了"); return; }
    startFight(r.fight, r.hint);
  };
  const startFight = (p: WFight, hint?: { rarity: number; big: boolean }) => {
    fight.current = { p, t0: performance.now(), tension: 0.3, progress: 0, rng: mulberry(p.seed), wob: 0, wobT: 0, surge: 0, el: 0, over: 0, clk: 0, slack: 0, legend: !!p.legend };
    setMode("fight"); if (hint && hint.rarity >= 2) flash(hint.big ? "好沉！是条大的——" : `上钩了！感觉是${RARITY[hint.rarity]}的`);
    // 放宽：松手回落至少跟收线一样快、体力至少够累计收线 2.2 倍的时间
    const recover = Math.max(p.recover, p.pull * 1.05); const cap = p.cap ?? 1; /* 线轴越好线越结实（超过 cap 才断） */
    // 大鱼「拉几下就说跑了，拉久了又超出范围」——以前鱼的力气按时间一直掉，按住和松开差不多各占一半，大鱼要 2 倍收线时间、只给 2.2 倍，
    // 再碰上猛冲就只能松手，基本拉不上来。现在：鱼跑掉只看「线松了太久」（连续 SLACK 秒几乎没劲），收着就不会跑；总时间给很宽的兜底。
    // 断线：超线了还按着、连续 0.6 秒才断（松手就保住）；猛冲小一点。模拟过：反应 0.35 秒的人大鱼基本都能拉上，手慢的会断一些。
    const SLACK = 3.2, hardLimit = Math.max(p.staminaMs * 2.5, p.reelMs * 4 + 6000);
    let last = performance.now(); let uiT = 0;
    const step = () => {
      const f = fight.current; if (!f || modeRef.current !== "fight") return;
      // 网卡 / 手机卡一下时，松手事件会晚到，张力一下冲过头就断线（玩家拉半天稀有鱼没了）。
      // 现在：卡顿超过 0.15 秒的那一帧不算（整局暂停一下）；张力要连续 0.35 秒超线才断；鱼的力气按游戏时间扣，不按墙上时间
      const now = performance.now(); const gap = (now - last) / 1000; last = now; if (gap > 0.15) { requestAnimationFrame(step); return; } const dt = Math.min(0.05, gap); f.el += dt;
      // 鱼挣扎：每 0.3 秒换一个抖动目标；偶尔猛冲一下
      f.wobT -= dt; if (f.wobT <= 0) { f.wobT = 0.3; f.wob = (f.rng() * 2 - 1) * p.jitter; if (f.rng() < 0.06 + p.jitter * 0.3) f.surge = p.jitter * 1.6; }
      f.surge = Math.max(0, f.surge - dt * 1.5);
      if (holding.current) { f.tension += p.pull * dt; f.progress += dt * 1000; f.clk = (f.clk ?? 0) + dt; if (f.clk > 0.11 - Math.min(0.06, f.tension * 0.05)) { f.clk = 0; snd.sfx("reel", Math.min(1, f.tension / cap)); } } else f.tension = Math.max(0, f.tension - recover * dt);
      const eff = f.tension + f.wob * 0.6 + f.surge;
      f.slack = eff < 0.15 && !holding.current ? f.slack + dt : Math.max(0, f.slack - dt * 2);
      const left = 1 - Math.min(1, f.progress / p.reelMs) * 0.9; // 鱼的力气：收得越多越没劲
      W.current?.setFight(f.progress / p.reelMs, Math.max(0, eff));
      uiT += dt; if (uiT > 0.033) { uiT = 0; setFightUi({ tension: Math.max(0, eff / cap), stamina: Math.max(0, left), progress: Math.min(1, f.progress / p.reelMs), slack: f.slack / SLACK }); }
      f.over = eff > cap && holding.current ? f.over + dt : Math.max(0, f.over - dt * 2); // 猛冲冲过线时松手就不会断：只有超线了还按着才算
      if (f.over > 0.6) { void finish("snapped"); return; }
      if (f.progress >= p.reelMs) { void finish("landed"); return; }
      if (f.slack >= SLACK || f.el * 1000 > hardLimit) { void finish("escaped"); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  // ── 传说鱼一起拉──
  // 夜河之主浮上来（st.legend.phase=calling）：顶上一张卡写谁到了、还剩几分钟；玩家在夜河就能「开拉」。
  // 开拉：甩竿到水里 → 跟平时一样拉（参数后端给，没到齐更难）；拉的时候每秒问一次后端有没有人喊，伙伴喊「加油」松一截张力、「放线」松得多但鱼往远跑一截。
  // 结果报 /legend/land：拉上来名字一起上纪录板；没拉上留一片鳞（「差一点」），下次更好拉。
  const legendSince = useRef(0);
  const [cheerPop, setCheerPop] = useState<{ who: string; line: string; k: number } | null>(null);
  const lg = st?.legend ?? null;
  const [, setLgTick] = useState(0);
  useEffect(() => { if (lg?.phase !== "calling") return; const id = window.setInterval(() => setLgTick(x => x + 1), 1000); return () => clearInterval(id); }, [lg?.phase]);
  const startLegend = async () => {
    const w = W.current; if (!ep || !w || modeRef.current !== "walk") return;
    if (scene !== "river") { flash("夜河之主在夜河，先去夜河"); return; }
    let r: Awaited<ReturnType<typeof worldApi.legendStart>>;
    try { r = await worldApi.legendStart(ep); } catch (e) { flash((e as Error).message || "没开成"); return; }
    w.setAim(true); const to = w.aimTarget(); if (!to) { w.setAim(false); flash("走到水边再开拉"); return; }
    w.castTo(to); setMode("busy"); legendSince.current = Date.now() - 1000; snd.sfx("cast");
    window.setTimeout(() => { startFight(r.fight, { rarity: 4, big: true }); flash(r.fight.missing ? `开拉！还有 ${r.fight.missing} 个人没赶到，会更难` : "开拉！大家都在"); }, 750);
  };
  // 拉的时候：每秒问一次谁喊了
  useEffect(() => {
    if (mode !== "fight" || !fight.current?.legend || !ep) return;
    let dead = false;
    const id = window.setInterval(async () => {
      try {
        const r = await worldApi.legend(ep, legendSince.current); if (dead) return;
        for (const c of r.cheers) {
          legendSince.current = Math.max(legendSince.current, c.at);
          const f = fight.current; const eff = f?.p.cheer?.[c.kind]; if (!f || !eff) continue;
          f.tension = Math.max(0, f.tension + eff.tension); // 加油 -0.12 / 放线 -0.3
          if (eff.staminaMs) f.progress = Math.max(0, f.progress - 900); // 放线：鱼往远跑一截
          say(c.who, c.line); setCheerPop({ who: c.who, line: c.line, k: c.at }); snd.sfx("chime", 2);
        }
      } catch { /* 下一秒再问 */ }
    }, 1000);
    return () => { dead = true; clearInterval(id); };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const legendFinish = async (result: "landed" | "snapped" | "escaped") => {
    const w = W.current; if (!ep) return; setMode("busy"); holding.current = false;
    let r: Awaited<ReturnType<typeof worldApi.legendLand>> | null = null;
    for (let i = 0; i < 4 && !r; i++) { try { r = await worldApi.legendLand(ep, result === "landed" ? "landed" : "escaped"); } catch { await new Promise(x => window.setTimeout(x, 1200 + i * 1200)); } }
    w?.clearBobber(result); fight.current = null; setMode("walk"); setFightUi({ tension: 0.3, stamina: 1, progress: 0, slack: 0 });
    if (!r) { flash("网断了，结果没报上去"); return; }
    const who = (r.names ?? []).filter(n => n !== "player").map(nm).join("、");
    if (r.result === "won") { snd.sfx("catch", 4); snd.sfx("first"); w?.celebrate("player", 4, "river_lord"); snd.vibe(120); setCard({ ok: false, text: `拉上来了！${lg?.name ?? "夜河之主"} ${lg?.kg ?? ""}kg${who ? `，和${who}的名字一起上了纪录板` : ""}`, rarity: 4, big: true }); }
    else { snd.sfx(result === "snapped" ? "snap" : "escape"); setCard({ ok: false, text: `差一点……它沉下去了，留下一片鳞（下次更好拉）`, rarity: 4, big: true }); }
    try { setSt(await worldApi.state(ep)); } catch { /* ignore */ }
  };
  const finish = async (result: "landed" | "snapped" | "escaped") => {
    if (fight.current?.legend) { void legendFinish(result); return; }
    const w = W.current; if (!ep || !cast_.current) return; setMode("busy"); holding.current = false;
    // 第三轮：玩家拉满一条稀有鱼，报结果那一下网卡住，鱼就没了。现在报不上去就先记在本机、隔一会儿再报（服务器同一竿重复报回同样的结果），
    // 最多试 5 次；关掉页面也不丢，下次进来接着报
    const id = cast_.current.id; try { localStorage.setItem("lwPendingLand", JSON.stringify({ id, result, at: Date.now() })); } catch { /* ignore */ }
    const landRetry = async () => {
      let e0: unknown = null;
      for (let i = 0; i < 5; i++) {
        try { return await worldApi.land(ep, id, result); } catch (e) { e0 = e; const st = (e as { status?: number }).status; if (st && st !== 502 && st !== 503 && st !== 504) break; if (i === 0) flash("网有点卡，鱼还挂在钩上……"); await new Promise(r => window.setTimeout(r, 1200 + i * 1500)); }
      }
      throw e0;
    };
    try {
      const r = await landRetry(); try { localStorage.removeItem("lwPendingLand"); } catch { /* ignore */ }
      w?.clearBobber(result); fight.current = null;
      if (r.result === "landed") { snd.sfx("catch", r.fish.rarity); if (r.first) snd.sfx("first"); w?.celebrate("player", r.fish.rarity, r.fish.species); window.setTimeout(() => setCard({ ok: true, fish: r.fish, sign: r.sign, first: r.first, record: r.record }), 700); snd.vibe(80); }
      else { snd.sfx(result === "snapped" ? "snap" : "escape"); } if (r.result !== "landed") setCard({ ok: false, text: result === "snapped" ? "线断了……" : "鱼挣脱跑掉了……", rarity: r.fish.rarity, big: r.fish.big });
    } catch (e) { w?.clearBobber(); fight.current = null; const st = (e as { status?: number }).status; if (st && st < 500) { try { localStorage.removeItem("lwPendingLand"); } catch { /* ignore */ } flash((e as Error).message || "没报上去"); } else flash("网断了，这条鱼先记着，网好了自动补上"); }
    setMode("walk"); setFightUi({ tension: 0.3, stamina: 1, progress: 0, slack: 0 });
  };
  // 上次没报上去的那条：进来就补报（10 分钟内）
  useEffect(() => {
    if (!ep) return; let pend: { id: string; result: "landed" | "snapped" | "escaped"; at: number } | null = null;
    try { pend = JSON.parse(localStorage.getItem("lwPendingLand") || "null"); } catch { /* ignore */ }
    if (!pend) return; if (Date.now() - pend.at > 600000) { try { localStorage.removeItem("lwPendingLand"); } catch { /* ignore */ } return; }
    const p = pend; const t = window.setTimeout(async () => {
      try { const r = await worldApi.land(ep, p.id, p.result); try { localStorage.removeItem("lwPendingLand"); } catch { /* ignore */ }
        if (r.result === "landed") { W.current?.celebrate("player", r.fish.rarity, r.fish.species); setCard({ ok: true, fish: r.fish, sign: r.sign, first: r.first, record: r.record }); } }
      catch (e) { const st = (e as { status?: number }).status; if (st && st < 500) try { localStorage.removeItem("lwPendingLand"); } catch { /* ignore */ } }
    }, 1500);
    return () => clearTimeout(t);
  }, [ep]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (action: "show" | "release" | "gift", fish: WFish, to?: "buddy" | "pal") => {
    if (!ep) return;
    try { await worldApi.act(ep, action, fish.id, to); flash(action === "show" ? "举起来给大家看了" : action === "release" ? "放回水里了" : `送给${nm(to!)}了`); if (action === "show") { say("player", `看！${fish.name} ${fish.kg}kg`); W.current?.celebrate("player", fish.rarity, fish.species); } }
    catch (e) { flash((e as Error).message || "没成"); }
  };
  const toggleOpen = async () => { if (!ep || !st) return; try { const r = await worldApi.open(ep, !st.open); setSt({ ...st, open: r.open }); flash(r.open ? "伙伴也来钓了" : "他俩先回去了，不会再叫醒他们"); } catch { /* ignore */ } };
  const sendChat = async () => { const t = chat.trim(); if (!t || !ep) return; setChat(""); myLast.current = Date.now(); say("player", t); try { await socialApi.send(ep, t, "game"); } catch { flash("没发出去"); } };

  // ── 摇杆 ──
  const joyRef = useRef<HTMLDivElement>(null); const knobRef = useRef<HTMLDivElement>(null); const joyId = useRef<number | null>(null);
  const [joyOn, setJoyOn] = useState(false);
  const joyMove = (e: React.PointerEvent) => {
    if (joyId.current !== e.pointerId || !joyRef.current) return; const r = joyRef.current.getBoundingClientRect(); const R = joyRef.current.offsetWidth / 2;
    const d = toStage(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    let x = d.x / R, y = d.y / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    if (W.current) W.current.joy = { x, y };
    // 摇杆头跟着手指走，上面的蝴蝶结往走的方向歪一点
    if (knobRef.current) knobRef.current.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px) rotate(${x * 18}deg)`;
  };
  const joyEnd = () => { joyId.current = null; setJoyOn(false); if (W.current) W.current.joy = { x: 0, y: 0 }; if (knobRef.current) knobRef.current.style.transform = ""; };
  // 印章每按一下冒一圈墨
  const [inks, setInks] = useState<number[]>([]);
  const stampPress = () => { const k = Date.now(); setInks(v => [...v.slice(-2), k]); window.setTimeout(() => setInks(v => v.filter(x => x !== k)), 520); };

  const players = st?.players ?? []; const mine = players.find(p => p.id === "player");
  // 开源版：两个伙伴叫什么由世界服务的内容包定（state.players 里的 name）
  const buddyName = players.find(p => p.id === "buddy")?.name || "伙伴甲"; const palName = players.find(p => p.id === "pal")?.name || "伙伴乙";
  // ── 第 2 步：秤砣的店（亮鳞）。台词是伙伴甲写的 ──
  const wallet = st?.wallet; const [busyTrade, setBusyTrade] = useState(false);
  // ── 种菜（伞树农场，后端 little-world/engine/farm.js）：在农场就拉 /world/farm 喂给画面；点自己盆的空格出种子袋，点熟了的收，站盆跟前按大按钮摇伞
  const [farm, setFarm] = useState<WFarmRes | null>(null); const [seedTile, setSeedTile] = useState<number | string | null>(null); /* 数字 = 自己盆的格；"ground:N" = 菜园地上 */ const [farmBusy, setFarmBusy] = useState(false);
  const farmIn = (r: WFarmRes) => { setFarm(r); W.current?.setFarm(r.farm); };
  useEffect(() => {
    if (scene !== "farm" || !ep) { W.current?.setFarm(null); return; }
    let dead = false; const pull = () => void worldApi.farm(ep).then(r => { if (!dead) farmIn(r); }).catch(() => {});
    pull(); const t = window.setInterval(pull, 30000); return () => { dead = true; clearInterval(t); };
  }, [scene, ep, trial]); // eslint-disable-line react-hooks/exhaustive-deps —— trial 变了画面会重建，要重新喂
  const farmCall = async (f: () => Promise<{ ok: boolean; text?: string; empty?: boolean } & WFarmRes>, quiet = false) => {
    if (farmBusy) return null; setFarmBusy(true);
    try { const r = await f(); farmIn(r); if (r.text && !quiet) flash(r.text); return r; } catch (e) { flash((e as Error).message || "没成，等一下再试"); snd.sfx("nope"); return null; } finally { setFarmBusy(false); }
  };
  const STAGE_TXT = ["刚冒芽", "长叶子了", "打花苞了", "开花了", "熟了"];
  const potTap = (who: string, tile: number) => {
    const f = farm?.farm; if (!f || !ep) return; const sl = f.slots.find(q => q.who === who); const c = sl?.tiles[tile]?.crop;
    if (who !== "player") { // 别人的盆：先看种了什么；3 秒内再点一下 = 把竹管转过去给他那盆浇透（用 1 格水）
      const again = spoutAsk.current?.who === who && Date.now() - spoutAsk.current.at < 3000;
      if (again) { spoutAsk.current = null; void farmCall(() => worldApi.farmSpout(ep, who)).then(r => { if (r && !r.empty) W.current?.farmSpoutFx(who); }); return; }
      spoutAsk.current = { who, at: Date.now() }; const has = sl?.tiles.some(q => q.crop);
      flash(`${c ? `${sl?.name}的盆：${c.name}，${STAGE_TXT[Math.min(4, c.stage)]}` : `${sl?.name}的盆，这格还空着`}${has && f.water.level > 0 ? " · 再点一下用竹管帮他浇" : ""}`); snd.sfx("tap"); return; }
    if (!c) { setSeedTile(tile); return; }
    if (c.ripe || c.stage >= 4) { void farmCall(() => worldApi.farmHarvest(ep, tile)); return; }
    flash(`${c.name}，${STAGE_TXT[Math.min(4, c.stage)]}${c.dryDays >= 1 ? "，有点蔫了，快浇水" : c.wet >= 1 ? "，今天浇透了" : c.wet > 0 ? "，沾到一点水" : "，今天还没浇水"}`); snd.sfx("tap");
  };
  const spoutAsk = useRef<{ who: string; at: number } | null>(null);
  // 菜园地上那三块菜地也能种（共用，谁都能浇、能收；不吃伞和竹管的水，靠下雨和手浇）。空格 → 种子袋；熟了 → 收；长着 → 先说种的什么、谁种的，3 秒内再点一下 = 浇水
  const waterAsk = useRef<{ i: number; at: number } | null>(null);
  const groundTap = (i: number) => {
    const f = farm?.farm; if (!f || !ep) return; const pl = f.ground?.[i];
    if (!f.ground || !pl) { flash("这块地还没开好，过两天再来"); snd.sfx("tap"); return; }
    const plot = `ground:${i}`, c = pl.crop;
    if (!c) { setSeedTile(plot); return; }
    if (c.ripe || c.stage >= 4) { void farmCall(() => worldApi.farmHarvest(ep, plot)); return; }
    if (waterAsk.current?.i === i && Date.now() - waterAsk.current.at < 3000) { waterAsk.current = null; void farmCall(() => worldApi.farmWater(ep, plot)).then(r => { if (r) W.current?.groundWaterFx(i); }); return; }
    waterAsk.current = { i, at: Date.now() }; const by = c.by === "player" ? "你" : c.byName || (c.by ? nm(c.by) : "");
    flash(`${by ? `${by}种的` : ""}${c.name}，${STAGE_TXT[Math.min(4, c.stage)]}${c.dryDays >= 1 ? "，有点蔫了" : c.wet >= 1 ? "，今天浇透了" : c.wet > 0 ? "，沾到一点水" : "，今天还没浇水"}${c.wet >= 1 ? "" : " · 再点一下浇水"}`); snd.sfx("tap");
  };
  const groundTapRef = useRef(groundTap); groundTapRef.current = groundTap;
  // 「我游戏里面找不到在哪买种子种菜」——入口只有爬上伞顶点自己盆的空格，没有任何提示。加：右边「种菜」标签（自己走过去、到了开种子袋）+ 第一次进农场盆上冒「你的花盆在这儿」
  const potArrive = () => { const sl = farm?.farm?.slots.find(q => q.who === "player"); const i = sl ? sl.tiles.findIndex(q => !q.crop) : -1; setPotHint(false); if (i >= 0) setSeedTile(i); else { flash("盆里种满了，熟了点一下就能收"); snd.sfx("tap"); } };
  const potArriveRef = useRef(potArrive); potArriveRef.current = potArrive;
  const goSow = () => { const w = W.current; if (!w) return; snd.sfx("tap"); try { localStorage.setItem("lw.farm.potHint", "1"); } catch { /* 无痕模式 */ } setPotHint(false); if (!w.goToPot()) flash(w.me.path || w.me.ride ? "等一下，正在走" : "先走到地上或伞顶再点"); };
  const potHintRef = useRef<HTMLDivElement>(null);
  const [potHint, setPotHint] = useState(() => { try { return !localStorage.getItem("lw.farm.potHint"); } catch { return false; } });
  useEffect(() => { if (!potHint || scene !== "farm" || !farm?.farm) return; const t = window.setTimeout(() => { setPotHint(false); try { localStorage.setItem("lw.farm.potHint", "1"); } catch { /* ignore */ } }, 12000); return () => clearTimeout(t); }, [potHint, scene, !!farm?.farm]); // eslint-disable-line react-hooks/exhaustive-deps
  const potTapRef = useRef(potTap); potTapRef.current = potTap;
  const shakeRef = useRef<() => void>(() => {});
  shakeRef.current = () => { if (!ep) return; void farmCall(() => worldApi.farmShake(ep)).then(r => { if (r) W.current?.farmShake(!!r.empty); }); };
  // v2 道具：布袋里点「用」→ 后端扣一个 → 放那一段动画 + 后端回的那句话
  const [itemFx, setItemFx] = useState<{ id: string; text: string; fish?: string; k: number } | null>(null);
  const useItem = async (id: string) => {
    if (!ep || busyTrade) return; setBusyTrade(true);
    try { const r = await worldApi.use(ep, ITEM_META[id]?.name ?? id); setSheet(""); const fishName = id === "rubbing" ? /拓好了：(\S+)/.exec(r.text ?? "")?.[1] : undefined; setItemFx({ id, text: r.text ?? "", fish: fishName ? st?.dex.find(d => d.name === fishName)?.id : undefined, k: Date.now() }); if (id === "sunny_doll" && W.current) W.current.weather = "晴";
      try { setSt(await worldApi.state(ep)); } catch { /* ignore */ } }
    catch (e) { snd.sfx("nope"); flash((e as Error).message || "没用成"); } finally { setBusyTrade(false); }
  };
  const bagN = Object.values(st?.items ?? {}).reduce((a, b) => a + b, 0);
  const pickLine = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  // 在账本里买卖时秤砣被面板挡着，看不到他做动作 → 账本开着先攒着，合上以后一个一个做（每个 3.6 秒）
  const pelQ = useRef<{ act: PelAct; fish?: { sp: string; rarity: number }; line?: string }[]>([]); const sheetRef = useRef(sheet); sheetRef.current = sheet;
  // 秤砣喝茶去了，卖完鱼出来他站的地方冒了个气泡 → 他不在摊子上（喝茶 / 打烊）就不说话不做动作
  const pelAway = () => { const k = W.current?.stallNow(); return k === "away" || k === "closed"; };
  const pelDo = (act: PelAct, line?: string, fish?: { sp: string; rarity: number }) => { if (pelAway()) return; if (sheetRef.current === "shop" || pelQ.current.length) { pelQ.current.push({ act, fish, line }); return; } W.current?.pelPlay(act, fish); if (line) say("pel", line); };
  useEffect(() => {
    if (sheet === "shop" || !pelQ.current.length) return; let t = 0;
    const next = () => { if (pelAway()) { pelQ.current = []; return; } const it = pelQ.current.shift(); if (!it) return; W.current?.pelPlay(it.act, it.fish); if (it.line) say("pel", it.line); if (pelQ.current.length) t = window.setTimeout(next, 3600); };
    t = window.setTimeout(next, 350); return () => clearTimeout(t);
  }, [sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  const setTrialOn = async (v: boolean) => {
    if (!ep) return;
    try { const r = await worldApi.trial(ep, v); applyTrial(r.trial);
      flash(r.trial ? "试玩开了：地图上多了伞树农场，树屋就是小屋。只有你看得到" : "试玩关了");
      if (!r.trial && sceneRef.current === "cabin" && !CABIN_READY) setScene("pond");
      try { setSt(await worldApi.state(ep)); } catch { /* ignore */ } }
    catch (e) { flash((e as Error).message || "没开成"); }
  };
  const sellLine = (f: { name: string; rarity: number; kg?: number; species: string }) => /boot|umbrella|duck/.test(f.species) ? "靴子？一只？……放这儿吧，给你个蚯蚓钱。".replace("靴子", f.name.replace(/^旧/, ""))
    : f.rarity >= 3 ? "……这条给你多称两片。" : (f.kg ?? 1) < 0.1 ? "这么小也好意思拿来。" : pickLine(["这条……瘦了点。", "按斤算，零头抹了——抹的是你的零头。", "行吧，给你这个数。"]);
  const trade = async (kind: "sell" | "buy" | "equip", id: string, slot?: string, n = 1): Promise<WTrade | null> => {
    if (!ep || busyTrade) return null; setBusyTrade(true); const w = W.current;
    try {
      const r = kind === "sell" ? await worldApi.sell(ep, id) : kind === "buy" ? await worldApi.buy(ep, id, n) : await worldApi.equip(ep, id, slot);
      setSt(o => (o ? { ...o, wallet: r.wallet } : o)); if (w) { w.bobSkin = r.wallet.gear.bobber; w.rodSkin = r.wallet.gear.rod; }
      if (kind === "sell" && r.sold?.length) { const best = [...r.sold].sort((a, b) => b.scales - a.scales)[0]; const junk = /boot|umbrella|duck/.test(best.species); if (junk) pelDo("sniff", sellLine(best)); else pelDo("weigh", sellLine(best), { sp: best.species, rarity: best.rarity }); flash(`秤砣称出 ${r.got} 亮鳞${r.repay ? `，先还了欠的 ${r.repay}` : ""}`); }
      else if (kind === "buy") { if (r.soft) pelDo("soft", "不赊账……这次算了。"); else pelDo("deal", pickLine(["钱货两清，出门不认。", "这个饵好用，我自己都舍不得。"])); flash(r.text || "买好了"); }
      else flash(r.text || "换上了");
      try { setSt(await worldApi.state(ep)); } catch { /* ignore */ }
      return r;
    } catch (e) { const msg = (e as Error).message || "没成"; if (/不够/.test(msg)) pelDo("soft", "不赊账。"); flash(msg); try { setSt(await worldApi.state(ep)); } catch { /* ignore */ } return null; }
    finally { setBusyTrade(false); }
  };
  // 走到秤砣跟前：他从镜片上面瞟你一眼；你饵用完了，他偷偷塞条蚯蚓
  const greetAt = useRef(0);
  useEffect(() => {
    const w = W.current; if (!nearShop || !w) return; const sk = w.stallNow(); if (sk === "closed" || sk === "away" || Date.now() - greetAt.current < 60000) return; greetAt.current = Date.now();
    pelDo("peek", pickLine(["看看可以，摸要收钱。", "来了？先说好，不赊账。", "这池子今天鱼少，肯定是你们钓太狠。"]));
    // 每天第一次来 / 饵用完了：秤砣从喉囊里摸东西塞给玩家（后端记着，一天一次 / 两小时一次）
    if (ep) void worldApi.visit(ep).then(r => { if (!r.gift) return; const g = r.gift; window.setTimeout(() => pelDo(g.kind === "daily" ? "player" : "worm", g.line), 3400); /* 先瞟完玩家一眼再塞东西 */ flash(`秤砣塞给你 ${r.gift.n} 份${r.gift.name}`); setSt(o => (o ? { ...o, wallet: r.wallet } : o)); }).catch(() => { /* ignore */ });
  }, [nearShop]); // eslint-disable-line react-hooks/exhaustive-deps
  // 出发（立体书里点了地方）：后端换钓点，成功了书合上的那一刻换场景（书挡着，看不到重建）
  // 伞树农场先是前端本地场景（试玩开了才有）：去农场不问后端，后端那边玩家还站在原来的钓点
  const onTravel = async (to: Scene) => { if (to === "farm") return true; /* 农场全开 */ if (!ep) return false; try { await worldApi.travel(ep, to); return true; } catch (e) { flash((e as Error).message || "没去成"); return false; } };
  const onArrive = (to: Scene) => { setScene(to); setMode("walk"); if (to === "farm") window.setTimeout(() => flash("走到吊篮、梯子、楼梯跟前，按大按钮就上去；树屋就是小屋，门口能进屋"), 2600); };
  // 农场里点屏幕：点飞鸟 / 帆船 / 稻草人 / 向日葵 / 蒲公英 / 小塘 / 伞面（没拖动的一下才算点）
  const tap0 = useRef<{ x: number; y: number; t: number } | null>(null);
  cabinDoRef.current = cabinDo;
  const hostTap = (e: { clientX: number; clientY: number; nativeEvent: PointerEvent }) => {
    const a = tap0.current; tap0.current = null; const w = W.current; if (!a || !w || (w.scene !== "farm" && w.scene !== "cabin")) return;
    if (Math.hypot(e.clientX - a.x, e.clientY - a.y) > 12 || Date.now() - a.t > 500) return;
    const k = (window.devicePixelRatio || 1) / w.scale; const wx = w.cam.x + e.nativeEvent.offsetX * k, wy = w.cam.y + e.nativeEvent.offsetY * k;
    if (w.scene === "farm") { w.farmTap(wx, wy); return; }
    // 小屋里直接点家具：站在跟前就直接用；不在跟前只描亮边（不再自动走过去）
    if (modeRef.current !== "walk" || Date.now() < lockUntil.current) return;
    const gid = w.guestHit(wx, wy); if (gid) { const G = w.guests.find(g => g.id === gid); if (G) { const d = new Date(G.firstAt); snd.sfx("tap"); flash(`${G.name}的房间 · ${d.getMonth() + 1}/${d.getDate()} 第一次来 · ${G.here ? "在屋里" : "出门了，窗帘拉着"}`); } return; }
    { const iou = w.iouHit(wx, wy); if (iou) { snd.sfx("paper"); setIouOpen(iou); return; } } // 点门边挂着的欠条
    const id = w.cabinHit(wx, wy); if (!id) return;
    if (w.nearCabinAll().includes(id)) { w.thSel = { id, t: w.t }; void cabinDoRef.current(id as CabinSpot); return; }
    w.thSel = { id, t: w.t }; snd.sfx("tap"); flash("走到它跟前再点"); // 点了家具自动走过去不喜欢 → 只描一下边，自己走过去
  };
  // 夜河早上 5 点散场：萤火虫先散 → 灯从上游一盏盏熄 → 「天亮了……明晚七点再来」→ 暖色帘子一盖，路牌送玩家回池塘。
  // 玩家正在拉鱼就等拉完；等咬钩的那竿收掉
  useEffect(() => {
    if (scene !== "river") return; let done = false; const ts: number[] = [];
    const chk = window.setInterval(() => {
      const w = W.current; if (!w || done) return; const h = forceHour ?? hourNow(); if (h >= 19 || h < 5) return; const m = modeRef.current; if (m !== "walk" && m !== "wait") return;
      done = true; if (m === "wait") { w.clearBobber(); setMode("walk"); } setRnote(null); w.riverClose();
      ts.push(window.setTimeout(() => { setDawn("card"); snd.sfx("popup", 2); }, 7600));
      ts.push(window.setTimeout(() => { setDawn("curtain"); snd.sfx("go"); }, 10800));
      ts.push(window.setTimeout(() => { void onTravel("pond").then(ok => { if (ok) onArrive("pond"); else setDawn(""); }); }, 11500));
    }, 1000);
    return () => { window.clearInterval(chk); ts.forEach(t => window.clearTimeout(t)); };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (scene === "river") return; if (dawn === "curtain") { const t = window.setTimeout(() => setDawn("lift"), 600); return () => window.clearTimeout(t); } if (dawn === "lift") { const t = window.setTimeout(() => setDawn(""), 800); return () => window.clearTimeout(t); } }, [dawn, scene]); // 换到池塘、画好了再慢慢掀开帘子
  const nm = (w: string) => (w === "buddy" ? buddyName : w === "pal" ? palName : w === "player" ? "我" : "");
  const hr = forceHour ?? hourNow(); const clock = `${String(Math.floor(hr)).padStart(2, "0")}:${String(Math.floor((hr % 1) * 60)).padStart(2, "0")}`;
  const period = hr < 5 ? "午夜" : hr < 8 ? "清晨" : hr < 11 ? "上午" : hr < 16 ? "下午" : hr < 19 ? "黄昏" : "夜里";
  const bigLabel = mode === "walk" ? (scene === "cabin" ? (farmAct ? FARM_LABEL[farmAct] : nearCab ? CAB_LABEL[nearCab] ?? "看看" : "") : nearDoor ? "进屋" : farmAct === "shake" && farm?.farm ? `摇伞浇水 · 剩${farm.farm.water.level}格` : farmAct ? FARM_LABEL[farmAct] : nearShop && !nearWater ? "找秤砣" : nearSign && !nearWater ? "出发" : nearLamp ? "捞河灯" : nearWater ? "钓鱼" : "") : mode === "aim" ? "松手" : mode === "flying" ? "…" : mode === "wait" ? "等咬钩" : mode === "bite" ? "提竿！" : mode === "fight" ? "收线" : "…";
  const bigIcon = mode === "walk" ? (scene === "cabin" || nearDoor ? "b2-heart-stitch" : nearLamp && !(nearShop || nearSign) ? "b2-sparkle" : "b2-cat-fish") : mode === "aim" ? "b2-heart" : mode === "wait" ? "b2-m-teacup" : mode === "fight" ? "b2-bow-pink" : "";
  const compact = dim.h > 0 && dim.h < 500;
  const stageStyle = { ...(rot ? { width: dim.w, height: dim.h, transform: `translateX(${dim.h}px) rotate(90deg)` } : {}), "--sw": `${dim.w || 800}px` } as React.CSSProperties;
  const tension = Math.min(1.05, fightUi.tension);
  const [leaving, setLeaving] = useState<"" | "keep" | "free" | "show">("");
  const cardOut = (how: "keep" | "free" | "show", fish?: WFish) => {
    if (leaving) return; setLeaving(how);
    if (fish && how === "free") void act("release", fish); if (fish && how === "show") void act("show", fish);
    window.setTimeout(() => { setCard(null); setLeaving(""); }, 640);
  };
  const today = (() => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; })();
  const openMail = (focus: boolean) => { setMailOpen(true); setUnread(0); setMailFocus(focus); if (focus && rotRef.current) setCompose(true); };
  const [mailFocus, setMailFocus] = useState(false); const [compose, setCompose] = useState(false);

  const mail = mailOpen && (
    <div className={s.mailMask} onClick={() => setMailOpen(false)}>
      <div className={s.scroll} onClick={e => e.stopPropagation()}>
        <div className={s.roller}><img src="/fanart/b2-m-letter.png" alt="" /><b>小信箱</b><span>{buddyName}、{palName}和我</span><button type="button" onClick={() => setMailOpen(false)} aria-label="收起">×</button></div>
        <div className={s.scrollPaper}>
          <MailList log={log} nm={nm} />
        </div>
        <div className={s.mailInput}>
          {rot ? <button type="button" className={s.fakeInput} onClick={() => setCompose(true)}>{chat || `跟${buddyName}和${palName}说…`}</button> : <input autoFocus={mailFocus} value={chat} onChange={e => setChat(e.target.value)} placeholder={`跟${buddyName}和${palName}说…`} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) void sendChat(); }} />}
          <button type="button" onClick={() => void sendChat()} disabled={!chat.trim()}>发</button>
        </div>
        <i className={s.rollerBottom} />
      </div>
    </div>
  );

  return (
    <>
    <div className={`${s.page}${rot ? ` ${s.rot}` : ""}${compact ? ` ${s.compact}` : ""}`} style={stageStyle}>
      <div ref={hostRef} className={s.canvas}
        onPointerDown={e => { const w = W.current; if (editingRef.current && w) { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); const ox = e.nativeEvent.offsetX, oy = e.nativeEvent.offsetY; editPtr.current = { id: e.pointerId, x: ox, y: oy }; const p = toWorld(w, ox, oy); const k = w.editDown(p.x, p.y); if (k) { setEditSel(k); setEditSize(w.thEdit?.moves[k]?.s ?? w.thLayout[k]?.s ?? 1); } else setEditSel(null); return; } tap0.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
        onPointerMove={e => { const w = W.current, q = editPtr.current; if (!editingRef.current || !w || !q || q.id !== e.pointerId) return; const ox = e.nativeEvent.offsetX, oy = e.nativeEvent.offsetY; const p = toWorld(w, ox, oy); w.editMove(p.x, p.y, ox - q.x, oy - q.y); q.x = ox; q.y = oy; }}
        onPointerUp={e => { if (editingRef.current) { editPtr.current = null; W.current?.editUp(); return; } hostTap(e); }}
        onPointerCancel={() => { if (editingRef.current) { editPtr.current = null; W.current?.editUp(); } }} />

      {/* 头顶：便签气泡 / 名字 / 「！」 */}
      {(["player", "buddy", "pal", "pel"] as const).map(w => (
        <div key={w} ref={el => { bubbleRefs.current[w] = el; }} className={s.headTag}>
          {bubbles[w] && <span key={bubbles[w].at} className={`${s.bubble} ${s[`bub_${w}`] ?? ""}`}>{bubbles[w].text.length > 40 ? bubbles[w].text.slice(0, 40) + "…" : bubbles[w].text}</span>}
          {(w === "buddy" || w === "pal") && st?.ai?.[w]?.act === "bite" && <span className={s.bang}>！</span>}
          {(w === "buddy" || w === "pal") && <span className={`${s.nameTag} ${s[`nt_${w}`]}`}>{w === "buddy" && <img src="/fanart/c3-face.png" alt="" />}{w === "pal" && <img src="/fanart/xo-face.png" alt="" />}{nm(w)}</span>}
        </div>
      ))}
      {scene === "farm" && farm?.farm && potHint && <div ref={potHintRef} className={s.headTag}><span className={`${s.bubble} ${s.potHint}`} onClick={goSow}>你的花盆在这儿 · 点我去种菜</span></div>}
      {scene === "farm" && <div ref={animalLayerRef} />}
      {scene === "farm" && aCard && <FarmAnimalCard id={aCard} night={!!W.current?.isNight()} onClose={() => { snd.sfx("flip"); setACard(null); }} />}
      <div ref={bangRef} className={s.headTag}>{mode === "bite" && <span className={s.bang}>！</span>}</div>

      {/* 上方飘过的弹幕：谁说了什么、谁钓到了什么 */}
      <div className={s.dmLayer}>
        {dms.map(d => (
          <div key={d.id} className={`${s.dm} ${s[`dm_${d.who}`] ?? ""}${d.kind === "fish" ? ` ${s.dmFish}` : ""}`} style={{ top: `${d.lane * 30}px`, animationDuration: `${Math.min(16, 8 + d.text.length * 0.12)}s`, "--rc": RARITY_PX[d.rarity ?? 0] } as React.CSSProperties}
            onAnimationEnd={() => setDms(v => v.filter(x => x.id !== d.id))}>
            <Face who={d.who} />{d.kind === "fish" && d.species && <img className={s.dmFishImg} src={`/world-fish/${d.species}.png`} alt="" />}<b>{nm(d.who) || "小世界"}</b><span>{d.text.length > 36 ? d.text.slice(0, 36) + "…" : d.text}</span>
          </div>
        ))}
      </div>

      {/* 左上：手账纸条（带退出）+ 挂着的门牌 + 他俩的小纸签 */}
      <div className={s.note}>
        <button type="button" className={s.back} onClick={() => nav(-1)} aria-label="退出"><i>‹</i>退出</button>
        <div className={s.noteText}><b>{st?.spots?.[0]?.name && !/池塘/.test(st.spots[0].name) ? st.spots[0].name : "小世界"}</b><span>{period} {clock} · <i className={s.wx}>{st?.weather ?? "晴"}</i></span></div>
      </div>
      <div className={s.signWrap}>
        <Hang key={st?.open ? "on" : "off"} amp={14} drop={18} k={52} c={2} delay={0.35} poke line={{ len: 12, color: st?.open ? "#EFA3BA" : "#D9C6CE", width: 2 }} onClick={() => void toggleOpen()}>
          <span className={`${s.sign}${st?.open ? ` ${s.on}` : ""}`}>{st?.open ? <img src="/fanart/b2-heart.png" alt="" /> : <i className={s.dot} />}{st?.open ? "伙伴在钓" : "他俩没来 · 点我叫他们"}{st?.open && <i className={s.dot} />}</span>
        </Hang>
      </div>
      {/* 地图在右边索引标签里、设置在左边信箱下面（怀表不好看、音乐开关做进设置页）；伙伴不在画面里时屏幕边上贴着他的头像指过去 */}
      {(["buddy", "pal"] as const).map(w => <div key={w} ref={el => { edgeRefs.current[w] = el; }} className={s.edge}><img src={w === "buddy" ? "/fanart/c3-face.png" : "/fanart/xo-face.png"} alt="" /><i /></div>)}
      {setOpen && <WorldSettings onClose={() => setSetOpen(false)} trial={trial} onTrial={v => void setTrialOn(v)} onDoll={() => { setSetOpen(false); setDollOpen(true); }} />}
      {dollOpen && <DollPage ep={ep} names={{ buddy: buddyName, pal: palName }} sprites={Object.fromEntries(players.map(p => [p.id, p.sprite]))} onClose={() => setDollOpen(false)}
        onSaved={(who, url) => { setDollUrl(who, url); void W.current?.setSprite(who as "player" | "buddy" | "pal", url); setSt(o => (o ? { ...o, players: o.players.map(p => (p.id === who ? { ...p, sprite: url ? url.slice(url.indexOf("/api/")) : null } : p)) } : o)); }} />}
      {book && <WorldBook trial={trial} mode={book} here={scene} hour={hr} weathers={st?.weathers ?? {}} names={{ buddy: buddyName, pal: palName }}
        who={{ player: scene, ...Object.fromEntries((["buddy", "pal"] as const).map(k => [k, st?.ai?.[k]?.place ?? "pond"])) }}
        onTravel={onTravel} onArrive={onArrive} onClose={() => setBook(null)} />}

      {/* 小屋：摆家具 */}
      {scene === "cabin" && !editing && !book && <button type="button" className={s.editBtn} disabled={editSaving} onClick={editBegin}><img src="/world-cabin/mid_16.webp" alt="" /><small>{editSaving ? "在存" : "摆家具"}</small></button>}
      {editing && ( /* 顶上那条太挡 → 挪到左边侧栏，能收起成一个小签 */
        <div className={`${s.editBar}${editFold ? ` ${s.editFold}` : ""}`}>
          <button type="button" className={s.editHead} onClick={() => { snd.sfx("tap"); setEditFold(v => !v); }}>{editFold ? "摆家具 ›" : "‹ 收起"}</button>
          {!editFold && <>
            <span>{editSel ? <>选中：{FURN_NAME[editSel] ?? "这件"}<b>{Math.round(editSize * 100)}%</b></> : "按住家具拖：左右挪、上下挪前后，拖远了换楼层"}</span>
            {editSel && <div className={s.editSize}><button type="button" onClick={() => editSz(1 / 1.12)}>缩小</button><button type="button" onClick={() => editSz(1.12)}>放大</button></div>}
            <div className={s.editBtns}><button type="button" className={s.editOk} onClick={() => void editFinish(true)}>摆好了</button><button type="button" onClick={() => void editFinish(false)}>不要了</button><button type="button" onClick={() => void editReset()}>全部放回原位</button></div>
          </>}
        </div>
      )}
      {/* 左边：信箱（历史消息） */}
      <button type="button" className={s.mailBtn} onClick={() => openMail(false)} aria-label="信箱">
        <img src="/fanart/b2-m-letter.png" alt="" />
        {unread > 0 && <span key={unread} className={s.mailCnt}>{unread > 99 ? "99+" : unread}</span>}
      </button>

      {mute && <button type="button" className={s.soundFix} onClick={e => { snd.unlock(e.nativeEvent, true); window.setTimeout(() => { setMute(!snd.ok); if (snd.ok) { snd.sfx("pop"); return; }
          // 重建了还是哑的：试玩反馈过「退出重进就好」→ 直接帮玩家重进一次（整页重载，位置跟服务器走不会丢）；30 秒内只重载一次，免得来回刷
          let last = 0; try { last = Number(sessionStorage.getItem("lwSndReload") || 0); } catch { /* ignore */ }
          if (Date.now() - last > 30000) { try { sessionStorage.setItem("lwSndReload", String(Date.now())); } catch { /* ignore */ } flash("声音卡住了，帮你重进一下"); window.setTimeout(() => window.location.reload(), 700); }
          else flash("还是没声音……看看手机是不是开了静音 / 蓝牙连着别的"); }, 600); }}><i aria-hidden />没声音？点一下</button>}
      <button type="button" className={s.setBtn} onClick={() => setSetOpen(true)} aria-label="设置"><img src="/fanart/b2-m-teacup.png" alt="" /><small>设置</small></button>

      {/* 右边：索引标签 */}
      <div className={s.tabs}>
        {wallet && <div className={s.coinTag}><i />{wallet.coins}<small>亮鳞</small></div>}
        {st?.specials && <WatchTag specials={st.specials} />}
        <button type="button" className={`${s.tab} ${s.tabGear}`} onClick={() => setSheet("gear")}><img src="/fanart/b2-m-basket.png" alt="" />钓具</button>
        <button type="button" className={`${s.tab} ${s.tabDex}`} onClick={() => setSheet("dex")}><img src="/fanart/b2-m-read.png" alt="" />图鉴</button>
        <button type="button" className={`${s.tab} ${s.tabBucket}`} onClick={() => setSheet("bucket")}><img src="/fanart/b2-cat-fish.png" alt="" />鱼桶<span key={mine?.bucket.length ?? 0} className={`${s.cnt} ${s.cntBump}`}>{mine?.bucket.length ?? 0}</span></button>
        {bagN > 0 && <button type="button" className={`${s.tab} ${s.tabBag}`} onClick={() => setSheet("bag")}><img src="/fanart/b2-m-gift.png" alt="" />布袋<span key={bagN} className={`${s.cnt} ${s.cntBump}`}>{bagN}</span></button>}
        {scene === "farm" && farm?.farm && mode === "walk" && <button type="button" className={`${s.tab} ${s.tabSow}`} onClick={goSow}><img src="/fanart/b2-m-tulip.png" alt="" />种菜{potHint && <span className={s.sowHint}>花盆在伞顶上，点这里带你去</span>}</button>}
        {scene === "farm" && farm?.farm && <button type="button" className={`${s.tab} ${s.tabBag}`} onClick={() => setSheet("basket")}><img src="/fanart/b2-m-strawberry.png" alt="" />菜篮<span key={farm.bag.basket.length} className={`${s.cnt} ${s.cntBump}`}>{farm.bag.basket.length}</span></button>}
        <button type="button" className={`${s.tab} ${s.tabBet}`} onClick={() => { snd.sfx("paper"); setSheet("bet"); }}><img src="/fanart/letter.png" alt="" />打赌{(bet?.ious.filter(i => !i.tornAt).length ?? 0) > 0 && <span className={s.cnt}>{bet!.ious.filter(i => !i.tornAt).length}</span>}</button>
        <button type="button" className={`${s.tab} ${s.tabMap}`} onClick={() => setBook("view")}><img src="/fanart/b2-m-walk.png" alt="" />地图</button>
      </div>

      {/* 上方：手账尺子 */}
      {mode === "aim" && (
        <div className={s.ruler}>
          <div className={s.rLabel}><b>落点</b><span>按着往哪拖圈就去哪，松手甩竿</span></div>
          <div className={s.track}><i className={`${s.fill} ${s.fillPow}`} style={{ width: `${power * 100}%` }} /><i className={s.knotDot} style={{ left: `${power * 100}%` }} /></div>
        </div>
      )}
      {mode === "fight" && (
        <div className={`${s.ruler}${tension > 0.82 ? ` ${s.rulerShake}` : ""}`}>
          <div className={s.rLabel}><b>拉鱼</b><span>{tension > 0.82 ? "要断了！松一松" : fightUi.slack > 0.35 ? "线松了，鱼要跑，快收！" : "按住收，别拉太紧"}</span></div>
          <div className={s.track}><i className={s.danger} /><i className={s.fill} style={{ width: `${Math.min(100, tension * 100)}%` }} /><i className={s.knotDot} style={{ left: `${Math.min(100, tension * 100)}%` }} /></div>
          <div className={s.stam}>鱼的力气<i style={{ clipPath: `inset(0 ${100 - fightUi.stamina * 100}% 0 0)` }} /></div>
          <div className={s.reelFish}><span style={{ left: `${8 + fightUi.progress * 84}%` }}>🐟</span><em>{Math.round(fightUi.progress * 100)}%</em></div>
          {fight.current?.legend && cheerPop && <div className={s.cheerPop} key={cheerPop.k}><b>{nm(cheerPop.who)}</b>{cheerPop.line}</div>}
        </div>
      )}
      {/* 夜河之主浮上来了：谁到了、还剩几分钟，玩家在夜河就能开拉 */}
      {lg?.phase === "calling" && mode === "walk" && !sheet && (() => { /* 玩家点头上线 */
        const left = Math.max(0, lg.arriveBy - Date.now()); const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
        return (
          <div className={s.legendCard}>
            <div className={s.lgWater}><i className={s.lgShadow} /><i className={s.lgRipple} /><i className={s.lgRipple} style={{ animationDelay: "1.1s" }} /></div>
            <div className={s.lgBody}>
              <b>{lg.name}浮上来了</b>
              <span>{left > 0 ? `等大家赶到 ${mm}:${String(ss).padStart(2, "0")}` : "没到齐也能拉，就是更难"}</span>
              <div className={s.lgWho}>{["buddy", "pal"].map(w => <em key={w} className={lg.joined[w] ? s.lgIn : ""}>{nm(w)}{lg.joined[w] ? " 到了" : " 赶来中"}</em>)}</div>
            </div>
            <button type="button" className={s.lgGo} onClick={() => { snd.sfx("tap"); if (scene === "river") void startLegend(); else void onTravel("river").then(ok => { if (ok) onArrive("river"); }); }}>{scene === "river" ? "开拉" : "去夜河"}</button>
          </div>
        );
      })()}

      {/* 左下：摇杆 */}
      <div ref={joyRef} className={`${s.joy}${joyOn ? ` ${s.joyOn}` : ""}${mode !== "walk" || editing ? ` ${s.joyOff}` : ""}`}
        onPointerDown={e => { joyId.current = e.pointerId; setJoyOn(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); joyMove(e); }} onPointerMove={joyMove} onPointerUp={joyEnd} onPointerCancel={joyEnd}>
        <div ref={knobRef} className={s.knob}><img src="/fanart/b2-bow-pink.png" alt="" /></div>
      </div>
      {/* 家具挤在一起点不准 → 跟前有两三样时，印章上面列一排小图（那件家具的缩小图），自己挑 */}
      {mode === "walk" && scene === "cabin" && !editing && !farmAct && nearCabAll.length >= 2 && (
        <div className={s.cabPick}>
          {nearCabAll.slice(0, 4).map((id, i) => { const f = TH_FURN.find(q => q.spot === id); const src = f ? `/world-cabin/${f.k}.webp` : id === "tank" ? "/fanart/b2-cat-fish.png" : id === "door" ? "/fanart/b2-heart-stitch.png" : "/fanart/b2-sparkle.png";
            return <button key={id} type="button" style={{ animationDelay: `${i * 0.05}s` }} onClick={() => { const w = W.current; if (!w) return; w.thSel = { id, t: w.t }; void cabinDo(id as CabinSpot); }}><img src={src} alt="" /><b>{CAB_LABEL[id as CabinSpot] ?? "看看"}</b></button>; })}
        </div>
      )}
      {/* 右下：印章 */}
      {bigLabel && !editing && (
        <button type="button" className={`${s.stamp} ${s[`st_${mode}`] ?? ""}`} style={{ "--p": power } as React.CSSProperties}
          onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); stampPress(); bigDown(e.clientX, e.clientY); }} onPointerMove={e => bigMove(e.clientX, e.clientY)} onPointerUp={bigUp} onPointerCancel={bigUp} onContextMenu={e => e.preventDefault()}>
          {bigIcon && <img src={`/fanart/${bigIcon}.png`} alt="" />}
          <b>{bigLabel}</b>
          {inks.map(k => <i key={k} className={s.ink} />)}
        </button>
      )}
      {!isTouch() && mode === "walk" && <span className={s.hint}>{scene === "farm" ? "WASD / 方向键走 · 吊篮 / 梯子 / 楼梯跟前按空格 · 鼠标到处点点" : "WASD / 方向键走 · 空格钓鱼 · T 写信"}</span>}
      {mail}
      {toast && <div key={toast} className={s.toast}>{toast}</div>}
      {rnote && <RiverNote text={rnote.text} n={rnote.n} onDone={() => { setRnote(null); W.current?.releaseLamp(); }} />}
      {(dawn === "card" || dawn === "curtain") && <div className={s.dawnCard}><i className={s.dawnSun} aria-hidden /><img src="/fanart/b2-m-moonnap.png" alt="" /><b>天亮了，夜河的灯笼熄了。</b><span>明晚七点再来。</span></div>}
      {(dawn === "curtain" || dawn === "lift") && <div className={`${s.dawnCurtain}${dawn === "lift" ? ` ${s.dawnLift}` : ""}`} aria-hidden />}

      {/* 钓到了：从右边抽出一页手账（跟右边的索引标签一套），鱼从水花里跳上来落在涟漪中间，名字一笔一笔写出来；
 三个动作是页边伸出来的索引标签（第二版：试玩反馈拍立得和相机贴纸怪，不要了） */}
      {card && (
        <div className={s.mask} onClick={() => cardOut("keep")}>
          <div className={`${s.leaf}${card.ok ? "" : ` ${s.leafBad}`}${leaving ? ` ${s[`out_${leaving}`]}` : ""}`} onClick={e => e.stopPropagation()} style={{ "--rc": RARITY_PX[card.ok ? card.fish.rarity : card.rarity] } as React.CSSProperties}>
            <span className={s.leafTape} />
            <div className={s.pond}>
              <i className={s.ring} /><i className={`${s.ring} ${s.ring2}`} /><i className={`${s.ring} ${s.ring3}`} />
              {Array.from({ length: 8 }, (_, i) => <i key={i} className={s.drop} style={{ "--a": `${i * 45 + 20}deg` } as React.CSSProperties} />)}
              <div className={s.jump}>{card.ok ? <FishArt species={card.fish.species} rarity={card.fish.rarity} /> : <FishArt rarity={card.rarity} ghost />}</div>
              <span className={s.rarTag}>{card.ok ? RARITY[card.fish.rarity] : "跑掉了"}</span>
            </div>
            <div className={s.lines}>
              {card.ok ? (
                <>
                  <span className={s.kicker}>{card.first ? "图鉴新收录" : card.record ? "破纪录了" : "钓到了"}<em>{today}</em></span>
                  <b className={s.fname}>{card.fish.name}</b>
                  <span className={s.capLine}><span className={s.stars}>{Array.from({ length: card.fish.stars }, (_, i) => <span key={i} style={{ animationDelay: `${1.1 + i * 0.09}s` }}>★</span>)}</span><CountKg kg={card.fish.kg} /></span>
                  {card.sign && <p className={s.sign2}>「{card.sign}」</p>}
                </>
              ) : (
                <>
                  <span className={s.kicker}>差一点<em>{today}</em></span>
                  <b className={s.fname}>？？？</b>
                  <p className={s.sign2}>{card.text}{card.big ? "好像是条大的……" : ""}</p>
                </>
              )}
            </div>
            <div className={s.edgeTabs}>
              {card.ok ? (
                <>
                  <button type="button" className={s.etKeep} onClick={() => cardOut("keep")}>收下</button>
                  <button type="button" className={s.etShow} onClick={() => cardOut("show", (card as { fish: WFish }).fish)}>炫耀</button>
                  <button type="button" className={s.etFree} onClick={() => cardOut("free", (card as { fish: WFish }).fish)}>放生</button>
                </>
              ) : <button type="button" className={s.etKeep} onClick={() => cardOut("keep")}>再来</button>}
            </div>
          </div>
        </div>
      )}

      {/* 鱼桶：一个小玻璃鱼缸，鱼在里面游，点一条它跳出来 */}
      {sheet === "bucket" && <Tank fish={mine?.bucket ?? []} nm={nm} buddyName={buddyName} palName={palName} onClose={() => setSheet("")} onAct={(a, f, to) => void act(a, f, to)} />}
      {/* 图鉴：集邮册，每种鱼一张邮票，钓到了盖邮戳 */}
      {sheet === "dex" && <Album dex={st?.dex ?? []} onClose={() => setSheet("")} />}
      {(sheet === "buddydex" || sheet === "paldex") && cabin && (() => { const who = sheet === "buddydex" ? "buddy" : "pal"; const md = cabin.corners[who]?.dex ?? {}; return <Album dex={(st?.dex ?? []).map(d => ({ ...d, mine: md[d.id] ?? null }))} who={who} whoName={nm(who)} onClose={() => setSheet("")} />; })()}
      {sheet === "tank" && cabin && <TankSheet cabin={cabin} bucket={mine?.bucket ?? []} busy={busyTrade} nm={w => (w === "player" ? "你" : nm(w))} onPut={id => void tankDo("put", id)} onTake={id => void tankDo("take", id)} onClose={() => setSheet("")} />}
      {sheet === "cabinet" && cabin && <CabinetSheet cabin={cabin} dex={st?.dex ?? []} nm={w => (w === "player" ? "你" : nm(w))} onClose={() => setSheet("")} />}
      {sheet === "notes" && cabin && <NotesSheet cabin={cabin} nm={w => (w === "player" ? "你" : nm(w))} busy={busyTrade} onSend={noteDo} onClose={() => setSheet("")} />}
      {sheet === "chest" && cabin && <ChestSheet cabin={cabin} nm={w => (w === "player" ? "你" : nm(w))} busy={busyTrade} onPlace={(sl, it) => void placeDo(sl, it)} onClose={() => setSheet("")} />}
      {sheet === "board" && cabin && <BoardSheet cabin={cabin} nm={w => (w === "player" ? "你" : nm(w))} onClose={() => setSheet("")} />}
      {doorFx && <div className={`${s.doorFx} ${doorFx === "close" ? s.doorClose : s.doorOpen}`} aria-hidden><i /><i /></div>}
      {sheet === "bag" && <BagSheet items={st?.items ?? {}} busy={busyTrade} onUse={id => void useItem(id)} onClose={() => setSheet("")} />}
      {itemFx && <ItemFx key={itemFx.k} id={itemFx.id} text={itemFx.text} fish={itemFx.fish} onDone={() => setItemFx(null)} />}
      {sheet === "shop" && wallet && <StallShop wallet={wallet} fish={mine?.bucket ?? []} stall={W.current?.stallNow() ?? "open"} busy={busyTrade} onClose={() => setSheet("")} onSell={id => trade("sell", id)} onBuy={(id, n) => trade("buy", id, undefined, n)} onEquip={(id, k) => trade("equip", id, k)} />}
      {seedTile != null && farm?.farm && <WorldSeeds farm={farm.farm} bag={farm.bag} coins={wallet?.coins ?? 0} busy={farmBusy} onClose={() => setSeedTile(null)}
        onBuy={id => { if (ep) void farmCall(() => worldApi.farmBuy(ep, id, 1)).then(() => { void worldApi.state(ep).then(r => setSt(r)).catch(() => {}); }); }}
        onPlant={id => { const t = seedTile; if (ep) void farmCall(() => worldApi.farmPlant(ep, id, t), true); }} />}
      {sheet === "basket" && farm?.farm && <WorldBasket farm={farm.farm} bag={farm.bag} names={{ player: nm("player"), buddy: nm("buddy"), pal: nm("pal") }} onClose={() => setSheet("")}
        onSell={() => { if (ep) void farmCall(() => worldApi.farmSell(ep)).then(r => { if (r && "wallet" in r && r.wallet) setSt(o => (o ? { ...o, wallet: (r as { wallet: NonNullable<WState["wallet"]> }).wallet } : o)); }); }} />}
      {sheet === "ddz" && <WorldDdz names={{ buddy: nm("buddy"), pal: nm("pal") }} onClose={() => setSheet("")} chat={log.filter(l => l.kind === "say").slice(-20).map(l => ({ id: l.id, at: l.at, who: l.who, text: l.text }))} onSay={() => setCompose(true)} />}
      {sheet === "cardbox" && <CardBox onPick={k => setSheet(k)} onClose={() => setSheet("")} />}
      {sheet === "fish" && <WorldFishCards names={{ buddy: nm("buddy"), pal: nm("pal") }} onClose={() => setSheet("")} onSwitch={() => setSheet("ddz")} chat={log.filter(l => l.kind === "say").slice(-20).map(l => ({ id: l.id, at: l.at, who: l.who, text: l.text }))} onSay={() => setCompose(true)} />}
      {sheet !== "bet" && !book && <BetRibbon data={bet} nm={nm} onOpen={() => setSheet("bet")} />}
      {sheet === "bet" && <WorldBet ep={ep} data={bet} run={betRun} nm={nm} flash={flash} onClose={() => setSheet("")} onIou={id => setIouOpen(id)} />}
      {iouOpen && (() => { const i = bet?.ious.find(q => q.id === iouOpen); if (!i) return null; return <IouCard key={i.id} iou={i} nm={nm} onClose={() => setIouOpen(c => (c === i.id ? null : c))}
        onTear={async () => { try { await betRun(() => betApi.tear(ep!, i.id)); return true; } catch (e) { flash((e as Error).message || "没撕下来"); return false; } }}
        onPaid={() => void (async () => { try { await betRun(() => betApi.paid(ep!, i.id)); flash("标好了，等他撕掉"); } catch (e) { flash((e as Error).message || "没标上"); } })()} />; })()}
      {sheet === "gear" && wallet && <WorldGear wallet={wallet} busy={busyTrade} onClose={() => setSheet("")} onEquip={(id, k) => void trade("equip", id, k)} onShop={() => { setSheet(""); flash("秤砣在栈桥左边的小摊，走过去按「找秤砣」"); }} />}
    </div>
    {/* 手机锁着竖屏、画面转了 90° 时：系统键盘只会竖着弹。打字就在竖着的小便签上打（跟键盘同一个方向），发完回到横着的信箱 */}
    {(rot || sheet === "ddz" || sheet === "fish") && compose && ( /* 牌桌里「说一句」也用这张竖着的小便签（横屏时键盘也正） */
      <div className={s.composeMask} onClick={() => setCompose(false)}>
        <div className={s.composer} onClick={e => e.stopPropagation()}>
          <b>跟{buddyName}和{palName}说</b>
          <textarea autoFocus value={chat} rows={2} onChange={e => setChat(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); setCompose(false); void sendChat(); } }} />
          <div><button type="button" className={s.cCancel} onClick={() => setCompose(false)}>收起</button><button type="button" onClick={() => { setCompose(false); void sendChat(); }} disabled={!chat.trim()}>发</button></div>
        </div>
      </div>
    )}

    </>
  );
}

type LogItem = { id: string; at: number; who: string; kind: "say" | "fish"; text: string; rarity?: number; species?: string };
type Danmu = LogItem & { lane: number };

function Face({ who }: { who: string }) {
  if (who === "buddy") return <img className={s.face} src="/fanart/c3-face.png" alt="" />;
  if (who === "player") return <img className={`${s.face} ${s.facePlayer}`} src="/fanart/b2-m-hood.png" alt="" />; // 不喜欢蝴蝶结，喜欢美乐蒂
  return <img className={`${s.face} ${s.facePal}`} src="/fanart/xo-face.png" alt="" />; // 伙伴乙 = 酷企鹅
}

/** 信箱纸卷里的历史：按天分，说话是一句一句，钓鱼是一张小票 */
function MailList({ log, nm }: { log: LogItem[]; nm: (w: string) => string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [log.length]);
  if (!log.length) return <div className={s.mailEmpty}><img src="/fanart/scroll.png" alt="" />还没人说话，这里很安静</div>;
  const hm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  return (
    <div className={s.mailList}>
      {log.map((m, i) => (
        m.kind === "fish" ? (
          <div key={m.id} className={s.mlFish} style={{ "--rc": RARITY_PX[m.rarity ?? 0], animationDelay: `${Math.max(0, i - log.length + 12) * 0.035}s` } as React.CSSProperties}>
            {m.species && <img src={`/world-fish/${m.species}.png`} alt="" />}<span><b>{nm(m.who) || "小世界"}</b>{m.text}</span><em>{hm(m.at)}</em>
          </div>
        ) : (
          <div key={m.id} className={`${s.ml} ${s[`ml_${m.who}`] ?? ""}`} style={{ animationDelay: `${Math.max(0, i - log.length + 12) * 0.035}s` }}>
            <Face who={m.who} /><div><b>{nm(m.who)}<em>{hm(m.at)}</em></b><p>{m.text}</p></div>
          </div>
        )
      ))}
      <div ref={end} />
    </div>
  );
}

/** 鱼桶：玻璃鱼缸。每条鱼一条泳道，来回游；点一下跳出来，旁边贴一张便利贴 */
function Tank({ fish, nm, buddyName, palName, onClose, onAct }: { fish: WFish[]; nm: (w: string) => string; buddyName: string; palName: string; onClose: () => void; onAct: (a: "show" | "release" | "gift", f: WFish, to?: "buddy" | "pal") => void }) {
  const [pick, setPick] = useState<string | null>(null); const [gone, setGone] = useState<string[]>([]);
  const list = [...fish].reverse().filter(f => !gone.includes(f.id)); const p = list.find(f => f.id === pick) || null;
  const lanes = useRef<Record<string, { y: number; d: number; delay: number }>>({});
  list.forEach((f, i) => { if (!lanes.current[f.id]) { const r = mulberry(hashStr(f.id)); lanes.current[f.id] = { y: 12 + ((i * 37 + r() * 20) % 62), d: 7 + r() * 7, delay: -r() * 10 }; } });
  const doAct = (a: "show" | "release" | "gift", to?: "buddy" | "pal") => { if (!p) return; onAct(a, p, to); if (a !== "show") { setGone(g => [...g, p.id]); setPick(null); } };
  return (
    <div className={s.mask} onClick={onClose}>
      <div className={s.tankWrap} onClick={e => e.stopPropagation()}>
        <div className={s.tankLabel}><img src="/fanart/b2-cat-fish.png" alt="" /><b>我的鱼桶</b><span>{list.length} / 20 条</span></div>
        <button type="button" className={s.tankX} onClick={onClose} aria-label="关上">×</button>
        <div className={s.tank} onClick={() => setPick(null)}>
          <i className={s.glare} /><i className={s.sand} /><i className={`${s.weed} ${s.weed1}`} /><i className={`${s.weed} ${s.weed2}`} />
          {Array.from({ length: 6 }, (_, i) => <i key={i} className={s.bubbleUp} style={{ left: `${10 + i * 15}%`, animationDelay: `${i * 0.9}s`, animationDuration: `${3.2 + (i % 3) * 0.8}s` }} />)}
          {!list.length && <div className={s.tankEmpty}><img src="/fanart/b2-m-basket.png" alt="" />缸里还空着，去岸边甩一竿</div>}
          {list.map(f => { const l = lanes.current[f.id]; const on = pick === f.id; return (
            <div key={f.id} className={`${s.lane}${f.junk ? ` ${s.sunk}` : ""}${on ? ` ${s.laneOn}` : ""}${pick && !on ? ` ${s.laneDim}` : ""}`} style={{ top: f.junk ? "auto" : `${l.y}%`, "--sx": `${8 + (l.y * 1.3) % 70}%`, "--rot": `${(l.d * 17) % 40 - 20}deg`, "--d": `${l.d}s`, "--dl": `${l.delay}s`, "--rc": RARITY_PX[f.rarity] } as React.CSSProperties}>
              <button type="button" className={s.swimmer} onClick={e => { e.stopPropagation(); setPick(on ? null : f.id); }}><FishArt species={f.species} rarity={f.rarity} small /></button>
            </div>
          ); })}
        </div>
        {p && (
          <div key={p.id} className={s.pickNote} style={{ "--rc": RARITY_PX[p.rarity] } as React.CSSProperties}>
            <b>{p.name}</b>
            <span>{"★".repeat(p.stars)} · {p.kg}kg{p.giftFrom ? ` · ${nm(p.giftFrom)}送的` : ""}</span>
            <div className={s.pickBtns}>
              <button type="button" onClick={() => doAct("show")}>炫耀</button>
              <button type="button" className={s.toBuddy} onClick={() => doAct("gift", "buddy")}>送{buddyName}</button>
              <button type="button" className={s.toPal} onClick={() => doAct("gift", "pal")}>送{palName}</button>
              <button type="button" className={s.toFree} onClick={() => doAct("release")}>放生</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 图鉴：集邮册。齿孔边邮票，面值是星星；没钓到只有铅笔描的轮廓；钓到了盖一枚邮戳（日期 + 谁先钓到），点一下翻到背面 */
// 小屋（第 4 步）：池塘右下角一间木屋，门口按「进屋」走进去。
// 玩家还没看过图，先关着（跟夜河 RIVER_READY 一样）；点头了改 true 再打包
const CABIN_READY = true || import.meta.env.VITE_TEST_OPEN === "1"; PixelWorld.cabinReady = CABIN_READY; // VITE_TEST_OPEN 只在开发的 dist-test 构建里设
// 玩家的试玩开关（设置页）：开了小屋 / 夜河只对玩家开。本机记一份，进页面第一帧就按它画（不用等服务器，免得池塘先画一遍没小屋的再重画）
const WHERE_KEY = "lwWhere";
/** 只记小屋 / 农场（钓点后端记着）；只在走路时记，钓鱼坐着的姿势不记 */
function saveWhere(scene: Scene, me: { x: number; y: number; dir: number }, mode: string) {
  try { if (scene === "cabin" || scene === "farm") { if (mode === "walk") localStorage.setItem(WHERE_KEY, JSON.stringify({ scene, x: Math.round(me.x), y: Math.round(me.y), dir: me.dir, at: Date.now() })); } else localStorage.removeItem(WHERE_KEY); } catch { /* ignore */ }
}
function lastWhere(): { scene: Scene; x: number; y: number; dir: 0 | 1 | 2 | 3 } | null {
  try { const v = JSON.parse(localStorage.getItem(WHERE_KEY) || "null"); if (!v || (v.scene !== "cabin" && v.scene !== "farm") || Date.now() - v.at > 12 * 3600e3 || !isFinite(v.x) || !isFinite(v.y)) return null; if (v.scene === "cabin" && !(CABIN_READY || trialLocal())) return null; return { scene: v.scene, x: v.x, y: v.y, dir: (v.dir | 0) as 0 | 1 | 2 | 3 }; } catch { return null; }
}
const TRIAL_KEY = "lwTrial"; const trialLocal = () => { try { return localStorage.getItem(TRIAL_KEY) === "1"; } catch { return false; } };
PixelWorld.cabinReady = CABIN_READY || trialLocal();
const FARM_LABEL: Record<FarmAct, string> = { rideUp: "坐吊篮", rideDown: "坐吊篮下去", stairUp: "上楼", stairDown: "下楼", ladderUp: "爬梯子", ladderDown: "爬下去", door: "进屋", shake: "摇伞浇水" };
const CAB_LABEL: Record<CabinSpot, string> = { tank: "看鱼缸", cabinet: "纪念品柜", board: "照片墙", buddy: "写字桌", pal: "收音机", table: "牌桌", door: "出门",
  telescope: "望远镜", chest: "旧木箱", jar: "萤火虫罐", hammock: "躺吊床", window: "看窗外", pinwheel: "吹风车", hammock2: "小吊床", record: "唱片机", wardrobe: "衣柜", bed: "躺一会儿",
  mirror: "照镜子", dex: "图鉴", books: "书架", buddybed: "小床", stove: "看看锅", rods: "钓竿架", cat: "猫窝", gramo: "留声机", shoes: "鞋架", notes: "风铃留言", clock: "布谷钟" };
export function Album({ dex: all, onClose, who = "player", whoName = "你" }: { dex: WDex[]; onClose: () => void; who?: string; whoName?: string }) { // 小屋里伙伴的角落也用这本（who = 谁的；dex 里 mine 换成他的）
  const [flip, setFlip] = useState<string | null>(null);
  // 图鉴只算玩家自己钓到的。日期 / 次数 / 最大都用玩家自己的；全场第一个钓到的盖「首发」，全场最大的写「纪录」
  const dex = useMemo(() => all.map(d => d.mine ? { ...d, caught: true, first: d.firstBy === who, rec: d.maxBy === who && d.maxKg === d.mine.maxKg, firstAt: d.mine.firstAt, count: d.mine.count, maxKg: d.mine.maxKg } : { ...d, caught: false, first: false, rec: false }), [all]);
  const md = (t?: number) => { if (!t) return ""; const d = new Date(t); return `${d.getMonth() + 1}.${d.getDate()}`; };
  return (
    <div className={s.mask} onClick={onClose}>
      <div className={s.album} onClick={e => e.stopPropagation()}>
        {/* 标题栏整条都能点着合上（×太小、iPhone 上偶尔点不到） */}
        <div className={s.albumHead} onClick={e => { if (!(e.target as HTMLElement).closest("span")) onClose(); }}><img src="/fanart/b2-m-read.png" alt="" /><b>{who === "player" ? "集邮册" : `${whoName}的集邮册`}</b><span>收集 {dex.filter(d => d.caught).length} / {dex.length}</span><button type="button" onPointerUp={onClose} aria-label="合上">×</button></div>
        <div className={s.stamps}>
          {dex.map((d, i) => (
            <div key={d.id} className={`${s.stampCell}${flip === d.id ? ` ${s.flipped}` : ""}`} style={{ "--rc": RARITY_PX[d.rarity], animationDelay: `${i * 0.05}s` } as React.CSSProperties} onClick={() => d.caught && setFlip(flip === d.id ? null : d.id)}>
              <div className={s.stampInner}>
                <div className={`${s.stampFront}${d.caught ? "" : ` ${s.stampBlank}`}`}>
                  <div className={s.stampFace}>
                    <span className={s.face_}>{"★".repeat(d.stars)}</span>
                    <FishArt species={d.id} rarity={d.rarity} small ghost={!d.caught} />
                    <b>{d.caught ? d.name : "？？？"}</b>
                    {!d.caught && <em>{d.hours ? `${d.hours[0]}:00–${d.hours[1]}:00` : "全天"}</em>}
                  </div>
                  {d.caught && (
                    <svg className={s.postmark} viewBox="0 0 84 52" style={{ animationDelay: `${0.35 + i * 0.05}s` }}>
                      <circle cx="26" cy="26" r="21" /><circle cx="26" cy="26" r="15.5" />
                      <text x="26" y="24">{md(d.firstAt)}</text><text x="26" y="33" className={s.pmBy}>{d.first ? "首发" : whoName}</text>
                      <path d="M50 16 q5 -4 10 0 t10 0 t10 0 M50 26 q5 -4 10 0 t10 0 t10 0 M50 36 q5 -4 10 0 t10 0 t10 0" />
                    </svg>
                  )}
                </div>
                {d.caught && (
                  <div className={s.stampBack}>
                    <p>「{d.sign}」</p>
                    <span>最大 {d.maxKg}kg{d.rec ? " · 纪录" : ""}</span>
                    <span>钓到过 {d.count} 次</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
const hashStr = (t: string) => { let h = 7; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };

/** 重量从 0 数上去 */
function CountKg({ kg }: { kg: number }) {
  const [v, setV] = useState(0);
  useEffect(() => { let raf = 0; const t0 = performance.now() + 500; const step = (now: number) => { const k = Math.max(0, Math.min(1, (now - t0) / 700)); setV(kg * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf); }, [kg]);
  return <span className={s.kg}>{v.toFixed(kg < 10 ? 2 : 1)} kg</span>;
}

// 鱼 / 杂物的像素图：按场景画风画的一张，切成 public/world-fish/<种类>.png
function FishArt({ species, rarity, small, ghost }: { species?: string; rarity: number; junk?: boolean; small?: boolean; ghost?: boolean }) {
  const id = species || "crucian"; void rarity;
  return <img className={`${s.fishImg}${small ? ` ${s.fishSmall}` : ""}${ghost ? ` ${s.fishGhost}` : ""}`} src={`/world-fish/${id}.png`} alt="" draggable={false} />;
}

