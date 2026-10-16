// 小世界设置（怀表和音乐按钮去掉，做一个设置页，音乐能调大小、走路和钓鱼的音效单独调；以后邀请朋友也放这里）。
// 一页手账从左边翻进来（左上角贴纸胶带）；声音每一类是一根缎带，拖上面的蝴蝶结调大小，蝴蝶结被拖着会晃，松手放一声试听；
// 缎带一行一行依次滑进来。底下「我的小人」进换小人那页。
import { useEffect, useRef, useState } from "react";
import s from "./WorldSettings.module.css";
import { snd, type VolKey } from "../pixel/sound";
import { skyApi, type SkyNow } from "../lib/sky";

const ROWS: { k: VolKey; name: string; note: string; icon: string }[] = [
  { k: "music", name: "音乐", note: "八音盒", icon: "/fanart/b2-m-teacup.png" },
  { k: "amb", name: "环境声", note: "雨 · 风 · 海浪 · 虫鸣", icon: "/fanart/b2-cloud.png" },
  { k: "fish", name: "钓鱼", note: "甩竿 · 咬钩 · 收线 · 钓到", icon: "/fanart/b2-cat-fish.png" },
  { k: "step", name: "脚步", note: "草地 · 沙滩 · 木板 · 石板", icon: "/fanart/b2-m-walk.png" },
  { k: "life", name: "动静", note: "秤砣 · 别人钓到 · 冒泡", icon: "/fanart/b2-mouse.png" },
  { k: "ui", name: "按钮", note: "翻书 · 点按", icon: "/fanart/b2-heart.png" },
];

function Ribbon({ k }: { k: VolKey }) {
  const [v, setV] = useState(snd.vol[k]); const [drag, setDrag] = useState(false); const ref = useRef<HTMLDivElement>(null);
  const at = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); const rot = Math.abs(r.height) > Math.abs(r.width); // 舞台可能转了 90°
    const x = rot ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width; const nv = Math.round(Math.max(0, Math.min(1, x)) * 20) / 20; setV(nv); snd.setVol(k, nv); };
  return (
    <div ref={ref} className={`${s.ribbon}${drag ? ` ${s.drag}` : ""}`} style={{ "--v": v } as React.CSSProperties}
      onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(true); snd.unlock(); at(e); }}
      onPointerMove={e => { if (drag) at(e); }} onPointerUp={() => { setDrag(false); snd.preview(k); }} onPointerCancel={() => setDrag(false)}>
      <i className={s.track} /><i className={s.fill} />
      <img className={s.knob} src="/fanart/b2-bow-pink.png" alt="" draggable={false} />
      <span className={s.pct}>{v === 0 ? "关" : Math.round(v * 100)}</span>
    </div>
  );
}

/** 看星星的位置：望远镜 / 窗外按这里算头顶的星空。不填后端按时区估一个；只存在你自己的世界服务里。
 *  面板就在设置页里（跟游戏一起横着）。横着打字键盘是歪的，所以主要靠点：常用城市点一下就存、「定位」拿到就存；手填经纬度只是兜底 */
