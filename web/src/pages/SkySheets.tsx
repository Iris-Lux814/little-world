// 小屋「看望远镜」「看窗外」。
// 望远镜：黄铜目镜框里是此刻玩家头顶真实的星空（SkyCanvas），拖着转、捏着放大，对准星座连线一笔笔亮、出一句小故事，对准星系星云对焦显出真照片。
// 看窗外：圆窗里是此刻真实的天色、星星和月相，窗外的景按白天 / 黄昏 / 夜里换；下雨玻璃上有水往下流，夜里偶尔一颗流星。
// 天气：世界服务的星空不带天气（weather = null）时，用游戏里此刻的天气（wx，跟池塘那块一样）。
// fixed：截图用（塞进固定的星空和镜头朝向，不能动）。
import { useEffect, useMemo, useRef, useState } from "react";
import s from "./SkySheets.module.css";
import SkyCanvas, { type SkyFocus } from "../components/SkyCanvas";
import { snd } from "../pixel/sound";
import { altAz, dirName, lst, skyApi, type SkyCatalog, type SkyNow, type View } from "../lib/sky";
import { bridgeUrl } from "../api/ccBridge";
import { primaryEndpoint } from "../store/useEndpoints";

export type SkyFixed = { cat: SkyCatalog; now: SkyNow; view?: View };
/** 深空天体照片：世界服务给的是 /api/world/sky/img/... 相对地址 → 拼上服务地址 */
function imgUrl(p: string) { if (!p.startsWith("/api/")) return p; const ep = primaryEndpoint(); return ep ? bridgeUrl(ep, p) : p; }

