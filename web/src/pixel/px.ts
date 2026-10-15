// 像素画小工具（钓鱼小世界）：所有角色、物件都在这里一格一格画出来，不用外部图片。
// 画法：先按像素填形状（椭圆、矩形、单点），椭圆自带"左上亮、右下暗"的明暗；
// 最后 outline 给外轮廓描边——描边色取相邻那格颜色压暗（像素画里叫 sel-out），比统一黑边柔和。
export type C = string | null;

export function hex(c: string) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const; }
export function mix(a: string, b: string, k: number) { const A = hex(a), B = hex(b); const f = (i: number) => Math.round(A[i] + (B[i] - A[i]) * k).toString(16).padStart(2, "0"); return `#${f(0)}${f(1)}${f(2)}`; }
export const darken = (c: string, k = 0.35) => mix(c, "#3a2430", k);
export const lighten = (c: string, k = 0.35) => mix(c, "#ffffff", k);

export class Px {
  w: number; h: number; d: C[];
  constructor(w: number, h: number) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
  get(x: number, y: number): C { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.d[y * this.w + x]; }
  set(x: number, y: number, c: C) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[y * this.w + x] = c; }
  rect(x: number, y: number, w: number, h: number, c: C) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); return this; }
  /** 椭圆（像素中心判定）。shade/light 给了就按法线方向上明暗 */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, o: { shade?: string | false; light?: string | false; only?: (x: number, y: number) => boolean } = {}) {
    const sh = o.shade === undefined ? darken(c, 0.16) : o.shade; const li = o.light === undefined ? lighten(c, 0.35) : o.light;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; const r = nx * nx + ny * ny; if (r > 1) continue;
      if (o.only && !o.only(x, y)) continue;
      let col = c;
      if (sh && nx * 0.45 + ny * 0.9 > 0.62 && r > 0.35) col = sh;
      else if (li && -nx * 0.6 - ny * 0.8 > 0.55 && r > 0.3 && r < 0.85) col = li;
      this.set(x, y, col);
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) this.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c); return this; }
  /** 外轮廓：空格子挨着有颜色的格子 → 描边（取邻格颜色压暗；给了 color 就用固定色） */
  outline(color?: string, k = 0.55) {
    const add: [number, number, string][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      const n = this.get(x, y - 1) || this.get(x, y + 1) || this.get(x - 1, y) || this.get(x + 1, y);
      if (n) add.push([x, y, color ?? darken(n, k)]);
    }
    for (const [x, y, c] of add) this.set(x, y, c);
    return this;
  }
  mirror() { const p = new Px(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)]; return p; }
  shift(dy: number) { const p = new Px(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const sy = y - dy; if (sy >= 0 && sy < this.h) p.d[y * this.w + x] = this.d[sy * this.w + x]; } return p; }
  canvas(): HTMLCanvasElement {
    const cv = document.createElement("canvas"); cv.width = this.w; cv.height = this.h; const g = cv.getContext("2d")!; const img = g.createImageData(this.w, this.h);
    for (let i = 0; i < this.d.length; i++) { const c = this.d[i]; if (!c) continue; const [r, gg, b] = hex(c); img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); return cv;
  }
}
/** 可重复的随机 */
export function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hash2 = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