const CITIES: [string, number, number][] = [
  ["北京", 39.9, 116.4], ["上海", 31.2, 121.5], ["广州", 23.1, 113.3], ["深圳", 22.5, 114.1], ["杭州", 30.3, 120.2], ["南京", 32.1, 118.8], ["天津", 39.1, 117.2],
  ["成都", 30.7, 104.1], ["重庆", 29.6, 106.5], ["武汉", 30.6, 114.3], ["西安", 34.3, 108.9], ["长沙", 28.2, 113.0], ["青岛", 36.1, 120.4], ["厦门", 24.5, 118.1],
  ["昆明", 25.0, 102.7], ["哈尔滨", 45.8, 126.6], ["沈阳", 41.8, 123.4], ["拉萨", 29.7, 91.1], ["乌鲁木齐", 43.8, 87.6], ["三亚", 18.3, 109.5], ["香港", 22.3, 114.2], ["台北", 25.0, 121.5],
  ["东京", 35.7, 139.7], ["首尔", 37.6, 127.0], ["新加坡", 1.3, 103.8], ["悉尼", -33.9, 151.2], ["伦敦", 51.5, -0.1], ["巴黎", 48.9, 2.4], ["柏林", 52.5, 13.4],
  ["纽约", 40.7, -74.0], ["洛杉矶", 34.1, -118.2], ["温哥华", 49.3, -123.1], ["多伦多", 43.7, -79.4], ["雷克雅未克", 64.1, -21.9],
];
function SkyWhere() {
  const [where, setWhere] = useState<SkyNow["where"] | null>(null); const [err, setErr] = useState(""); const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false); const [lat, setLat] = useState(""); const [lon, setLon] = useState(""); const [busy, setBusy] = useState(false);
  const wrote = useRef(false); // 存过 / 清过：初次读取晚回来也不再用它（不然显示会退回旧位置）
  useEffect(() => { let alive = true; skyApi.now().then(n => { if (!alive || wrote.current) return; setWhere(n.where); }).catch(e => alive && setErr((e as Error).message)); return () => { alive = false; }; }, []);
  // 一次只做一件事：点城市 / 定位 / 清掉 / 手填存，都先拿锁（ref，回调里也是最新的），做完才放；
  // 定位从点下去到存完全程锁着；收起面板 / 离开设置页时序号 +1，还没回来的定位就作废
  const lock = useRef(false), act = useRef(0), alive = useRef(true), inFlight = useRef(false); // inFlight：存 / 清的请求已经发出去了
  useEffect(() => { alive.current = true; return () => { alive.current = false; act.current++; }; }, []); // StrictMode 开发时会 setup→cleanup→setup，所以 setup 里要置回 true
  const begin = () => { if (lock.current) return 0; lock.current = true; setBusy(true); setErr(""); return ++act.current; };
  const end = (id: number) => { if (id !== act.current) return; lock.current = false; if (alive.current) setBusy(false); };
  const valid = (la: number, lo: number) => Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180;
  const doSave = async (id: number, la: number, lo: number, name?: string) => {
    wrote.current = true; inFlight.current = true;
    try { const r = await skyApi.where(la, lo, name); if (!alive.current || id !== act.current) return; setWhere(r.where ?? { lat: la, lon: lo, city: name }); setOpen(false); setManual(false); snd.sfx("clasp"); }
    catch (e) { if (alive.current && id === act.current) { setErr(`没存上：${(e as Error).message}`); snd.sfx("nope"); } }
    finally { inFlight.current = false; end(id); }
  };
  const saveTo = (la: number, lo: number, name?: string) => {
    if (!valid(la, lo)) { setErr("纬度 -90～90、经度 -180～180"); snd.sfx("nope"); return; }
    const id = begin(); if (!id) return; void doSave(id, la, lo, name);
  };
  const locate = () => {
    if (!navigator.geolocation) { setErr("这个浏览器拿不到定位，点个城市或者手填吧"); return; }
    const id = begin(); if (!id) return; setErr("定位中…");
    navigator.geolocation.getCurrentPosition(p => {
      if (!alive.current || id !== act.current) return; setErr("");
      const la = Math.round(p.coords.latitude * 10) / 10, lo = Math.round(p.coords.longitude * 10) / 10;
      if (!valid(la, lo)) { setErr("定位回来的数不对，点个城市或者手填吧"); end(id); return; }
      void doSave(id, la, lo, "定位的地方");
    }, () => { if (!alive.current || id !== act.current) return; setErr("没拿到定位（局域网的 http 地址浏览器不给定位），点个城市或者手填吧"); end(id); }, { timeout: 10000 });
  };
  const clear = async () => {
    const id = begin(); if (!id) return; wrote.current = true; inFlight.current = true;
    try { const r = await skyApi.clearWhere(); if (!alive.current || id !== act.current) return; setWhere(r.where ?? (where ? { ...where, approx: true, city: "" } : null)); setOpen(false); setManual(false); snd.sfx("fold"); }
    catch (e) { if (alive.current && id === act.current) { setErr(`没清掉：${(e as Error).message}`); snd.sfx("nope"); } }
    finally { inFlight.current = false; end(id); }
  };
  /** 收起面板：还在等定位（请求没发）就作废、放锁；存 / 清的请求已经在路上就不放锁，等它回来自己放（不然下一次点击会跟它在服务端抢先后） */
  const fold = () => { if (!inFlight.current) { act.current++; lock.current = false; setBusy(false); } setOpen(false); setManual(false); };
  const label = where ? (where.approx ? "没填，按时区估的" : where.city || `${where.lat.toFixed(1)}°, ${where.lon.toFixed(1)}°`) : err ? "读不到" : "读取中…";
  const on = (c: [string, number, number]) => !!where && !where.approx && where.city === c[0];
  return (
    <>
      <div className={s.row} style={{ animationDelay: ".76s" }}>
        <img className={s.ico} src="/fanart/b2-star.png" alt="" /><div className={s.lbl}><b>看星星的位置</b><small>{label}</small></div>
        <button type="button" className={s.go} onClick={() => { snd.sfx("tap"); setErr(""); if (open) fold(); else setOpen(true); }}>{open ? "收起" : "改"}</button>
      </div>
      {open && (
        <div className={s.wherePanel}>
          <div className={s.chips}>{CITIES.map((c, i) => <button key={c[0]} type="button" disabled={busy} className={`${s.chip}${on(c) ? ` ${s.chipOn}` : ""}`} style={{ animationDelay: `${i * 0.012}s` }} onClick={() => saveTo(c[1], c[2], c[0])}>{c[0]}</button>)}</div>
          <div className={s.whereFoot}>
            <button type="button" className={s.go} disabled={busy} onClick={locate}>定位</button>
            <button type="button" className={s.go} disabled={busy} onClick={() => { snd.sfx("tap"); setManual(m => !m); }}>{manual ? "不手填了" : "手填经纬度"}</button>
            {where && !where.approx && <button type="button" className={s.go} disabled={busy} onClick={() => void clear()}>清掉</button>}
          </div>
          {manual && (
            <div className={s.whereLL}>
              <input value={lat} onChange={e => setLat(e.target.value)} placeholder="纬度" inputMode="decimal" />
              <input value={lon} onChange={e => setLon(e.target.value)} placeholder="经度" inputMode="decimal" />
              <button type="button" className={s.go} disabled={busy} onClick={() => { if (!lat.trim() || !lon.trim()) { setErr("两个都要填"); snd.sfx("nope"); return; } saveTo(Number(lat), Number(lon)); }}>存</button>
            </div>
          )}
          <small className={s.whereNote}>望远镜和窗外按这里算星空；只存在你自己的世界服务里</small>
        </div>
      )}
      {err && <div className={s.whereErr}>{err}</div>}
    </>
  );
}