function useSky(fixed?: SkyFixed, wx?: string) {
  const wxRef = useRef(wx); wxRef.current = wx; const noSrvWx = useRef(false); // 服务端没给天气 → 用游戏天气
  const [cat, setCat] = useState<SkyCatalog | null>(fixed?.cat ?? null); const [now, setNow] = useState<SkyNow | null>(fixed?.now ?? null); const [err, setErr] = useState("");
  useEffect(() => { if (fixed) return; let alive = true;
    // 星表和此刻分开存，缺哪份重试哪份（以前一份失败两份都不落，后面只重试 now，星图一直出不来）
    let haveCat = false, haveNow = false, t = 0;
    const load = () => {
      if (!haveCat) skyApi.catalog().then(c => { if (!alive) return; haveCat = true; setCat({ ...c, deep: c.deep.map(o => ({ ...o, img: imgUrl(o.img) })) }); if (haveNow) setErr(""); }).catch(e => alive && setErr((e as Error).message));
      skyApi.now().then(n => { if (!alive) return; haveNow = true; noSrvWx.current = !n.weather; setNow(n.weather ? n : { ...n, weather: { text: wxRef.current ?? "" } }); if (haveCat) setErr(""); }).catch(e => alive && setErr((e as Error).message));
      t = window.setTimeout(load, haveCat && haveNow ? 5 * 60000 : 8000); // 都有了五分钟对一次月亮行星天气；缺的 8 秒后再试
    };
    load();
    return () => { alive = false; clearTimeout(t); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 游戏天气变了（下雨 / 放晴）马上跟上，不用等五分钟那次
  useEffect(() => { if (wx != null && noSrvWx.current) setNow(n => (n && !fixed && (n.weather?.text ?? "") !== wx ? { ...n, weather: { text: wx } } : n)); }, [wx, fixed]);
  return { cat, now, err };
}
const isDay = (n: SkyNow) => n.sun.alt > 4;
const isDusk = (n: SkyNow) => n.sun.alt <= 4 && n.sun.alt > -8;
/** 太阳正在升（时角为负 = 还在东边）→ 清晨；只看观测位置和时间，跟手机时区无关 */
const sunRising = (n: SkyNow) => ((lst(n.at, n.where.lon) - n.sun.ra + 540) % 360) - 180 < 0;

/* ───────── 望远镜 ───────── */
export function TelescopeSheet({ onClose, fixed, wx }: { onClose: () => void; fixed?: SkyFixed; wx?: string }) {
  const { cat, now, err } = useSky(fixed, wx);
  const [view, setView] = useState<View>(fixed?.view ?? { az: 180, alt: 42, half: 30 });
  const [focus, setFocus] = useState<SkyFocus>(null); const [story, setStory] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => { if (!fixed) snd.sfx("brass"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 一打开：月亮在天上就先对着月亮（不然对着正南偏上）
  const aimed = useRef(false);
  useEffect(() => { if (aimed.current || !now || fixed?.view) return; aimed.current = true; if (now.moon.alt > 8 && now.moon.alt < 80) setView(v => ({ ...v, az: now.moon.az, alt: now.moon.alt })); }, [now]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { if (closing) return; setClosing(true); snd.sfx("fold"); window.setTimeout(onClose, 420); };
  // 自测用：对准某个赤经赤纬（frames.cjs 截图时调）
  useEffect(() => { if (!now) return; (window as unknown as { __skyAim?: unknown }).__skyAim = (ra: number, dec: number, half: number) => { const [alt, az] = altAz(ra, dec, now.where.lat, lst(now.at, now.where.lon)); setView({ az, alt, half }); }; }, [now]);
  const day = now ? isDay(now) : false;
  const wt = now?.weather?.text ?? ""; const dim = now ? Math.min(1, (now.weather?.cloud ?? (/雨|雪/.test(wt) ? 0.95 : /阴/.test(wt) ? 0.85 : /雾/.test(wt) ? 0.7 : /云/.test(wt) ? 0.4 : 0))) : 0;
  return (
    <div className={`${s.mask} ${closing ? s.out : ""}`}>
      <div className={s.cabinBlur} />
      <div className={s.scopeWrap}>
        <div className={s.lens}>
          {cat && now ? <SkyCanvas cat={cat} now={now} view={view} interactive={!fixed} focusable round minHalf={2.5} maxHalf={55} minAlt={-5} dim={dim}
            onView={setView} onFocus={f => { setFocus(f); setStory(false); }} onTick={k => snd.sfx(k === "turn" ? "gear" : k === "focus" ? "focus" : "constel", 0, k === "turn" ? 0.6 : 1)} />
            : <div className={s.loading}>{err || "镜头对焦中…"}</div>}
          
          <i className={s.vignette} />
          {day && <div className={s.dayTip}>星星都在，天亮了看不见</div>}
          {!day && dim > 0.6 && <div className={s.dayTip}>{wt}，云把星星挡住了一些</div>}
        </div>
        <img className={s.brass} src="/world-sky/brass.webp" alt="" draggable={false} />
      </div>
      <div className={s.aimPlate}>正对 {dirName(view.az)} · 高 {Math.round(view.alt)}°{view.half < 12 ? ` · ×${Math.round(30 / view.half)}` : ""}</div>
      {focus && <div className={s.focusCard} key={focus.kind === "line" ? focus.line.name : focus.deep.id} onClick={() => { if (!story) snd.sfx("paper"); setStory(x => !x); }}>
        {focus.kind === "line" ? <><b>{focus.line.name}</b>{focus.line.story && <span className={story ? s.storyOn : s.storyTap}>{story ? focus.line.story : "点一下听它的故事"}</span>}</>
          : <><b>{focus.deep.name}</b>{focus.deep.dist && <span className={s.dist}>离我们 {focus.deep.dist}</span>}<small>真实照片{focus.deep.credit ? ` · ${focus.deep.credit}${focus.deep.license ? `（${focus.deep.license}）` : ""}` : ""}{focus.deep.source && /^https:\/\//.test(focus.deep.source) && <> · <a href={focus.deep.source} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>来源</a></>}</small></>}
      </div>}
      {!fixed && <div className={s.hint}>拖着转 · 捏着放大</div>}
      {now?.where.city && <div className={s.city}>{now.where.city}的天空 · 此刻</div>}
      {!fixed && <button type="button" className={s.close} onClick={close} aria-label="不看了" />}
    </div>
  );
}

/* ───────── 看窗外 ───────── */
const MOON_NAME = (n: SkyNow) => n.moon.name || "";
export function WindowSheet({ onClose, fixed, wx }: { onClose: () => void; fixed?: SkyFixed; wx?: string }) {
  const { cat, now, err } = useSky(fixed, wx);
  const [closing, setClosing] = useState(false);
  useEffect(() => { if (!fixed) snd.sfx("sash"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { if (closing) return; setClosing(true); snd.sfx("fold"); window.setTimeout(onClose, 420); };
  const wxT = now?.weather?.text ?? ""; const rain = /雨/.test(wxT), fog = /雾|霾/.test(wxT), wind = /风/.test(wxT), snow = /雪/.test(wxT);
  const phase = now ? (isDay(now) ? "day" : isDusk(now) ? "dusk" : "night") : "night";
  const land = `/world-sky/land_${phase}.webp`;
  const plate = now ? `${phase === "day" ? "白天" : phase === "dusk" ? (sunRising(now) ? "清晨" : "黄昏") : "今晚"}${phase !== "day" && MOON_NAME(now) && now.moon.alt > 0 ? ` · ${MOON_NAME(now)}` : ""} · ${wxT || "晴"}` : "";
  // 窗外看出去的方向（固定朝南偏东一点、略往上），星星 / 月亮照真实位置画在这片天里
  const view = useMemo<View>(() => fixed?.view ?? { az: 165, alt: 26, half: 42 }, [fixed?.view]);
  const dim = now ? Math.min(1, now.weather?.cloud ?? (rain || snow ? 0.95 : fog ? 0.7 : /阴/.test(wxT) ? 0.85 : /云/.test(wxT) ? 0.4 : 0)) : 0;
  const [meteor, setMeteor] = useState(0);
  useEffect(() => { if (phase !== "night" || dim > 0.5 || fixed) return; let t = 0; const go = () => { t = window.setTimeout(() => { setMeteor(Date.now()); go(); }, 7000 + Math.random() * 9000); }; go(); return () => clearTimeout(t); }, [phase, dim, fixed]);
  return (
    <div className={`${s.mask} ${closing ? s.out : ""}`}>
      <div className={s.cabinBlur} />
      <div className={s.winWrap}>
        <div className={s.view}>
          {cat && now ? <SkyCanvas cat={cat} now={now} view={view} dim={dim} /> : <div className={s.loading}>{err || "推开窗…"}</div>}
          {meteor > 0 && <i className={s.meteor} key={meteor} style={{ left: `${20 + (meteor % 50)}%`, top: `${8 + (meteor % 17)}%` }} />}
          <img className={`${s.land} ${wind ? s.landWind : ""}`} src={land} alt="" draggable={false} />
          {phase === "night" && <i className={s.flies}>{Array.from({ length: 10 }, (_, i) => <em key={i} style={{ "--i": i } as React.CSSProperties} />)}</i>}
          {fog && <><i className={s.fog} /><i className={`${s.fog} ${s.fog2}`} /></>}
          {snow && <i className={s.snow} />}
          {rain && <><i className={s.rainFar} /><i className={s.glass}>{Array.from({ length: 14 }, (_, i) => <em key={i} style={{ "--i": i } as React.CSSProperties} />)}</i></>}
          <i className={s.pane} />
        </div>
        <img className={`${s.frame} ${wind ? s.frameWind : ""}`} src="/world-sky/winframe.webp" alt="" draggable={false} />
        {plate && <div className={s.sill}>{plate}</div>}
      </div>
      {!fixed && <button type="button" className={s.close} onClick={close} aria-label="不看了" />}
    </div>
  );
}
