// 农场扩建：8 只小动物。玩家选的 A 方案：不画假腿，只做轮廓看得出来的动作（换姿势先压扁再弹回、蹦、颠、呼吸），
// 表情用头顶气泡（DOM，跟小世界说话气泡同款），点一下弹大图卡片（WorldPage）。预览玩家点过头：
// 规则都是本地的小循环（每个人看到的节奏不必一样），以后喂食 / 珍珠这种要存的再接后端。
const IMG = import.meta.glob("../assets/world/farm/expand/a_*.png", { eager: true, import: "default" }) as Record<string, string>;
export type AnimalId = "duck" | "pigeon" | "cat" | "hedgehog" | "alpaca" | "heng" | "firefly" | "clam";
export type BubKind = "zz" | "嘎" | "?" | "哼" | "star" | "!";
export const ANIMAL_INFO: Record<AnimalId, { name: string; who: string; lines: string[] }> = {
  duck: { name: "鸭老大", who: "池塘最早的住户 · 跟秤砣最亲", lines: ["下雨了！下雨了！", "秤砣说你还欠我一条鱼。"] },
  heng: { name: "横横", who: "总趴在谁肩上 · 跟你最亲", lines: ["我没横着走，是路斜。", "（夹住你的鞋带，不撒手）"] },
  firefly: { name: "一闪", who: "从夜河飞来的", lines: ["夜河那边还有一个我。", "白天别找，我在攒亮。"] },
  cat: { name: "鳞片", who: "谁钓得多就跟谁", lines: ["你桶里那条，闻着不错。", "我不是来要的，就路过第三次。"] },
  pigeon: { name: "邮差", who: "信鸽 · 认生", lines: ["信送到了，回信要等。", "咕。"] },
  hedgehog: { name: "栗子", who: "住在菜地篱笆下", lines: ["（露一只眼）你今天也来了啊。", "那颗萝卜是我先看上的。"] },
  alpaca: { name: "云朵", who: "一身毛像湖上的雾", lines: ["哼……再摸一下也行。", "我不是羊。"] },
  clam: { name: "闷葫芦", who: "湖边浅水里 · 不跟谁亲", lines: ["……", "（张开一下，里面有一点点光）"] },
};
type Pose = string;
/** 农场镜头退回 3 倍、人放大 1.25；小动物也放大但「比人类小一点」→ 1.15 */
const AK = 1.15;
type A = { id: AnimalId; hx: number; hy: number; x: number; y: number; range: number; pose: Pose; poseAt: number; until: number; next: number; flip: boolean;
  hop: number; hopV: number; goal: number | null; bub: BubKind | null; bubUntil: number; near: boolean; nearAt: number; frame: number; hit: number; again: number };