export function WorldSettings({ onClose, trial, onTrial, onDoll }: { onClose: () => void; trial?: boolean; onTrial?: (on: boolean) => void; onDoll?: () => void }) {
  const [out, setOut] = useState(false); const [vibe, setVibe] = useState(snd.vibeOn);
  const close = () => { setOut(true); snd.sfx("paper"); window.setTimeout(onClose, 420); };
  return (
    <div className={`${s.mask}${out ? ` ${s.maskOut}` : ""}`} onClick={close}>
      <div className={`${s.page}${out ? ` ${s.pageOut}` : ""}`} onClick={e => e.stopPropagation()}>
        <i className={s.tape} />
        <div className={s.head}><img src="/fanart/b2-m-teacup.png" alt="" /><b>小世界设置</b><button type="button" onClick={close} aria-label="合上">×</button></div>
        <div className={s.sec}>声音<small>拖蝴蝶结调大小，松手听一下</small></div>
        {ROWS.map((r, i) => (
          <div key={r.k} className={s.row} style={{ animationDelay: `${0.25 + i * 0.06}s` }}>
            <img className={s.ico} src={r.icon} alt="" /><div className={s.lbl}><b>{r.name}</b><small>{r.note}</small></div>
            <Ribbon k={r.k} />
          </div>
        ))}
        <div className={s.sec}>其他</div>
        <div className={s.row} style={{ animationDelay: ".65s" }}>
          <img className={s.ico} src="/fanart/b2-sparkle.png" alt="" /><div className={s.lbl}><b>咬钩震动</b><small>浮漂动了手机震一下</small></div>
          <button type="button" className={`${s.heart}${vibe ? ` ${s.on}` : ""}`} onClick={() => { const n = !vibe; setVibe(n); snd.setVibe(n); if (n) snd.vibe([40, 30, 40]); }} aria-label="咬钩震动"><i /></button>
        </div>
        {onTrial && (
          <div className={s.row} style={{ animationDelay: ".7s" }}>
            <img className={s.ico} src="/fanart/b2-heart-stitch.png" alt="" /><div className={s.lbl}><b>试玩：伞树农场</b><small>树屋就是小屋。只对你开，伙伴进不来；做完了再正式开</small></div>
            <button type="button" className={`${s.heart}${trial ? ` ${s.on}` : ""}`} onClick={() => { snd.sfx(trial ? "paper" : "clasp"); onTrial(!trial); }} aria-label="试玩伞树农场"><i /></button>
          </div>
        )}
        <div className={s.sec}>星空</div>
        <SkyWhere />
        {onDoll && <>
          <div className={s.sec}>我的小人</div>
          <div className={s.row} style={{ animationDelay: ".72s" }}>
            <img className={s.ico} src="/fanart/b2-m-hood.png" alt="" /><div className={s.lbl}><b>换小人</b><small>传一张自己画的小人图</small></div>
            <button type="button" className={s.go} onClick={() => { snd.sfx("tap"); onDoll(); }}>去换 ›</button>
          </div>
        </>}
      </div>
    </div>
  );
}
