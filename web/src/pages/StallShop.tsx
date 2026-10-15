// 秤砣的小摊。方案 A：一个活的小摊柜台。
// 上面粉白条纹遮阳棚放下来，招牌晃两下；左边柜台，秤砣站在后面；右边是货。
// 卖鱼：点一条，鱼落到天平左盘，秤砣刮鳞，亮鳞一片片飞进右上角的罐子，数字滚上去。全卖了 = 一条条跳上去。
// 买饵：货架上一排玻璃罐，点一罐放到柜台上；「− 3 袋 +」想囤几袋舀几勺，每勺倒进纸袋、纸袋鼓一点，付完折口盖章。
// 钓具：挂板上一排挂钩，点一件晃一下、取到柜台上看说明；买下 = 包装纸一裹、系蝴蝶结。
// 玩家看完：秤太卡通 / 饵罐敷衍 / 钓具页糊像素跟别页不搭 / 点鱼直接卖了。
// 秤换 画的黄铜天平（三件：底座、横梁、秤盘，横梁绕轴转）；饵和钓具全用钓具箱那套贴纸（public/world-gear），钓具页也做成木架子；
// 点鱼先放上秤、报价，再点「卖给他」才卖；点秤砣本人有反应。
import { useEffect, useRef, useState } from "react";
import s from "./StallShop.module.css";
import type { WFish, WShopItem, WTrade, WWallet } from "../api/ccBridge";
import type { StallKind } from "../pixel/world";
import { snd } from "../pixel/sound";
import actsPng from "../assets/world/shop/pelican_acts.png";

const STALL_TIP: Record<StallKind, string> = { open: "营业中", night: "挂着灯笼，照样营业", rain: "搭了油布，照样营业", away: "喝茶去了 · 自己拿，鳞片放罐里", closed: "打烊了，明早再来" };
const ACT_ROW = { nap: 0, weigh: 1, soft: 2, worm: 3, peek: 4, sniff: 5, deal: 6, close: 7, player: 8 } as const;
type Act = keyof typeof ACT_ROW;
type Page = "sell" | "bait" | "gear" | "misc";
// 每罐饵的样子：罐里的颜色、上面一层的颜色、罐里飘的小东西
const JAR: Record<string, { a: string; b: string; bit: string }> = {
  bread: { a: "#E9C27E", b: "#F7DDA8", bit: "crumb" }, jelly: { a: "#F27C9B", b: "#FFB3C6", bit: "gum" }, star: { a: "#F9D96B", b: "#FFF0B0", bit: "star" },
  rain: { a: "#8FCDEF", b: "#CDEBFA", bit: "drop" }, letter: { a: "#EFE5D3", b: "#FFFAF0", bit: "paper" }, mooncake: { a: "#D6A152", b: "#F0CB86", bit: "crumb" },
};
const SLOT_NAME: Record<string, string> = { rod: "竿", bobber: "浮漂", reel: "线轴", charm: "挂件", bucket: "桶" };
const GEAR_KINDS = ["rod", "bobber", "reel", "charm", "bucket"] as const;
// v2 杂货：道具挂在钉板的小钩子上（风吹会晃），小屋摆设放在旁边的小橱窗里（每样都活着）
const MISC_LINE: Record<string, string> = { sunny_doll: "晴天娃娃。挂上，一小时准晴。……比天气预报准。", rain_pot: "雨壶，往伞里倒水的。农场那边用。", wrap: "包装纸。送人的时候包一下，显得用心。", rubbing: "鱼拓纸。把你最得意那条印下来。", rumor: "消息？……五十，爱听不听。",
  decor_fish_chime: "木头鱼风铃，我自己刻的。", decor_lanterns: "纸灯笼串，晚上会亮。", decor_fishbone_clock: "鱼骨头挂钟，走得比我准。", decor_shell_frame: "贝壳相框。放张照片吧。", decor_glass_float: "玻璃浮球，老渔网兜着的。里面那点光……别问。" };

type Props = { wallet: WWallet; fish: WFish[]; stall: StallKind; busy: boolean; onClose: () => void;
  onSell: (id: string) => Promise<WTrade | null>; onBuy: (id: string, n?: number) => Promise<WTrade | null>; onEquip: (id: string, kind: string) => Promise<WTrade | null> };

