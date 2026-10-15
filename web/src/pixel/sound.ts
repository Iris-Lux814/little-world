// 小世界的音乐和音效（八音盒 + 柔和音效，能加音效的都加上）。
// 全部用 WebAudio 现场合成，不下载任何音频文件：
// · 音乐：八音盒音色（正弦基音 + 一点 4 倍泛音，敲一下慢慢衰减）+ 假混响，每个钓点一首，晚上换慢一点、轻一点的版本
// · 环境声：海浪 / 雨 / 风 / 夜里虫鸣，跟着天气强度慢慢变大变小
// · 音效：甩竿、落水、咬钩、收线、断线、钓到（按稀有度）、脚步（按地面）、秤砣、亮鳞、翻书……
// iOS 要在用户第一次点屏幕时才能出声：unlock 挂在 pointerdown 上。开关存 localStorage（音乐 / 音效分开）。
import { getCallView, onCallView } from "../store/useCallUi";

type Tune = { beat: number; notes: [number, number][]; bass: number[]; chime?: boolean };
const TUNES: Record<string, Tune> = {
  pond: { beat: 0.34, notes: [[77, 1], [81, 1], [84, 1], [81, 2], [79, 1], [77, 1], [76, 1], [77, 1], [72, 3], [74, 1], [76, 1], [77, 1], [79, 2], [81, 1], [79, 1], [77, 1], [76, 1], [74, 3], [77, 1], [81, 1], [84, 1], [86, 2], [84, 1], [81, 1], [79, 1], [81, 1], [77, 3], [76, 1], [74, 1], [76, 1], [77, 3], [0, 3]], bass: [53, 57, 60, 57, 53, 57, 60, 57, 50, 53, 57, 53, 48, 52, 55, 52] },
  sea: { beat: 0.46, notes: [[72, 2], [76, 1], [79, 3], [77, 2], [76, 1], [74, 3], [72, 2], [74, 1], [76, 2], [79, 1], [77, 3], [0, 3], [76, 2], [79, 1], [84, 3], [83, 2], [81, 1], [79, 3], [77, 2], [76, 1], [74, 2], [71, 1], [72, 3], [0, 3]], bass: [48, 55, 52, 55, 50, 57, 53, 57] },
  lake: { beat: 0.5, notes: [[81, 2], [76, 1], [74, 2], [72, 1], [69, 3], [0, 3], [72, 2], [74, 1], [76, 2], [79, 1], [76, 3], [0, 3], [81, 2], [84, 1], [83, 2], [79, 1], [81, 3], [0, 3], [76, 2], [74, 1], [72, 2], [71, 1], [69, 6]], bass: [45, 52, 48, 52, 43, 50, 47, 50], chime: true },
  // 小屋：屋里的八音盒，三拍子慢华尔兹，暖一点
  cabin: { beat: 0.42, notes: [[79, 1], [84, 1], [88, 1], [86, 2], [84, 1], [83, 2], [81, 1], [79, 3], [76, 1], [79, 1], [84, 1], [83, 2], [81, 1], [79, 2], [77, 1], [76, 3], [77, 1], [81, 1], [84, 1], [86, 2], [84, 1], [83, 1], [84, 1], [86, 1], [88, 3], [86, 1], [84, 1], [81, 1], [79, 2], [83, 1], [84, 3], [0, 3]], bass: [48, 55, 52, 55, 45, 52, 48, 52, 41, 48, 45, 48, 43, 50, 47, 50] },
  river: { beat: 0.6, notes: [[74, 2], [77, 1], [81, 3], [79, 2], [77, 1], [76, 3], [74, 2], [72, 1], [69, 3], [0, 3], [77, 2], [81, 1], [84, 3], [83, 2], [81, 1], [79, 3], [77, 2], [76, 1], [74, 6]], bass: [50, 57, 53, 57, 46, 53, 50, 53], chime: true },
};
const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// 设置页：每一类声音单独调大小（0～1），存在本机
export type VolKey = "music" | "amb" | "fish" | "step" | "life" | "ui";
export const VOL_DEFAULT: Record<VolKey, number> = { music: 0.7, amb: 0.7, fish: 1, step: 0.7, life: 0.9, ui: 0.6 };
const CAT: Record<string, VolKey> = {};
for (const n of ["cast", "plop", "bite", "hook", "reel", "snap", "escape", "catch", "first"]) CAT[n] = "fish";
for (const n of ["squawk", "snore", "scrape", "coin", "far", "pop", "bubble", "crab"]) CAT[n] = "life";
CAT.step = "step";
const loadVol = (): Record<VolKey, number> => { try { return { ...VOL_DEFAULT, ...JSON.parse(localStorage.getItem("lwVol") || "{}") }; } catch { return { ...VOL_DEFAULT }; } };

