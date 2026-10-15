// 标准小人图 → 引擎要的格式。
// 标准图（开源说明里给的规格）：透明 PNG，一格 48×64，5 行 × 5 格（240×320），脚底踩在每格从上往下第 60 行（y = 59）：
// 第 1～4 行：朝下 / 朝左 / 朝右 / 朝上，每行 [站, 走1, 走2, 走3, 走4]
// 第 5 行：[甩竿1, 甩竿2, 甩竿3, 坐, 空]（朝右画；鱼竿游戏自己画）
// 引擎里每个人一张图：走路在前 4 列、站在第 5 列；动作（举鱼 / 伸懒腰之类）在下面一行，按编号取。
export const CELL_W = 48, CELL_H = 64, FOOT_Y = 59;
const CH = FOOT_Y + 1; // 引擎从脚底往上量高度，格子底下那 4 行空白不要

export type DollMeta = { cw: number; ch: number; ax: number; aw: number; ah: number; aax: number; ay: number; idle: number[] };
export type Doll = { sheet: HTMLImageElement; meta: DollMeta; rest: HTMLImageElement };

const toImg = (c: HTMLCanvasElement) => { const im = new Image(); im.src = c.toDataURL("image/png"); return im; };

/** 读一张标准图；读不到就回 null（调用的人退回默认小人） */
export function loadDoll(src: string): Promise<Doll | null> {
  return new Promise(res => {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => {
      if (im.naturalWidth !== CELL_W * 5 || im.naturalHeight !== CELL_H * 5) { res(null); return; }
      // 引擎格式：4 行走路（列 0～3 走、列 4 站）+ 第 5 行动作（列 0～2 甩竿、列 3 甩竿最后一帧当「举起来」）
      const c = document.createElement("canvas"); c.width = CELL_W * 5; c.height = CH * 5;
      const g = c.getContext("2d")!; g.imageSmoothingEnabled = false;
      const cp = (sc: number, sr: number, dc: number, dr: number) => g.drawImage(im, sc * CELL_W, sr * CELL_H, CELL_W, CH, dc * CELL_W, dr * CH, CELL_W, CH);
      for (let r = 0; r < 4; r++) { for (let f = 0; f < 4; f++) cp(f + 1, r, f, r); cp(0, r, 4, r); }
      for (let f = 0; f < 3; f++) cp(f, 4, f, 4);
      cp(2, 4, 3, 4);
      // 坐：引擎的坐图是两帧并排（慢慢晃），这里两帧用同一张，裁到人那么大
      const sit = document.createElement("canvas"); sit.width = CELL_W; sit.height = CELL_H;
      const sg = sit.getContext("2d")!; sg.drawImage(im, 3 * CELL_W, 4 * CELL_H, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
      const d = sg.getImageData(0, 0, CELL_W, CELL_H).data; let top = CELL_H, bot = 0;
      for (let y = 0; y < CELL_H; y++) for (let x = 0; x < CELL_W; x++) if (d[(y * CELL_W + x) * 4 + 3]) { top = Math.min(top, y); bot = Math.max(bot, y); }
      const rc = document.createElement("canvas"); const rh = Math.max(1, bot - top + 1); rc.width = CELL_W * 2; rc.height = rh;
      const rg = rc.getContext("2d")!; for (let k = 0; k < 2; k++) rg.drawImage(sit, 0, top, CELL_W, rh, k * CELL_W, 0, CELL_W, rh);
      res({ sheet: toImg(c), rest: toImg(rc), meta: { cw: CELL_W, ch: CH, ax: CELL_W / 2, aw: CELL_W, ah: CH, aax: CELL_W / 2, ay: CH * 4, idle: [4, 4, 4, 4] } });
    };
    im.onerror = () => res(null);
    im.src = src;
  });
}

/** 开源版自带的通用小人（public/sprites/starter.png） */
export const STARTER = "/sprites/starter.png";

// 每个人现在用的小人图地址（页面拉状态时登记）：牌桌这些 DOM 画的地方从这儿取，没登记 = 通用小人
const urls = new Map<string, string>();
export const setDollUrl = (who: string, url: string | null) => { if (url) urls.set(who, url); else urls.delete(who); };
export const dollUrl = (who: string) => urls.get(who) ?? STARTER;