// 落脚点（世界坐标，脚底）：菜园 / 院子按效果图上的位置换算（菜园图 x=-1061+mx*0.635，y=360+my*0.635；院子图 x=1536+mx*0.6875，y=278+my*0.6875）
const HOME: Record<AnimalId, { x: number; y: number; range: number; flip?: boolean }> = {
  hedgehog: { x: -810, y: 782, range: 14 },        // 菜园落叶筐跟前的石板路上
  heng: { x: -560, y: 829, range: 200 },           // 三块菜畦前沿横着挪
  firefly: { x: 432, y: 684, range: 0 },           // 树屋屋檐下（白天）
  duck: { x: 1100, y: 776, range: 8 },             // 小塘右边的大石头上（左边那块被树根挡住）
  clam: { x: 1012, y: 797, range: 0 },             // 塘里浅水
  alpaca: { x: 2150, y: 848, range: 40, flip: true }, // 院子草棚前
  cat: { x: 2452, y: 664, range: 0, flip: true },  // 木箱顶上揣手
  pigeon: { x: 2441, y: 741, range: 0, flip: true }, // 木箱旁边的栅栏桩顶上（收音机太高，人在地上时出镜头了）
};
export class FarmAnimals {
  img: Record<string, HTMLImageElement> = {}; list: A[] = []; trail: { x: number; y: number; t: number }[] = [];
  constructor() {
    for (const [p, src] of Object.entries(IMG)) { const k = p.split("/").pop()!.replace(/^a_|\.png$/g, ""); const im = new Image(); im.src = src; this.img[k] = im; }
    for (const [id, h] of Object.entries(HOME) as [AnimalId, typeof HOME[AnimalId]][]) this.list.push({ id, hx: h.x, hy: h.y, x: h.x, y: h.y, range: h.range, pose: id === "cat" ? "loaf" : "base", poseAt: -9, until: 0, next: 2 + Math.random() * 5, flip: !!h.flip, hop: 0, hopV: 0, goal: null, bub: null, bubUntil: 0, near: false, nearAt: -9, frame: 0, hit: -9, again: 0 });
  }
  ok(k: string) { const im = this.img[k]; return im?.complete && im.naturalWidth ? im : null; }
  imgOf(a: A) { return this.ok(`${a.id}_${a.pose}`) ?? this.ok(a.id); }
  setPose(a: A, p: Pose, t: number, dur = 0) { if (a.pose !== p) { a.pose = p; a.poseAt = t; } a.until = dur ? t + dur : 0; }
  say(a: A, k: BubKind, t: number, dur: number) { a.bub = k; a.bubUntil = t + dur; }
  /** 每帧：me = 玩家的位置；night / rain 跟真实时间天气走 */
  step(dt: number, t: number, me: { x: number; y: number; moving: number }, night: boolean, rain: boolean, sfx: (n: string, x: number, y: number) => void) {
    for (const a of this.list) {
      const d = Math.hypot(me.x - a.x, (me.y - a.y) * 0.6), near = d < (a.id === "hedgehog" ? 56 : a.id === "pigeon" ? 90 : 72);
      const came = near && !a.near; if (near !== a.near) { a.near = near; a.nearAt = t; }
      if (a.bub && t > a.bubUntil) a.bub = null;
      if (a.id !== "clam" && a.until && t > a.until) { a.until = 0; this.setPose(a, a.id === "cat" && !a.near ? "loaf" : "base", t); }
      // 蹦 / 颠：hop 是离地高度
      if (a.hop > 0 || a.hopV) { a.hopV -= 420 * dt; a.hop = Math.max(0, a.hop + a.hopV * dt); if (a.hop === 0 && a.hopV < 0) a.hopV = 0; }
      if (a.goal != null) { const sp = a.id === "hedgehog" ? 26 : a.id === "heng" ? 14 : 20, dx = a.goal - a.x; if (Math.abs(dx) < 1) a.goal = null; else { a.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt); if (a.id !== "heng") a.flip = dx < 0 ? false : true; if (a.id !== "heng" && a.id !== "hedgehog" && a.hop === 0) a.hopV = 70; } }
      a.frame = a.id === "heng" ? (a.goal != null ? ((t * 4) | 0) % 2 * 2 : 0) : a.id === "firefly" ? ((t * 6) | 0) % 4 : a.frame;
      switch (a.id) {
        case "hedgehog": // 怕生：人走近 → 「!」缩成刺球，两秒后露一只眼偷看；人走开才打开
          if (came) { this.setPose(a, "ball", t); this.say(a, "!", t, 1.2); a.goal = null; sfx("pop", a.x, a.y); }
          else if (a.near && a.pose === "ball" && t - a.poseAt > 2) this.setPose(a, "peek", t);
          else if (!a.near && (a.pose === "ball" || a.pose === "peek") && t - a.nearAt > 1.2) this.setPose(a, "base", t);
          else if (!a.near && a.pose === "base" && t > a.next) { a.goal = a.hx + (Math.random() - 0.5) * 2 * a.range; a.next = t + 3 + Math.random() * 4; }
          if (a.goal != null && a.pose === "base") a.hop = ((t * 10) | 0) % 2 ? 1 : 0; // 碎步颠
          break;
        case "heng": // 横着一格一格挪，偶尔停下
          if (t > a.next) { a.goal = a.goal == null ? a.hx + (Math.random() - 0.5) * 2 * a.range : null; a.next = t + (a.goal == null ? 2 + Math.random() * 3 : 6 + Math.random() * 6); }
          break;
        case "firefly": // 白天挂屋檐下关灯睡；天黑绕人飞（离得远就绕着家飞），留一道很淡的光尾巴
          if (!night) { a.x = a.hx; a.y = a.hy; if (!a.bub && t > a.next) { this.say(a, "zz", t, 4); a.next = t + 9; } break; }
          { const fol = Math.hypot(me.x - a.hx, me.y - a.hy) < 260, cx = fol ? me.x : a.hx + 20, cy = fol ? me.y - 34 : a.hy + 30, k = t * (fol ? 1.6 : 0.9);
            const tx = cx + Math.cos(k) * 26, ty = cy + Math.sin(k * 1.7) * 9; a.x += (tx - a.x) * Math.min(1, dt * 4); a.y += (ty - a.y) * Math.min(1, dt * 4); a.flip = Math.cos(k) < 0; }
          this.trail.push({ x: a.x, y: a.y, t }); break;
        case "clam": // 一天张一次口——游戏里太久了，四十秒左右张一次，冒两个泡
          if (t > a.next && a.frame === 0) { a.until = t + 4; a.next = t + 35 + Math.random() * 20; sfx("bubble", a.x, a.y); }
          a.frame = a.until && t < a.until ? Math.min(3, Math.floor((4 - (a.until - t)) * 4)) : a.until && t < a.until + 0.75 ? 3 - Math.floor((t - a.until) * 4) : 0;
          if (a.frame < 0) a.frame = 0; if (a.until && t >= a.until + 0.75) { a.until = 0; a.frame = 0; } break; // 河蚌自己管到期：张开 4 秒 → 0.75 秒合上 → 再清零
        case "duck": // 倚老卖老：有人到岸边就嘎两声；下雨最开心，蹦一蹦；没事缩成一团打盹
          if (came && a.pose !== "nap") { this.setPose(a, "quack", t, 1.6); this.say(a, "嘎", t, 1.6); sfx("pop", a.x, a.y); }
          else if (came && a.pose === "nap") { this.setPose(a, "base", t); this.say(a, "?", t, 1.2); }
          else if (t > a.next && !a.until) { const r = Math.random(); a.next = t + 5 + Math.random() * 6;
            if (rain || r < 0.35) { this.setPose(a, "quack", t, 1.4); this.say(a, "嘎", t, 1.4); if (rain) a.hopV = 90; }
            else if (r < 0.6 && a.pose !== "nap") { a.goal = a.hx + (Math.random() - 0.5) * 2 * a.range; }
            else { this.setPose(a, "nap", t, 10 + Math.random() * 8); } }
          if (a.pose === "nap" && !a.bub) this.say(a, "zz", t, 99); else if (a.pose !== "nap" && a.bub === "zz") a.bub = null;
          break;
        case "pigeon": // 正经：低头啄两下；有人来先歪头「?」看一圈
          if (came) { this.setPose(a, "tilt", t, 2.4); this.say(a, "?", t, 2.4); }
          else if (t > a.next && !a.until) { a.next = t + 4 + Math.random() * 5; if (Math.random() < 0.6) { this.setPose(a, "peck", t, 0.5); a.again = t + 0.8; } else a.hopV = 80; }
          if (a.again && t > a.again && a.pose === "base") { a.again = 0; this.setPose(a, "peck", t, 0.5); }
          break;
        case "cat": // 势利：趴成面包；人来了伸个懒腰坐起来，眼睛变星星（看你桶里有没有鱼）
          if (came) { this.setPose(a, "stretch", t, 1.4); a.next = t + 1.5; }
          else if (a.near && a.pose === "base" && t > a.next && !a.bub) { this.say(a, "star", t, 2.6); this.setPose(a, "star", t, 2.6); a.next = t + 12; }
          else if (!a.near && a.pose === "base" && t - a.nearAt > 4) this.setPose(a, "loaf", t);
          break;
        case "alpaca": // 傲娇：你走过来它先扭头「哼」，过一会儿自己转回来；闲着走几步，久了卧下；下雨毛塌（卧着不动）
          if (came) { this.setPose(a, "pout", t, 2.2); this.say(a, "哼", t, 2.2); a.flip = me.x < a.x; a.goal = null; }
          else if (rain && a.pose !== "lie") this.setPose(a, "lie", t);
          else if (t > a.next && !a.until && !rain) { a.next = t + 6 + Math.random() * 6; if (a.pose === "lie") this.setPose(a, "base", t); else if (Math.random() < 0.6) a.goal = a.hx + (Math.random() - 0.5) * 2 * a.range; else this.setPose(a, "lie", t, 14); }
          break;
      }
    }
    this.trail = this.trail.filter(p => t - p.t < 1);
  }
  /** 画（按脚底 y 交给外面排序）：rp = 取整到屏幕像素 */
  drawers(g: CanvasRenderingContext2D, t: number, night: boolean, rp: (v: number) => number, view: { x0: number; x1: number }) {
    const out: { y: number; f: () => void }[] = [];
    for (const a of this.list) { if (a.x < view.x0 - 80 || a.x > view.x1 + 80) continue; out.push({ y: a.id === "duck" || a.id === "clam" ? 857 : a.id === "firefly" ? 999 : a.y, f: () => this.drawOne(g, a, t, night, rp) }); } // 鸭子 / 河蚌要压在小塘图上面，一闪在树屋图上面
    return out;
  }
  drawOne(g: CanvasRenderingContext2D, a: A, t: number, night: boolean, rp: (v: number) => number) {
    if (a.id === "firefly" && night) for (const p of this.trail) { const k = 1 - (t - p.t); g.fillStyle = `rgba(255,236,150,${0.35 * k})`; g.fillRect(rp(p.x), rp(p.y), 1, 1); } // 尾迹是飞过的真实位置，画在放大外面
    g.save(); g.translate(a.x, a.y); g.scale(AK, AK); g.translate(-a.x, -a.y); this.drawOne0(g, a, t, night, rp); g.restore();
  }
  drawOne0(g: CanvasRenderingContext2D, a: A, t: number, night: boolean, rp: (v: number) => number) {
    if (a.id === "firefly" || a.id === "heng" || a.id === "clam") { const im = this.ok(a.id); if (!im) return; const n = a.id === "heng" ? 3 : 4, fw = im.width / n, fh = im.height;
      if (a.id === "firefly" && night) {
        const gl = 0.55 + Math.sin(t * 2.4) * 0.35; const R = 7; const rg = g.createRadialGradient(a.x, a.y, 0, a.x, a.y, R); rg.addColorStop(0, `rgba(255,232,140,${0.55 * gl})`); rg.addColorStop(1, "rgba(255,232,140,0)"); g.fillStyle = rg; g.fillRect(a.x - R, a.y - R, R * 2, R * 2); }
      const x0 = rp(a.x - fw / 2), y0 = rp(a.y - fh + (a.id === "clam" ? 3 : 0) - a.hop - (a.id === "heng" && a.hit > t - 0.5 ? 4 : 0));
      if (a.id === "clam") { g.fillStyle = "rgba(40,90,110,.25)"; g.fillRect(rp(a.x - fw / 2 + 1), rp(a.y + 1), fw - 2, 2); }
      g.save(); if (a.flip) { g.translate(x0 * 2 + fw, 0); g.scale(-1, 1); } g.drawImage(im, a.frame * fw, 0, fw, fh, x0, y0, fw, fh); g.restore();
      if (a.id === "heng") this.drawLeafHat(g, x0 + fw / 2, y0, rp);
      if (a.id === "clam" && a.frame === 3 && ((t * 3) | 0) % 2) { g.fillStyle = "#fff6fb"; g.fillRect(rp(a.x), rp(a.y - 6), 1, 1); }
      return; }
    const im = this.imgOf(a); if (!im) return;
    const age = t - a.poseAt, sq = age < 0.1 ? 0.12 : age < 0.2 ? 0.06 : age < 0.3 ? -0.03 : 0, br = a.hop || a.pose === "ball" ? 0 : 0.02 * Math.sin(t * 2 * Math.PI / 3);
    const w = Math.max(1, Math.round(im.width * (1 + sq * 0.6))), h = Math.max(1, Math.round(im.height * (1 - sq) * (1 + br)));
    const shW = Math.round(im.width * 0.36); g.fillStyle = "rgba(50,40,60,.22)"; g.fillRect(rp(a.x - shW), rp(a.y - 1), shW * 2, 2);
    const x0 = rp(a.x - w / 2), y0 = rp(a.y - h - a.hop + (a.hit > t - 0.4 ? Math.round(Math.sin((t - a.hit) * 40)) : 0));
    g.save(); if (a.flip) { g.translate(x0 * 2 + w, 0); g.scale(-1, 1); } g.drawImage(im, x0, y0, w, h); g.restore();
  }
  drawLeafHat(g: CanvasRenderingContext2D, cx: number, top: number, rp: (v: number) => number) { // 横横头顶一片菜叶当帽子
    const x = rp(cx - 6), y = rp(top - 2); g.fillStyle = "#4f9a3c"; g.fillRect(x + 1, y, 10, 2); g.fillRect(x + 3, y - 1, 6, 1); g.fillStyle = "#7cc35a"; g.fillRect(x + 2, y, 7, 1); g.fillStyle = "#3d7a2e"; g.fillRect(x + 6, y - 2, 1, 2); }
  /** 点到哪只（点在身上那块框里） */
  hit(x: number, y: number, t: number): AnimalId | null {
    for (const a of [...this.list].sort((p, q) => q.y - p.y)) { const im = a.id === "heng" || a.id === "firefly" || a.id === "clam" ? null : this.imgOf(a); const w = (im ? im.width : a.id === "heng" ? 14 : 12) * AK, h = (im ? im.height : a.id === "heng" ? 20 : 12) * AK;
      if (Math.abs(x - a.x) <= w / 2 + 6 && y <= a.y + 6 && y >= a.y - h - 8) { a.hit = t; return a.id; } }
    return null;
  }
  /** 头顶气泡挂哪（世界坐标） */
  bubbles() { return this.list.filter(a => a.bub).map(a => { const im = a.id === "heng" || a.id === "firefly" || a.id === "clam" ? null : this.imgOf(a); return { id: a.id, kind: a.bub!, x: a.x, y: a.y - ((im ? im.height : 14) + a.hop) * AK - 2 }; }); }
}