// 通话中进小世界：别动 audioSession（改成 playback 麦就断）、别放保活的静音音频；音乐和环境声淡出，挂了再回来
const inCall = () => getCallView() !== "off";
class Sound {
  ac: AudioContext | null = null; master!: GainNode; sfxBus!: GainNode; musicBus!: GainNode; ambBus!: GainNode; rev!: ConvolverNode; musicOut!: GainNode;
  vol = loadVol(); bus: Partial<Record<VolKey, GainNode>> = {};
  vibeOn = (() => { try { return localStorage.getItem("lwVibe") !== "0"; } catch { return true; } })();
  get musicOn() { return this.vol.music > 0.01; }
  scene = "pond"; night = false; timer = 0; playing = false; noiseBuf: AudioBuffer | null = null;
  amb: Record<string, { g: GainNode; want: number }> = {};

  // app 更新后进游戏没声音，退出重进才好（「以后别人进来不能听不见」）。iOS 的 AudioContext 坏了不会自己好：
  // · pointerdown 在 iOS 不算「用户手势」，在里面新建的 AudioContext 可能一直是哑的 → 只在 touchend / click / keydown 里新建；
  // · 建完 / 恢复完 0.35 秒自查：状态不是 running 或者时钟不走 → 标坏，下一次点屏幕整套拆了重建（最多 3 次）；
  // · 被打断（interrupted / suspended，比如来电、切后台）→ 下次点屏幕先 resume，不行再重建；
  // · 页面上：点过屏幕还是不响，冒一个「没声音？点一下」（WorldPage 看 snd.ok）。
  broken = false; rebuilds = 0; touched = false; checkT = 0;
  // 玩家又碰到没声音、点「没声音？点一下」也不管用。再加一层：点屏幕时放一段循环的无声 <audio>。
  // iOS 上有个网页媒体在「播放」，整页声音就走媒体通道（不受静音键、也不容易被系统挂起），WebAudio 跟着一起出声
  keep: HTMLAudioElement | null = null;
  private keepAlive() {
    try {
      if (!this.keep) {
        const n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer); const w = (o: number, t: string) => { for (let i = 0; i < 4; i++) b[o + i] = t.charCodeAt(i); };
        w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
        let bin = ""; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
        const el = (this.keep = new Audio("data:audio/wav;base64," + btoa(bin))); el.loop = true; el.setAttribute("playsinline", ""); el.volume = 0.01;
      }
      if (this.keep.paused) void this.keep.play().catch(() => { /* 不是手势里，下次再试 */ });
    } catch { /* ignore */ }
  }
  get ok() { return !!this.ac && this.ac.state === "running" && !this.broken; }
  private rebuild() {
    clearTimeout(this.timer); this.playing = false; const old = this.ac; this.ac = null; this.amb = {}; this.bus = {}; this.broken = false; this.rebuilds++;
    try { void old?.close(); } catch { /* ignore */ }
  }
  private selfCheck() {
    const a = this.ac; if (!a) return; const t0 = a.currentTime; clearTimeout(this.checkT);
    this.checkT = window.setTimeout(() => { if (this.ac !== a) return; if (a.state !== "running" || a.currentTime <= t0) this.broken = true; }, 350);
  }
  /** 点屏幕时调（iOS / Chrome 要用户手势才能出声）；force = 「没声音？点一下」按钮，直接拆了重建 */
  unlock(ev?: Event | string, force = false) {
    const type = typeof ev === "string" ? ev : ev?.type;
    if (type && type !== "pointerdown") this.touched = true;
    if (this.ac && (force || this.broken) && this.rebuilds < (force ? 99 : 3)) this.rebuild();
    if (!this.ac && type === "pointerdown") return; // 等 touchend / click 再建
    if (type && type !== "pointerdown" && !inCall()) this.keepAlive();
    // 玩家测：完全没声音。iPhone 网页声音默认是「环境音」，静音键一开就全哑 → 改成「播放」类（跟听歌 app 一样不受静音键影响，iOS 16.4+）
    if (!inCall()) try { const ns = navigator as unknown as { audioSession?: { type: string } }; if (ns.audioSession && ns.audioSession.type !== "playback") ns.audioSession.type = "playback"; } catch { /* ignore */ }
    if (!this.ac) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!AC) return;
      const a = (this.ac = new AC()); this.master = a.createGain(); this.master.gain.value = 0.8; this.master.connect(a.destination);
      for (const k of ["fish", "step", "life", "ui"] as VolKey[]) { const g = a.createGain(); g.gain.value = this.vol[k] * 0.75; g.connect(this.master); this.bus[k] = g; }
      this.sfxBus = this.bus.ui!;
      // 音乐：musicBus（调音量）→ musicOut（离开小世界时淡出用）
      this.musicOut = a.createGain(); this.musicOut.gain.value = 1; this.musicOut.connect(this.master);
      this.musicBus = a.createGain(); this.musicBus.gain.value = this.vol.music * 0.6; this.musicBus.connect(this.musicOut);
      this.ambBus = a.createGain(); this.ambBus.gain.value = this.vol.amb * 0.7; this.ambBus.connect(this.musicOut);
      this.rev = a.createConvolver(); const len = a.sampleRate * 2.2, b = a.createBuffer(2, len, a.sampleRate);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      this.rev.buffer = b; const rg = a.createGain(); rg.gain.value = 0.32; this.rev.connect(rg); rg.connect(this.musicBus);
      const nb = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
      this.startAmb();
      a.onstatechange = () => { if (this.ac === a && a.state !== "running" && !document.hidden) this.selfCheck(); };
    }
    if (this.ac.state !== "running") { const a = this.ac; void a.resume().then(() => this.selfCheck(), () => { if (this.ac === a) this.broken = true; }); }
    else if (type && type !== "pointerdown") this.selfCheck();
    // 放一小段无声的，iOS 才算真正「解锁」了声音
    try { const b = this.ac.createBuffer(1, 1, 22050); const src = this.ac.createBufferSource(); src.buffer = b; src.connect(this.ac.destination); src.start(0); } catch { /* ignore */ }
    this.musicOut.gain.setTargetAtTime(inCall() ? 0 : 1, this.t, 0.3); if (this.musicOn && !this.playing && !inCall()) this.loop();
  }
  /** 离开小世界：音乐环境声停掉（开关不变，下次进来接着放） */
  pause() { try { this.keep?.pause(); } catch { /* ignore */ }
    // 离开小世界把声音模式还回 auto，不然 playback 留着，iOS 灵动岛一直挂「正在播放」
    if (!inCall()) try { const ns = navigator as unknown as { audioSession?: { type: string } }; if (ns.audioSession && ns.audioSession.type === "playback") ns.audioSession.type = "auto"; } catch { /* ignore */ } clearTimeout(this.timer); this.playing = false; if (this.ac) this.musicOut.gain.setTargetAtTime(0, this.t, 0.2); }
  get t() { return this.ac ? this.ac.currentTime : 0; }
  /** 设置页拖缎带：某一类声音的大小 */
  setVol(k: VolKey, v: number) {
    this.vol = { ...this.vol, [k]: v }; try { localStorage.setItem("lwVol", JSON.stringify(this.vol)); } catch { /* ignore */ }
    if (!this.ac) return; const g = k === "music" ? this.musicBus : k === "amb" ? this.ambBus : this.bus[k]; g?.gain.setTargetAtTime(v * (k === "music" ? 0.6 : k === "amb" ? 0.7 : 0.75), this.t, 0.08);
    if (k === "music" && v > 0.01 && !this.playing) this.loop();
  }
  setVibe(on: boolean) { this.vibeOn = on; try { localStorage.setItem("lwVibe", on ? "1" : "0"); } catch { /* ignore */ } }
  /** 震动。安卓走 navigator.vibrate；iPhone 的 Safari / 主屏 app 没有这个接口（试玩反馈钓鱼震动从来没触发过），
 * 改用 iOS 18 起的「开关复选框」：点一下 <label> 带的 <input switch>，系统会给一下轻触感。一个数就点一下，数组按「震 / 停」一段段点。 */
  vibe(p: number | number[]) {
    if (!this.vibeOn) return;
    try { if (typeof navigator.vibrate === "function" && navigator.vibrate(p)) return; } catch { /* ignore */ }
    const seq = Array.isArray(p) ? p : [p]; let t = 0;
    seq.forEach((ms, i) => { if (i % 2 === 0) { const n = Math.max(1, Math.min(4, Math.round(ms / 90))); for (let k = 0; k < n; k++) window.setTimeout(() => this.tick(), t + k * 70); } t += ms; });
  }
  private hapticLabel: HTMLLabelElement | null = null;
  private tick() {
    try {
      if (!this.hapticLabel) {
        const l = document.createElement("label"); const i = document.createElement("input"); i.type = "checkbox"; i.setAttribute("switch", "");
        l.appendChild(i); Object.assign(l.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0", pointerEvents: "none" }); l.setAttribute("aria-hidden", "true");
        document.body.appendChild(l); this.hapticLabel = l;
      }
      this.hapticLabel.click();
    } catch { /* ignore */ }
  }
  /** 设置页松手试听 */
  preview(k: VolKey) { this.unlock(); if (k === "music") { const t = this.t; [72, 76, 79].forEach((n, i) => this.bell(N(n), t + i * 0.12, 0.17, 1.2, this.musicBus)); } else if (k === "amb") this.hiss(this.t, 1.2, 600, 1200, 0.25, 0.5, this.ambBus); else this.sfx(k === "fish" ? "catch" : k === "step" ? "step" : k === "life" ? "squawk" : "tap", 1); }

  // ── 基本音色 ──
  bell(f: number, t: number, v = 0.22, dec = 1.6, bus: AudioNode = this.sfxBus, wet = true) {
    const a = this.ac; if (!a) return; const o = a.createOscillator(), o2 = a.createOscillator(), g = a.createGain(), g2 = a.createGain();
    o.frequency.value = f; o2.frequency.value = f * 4.02;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + dec);
    g2.gain.setValueAtTime(v * 0.22, t); g2.gain.exponentialRampToValueAtTime(0.0005, t + dec * 0.3);
    o.connect(g); o2.connect(g2); for (const x of [g, g2]) { x.connect(bus); if (wet) x.connect(this.rev); }
    o.start(t); o2.start(t); o.stop(t + dec + 0.1); o2.stop(t + dec + 0.1);
  }
  hiss(t: number, dur: number, f0: number, f1: number, v: number, q = 1, bus: AudioNode = this.sfxBus, type: BiquadFilterType = "bandpass") {
    const a = this.ac; if (!a || !this.noiseBuf) return; const s = a.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = a.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(t: number, f0: number, f1: number, dur: number, v: number, type: OscillatorType = "sine") {
    const a = this.ac; if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }

  // ── 音乐：每个钓点一首，晚上慢一点轻一点 ──
  setScene(scene: string, hour: number) { const night = hour >= 19 || hour < 5; const ch = scene !== this.scene || night !== this.night; this.scene = scene; this.night = night; this.ambWant(); if (ch && this.playing) { clearTimeout(this.timer); this.playing = false; if (this.musicOn && this.ac) this.timer = window.setTimeout(() => this.loop(), 900); } }
  loop() {
    const a = this.ac; if (!a || !this.musicOn) { this.playing = false; return; } this.playing = true;
    const T = TUNES[this.scene] ?? TUNES.pond; const beat = T.beat * (this.night ? 1.25 : 1); const vol = this.night ? 0.13 : 0.17; let t = a.currentTime + 0.15;
    T.notes.forEach(([n, d], i) => { if (n) this.bell(N(n - (this.night ? 12 : 0) + (this.night && n > 80 ? 12 : 0)), t, vol, 2, this.musicBus); const b = T.bass[i % T.bass.length]; if (b && i % 2 === 0) this.bell(N(b), t, vol * 0.45, 1.4, this.musicBus); if (T.chime && Math.random() < 0.1) this.bell(N(96 + [0, 3, 7][i % 3]), t + 0.2, 0.04, 1.2, this.musicBus); t += d * beat; });
    // 一首放完歇几秒再来，不要一直响
    this.timer = window.setTimeout(() => this.loop(), (t - a.currentTime) * 1000 + 4000 + Math.random() * 5000);
  }

  // ── 环境声：四条循环噪声，按天气 / 钓点 / 时间调音量 ──
  wx = { rain: 0, wind: 0 };
  startAmb() {
    const a = this.ac!; const mk = (name: string, type: BiquadFilterType, f: number, q: number) => {
      const s = a.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const fl = a.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = a.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(this.ambBus); s.start(); this.amb[name] = { g, want: 0 };
      return fl;
    };
    mk("rain", "highpass", 1800, 0.5); const wind = mk("wind", "bandpass", 500, 0.8); mk("waves", "lowpass", 700, 0.6);
    // 风：滤波频率慢慢漂，呼——呼——；海浪：音量 6 秒一涨一落
    const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 260; lfo.connect(lg); lg.connect(wind.frequency); lfo.start();
    const wl = a.createOscillator(), wg = a.createGain(); wl.frequency.value = 1 / 6.5; wg.gain.value = 0.5; wl.connect(wg); const wav = a.createGain(); wav.gain.value = 0.6; wg.connect(wav.gain);
    this.amb.waves.g.disconnect(); this.amb.waves.g.connect(wav); wav.connect(this.ambBus); wl.start();
    // 夜河的流水：一条带通噪声，中心频率慢慢漂（哗——哗——，比海浪细、不一涨一落）
    const st = mk("stream", "bandpass", 1100, 0.6); const sl = a.createOscillator(), sg = a.createGain(); sl.frequency.value = 0.21; sg.gain.value = 240; sl.connect(sg); sg.connect(st.frequency); sl.start();
    this.ambWant(); window.setInterval(() => this.crickets(), 700);
  }
  setWeather(rain: number, wind: number) { this.wx = { rain, wind }; this.ambWant(); }
  ambWant() {
    if (!this.ac) return; const w = this.wx; const set = (k: string, v: number) => { const x = this.amb[k]; if (x) x.g.gain.setTargetAtTime(v, this.t, 2.5); };
    set("rain", w.rain * (this.scene === "cabin" ? 0.09 : 0.22)); // 屋里听雨小一点 set("wind", w.wind * 0.14 + (this.scene === "lake" ? 0.02 : 0)); set("waves", this.scene === "sea" ? 0.12 + w.wind * 0.1 : 0); set("stream", this.scene === "river" ? 0.06 + w.rain * 0.03 : 0);
  }
  crickets() { if (!this.ac || this.vol.amb < 0.01 || !this.night || this.wx.rain > 0.3 || Math.random() > 0.55) return; const t = this.t; for (let i = 0; i < 3; i++) this.bell(4200 + Math.random() * 300, t + i * 0.06, 0.012, 0.05, this.ambBus, false); }

  // ── 音效 ──
  sfx(name: string, arg = 0, vol = 1) {
    if (!this.ac || vol < 0.02) return; const t = this.t; const v = vol;
    const keep = this.sfxBus; this.sfxBus = this.bus[CAT[name] ?? "ui"] ?? keep; // 按类别走各自的音量
    try { this.play(name, arg, t, v); } finally { this.sfxBus = keep; }
  }
  private play(name: string, arg: number, t: number, v: number) {
    const a = this.ac!;
    switch (name) {
      case "cast": this.hiss(t, 0.35, 900, 3500, 0.18 * v, 1.2); break; // 甩竿：咻
      case "plop": this.tone(t, 520, 140, 0.16, 0.25 * v); this.hiss(t + 0.02, 0.3, 2400, 600, 0.12 * v, 0.9); break; // 落水：噗通
      case "bite": for (let i = 0; i < 2; i++) this.bell(N(93), t + i * 0.13, 0.12 * v, 0.25, this.sfxBus, false); break; // 浮漂动了：叮叮
      case "hook": this.hiss(t, 0.18, 1500, 5000, 0.18 * v, 1.5); this.tone(t, 300, 700, 0.12, 0.1 * v, "triangle"); break; // 提竿：嗖
      case "reel": this.hiss(t, 0.025, 3800 + arg * 1600, 3400 + arg * 1600, (0.07 + arg * 0.05) * v, 9); break; // 线轴咔啦，arg = 张力 0～1，越紧越尖
      case "snap": this.tone(t, 900, 90, 0.22, 0.3 * v, "triangle"); this.hiss(t, 0.1, 3000, 800, 0.2 * v, 2); break; // 断线：嘣
      case "escape": this.hiss(t, 0.45, 1800, 400, 0.22 * v, 0.8); break; // 脱钩：扑腾
      case "catch": { const up = [[76, 79, 84], [76, 79, 84, 88], [72, 76, 79, 84, 88], [72, 76, 79, 84, 88, 91], [72, 76, 79, 84, 88, 91, 96]][Math.max(0, Math.min(4, arg))]; up.forEach((n, i) => this.bell(N(n), t + i * 0.085, 0.17 * v, 1.4)); if (arg >= 4) for (const n of [48, 55, 60]) this.bell(N(n), t, 0.12 * v, 3); break; }
      case "first": [84, 88, 91, 96].forEach((n, i) => this.bell(N(n), t + 0.5 + i * 0.12, 0.12 * v, 1.5)); break; // 图鉴新收录：叮～
      case "step": { const k = arg; if (k === 1) this.hiss(t, 0.07, 700, 400, 0.05 * v, 1.2); else if (k === 2) this.tone(t, 380, 300, 0.05, 0.05 * v, "triangle"); else if (k === 3) this.tone(t, 900, 700, 0.03, 0.045 * v, "square"); else this.hiss(t, 0.06, 2600, 1800, 0.035 * v, 2); break; } // 0 草沙沙 1 沙软 2 木板咚 3 石板嗒
      case "squawk": { const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter(); o.type = "sawtooth"; o.frequency.setValueAtTime(420 - arg * 80, t); o.frequency.linearRampToValueAtTime(300 - arg * 60, t + 0.15); o.frequency.linearRampToValueAtTime(380 - arg * 80, t + 0.25); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 3; g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.14 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(f); f.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.32); break; } // 秤砣：嘎
      case "snore": this.hiss(t, 1.1, 300, 500, 0.05 * v, 2); break;
      case "scrape": for (let i = 0; i < 6; i++) this.hiss(t + i * 0.09, 0.06, 5000 + arg * 900, 3000, 0.07 * v, 4); break; // 刮鳞：嚓嚓，稀有越亮
      case "coin": for (let i = 0; i < 4; i++) this.bell(N(96 + (i % 2) * 3), t + i * 0.06, 0.07 * v, 0.3, this.sfxBus, false); break; // 亮鳞进账
      case "far": this.bell(N(88), t, 0.1 * v, 0.9); break; // 远处有人钓到了
      case "pop": this.tone(t, 700, 1300, 0.07, 0.06 * v); break; // 气泡冒出来：啵
      case "bubble": for (let i = 0; i < 3; i++) this.tone(t + i * 0.09, 300 + i * 90, 600 + i * 90, 0.06, 0.05 * v); break; // 石龟冒泡：咕嘟
      case "tap": this.tone(t, 1200, 900, 0.04, 0.05 * v, "triangle"); break; // 按钮：嗒
      case "chime": [91, 95, 98, 94].forEach((n, i) => this.bell(N(n + (arg % 3) * 2), t + i * 0.11 + Math.random() * 0.03, 0.05 * v, 1.6, this.sfxBus, false)); break; // 风铃 / 小道具：叮铃铃（arg 换音高）
      case "tick": for (let i = 0; i < 4; i++) this.tone(t + i * 0.5, 2600, 2400, 0.012, 0.035 * v, "square"); break; // 怀表：滴答滴答
      case "paper": this.hiss(t, 0.3, 900, 2600, 0.13 * v, 0.8); break; // 翻纸
      case "flip": this.hiss(t, 0.45, 700, 2600, 0.2 * v, 0.8); this.hiss(t + 0.25, 0.2, 2600, 900, 0.1 * v, 0.8); break;
      case "ribbon": this.hiss(t, 0.35, 1200, 4000, 0.15 * v, 1.5); break;
      case "knock": this.tone(t, 230, 150, 0.06, 0.22 * v, "triangle"); this.hiss(t, 0.04, 900, 500, 0.12 * v, 2); break; // 敲木头，咚
      case "thud": this.hiss(t, 0.18, 300, 120, 0.3 * v, 1); break;
      case "popup": this.bell(N(79 + [0, 4, 7, 12][arg % 4]), t, 0.1 * v, 0.35, this.sfxBus, false); this.hiss(t, 0.05, 2000, 1200, 0.08 * v, 3); break;
      case "boing": { this.tone(t, 300, 620, 0.12, 0.1 * v); this.tone(t + 0.12, 620, 420, 0.13, 0.08 * v); break; }
      case "tape": this.hiss(t, 0.22, 5000, 2500, 0.09 * v, 2); break;
      case "nope": this.bell(N(64), t, 0.12 * v, 0.3, this.sfxBus, false); this.bell(N(61), t + 0.1, 0.12 * v, 0.35, this.sfxBus, false); break;
      case "go": [72, 76, 79].forEach((n, i) => this.bell(N(n), t + i * 0.07, 0.13 * v, 0.8)); break;
      case "arrive": [76, 79, 84, 88].forEach((n, i) => this.bell(N(n), t + i * 0.09, 0.14 * v, 1.4)); break;
      case "fold": this.hiss(t, 0.08, 1500, 700, 0.07 * v, 2); break;
      case "crab": for (let i = 0; i < 7; i++) if (i < 3 || i > 3) this.tone(t + i * 0.16 + (i > 3 ? 0.2 : 0), 2400, 1900, 0.025, 0.035 * v, "square"); break; // 小螃蟹：嗒嗒嗒（停一下）嗒嗒嗒
      case "clasp": this.tone(t, 2600, 1800, 0.03, 0.12 * v, "square"); this.tone(t + 0.05, 1900, 1400, 0.04, 0.1 * v, "square"); break; // 锁扣：咔嗒
      case "creak": this.tone(t, 180, 240, 0.35, 0.05 * v, "sawtooth"); this.hiss(t, 0.3, 600, 1400, 0.08 * v, 3); break; // 箱盖：吱——
      case "slide": this.hiss(t, 0.28, arg ? 1800 : 900, arg ? 900 : 1800, 0.12 * v, 1.5); this.tone(t + 0.26, 700, 500, 0.05, 0.06 * v, "triangle"); break; // 托盘滑出来 / 收回去
      case "clack": this.tone(t, 1500, 1100, 0.04, 0.12 * v, "square"); this.bell(N(88), t + 0.05, 0.09 * v, 0.5, this.sfxBus, false); break; // 装上：咔嗒 + 叮
      case "lantern": if (arg) { [84, 79, 76].forEach((n, i) => this.bell(N(n), t + i * 0.3, 0.045 * v, 2.2)); break; } this.bell(N(81), t, 0.06 * v, 1.8); this.bell(N(88), t + 0.22, 0.045 * v, 2); break; // 河灯漂过身边：叮——咚；arg=1 散场一串灯熄：三声往下落
      case "flies": if (arg) [91, 95, 98, 103].forEach((n, i) => this.bell(N(n), t + i * 0.09, 0.03 * v, 0.9, this.sfxBus, false)); else [98, 95, 91].forEach((n, i) => this.bell(N(n), t + i * 0.05, 0.025 * v, 0.5, this.sfxBus, false)); break; // 萤火虫围过来：一串细碎的叮；散开：往下落三声
      case "stamp": this.tone(t, 150, 55, 0.22, 0.4 * v); break;
      case "scoop": for (let i = 0; i < 5; i++) this.hiss(t + i * 0.035, 0.05, 2600 + i * 300, 1600, 0.05 * v, 3); this.tone(t + 0.2, 500, 380, 0.05, 0.04 * v, "triangle"); break; // 秤砣的小摊：舀一勺饵倒进纸袋，沙沙 + 袋子一鼓
      case "splash": this.hiss(t, 0.5, 900, 2600, 0.09 * v, 0.9); for (let i = 0; i < 7; i++) this.tone(t + 0.12 + i * 0.06 + Math.random() * 0.03, 900 + Math.random() * 700, 420 + Math.random() * 200, 0.05, 0.035 * v); break; // 摇伞：哗一下，水珠一颗颗滴进盆
      case "sprout": [84, 88, 91].forEach((n, i) => this.bell(N(n), t + i * 0.08, 0.04 * v, 1.0, this.sfxBus, false)); break; // 作物长了一阶：叮叮叮往上走
      case "rustle": this.hiss(t, 0.18, 1400, 3200, 0.1 * v, 1.2); this.hiss(t + 0.16, 0.22, 3200, 1100, 0.08 * v, 1.2); break; // 包装纸一折一裹
      // 鱼桶牌：扣牌滑进水里（咕嘟往下沉）/ 三张牌破水翻上来（哗地往上）/ 鱼跃（arg = 跳多高 0~3，越高越亮）/ 落进木桶（咚 + 溅）/ 放生（一串小泡往上 + 一声轻叮）/ 洗牌（纸牌哗啦）
      case "sink": this.tone(t, 620, 180, 0.32, 0.07 * v); this.hiss(t, 0.25, 1600, 500, 0.06 * v, 1.2); for (let i = 0; i < 3; i++) this.tone(t + 0.18 + i * 0.1, 260 - i * 40, 180 - i * 30, 0.05, 0.03 * v); break;
      case "rise": this.hiss(t, 0.4, 500, 3000, 0.12 * v, 0.9); this.tone(t + 0.05, 240, 720, 0.3, 0.05 * v, "triangle"); break;
      case "leap": { const top = 72 + Math.min(3, arg) * 4; this.tone(t, 400, 900 + arg * 260, 0.2, 0.06 * v, "triangle"); this.hiss(t, 0.3, 1200, 3600, 0.08 * v, 1); [top, top + 7].forEach((n, i) => this.bell(N(n), t + 0.16 + i * 0.09, 0.06 * v, 0.6, this.sfxBus, false)); break; }
      case "plunk": this.tone(t, 210, 120, 0.14, 0.16 * v, "triangle"); this.hiss(t + 0.03, 0.3, 2200, 700, 0.08 * v, 1); break;
      case "free": for (let i = 0; i < 5; i++) this.tone(t + i * 0.11, 380 + i * 110, 700 + i * 120, 0.05, 0.035 * v); this.bell(N(91), t + 0.62, 0.05 * v, 1.4, this.sfxBus, false); break;
      case "riffle": for (let i = 0; i < 9; i++) this.hiss(t + i * 0.035, 0.03, 3000 + i * 150, 2000, 0.06 * v, 4); this.tone(t + 0.34, 900, 700, 0.04, 0.05 * v, "triangle"); break;
      // 望远镜 / 看窗外：凑上目镜一声黄铜轻响 / 转动的细齿轮声 / 对焦咔一下 + 一圈微光 / 星座连上一串很轻的叮 / 推开窗的木头吱一下
      case "brass": this.bell(N(86), t, 0.07 * v, 1.6, this.sfxBus, false); this.bell(N(93), t + 0.02, 0.04 * v, 1.2, this.sfxBus, false); this.tone(t, 1800, 1500, 0.03, 0.03 * v, "square"); break;
      case "gear": this.tone(t, 3200 + Math.random() * 400, 2600, 0.012, 0.018 * v, "square"); break;
      case "focus": this.tone(t, 2200, 1600, 0.025, 0.06 * v, "square"); [91, 98, 103].forEach((n, i) => this.bell(N(n), t + 0.12 + i * 0.07, 0.03 * v, 1.0, this.sfxBus, false)); break;
      case "constel": [84, 88, 91, 96, 100].forEach((n, i) => this.bell(N(n), t + i * 0.16, 0.028 * v, 1.4, this.sfxBus, false)); break;
      case "sash": this.tone(t, 160, 210, 0.3, 0.04 * v, "sawtooth"); this.hiss(t + 0.05, 0.25, 900, 2400, 0.06 * v, 1.5); this.bell(N(79), t + 0.32, 0.04 * v, 0.8, this.sfxBus, false); break;
      case "swing": this.tone(t, 420, 520, 0.18, 0.035 * v, "triangle"); this.tone(t + 0.2, 520, 440, 0.18, 0.03 * v, "triangle"); break; // 挂钩上的东西晃一下
    }
  }
}
export const snd = new Sound();
// 通话开 / 关：小世界的音乐环境声跟着淡出 / 淡回（音效照常，声音小，不抢）
onCallView(() => { const a = snd.ac; if (!a || !snd.musicOut) return; if (inCall()) { try { snd.keep?.pause(); } catch { /* ignore */ } snd.musicOut.gain.setTargetAtTime(0, snd.t, 0.4); } else if (snd.musicOn) { snd.musicOut.gain.setTargetAtTime(1, snd.t, 0.6); } });
(window as unknown as { __lwSnd: Sound }).__lwSnd = snd; // 开发自测用：看声音起没起来