export function StallShop({ wallet, fish, stall, busy, onClose, onSell, onBuy, onEquip }: Props) {
  const [page, setPage] = useState<Page>("sell");
  const [act, setAct] = useState<{ a: Act; k: number }>({ a: stall === "closed" ? "close" : "peek", k: 0 }); // k 变了就重播一次
  const [say, setSay] = useState<{ t: string; k: number }>({ t: stall === "away" ? "（纸条）喝茶去了。自己拿，鳞片放罐里。" : stall === "closed" ? "打烊了。明早六点。……别敲了。" : "看看可以，摸要收钱。", k: 0 });
  const [pan, setPan] = useState<null | { fish: WFish[]; phase: "ask" | "drop" | "weigh" | "paid" | "nope"; got?: number; q?: string }>(null);
  const [flakes, setFlakes] = useState<{ k: number; tx: number; ty: number }>({ k: 0, tx: 0, ty: 0 }); // 飞进罐子的鳞片（k 变了就是一批新的；tx/ty = 从柜台到罐子）
  const jarRef = useRef<HTMLDivElement>(null); const topRef = useRef<HTMLDivElement>(null);
  const flyScales = () => { const a = topRef.current?.getBoundingClientRect(), b = jarRef.current?.getBoundingClientRect(); if (!a || !b) return; setFlakes(o => ({ k: o.k + 1, tx: b.left + 14 - (a.left + a.width / 2), ty: b.top + 10 - (a.top + a.height * 0.45) })); };
  const [bait, setBait] = useState<string>(() => wallet.bait !== "worm" ? wallet.bait : "bread");
  const [n, setN] = useState(1);
  const [scoop, setScoop] = useState<null | { n: number; phase: "pour" | "seal" | "nope" }>(null);
  const [gear, setGear] = useState<{ kind: string; id: string } | null>(null);
  const [wrap, setWrap] = useState<null | "wrap" | "open" | "nope">(null);
  const [closing, setClosing] = useState(false);
  const away = stall === "away", closed = stall === "closed";
  const tm = useRef<number[]>([]); const later = (f: () => void, ms: number) => { tm.current.push(window.setTimeout(f, ms)); };
  useEffect(() => { snd.sfx("slide", 1); const t = tm.current; return () => t.forEach(x => window.clearTimeout(x)); }, []);
  // 点秤砣本人：他会有反应。连着戳越来越不耐烦：抖毛（羽毛飘下来）→ 瞪你 → 弹一片亮鳞过来又收回去（只是动画，不真给）→ 装睡
  const [poke, setPoke] = useState<{ k: number; fx: "" | "feather" | "glare" | "coin" | "nap" }>({ k: 0, fx: "" }); const pokeN = useRef(0); const pokeT = useRef(0);
  const pokePel = () => {
    if (away || closed) return; const now = Date.now(); pokeN.current = now - pokeT.current < 2500 ? pokeN.current + 1 : 0; pokeT.current = now; const n = pokeN.current;
    if (n === 0) { setPoke(o => ({ k: o.k + 1, fx: "feather" })); snd.sfx("rustle"); doAct("sniff", pickLine(["别戳，毛乱了。", "……干嘛。", "看货，别看我。", "羽毛是不卖的。"])); }
    else if (n === 1) { setPoke(o => ({ k: o.k + 1, fx: "glare" })); snd.sfx("squawk"); doAct("peek", pickLine(["再戳收钱。", "我数着呢。第二下了。"])); }
    else if (n === 2) { setPoke(o => ({ k: o.k + 1, fx: "coin" })); snd.sfx("coin"); doAct("soft", "……拿去，别戳了。（弹过来一片，又收回去了）"); }
    else { setPoke(o => ({ k: o.k + 1, fx: "nap" })); snd.sfx("snore"); doAct("nap", "（装睡）"); pokeN.current = -1; }
  };
  const doAct = (a: Act, line?: string) => { if (away) return; setAct(o => ({ a, k: o.k + 1 })); if (line) setSay(o => ({ t: line, k: o.k + 1 })); };
  const close = () => { if (closing) return; setClosing(true); snd.sfx("slide", 0); later(onClose, 380); };
  const go = (p: Page) => { if (p === page) return; snd.sfx("paper"); setPage(p); setPan(null); setScoop(null); setWrap(null); setGear(null); };

  // 亮鳞：数字滚上去 / 滚下来
  const [shown, setShown] = useState(wallet.coins); const shownRef = useRef(wallet.coins); const [hold, setHold] = useState(false);
  useEffect(() => {
    const from = shownRef.current, to = wallet.coins; if (from === to || hold) return; const t0 = performance.now(), dur = 700; let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / dur), v = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); shownRef.current = v; setShown(v); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [wallet.coins, hold]);

  // ── 卖鱼 ──
  const price = new Map(wallet.sellable.map(x => [x.id, x.scales]));
  const onPan = new Set(pan?.fish.map(f => f.id) ?? []);
  const list = [...fish].reverse().filter(f => !onPan.has(f.id));
  const sellable = list.filter(f => price.get(f.id) != null); const total = sellable.reduce((a, f) => a + (price.get(f.id) ?? 0), 0);
  // 先放上秤报价（防误触）：点鱼 → 落到左盘、秤砣报个数 →「卖给他」才真卖，「拿回来」退回桶里。秤上有一条时再点别的 = 换一条
  const ask = (which: WFish[], q: string) => {
    if (busy || (pan && pan.phase !== "ask")) return; const v = which.reduce((a, f) => a + (price.get(f.id) ?? 0), 0);
    setPan({ fish: which, phase: "ask", got: v, q }); snd.sfx("clack");
    const junk = which.some(f => /boot|umbrella|duck/.test(f.species));
    doAct(junk ? "sniff" : "weigh", which.length > 1 ? `一共 ${which.length} 样，${v} 亮鳞。全给我？` : junk ? `${which[0].name}？……${v}，爱卖不卖。` : `${which[0].name}，${v} 亮鳞。卖不卖？`);
  };
  const takeBack = () => { if (pan?.phase !== "ask") return; snd.sfx("plop"); setPan(o => (o ? { ...o, phase: "nope" } : o)); doAct("peek", pickLine(["那留着吧。", "……舍不得就早说。", "嗯，不卖也行。"])); later(() => setPan(null), 600); };
  const sell = async () => {
    if (busy || !pan || pan.phase !== "ask") return; const which = pan.fish, q = pan.q ?? which[0].id; setPan({ fish: which, phase: "weigh" }); setHold(true);
    const t0 = Date.now(); const p = onSell(q);
    snd.sfx("scrape", Math.max(...which.map(f => f.rarity))); doAct(which.some(f => /boot|umbrella|duck/.test(f.species)) ? "sniff" : "weigh");
    const r = await p; const wait = Math.max(0, 900 - (Date.now() - t0));
    later(() => {
      if (!r?.ok) { setHold(false); setPan(o => (o ? { ...o, phase: "nope" } : o)); snd.sfx("nope"); doAct("soft", "……这个不收。"); later(() => setPan(null), 700); return; }
      setPan(o => (o ? { ...o, phase: "paid", got: r.got } : o)); flyScales(); later(() => { snd.sfx("coin"); setHold(false); }, 900);
      doAct("deal", r.repay ? `先扣你欠的 ${r.repay}。` : (r.got ?? 0) >= 300 ? "……这条不错。" : "拿去，别讲价。");
      later(() => setPan(null), 1700);
    }, wait);
  };

  // ── 买饵 ──
  const baits = (wallet.catalog.bait ?? []);
  const bi = baits.find(x => x.id === bait) ?? baits[0];
  const buyBait = async () => {
    if (!bi || busy || scoop) return; const k = n; setScoop({ n: k, phase: "pour" }); setHold(true); const per = k > 5 ? 260 : 420;
    for (let i = 0; i < Math.min(k, 10); i++) later(() => snd.sfx("scoop"), 180 + i * per);
    const t0 = Date.now(); const r = await onBuy(bi.id, k); const wait = Math.max(0, 260 + Math.min(k, 10) * per - (Date.now() - t0));
    later(() => {
      if (!r?.ok) { setHold(false); setScoop({ n: k, phase: "nope" }); snd.sfx("nope"); doAct("soft", "不赊账。"); later(() => setScoop(null), 900); return; }
      setScoop({ n: k, phase: "seal" }); snd.sfx("fold"); later(() => { snd.sfx("stamp"); setHold(false); }, 380);
      if (r.soft) doAct("soft", "不赊账……（停了两秒）……这次算了。"); else doAct("deal", k >= 5 ? "囤这么多？……行吧，给你多压了压。" : "钱货两清，出门不认。");
      later(() => { setScoop(null); setN(1); }, 1900);
    }, wait);
  };
  const equipBait = async () => { if (!bi || busy) return; snd.sfx("clack"); await onEquip(bi.id, "bait"); };

  // ── 钓具 ──
  const gi = gear ? wallet.catalog[gear.kind]?.find(x => x.id === gear.id) : undefined;
  const pickGear = (kind: string, id: string) => { snd.sfx("swing"); setGear({ kind, id }); setWrap(null); };
  const pickMisc = (kind: string, id: string) => { snd.sfx(kind === "decor" ? "chime" : "swing", id.length); setGear({ kind, id }); setWrap(null); if (MISC_LINE[id]) doAct("peek", MISC_LINE[id]); };
  const buyGear = async () => {
    if (!gear || !gi || busy || wrap) return; setWrap("wrap"); setHold(true); snd.sfx("rustle"); later(() => snd.sfx("ribbon"), 520);
    const t0 = Date.now(); const r = await onBuy(gi.id); const wait = Math.max(0, 1000 - (Date.now() - t0));
    later(() => {
      setHold(false); if (!r?.ok) { setWrap("nope"); snd.sfx("nope"); doAct("soft", "亮鳞不够。……先去钓几条。"); later(() => setWrap(null), 900); return; }
      snd.sfx("clasp"); doAct("deal", pickLine(["好东西。别弄丢了。", "这个我本来想自己留着的。", "……拿好。"])); later(() => { setWrap("open"); snd.sfx("paper"); }, 1400); later(() => setWrap(null), 1850);
    }, wait);
  };

  const row = ACT_ROW[act.a];
  return (
    <div className={`${s.mask}${closing ? ` ${s.maskOut}` : ""}`} onClick={close}>
      <div className={s.stall} onClick={e => e.stopPropagation()}>
        {/* 遮阳棚 + 招牌 + 亮鳞罐 */}
        <div className={s.awning} aria-hidden><i className={s.scallop} /></div>
        <div className={s.sign}><b>秤砣的小摊</b><span>{STALL_TIP[stall]}</span></div>
        <div ref={jarRef} className={s.jar} title="亮鳞"><i className={s.jarGlass}><em style={{ height: `${Math.min(100, 18 + Math.log10(1 + shown) * 20)}%` }} /></i><b>{shown}</b><small>亮鳞</small>{wallet.debt > 0 && <u>欠 {wallet.debt}</u>}</div>
        <button type="button" className={s.x} onClick={close} aria-label="合上">×</button>

        <div className={s.body}>
          {/* 左：柜台 */}
          <div className={s.counter}>
            {!away && <div className={`${s.pelWrap}${poke.fx ? ` ${s[`poke_${poke.fx}`]}` : ""}`} onClick={pokePel} role="button" aria-label="戳一下秤砣">{poke.fx === "feather" && <i key={`f${poke.k}`} className={s.feathers} aria-hidden>{Array.from({ length: 5 }, (_, i) => <i key={i} style={{ "--i": i } as React.CSSProperties} />)}</i>}{poke.fx === "coin" && <i key={`c${poke.k}`} className={s.tossCoin} aria-hidden />}{poke.fx === "nap" && <i key={`z${poke.k}`} className={s.zz} aria-hidden>z<i>z</i></i>}<div key={act.k} className={s.pel} style={{ backgroundImage: `url(${actsPng})`, backgroundPositionY: `${-row * 74 * 1.5}px` }} data-act={act.a} /></div>}
            {away && <div className={s.awayNote}><img src="/fanart/b2-m-teacup.png" alt="" /><span>喝茶去了<br />自己拿，鳞片放罐里</span></div>}
            {!away && <div key={`s${say.k}`} className={s.say}>{say.t}</div>}
            <div ref={topRef} className={s.top}>
              {page === "sell" && <Scale pan={pan} busy={busy} onSell={() => void sell()} onBack={takeBack} />}
              {page === "bait" && bi && <BaitDesk it={bi} n={n} setN={setN} scoop={scoop} wallet={wallet} busy={busy} onBuy={buyBait} onEquip={equipBait} />}
              {page === "misc" && <MiscDesk kind={gear?.kind} it={gi} wallet={wallet} wrap={wrap} busy={busy} onBuy={buyGear} />}
              {page === "gear" && <GearDesk kind={gear?.kind} it={gi} wallet={wallet} wrap={wrap} busy={busy} onBuy={buyGear} onEquip={() => { if (gear) { snd.sfx("clack"); void onEquip(gear.id, gear.kind); } }} />}
            </div>
            {flakes.k > 0 && <div key={flakes.k} className={s.flakes} style={{ "--tx": `${flakes.tx}px`, "--ty": `${flakes.ty}px` } as React.CSSProperties} aria-hidden>{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ "--d": `${i * 0.06}s`, "--x": `${(i % 3) * 7 - 7}px`, "--arc": `${-30 - (i % 4) * 14}px` } as React.CSSProperties} />)}</div>}
            <div className={s.tabs}>
              {([["sell", "卖鱼"], ["bait", "鱼饵"], ["gear", "钓具"], ["misc", "杂货"]] as const).map(([k, t], i) => (
                <button key={k} type="button" className={`${s.tab}${page === k ? ` ${s.on}` : ""}`} style={{ animationDelay: `${0.35 + i * 0.08}s` }} onClick={() => go(k)}>{t}</button>
              ))}
            </div>
          </div>

          {/* 右：货 */}
          <div key={page} className={`${s.goods}${page !== "sell" ? ` ${s.plain}` : ""}`}>
            {closed && <div className={s.shutter}><b>打烊了</b><span>秤砣回家睡觉，凌晨 6 点开门。</span></div>}
            {!closed && page === "sell" && (<>
              <div className={s.sellTop}><img src="/fanart/b2-m-basket.png" alt="" /><span>你的桶 {wallet.bucketUsed}/{wallet.bucketSize}</span>
                {total > 0 && <button type="button" className={s.btnMain} disabled={busy || (!!pan && pan.phase !== "ask")} onClick={() => ask(sellable, "全部")}>全卖了 <i className={s.sc} />+{total}</button>}</div>
              {!list.length && !pan && <p className={s.empty}>桶是空的。<br />秤砣：「空手来的？……」</p>}
              <div className={s.fishList}>
                {list.map((f, i) => { const v = price.get(f.id); return (
                  <button key={f.id} type="button" className={s.fishCard} style={{ animationDelay: `${Math.min(i, 10) * 0.04}s`, "--rc": RC[f.rarity] } as React.CSSProperties} disabled={v == null || busy || (!!pan && pan.phase !== "ask")} onClick={() => ask([f], f.id)}>
                    <img src={`/world-fish/${f.species}.png`} alt="" />
                    <span><b>{f.name}</b><em>{"★".repeat(f.stars)} · {f.kg}kg</em></span>
                    {v == null ? <small className={s.keep}>留着</small> : <small className={s.tag}><i className={s.sc} />{v}</small>}
                  </button>); })}
              </div>
            </>)}
            {!closed && page === "bait" && (
              <div className={s.shelf}>
                {baits.map((it, i) => { const off = !it.onSale && it.price != null; return <ShelfBtn key={it.id} src={art("bait", it.id)} name={it.name} sub={off ? "现在不卖" : `${it.price} · ${it.pack ?? 10} 份`} on={bi?.id === it.id} off={off} have={Number(it.owned) > 0 ? `×${String(it.owned)}` : undefined} using={wallet.bait === it.id} i={i} onPick={() => { if (scoop) return; snd.sfx("clack"); setBait(it.id); setN(1); }} />; })}
              </div>
            )}
            {!closed && page === "misc" && (
              <div className={s.misc}>
                <section><em className={s.shelfName}>杂货板 · 用了就没</em>
                  <div className={s.peg}>
                    {(wallet.catalog.item ?? []).map((it, i) => { const n = Number(it.owned) || 0; return (
                      <button key={it.id} type="button" className={`${s.hook}${gear?.id === it.id ? ` ${s.hookOn}` : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={() => pickMisc("item", it.id)}>
                        <i className={s.pin} /><i className={s.twine} /><span className={s.hang}><img src={art("item", it.id)} alt="" draggable={false} /></span>
                        <b>{it.name.replace("秤砣的", "")}</b><small>{it.onSale ? it.price : "现在不卖"}</small>{n > 0 && <em className={s.have}>×{n}</em>}
                      </button>); })}
                  </div>
                </section>
                <section><em className={s.shelfName}>小橱窗 · 小屋摆设</em>
                  <div className={s.vitrine}><i className={s.glare} aria-hidden />
                    {(wallet.catalog.decor ?? []).map((it, i) => (
                      <button key={it.id} type="button" className={`${s.show} ${s[`d_${it.id.replace("decor_", "")}`] ?? ""}${gear?.id === it.id ? ` ${s.showOn}` : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={() => pickMisc("decor", it.id)}>
                        <span className={s.showArt}><img src={art("decor", it.id)} alt="" draggable={false} /></span>
                        <b>{it.name}</b><small>{it.owned ? "收着了" : it.price}</small>
                      </button>))}
                  </div>
                </section>
              </div>
            )}
            {!closed && page === "gear" && (
              <div className={s.gearShelves}>
                {GEAR_KINDS.map((k, r) => { const items = (wallet.catalog[k] ?? []).filter(it => it.price !== 0); if (!items.length) return null; return (
                  <section key={k}><em className={s.shelfName}>{SLOT_NAME[k]}</em>
                    <div className={s.shelf}>
                      {items.map((it, i) => { const owned = !!it.owned, using = wallet.gear[k] === it.id; return (
                        <ShelfBtn key={it.id} src={art(k, it.id)} name={it.name} sub={using ? "在用" : owned ? "有了" : it.price == null ? "钓到才有" : String(it.price)} on={gear?.id === it.id} owned={owned} i={r * 2 + i} onPick={() => pickGear(k, it.id)} />); })}
                    </div>
                  </section>); })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
const RC = ["#C9B8BF", "#8FC7A8", "#8FB3E8", "#C39BE8", "#F2B45A"];
const pickLine = (a: string[]) => a[Math.floor(Math.random() * a.length)];

/** 天平：画的黄铜天平拆成三件（public/world-gear/scale_*）。底座不动；横梁绕柱顶的轴转；两个秤盘挂在梁两头的钩子上，跟着一上一下但一直竖直。
 * 左盘放鱼（重的那边沉），报价时停着等玩家点；卖了右盘堆起亮鳞、慢慢摆平。尺寸按原图量的（显示 px）：轴在 (120, 14) */
const PIV = { x: 120, y: 14 }, HOOK = { l: -80.5, r: 81, dy: 23.7 }, PAN = { ax: 37.6, ay: 4.8 };
function Scale({ pan, busy, onSell, onBack }: { pan: null | { fish: WFish[]; phase: string; got?: number }; busy: boolean; onSell: () => void; onBack: () => void }) {
  const tilt = !pan ? 0 : pan.phase === "ask" ? -7 : pan.phase === "drop" ? -10 : pan.phase === "weigh" ? -4 : pan.phase === "paid" ? 0 : 3;
  const r = (tilt * Math.PI) / 180, hook = (dx: number) => ({ x: PIV.x + dx * Math.cos(r) - HOOK.dy * Math.sin(r), y: PIV.y + dx * Math.sin(r) + HOOK.dy * Math.cos(r) });
  const L = hook(HOOK.l), R = hook(HOOK.r); const shown = pan?.fish.slice(0, 6) ?? [];
  const panAt = (p: { x: number; y: number }) => ({ transform: `translate(${p.x - PAN.ax}px, ${p.y - PAN.ay}px)` });
  return (
    <div className={s.scale}>
      <img className={s.stand} src="/world-gear/scale_stand.webp" alt="" draggable={false} />
      <i className={s.needle} style={{ transform: `rotate(${-tilt * 2.2}deg)` }} />
      <img className={s.beam} src="/world-gear/scale_beam.webp" alt="" draggable={false} style={{ transform: `rotate(${tilt}deg)` }} />
      <div className={s.pan} style={panAt(L)}>
        <img src="/world-gear/scale_pan.webp" alt="" draggable={false} />
        {shown.map((f, i) => <img key={f.id} className={`${s.onPan}${pan?.phase === "paid" ? ` ${s.gone}` : ""}${pan?.phase === "nope" ? ` ${s.back}` : ""}`} src={`/world-fish/${f.species}.png`} alt="" style={{ animationDelay: `${i * 0.07}s`, bottom: `${22 + Math.floor(i / 2) * 5}px`, left: `${50 + (i % 2 ? 11 : -11) * Math.min(1, shown.length - 1)}%` }} />)}
      </div>
      <div className={s.pan} style={panAt(R)}>
        <img src="/world-gear/scale_pan.webp" alt="" draggable={false} />
        {pan && (pan.phase === "weigh" || pan.phase === "paid") && Array.from({ length: 8 }, (_, i) => <i key={i} className={s.pile} style={{ animationDelay: `${i * 0.09}s`, left: `${28 + (i % 4) * 13}%`, bottom: `${22 + Math.floor(i / 4) * 4}px` }} />)}
      </div>
      {pan?.phase === "paid" && <b className={s.plus}>+{pan.got}</b>}
      {pan?.phase === "ask" ? (
        <div className={s.askRow}><button type="button" className={s.btnGhost} onClick={onBack}>拿回来</button><button type="button" className={s.btnMain} disabled={busy} onClick={onSell}>卖给他 · <i className={s.sc} />{pan.got}</button></div>
      ) : !pan && <span className={s.hint}>点一条鱼，放上来称</span>}
    </div>
  );
}

/** 钓具箱那套贴纸 */
const art = (kind: string, id: string) => `/world-gear/${kind}_${id}.webp`;
/** 木架上的一格：贴纸立在木板上，下面名字和价钱 */
function ShelfBtn({ src, name, sub, on, off, have, using, owned, i, onPick }: { src: string; name: string; sub: string; on: boolean; off?: boolean; have?: string; using?: boolean; owned?: boolean; i: number; onPick: () => void }) {
  return (
    <button type="button" className={`${s.item}${on ? ` ${s.itemOn}` : ""}${off ? ` ${s.off}` : ""}${owned ? ` ${s.owned}` : ""}`} style={{ animationDelay: `${i * 0.05}s` }} onClick={onPick}>
      <span className={s.itemArt}><img src={src} alt="" draggable={false} /></span>
      <b>{name}</b><small>{sub}</small>
      {have && <em className={s.have}>{have}</em>}
      {using && <u className={s.usingTag}>在用</u>}
    </button>
  );
}

/** 柜台上：选中的那罐 + 纸袋 + 「− n 袋 +」 */
function BaitDesk({ it, n, setN, scoop, wallet, busy, onBuy, onEquip }: { it: WShopItem; n: number; setN: (f: (v: number) => number) => void; scoop: null | { n: number; phase: string }; wallet: WWallet; busy: boolean; onBuy: () => void; onEquip: () => void }) {
  const c = JAR[it.id] ?? JAR.bread; const off = !it.onSale; const using = wallet.bait === it.id; const have = Number(it.owned) > 0;
  const per = scoop && scoop.n > 5 ? 0.26 : 0.42;
  const cost = (it.price ?? 0) * n; const short = cost > wallet.coins && !(n === 1 && !(wallet.debt > 0));
  return (
    <div className={s.baitDesk}>
      <div className={s.deskRow}>
        <div className={s.deskJar}><img key={it.id} className={s.deskArt} src={art("bait", it.id)} alt="" draggable={false} />{scoop?.phase === "pour" && <i className={s.spoon} style={{ "--per": `${per}s`, "--a": c.a, animationIterationCount: Math.min(scoop.n, 10) } as React.CSSProperties} />}</div>
        <div className={`${s.bag}${scoop?.phase === "seal" ? ` ${s.sealed}` : ""}${scoop?.phase === "nope" ? ` ${s.shake}` : ""}`} style={{ "--per": `${per}s`, "--a": c.a, animationIterationCount: scoop?.phase === "pour" ? Math.min(scoop.n, 10) : 0 } as React.CSSProperties}>
          <i className={s.bagFill} style={{ height: scoop ? "58%" : 0, transitionDuration: scoop?.phase === "pour" ? `${Math.min(scoop.n, 10) * per}s` : "0s" }} /><i className={s.bagTop} /><b>{scoop ? `${scoop.n} 袋` : "纸袋"}</b>{scoop?.phase === "seal" && <em className={s.stampMark}>已付</em>}
        </div>
      </div>
      <p className={s.note}><b>{it.name}</b> {it.note}</p>
      {off ? <p className={s.note}>现在不卖（限时的）。</p> : (
        <div className={s.buyRow}>
          <div className={s.stepper}><button type="button" disabled={n <= 1 || !!scoop} onClick={() => { snd.sfx("tap"); setN(v => Math.max(1, v - 1)); }}>−</button><b key={n}>{n}</b><span>袋</span><button type="button" disabled={n >= 10 || !!scoop} onClick={() => { snd.sfx("tap"); setN(v => Math.min(10, v + 1)); }}>+</button></div>
          <button type="button" className={s.btnMain} disabled={busy || !!scoop || short} onClick={onBuy}>舀 {n * (it.pack ?? 10)} 份 · <i className={s.sc} />{cost}</button>
        </div>
      )}
      {have && !using && <button type="button" className={s.btnGhost} disabled={busy} onClick={onEquip}>换上（有 {String(it.owned)} 份）</button>}
      {using && <span className={s.onNote}>正在用 · 还有 {wallet.baits[it.id] ?? 0} 份</span>}
    </div>
  );
}

/** 柜台上：从杂货板钩子上跳下来 / 从橱窗里拿出来的那样。道具能一直买（布袋里记个数），摆设买一次收着 */
function MiscDesk({ kind, it, wallet, wrap, busy, onBuy }: { kind?: string; it?: WShopItem; wallet: WWallet; wrap: null | "wrap" | "open" | "nope"; busy: boolean; onBuy: () => void }) {
  if (!kind || !it) return <div className={s.gearDesk}><span className={s.hint}>点一样，拿到柜台上看看</span></div>;
  const have = kind === "item" ? Number(it.owned) || 0 : 0, kept = kind === "decor" && !!it.owned; const p = it.price ?? 0;
  return (
    <div key={it.id} className={s.gearDesk}>
      <div className={`${s.tray} ${s.hopDown}${wrap === "wrap" ? ` ${s.wrapping}` : wrap === "open" ? ` ${s.opening}` : ""}${wrap === "nope" ? ` ${s.shake}` : ""}`}>
        <img className={s.deskArt} src={art(kind, it.id)} alt="" draggable={false} /><i className={s.paperL} /><i className={s.paperR} /><i className={s.bow} />
      </div>
      <p className={s.note}><b>{it.name}</b> {it.note}</p>
      {kept ? <span className={s.onNote}>收着了 · 树洞小屋做好就摆进去</span>
        : !it.onSale ? <span className={s.onNote}>现在不卖</span>
        : <button type="button" className={s.btnMain} disabled={busy || !!wrap || wallet.coins < p} onClick={onBuy}>{wallet.coins < p ? `还差 ${p - wallet.coins}` : <>{have ? "再买一个" : "买下"} · <i className={s.sc} />{p}</>}</button>}
      {have > 0 && <span className={s.onNote}>布袋里有 {have} 个 · 右边「布袋」里用</span>}
    </div>
  );
}

/** 柜台上：从挂板取下来的那件 */
function GearDesk({ kind, it, wallet, wrap, busy, onBuy, onEquip }: { kind?: string; it?: WShopItem; wallet: WWallet; wrap: null | "wrap" | "open" | "nope"; busy: boolean; onBuy: () => void; onEquip: () => void }) {
  if (!kind || !it) return <div className={s.gearDesk}><span className={s.hint}>挂板上点一件，拿下来看看</span></div>;
  const owned = !!it.owned, using = wallet.gear[kind] === it.id;
  return (
    <div key={it.id} className={s.gearDesk}>
      <div className={`${s.tray}${wrap === "wrap" ? ` ${s.wrapping}` : wrap === "open" ? ` ${s.opening}` : ""}${wrap === "nope" ? ` ${s.shake}` : ""}`}>
        <img className={s.deskArt} src={art(kind, it.id)} alt="" draggable={false} /><i className={s.paperL} /><i className={s.paperR} /><i className={s.bow} />
      </div>
      <p className={s.note}><b>{it.name}</b> {it.note}</p>
      {using ? <span className={s.onNote}>正在用</span>
        : owned ? <button type="button" className={s.btnMain} disabled={busy} onClick={onEquip}>换上</button>
        : it.price == null ? <span className={s.onNote}>钓到{it.need === "pal_card" ? "一张明信片" : it.need === "buddy_pencil" ? "一支铅笔" : it.need === "player_clip" ? "你的发卡" : "那件东西"}才有</span>
        : !it.onSale ? <span className={s.onNote}>现在不卖</span>
        : <button type="button" className={s.btnMain} disabled={busy || !!wrap || wallet.coins < it.price} onClick={onBuy}>{wallet.coins < it.price ? `还差 ${it.price - wallet.coins}` : <>买下 · <i className={s.sc} />{it.price}</>}</button>}
    </div>
  );
}
