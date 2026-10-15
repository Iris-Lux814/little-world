// 钓鱼小世界的像素引擎：星露谷那种俯视小地图，Canvas 2D 一格一格画。
// 世界坐标 = 美术像素；画布按整数倍放大（CSS image-rendering: pixelated），所以永远是清楚的方块像素。
// 地面（草地、池塘、沙岸、小路、栈桥、荷叶、小花）开场一次性烤进离屏画布；树、灌木、路灯、人按脚底 y 排序每帧画。
// 人物是 按玩家 room 形象 / 伙伴甲伙伴乙自己的描述画的整张图，切好放在 assets/world/*.png（切法见 设计说明）。
import { Px, rng, hash2 } from "./px";
import { loadDoll, STARTER } from "./doll"; // 开源版：三个人都用标准小人图（自带的通用小人，或各人上传的）
import stallPng from "../assets/world/shop/stall_open.png"; import pelicanPng from "../assets/world/shop/pelican.png";
import stallClosedPng from "../assets/world/shop/stall_closed.png"; import stallNightPng from "../assets/world/shop/stall_night.png"; import stallAwayPng from "../assets/world/shop/stall_away.png"; import stallRainPng from "../assets/world/shop/stall_rain.png";
import pelActsPng from "../assets/world/shop/pelican_acts.png"; import pelActsMeta from "../assets/world/shop/pelican_acts.json";
import type { WFarm } from "../api/ccBridge";
import { TH_W, TH_H, TH_SHELL, TH_FLOOR, TH_TUBE, TH_DOOR_X, TH_STAIR, TH_STAIR_AT, TH_FURN, TH_SPOTS, TH_DECOR, TH_NOTE, TH_CHALK, TH_ACTS, TH_ACT_HAVE, TH_DUO, TH_ATTACH, applyLayout, thDefault, thFloorOf, TH_PX, TH_GUEST_ART, TH_GUEST_GAP, TH_GUEST_SCALE, thGuestRooms, type Furn, type THLayout } from "./treehouse";
import cabinExtPng from "../assets/world/cabin_ext.png";
import fCottage from "../assets/world/farm/cottage.png"; import fWindmill from "../assets/world/farm/windmill.png"; import fShedPlayer from "../assets/world/farm/shed_player.png";
import fShedBuddy from "../assets/world/farm/shed_buddy.png"; import fShedPal from "../assets/world/farm/shed_pal.png"; import fGreenhouse from "../assets/world/farm/greenhouse.png";
import fBoard from "../assets/world/farm/board.png"; import fGateC from "../assets/world/farm/gate_closed.png"; import fGateO from "../assets/world/farm/gate_open.png";
import tCanopy from "../assets/world/farm/tree/canopy.png"; import tTrunk from "../assets/world/farm/tree/trunk.png"; import tHouse from "../assets/world/farm/tree/house.png"; import tPond from "../assets/world/farm/tree/pond.png"; import tPipe from "../assets/world/farm/tree/pipe.png";
import tPotPlayerE from "../assets/world/farm/tree/pot_player_empty.png"; import tPotBuddyE from "../assets/world/farm/tree/pot_buddy_empty.png"; import tPotPalE from "../assets/world/farm/tree/pot_pal_empty.png";
import tBasket from "../assets/world/farm/tree/basket.png"; import tLadder from "../assets/world/farm/tree/ladder.png"; import tPotPlayer from "../assets/world/farm/tree/pot_player.png"; import tPotBuddy from "../assets/world/farm/tree/pot_buddy.png"; import tPotPal from "../assets/world/farm/tree/pot_pal.png";
import tW0 from "../assets/world/farm/tree/wisteria0.png"; import tW1 from "../assets/world/farm/tree/wisteria1.png"; import tW2 from "../assets/world/farm/tree/wisteria2.png"; import tW3 from "../assets/world/farm/tree/wisteria3.png"; import tW4 from "../assets/world/farm/tree/wisteria4.png"; import tW5 from "../assets/world/farm/tree/wisteria5.png";
import canopyProf from "../assets/world/farm/tree/canopy.json"; import xGarden from "../assets/world/farm/expand/garden.webp"; import xYard from "../assets/world/farm/expand/yard.webp"; import { FarmAnimals, type AnimalId } from "./farmAnimals"; import tBg from "../assets/world/farm/tree/bg.webp"; import tBoat from "../assets/world/farm/tree/boat.png";
import pSunflower from "../assets/world/farm/tree/p_sunflower.png"; import pPumpkin from "../assets/world/farm/tree/p_pumpkin.png"; import pScarecrow from "../assets/world/farm/tree/p_scarecrow.png"; import pMushroom from "../assets/world/farm/tree/p_mushroom.png"; import pDandelion from "../assets/world/farm/tree/p_dandelion.png";
import pBamboo from "../assets/world/farm/tree/p_bamboo.png"; import pApple from "../assets/world/farm/tree/p_apple.png"; import pPeach from "../assets/world/farm/tree/p_peach.png"; import pLemon from "../assets/world/farm/tree/p_lemon.png"; import pArch from "../assets/world/farm/tree/p_arch.png";
import pHydP from "../assets/world/farm/tree/p_hydP.png"; import pHydB from "../assets/world/farm/tree/p_hydB.png"; import pHydV from "../assets/world/farm/tree/p_hydV.png"; import pLavender from "../assets/world/farm/tree/p_lavender.png"; import pClothes from "../assets/world/farm/tree/p_clothes.png";
import propsPng from "../assets/world/props.png"; import propsMeta from "../assets/world/props.json";
// props 图集：下标 → 东西
const PI_ = { pine: -1, turtle: -2, pampas: -3, treeBig: 0, tree: 1, treePink: 2, treeSmall: 3, bush: 4, bushFlower: 5, grass: 6, rock: 7, pebbles: 8, lamp: 10, sign: 11, stump: 12, flowers: 13, bucket: 14, reeds: 15, lily: 16, pole: -4, willow: -5 } as const;

export type Who = "player" | "buddy" | "pal";
type Meta = { cw: number; ch: number; ax: number; aw: number; ah: number; aax: number; ay: number; idle?: number[]; rt?: number[];
  // 第三轮：sheet 最下面一行 画的 5 个姿势（站 下/上/右、钓鱼 正面/背面）：[起始 y, 格宽, 格高, 脚底锚点 x, 脚底 y]；prt = 两张钓鱼的竿尖
  pose?: number[]; prt?: number[][];
  // 伙伴钓到鱼双手举高那一帧：[x, y, 宽, 高, 脚底锚点 x, 左拳 x, 左拳 y, 右拳 x, 右拳 y]
  hold?: number[];
  // 姿势里画死的竿，离线抠出来的像素：[x, y, 亮(1)/暗(0), k(0 竿尖 → 1 手)]，按装备换颜色
  rodpx?: Record<"side" | "front" | "back", number[][]> };
type Sheet = { img: HTMLImageElement; m: Meta; ok: boolean };
type Dir = 0 | 1 | 2 | 3; // 下 左 右 上（跟图里的行一样）
const DV: [number, number][] = [[0, 1], [-1, 0], [1, 0], [0, -1]];
export const MAP_W = 768, MAP_H = 544;
/** 农场比别处大一圈（1.5 倍），其他地点还是 768×544 */
export const FARM_W = 1536, FARM_H = 900;
/** 农场扩建：左边菜园、右边院子（效果图玩家选的菜园 B、院子 B），中间伞树农场坐标不动 → 左边是负的 */
export const FX0 = -1061, FX1 = FARM_W + 1150;
/** 农场里人物放大倍数（小动物在 farmAnimals.ts 里另有 ANIMAL_K，比人小一点） */
export const PEOPLE_K = 1.25;
// 伞树农场（侧视）：农场长在一棵绣球伞树上。人只在几条「台」上左右走——伞面顶（顺着弧线）、树屋门廊、地面；台之间靠梯子 / 楼梯 / 吊篮
const TC = { x: 118, y: 150 }; // 伞面图左上角
const TRUNK = { x: 193, y: 312 }; const HOUSE = { x: 401, y: 621 }; const POND = { x: 857, y: 711 }; const PIPE = { x: 800, y: 560 };
const FG = { x0: FX0 + 24, x1: FX1 - 24, y0: 850, y1: 888 }; // 地面能走的一条（前后能错开站）
const PORCH = { y: 764, x0: 432, x1: 572 }; const STAIR = { x0: 558, y0: 766, x1: 614, y1: 862 }; // 对准图上台阶中线（原来人贴着台阶右边走）
const LADDER_X = 1236, BASKET_X = 300, HOUSE_DOOR_X = 538; export const FCAN_X0 = 238, FCAN_X1 = 1298; // HOUSE_DOOR_X 树屋门（小屋搬进农场：门廊上站到门口 = 进屋）
export const FPOT: Record<"player" | "buddy" | "pal", number> = { player: 620, buddy: 800, pal: 980 };
/** 种菜：每个盆 6 格（后端 tiles 0~2 后排、3~5 前排），坐标是空土盆图里土面上的点（图左上角起，脚底那一行） */
const FTILE: Record<"player" | "buddy" | "pal", [number, number][]> = {
  player: [[30, 64], [76, 63], [100, 65], [20, 73], [52, 74], [90, 73]],
  buddy: [[32, 68], [58, 67], [102, 68], [24, 78], [72, 79], [110, 77]],
  pal: [[36, 61], [60, 60], [86, 61], [30, 70], [56, 71], [84, 70]] };
/** 菜园地上三块木框菜地，18 格（后端 ground:0~17）：每块 0~2 后排、3~5 前排；坐标是作物脚底那一点（菜园图左上角 = (FX0, 360)） */
export const GPLOT: [number, number][] = [[318, 404], [370, 404], [422, 404], [344, 428], [396, 428], [446, 428], // 前排错开半格，不然前后两棵叠成一棵
  [516, 404], [562, 404], [608, 404], [538, 428], [584, 428], [628, 428],
  [704, 404], [754, 404], [804, 404], [730, 428], [780, 428], [830, 428]].map(([x, y]) => [x - 1061, y + 360] as [number, number]);
const CAN_TOP = (() => { const a = (canopyProf as { top: number[] }).top; return a.map((_, i) => { let s = 0, n = 0; for (let k = -64; k <= 64; k++) { const v = a[i + k]; if (v != null && v >= 0) { s += v; n++; } } return n ? s / n : 999; }); })(); // 花团一簇簇凸起，抹平了当路走
const CAN_BOT = (canopyProf as { bot: number[] }).bot;
/** 伞面顶上某个 x 的脚底 y（脚陷进花里一点） */
export const fWalkY = (x: number) => { const v = CAN_TOP[Math.round(x - TC.x)]; return v == null || v > 900 ? 9999 : TC.y + v + 22; };
const BG_Y = 36, SEAM = 792; // 远景图贴在 y=36；SEAM 以上是远景（跟着镜头慢慢移 = 视差），以下的草地固定
/** 菜园 / 院子效果图里的灯笼位置（世界坐标，夜里加光） */
const XLAMPS: [number, number][] = [[-890, 792], [-858, 639], [-988, 414], [-902, 443], [1755, 752], [1971, 790], [2306, 790], [2560, 766], [2045, 615], [2258, 618], [2492, 570]];
const LAKE = { y0: 580, y1: 750 }; const SPOUT = { x: 893, y: 756 }; const PONDW = { x: 1010, y: 790, rx: 92, ry: 26 };
type FProp = { k: string; x: number; y: number; kind?: "sun" | "cloth" | "dand" | "crow" | "hyd"; front?: boolean };
const FPROPS: FProp[] = [
  { k: "lemon", x: 196, y: 812 }, { k: "apple", x: 1336, y: 810 }, { k: "peach", x: 1452, y: 816 }, { k: "bamboo", x: 1506, y: 846 },
  { k: "arch", x: 44, y: 848 }, { k: "board", x: 128, y: 846 }, { k: "lavender", x: 196, y: 846 }, { k: "hydP", x: 236, y: 848 },
  { k: "sunflower", x: 348, y: 846, kind: "sun" }, { k: "sunflower", x: 378, y: 848, kind: "sun" }, { k: "mushroom", x: 690, y: 846 }, { k: "dandelion", x: 746, y: 848, kind: "dand" },
  { k: "clothes", x: 1330, y: 846, kind: "cloth" }, { k: "scarecrow", x: 1420, y: 848, kind: "crow" }, { k: "hydV", x: 1470, y: 848 }, { k: "sunflower", x: 1196, y: 846, kind: "sun" },
  // 前景（画在人前面，压在最下沿）
  { k: "mushroom", x: 70, y: 900, front: true }, { k: "hydB", x: 486, y: 900, front: true }, { k: "lavender", x: 824, y: 900, front: true }, { k: "pumpkin", x: 1004, y: 900, front: true }, { k: "dandelion", x: 1130, y: 900, front: true, kind: "dand" }, { k: "hydP", x: 1290, y: 902, front: true },
];
const fStairY = (x: number) => STAIR.y0 + (x - STAIR.x0) * (STAIR.y1 - STAIR.y0) / (STAIR.x1 - STAIR.x0);
// 池塘 / 湖共用一套「一圈岸」：形状参数按场景换（同一时间只有一个 PixelWorld，换场景就是重建，所以放模块里）
let PC = { x: 384, y: 236 }, RX = 214, RY = 138; // 池塘
let DOCK = { x0: 370, x1: 398, y0: 286 }; // 栈桥（往下一直接到岸）；湖边是石板码头
let BF = [0.11, 1, 0.07, 2.2, 0.04, 0.5]; // 岸线起伏
let ISLE: { x: number; y: number; rx: number; ry: number } | null = null; // 湖心岛
function setBasin(scene: string) {
  if (scene === "lake") { PC = { x: 384, y: 250 }; RX = 290; RY = 158; DOCK = { x0: 366, x1: 402, y0: 330 }; BF = [0.08, 0.4, 0.06, 1.7, 0.03, 2]; ISLE = { x: 440, y: 226, rx: 40, ry: 18 }; }
  else { PC = { x: 384, y: 236 }; RX = 214; RY = 138; DOCK = { x0: 370, x1: 398, y0: 286 }; BF = [0.11, 1, 0.07, 2.2, 0.04, 0.5]; ISLE = null; }
}
/** 湖北边的雪山崖壁：y 小于这个就是山（不能走） */
export const lakeCliff = (x: number) => 58 + 12 * Math.sin(x / 61) + 7 * Math.sin(x / 23 + 2) + 3 * Math.sin(x / 9);
const inIsle = (x: number, y: number) => (ISLE ? ((x - ISLE.x) / ISLE.rx) ** 2 + ((y - ISLE.y) / ISLE.ry) ** 2 : 9);
// 秤砣的小摊：栈桥左下的空地（脚底中点）。小摊和秤砣是单独的图，跟人一起按脚底前后排
export const SHOP_POS = { x: 250, y: 456 };
export const PEL_POS = { x: SHOP_POS.x - 96, y: SHOP_POS.y + 10 }; // 秤砣站的地方（脚底）
// 秤砣的动作：nap 打盹 / weigh 收鱼过秤 / soft 嘴硬心软 / worm 偷塞蚯蚓
export type PelAct = "idle" | "nap" | "weigh" | "soft" | "worm" | "peek" | "sniff" | "deal" | "close" | "player";
/** 小摊今天什么样：凌晨 3~6 点打烊（秤砣回家睡了）；下午 3 点喝茶去（自己拿，鳞片放罐里）；下雨搭油布；晚上 7 点后挂灯笼照样营业 */
export type StallKind = "open" | "closed" | "night" | "away" | "rain";
export function stallKind(hour: number, weather: string): StallKind { const h = Math.floor(hour); if (h >= 3 && h < 6) return "closed"; if (h === 15) return "away"; if (/雨/.test(weather)) return "rain"; if (h >= 19 || h < 6) return "night"; return "open"; }
export const RARITY_PX = ["#9CC6E8", "#8FD3B0", "#9C8FE0", "#E78BC3", "#F2C14E"];

const pondF = (a: number) => 1 + BF[0] * Math.sin(2 * a + BF[1]) + BF[2] * Math.sin(3 * a + BF[3]) + BF[4] * Math.sin(5 * a + BF[5]);
const pondQ = (x: number, y: number) => { if (inIsle(x, y) < 1) return 2; const dx = (x - PC.x) / RX, dy = (y - PC.y) / RY; return Math.hypot(dx, dy) / pondF(Math.atan2(dy, dx)); };

type Actor = { who: Who; gear?: { rod?: string; bobber?: string }; x: number; y: number; dir: Dir; moving: number; walkT: number; rod: boolean; bob: { x: number; y: number } | null; act: number; actUntil: number; fish: { c: string; sp?: string; until: number; t0?: number } | null; sitting?: boolean; rest?: number | null; ride?: { t0: number; from: number; to: number; dur: number } | null; path?: { x: number; y: number; climb?: boolean; go?: string; face?: Dir; fast?: boolean }[] | null; cact?: { k: string; t0: number; loop: boolean; flip: boolean; dy: number; over?: string; alt?: string; spd?: number; swap?: boolean; spot?: string } | null; cabSpot?: string | null;
  // 伙伴自己溜达：沿着岸边的角度走到下一个钓点
  ang?: number; goal?: number | null; nextMove?: number; off?: number; dirHold?: number; srvAct?: string; lastAct?: string; synced?: boolean };
type Prop = { kind: keyof typeof PI_; x: number; y: number; r: number; flat?: boolean; flip?: boolean };
type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; g?: number };
type Ring = { x: number; y: number; t: number; max: number; c: string };

// 第 3 步：多个钓点。pond 小池塘（原来的）/ sea 海边（沙滩 + 海浪）。玩家从路牌出发，换场景就是重新建一个 PixelWorld
export type Scene = "pond" | "sea" | "lake" | "river" | "cabin" | "farm";
export type FarmAct = "rideUp" | "rideDown" | "stairUp" | "stairDown" | "ladderUp" | "ladderDown" | "door" | "shake";
export const SCENE_NAME: Record<Scene, string> = { pond: "小池塘", sea: "海边", lake: "湖", river: "夜河", cabin: "小屋", farm: "农场" };
// 小屋（第 4 步）：池塘边那间木屋的屋里，画的一整张底图（cabin.png，768×512）。地板能走，家具挡着（人不能走到家具后面，免得前后遮挡画错）；
// 走到东西跟前，大按钮变成「看鱼缸」之类。门在下沿中间，走出去回池塘
export type CabinSpot = string; // 树洞小屋：站在哪样东西跟前（treehouse.ts 的 TH_SPOTS id）
// ── 农场（湖和夜河中间的山坡）：三层梯田往下走。别的地方都是平地围着水，这里一层层台地、石墙隔开、台阶上下；
// 湖里引来的水渠从右上之字形流下来，每过一道石墙一个小瀑布、每层一道木闸，最后汇进左下的鸭塘。
// 第一层三块地，第二层朋友的空地 + 大田（巨型萝卜），第三层小动物，最底下路牌入口 + 留言板。
const FWALL = [{ y: 112, a: 5, f: 0.013, p: 0.4 }, { y: 236, a: 6, f: 0.011, p: 1.7 }, { y: 356, a: 5, f: 0.012, p: 2.9 }];
const FACE = 15; // 石墙正面多高
export const fWallY = (i: number, x: number) => FWALL[i].y + FWALL[i].a * Math.sin(x * FWALL[i].f + FWALL[i].p);
const FSTEP = [398, 398, 332]; // 每道墙的台阶在哪（x 中线），宽 28
const FCH: [number, number][] = [[790, 30], [712, 58], [664, 112], [642, 170], [612, 236], [572, 296], [540, 356], [488, 396], [396, 428], [300, 452], [170, 474]];
const segD = (x: number, y: number, a: [number, number], b: [number, number]) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))); return Math.hypot(x - a[0] - dx * k, y - a[1] - dy * k); };
const polyD = (x: number, y: number, P: [number, number][]) => { let d = 1e9; for (let i = 1; i < P.length; i++) d = Math.min(d, segD(x, y, P[i - 1], P[i])); return d; };
export const fChanD = (x: number, y: number) => polyD(x, y, FCH);
const FDUCK = { x: 112, y: 480, rx: 80, ry: 38 };
export const fDuckQ = (x: number, y: number) => Math.hypot((x - FDUCK.x) / FDUCK.rx, (y - FDUCK.y) / FDUCK.ry);
const FPATH: [number, number][] = [[384, 560], [392, 492], [362, 420], [332, 376], [336, 346], [372, 300], [398, 262], [398, 226], [398, 170], [398, 124], [392, 104], [300, 104], [150, 106]];
export const fPathD = (x: number, y: number) => polyD(x, y, FPATH);
/** 菜地（第一层三块、第二层朋友两块）和大田 */
export const FPLOT: Record<string, { x: number; y: number; w: number; h: number }> = { player: { x: 36, y: 140, w: 112, h: 70 }, buddy: { x: 204, y: 140, w: 112, h: 70 }, pal: { x: 436, y: 140, w: 112, h: 70 },
  f1: { x: 36, y: 268, w: 104, h: 66 }, f2: { x: 176, y: 268, w: 104, h: 66 } };
export const FFIELD = { x: 672, y: 300, rx: 74, ry: 38 };
/** 建筑 / 设施（脚底中点；bw = 挡路的半宽） */
const FB = { cottage: { x: 118, y: 102, bw: 70, bh: 26 }, windmill: { x: 560, y: 84, bw: 8, bh: 6 }, shedPlayer: { x: 176, y: 204, bw: 24, bh: 14 }, shedBuddy: { x: 344, y: 204, bw: 24, bh: 14 }, shedPal: { x: 576, y: 204, bw: 24, bh: 14 },
  greenhouse: { x: 640, y: 452, bw: 26, bh: 14 }, board: { x: 318, y: 520, bw: 26, bh: 6 } };

/** 池塘边的小屋（外面）：脚底中点；门在正下方。CABIN_READY 关着时池塘里不画、不能进 */
export const CABIN_POS = { x: 575, y: 470 };
/** 鱼缸里的水（画游的鱼用） */
const TANK_WATER = { x0: TH_TUBE.x0, x1: TH_TUBE.x1, y0: TH_TUBE.y0, y1: TH_TUBE.y1 };
/** 海边的海岸线：往下是海 */
export const seaShore = (x: number) => 300 + 16 * Math.sin(x / 68) + 9 * Math.sin(x / 29 + 1.3);
// 夜河：城里一条从右上往左下斜着流的河（只在晚上开）。rcx(y) = 这一行河中线的 x，rhw(y) = 横着量的半宽。后端 little-world/engine/core.js 用同一条河
export const rcx = (y: number) => 560 - y * 0.62 + 18 * Math.sin(y / 57) + 8 * Math.sin(y / 23 + 1);
export const rhw = (y: number) => 44 + 5 * Math.sin(y / 41 + 2);
/** 离水边多远（横着量，负数 = 在水里） */
const riverE = (x: number, y: number) => Math.abs(x - rcx(y)) - rhw(y);
/** 河边一道石头沿（CURB）+ 粉砖铺的步道（WALK）；石拱桥横跨的那几行；两串灯笼挂在哪一行 */
const CURB = 4, WALK = 24; export const RBRIDGE = { y0: 258, y1: 286 }; const LSTR = [170, 400];
const LCOL = ["#e2574c", "#f28fa6", "#f6a94a"]; // 灯笼：红 / 主粉 / 橘
/** 天气：服务器给一个词，前端把四个强度慢慢拉过去（试玩反馈天气变化不能突然） */
export const WX_TARGET: Record<string, { rain: number; fog: number; cloud: number; wind: number }> = {
  晴: { rain: 0, fog: 0, cloud: 0, wind: 0 }, 多云: { rain: 0, fog: 0, cloud: 0.6, wind: 0.2 }, 小雨: { rain: 0.45, fog: 0.1, cloud: 0.7, wind: 0.2 },
  大雨: { rain: 1, fog: 0.2, cloud: 1, wind: 0.5 }, 雾: { rain: 0, fog: 0.85, cloud: 0.4, wind: 0 }, 大风: { rain: 0, fog: 0, cloud: 0.35, wind: 1 },
};
export type WorldOpts = { onFrame?: (pos: Record<string, { x: number; y: number }>) => void; scene?: Scene; /** 音效：名字、参数、世界坐标（按离玩家多远调音量） */ onSfx?: (name: string, arg: number, x: number, y: number) => void };

export class PixelWorld {
  cv: HTMLCanvasElement; g: CanvasRenderingContext2D; host: HTMLElement;
  ground!: HTMLCanvasElement; groundX = 0; water!: Uint8Array; props: Prop[] = [];
  sheets: Record<Who, Sheet>; restImg = {} as Record<Who, HTMLImageElement>; atlas: HTMLImageElement; atlasOk = false;
  me: Actor; ai: Record<"buddy" | "pal", Actor>;
  joy = { x: 0, y: 0 }; keys = new Set<string>();
  scale = 3; vw = 320; vh = 200; cam = { x: 0, y: 0 };
  hour = 12; weather = "晴";
  scene: Scene = "pond";
  /** 现在的天气强度（每帧往 WX_TARGET[weather] 慢慢拉，约 25 秒拉满） */
  wx = { rain: 0, fog: 0, cloud: 0, wind: 0 }; wxInit = false;
  /** 路牌（出发 / 回去）站哪 */
  signPos = { x: 438, y: 424 };
  // 钓鱼状态
  power = 0; aiming = false; aimPt: { x: number; y: number } | null = null; // 第三轮：落点圈（按住钓鱼键时拖 / 摇杆推）
  static AIM_MAX = 150;
  bobber: null | { x: number; y: number; fx: number; fy: number; t: number; phase: "fly" | "float" | "bite" | "fight"; fight?: { k: number; tension: number } } = null;
  parts: Part[] = []; rings: Ring[] = []; shake = 0;
  flies: { x: number; y: number; p: number }[] = []; drops: { x: number; y: number; l: number }[] = [];
  raf = 0; last = 0; t = 0; ro: ResizeObserver; opts: WorldOpts;
  fishArt: Record<string, HTMLCanvasElement | null> = {};

  constructor(host: HTMLElement, opts: WorldOpts = {}) {
    this.host = host; this.opts = opts;
    this.cv = document.createElement("canvas"); this.cv.className = "pxw"; this.g = this.cv.getContext("2d")!;
    Object.assign(this.cv.style, { imageRendering: "pixelated", display: "block" });
    host.appendChild(this.cv);
    const sheet = (src: string, m: Meta): Sheet => { const img = new Image(); const s: Sheet = { img, m, ok: false }; img.onload = () => { s.ok = true; }; img.src = src; return s; };
    this.atlas = new Image(); this.atlas.onload = () => { this.atlasOk = true; }; this.atlas.src = propsPng;
    this.stallImg = new Image(); this.stallImg.src = stallPng; this.pelImg = new Image(); this.pelImg.src = pelicanPng;
    for (const [k, src] of Object.entries({ open: stallPng, closed: stallClosedPng, night: stallNightPng, away: stallAwayPng, rain: stallRainPng })) { const im = new Image(); im.src = src; this.stallImgs[k] = im; }
    this.pelActs = new Image(); this.pelActs.src = pelActsPng;
    void sheet; // 原来按文件直接读；开源版统一走 setSprite
    const blank = (): Sheet => ({ img: new Image(), m: { cw: 48, ch: 60, ax: 24, aw: 48, ah: 60, aax: 24, ay: 240, idle: [4, 4, 4, 4] }, ok: false });
    this.sheets = { player: blank(), buddy: blank(), pal: blank() };
    for (const w of ["player", "buddy", "pal"] as Who[]) void this.setSprite(w, null);
    this.scene = opts.scene ?? "pond"; setBasin(this.scene);
    if (this.scene === "farm") { this.mw = FARM_W; this.mh = FARM_H; } if (this.scene === "cabin") { this.mw = TH_W; this.mh = TH_H; } // 农场场地要大一点（镜头倍数不变，人不变小）
    if (this.scene === "sea") { this.bakeSea(); } else if (this.scene === "river") this.bakeRiver(); else if (this.scene === "cabin") this.bakeCabin(); else if (this.scene === "farm") this.bakeTree(); else this.bake();
    void cabinExtPng; // 池塘边的小屋删了（初始池塘还有不用的小屋），小屋搬进伞树农场的树屋
    this.me = { who: "player", x: this.scene === "river" ? rcx(478) + rhw(478) + 14 : 384, y: this.scene === "sea" ? 128 : this.scene === "lake" ? 490 : this.scene === "river" ? 478 : this.scene === "cabin" ? TH_FLOOR[2].y : this.scene === "farm" ? 872 : 470, dir: 3, moving: 0, walkT: 0, rod: false, bob: null, act: -1, actUntil: 0, fish: null };
    const mk = (who: "buddy" | "pal", ang0: number): Actor => { let ang = ang0; for (let i = 0; i < 40 && !this.goodSpot(this.bank(ang)); i++) ang = ang0 + (i % 2 ? 1 : -1) * 0.08 * Math.ceil((i + 1) / 2); const p = this.bank(ang); const a: Actor = { who, ...p, dir: 0, moving: 0, walkT: 0, rod: true, bob: null, act: -1, actUntil: 0, fish: null, ang, goal: null, nextMove: 8 + Math.random() * 20, srvAct: "idle" }; this.faceIdle(a); return a; };
    this.ai = { buddy: mk("buddy", -0.12), pal: mk("pal", Math.PI + 0.3) };
    if (this.scene === "farm") { this.me.x = 190; this.me.dir = 2; } if (this.scene === "cabin") { this.me.x = TH_DOOR_X; this.me.dir = 1; } /* 110 在手机上被摇杆挡住 */
    if (this.scene !== "pond") for (const a of Object.values(this.ai)) { a.x = -9999; a.y = -9999; a.rod = false; a.bob = null; } // 先藏着，等 syncAi 说他在这个钓点再放出来
    const r = rng(7); for (let i = 0; i < 14; i++) this.flies.push({ x: r() * this.mw, y: r() * this.mh, p: r() * 6.28 });
    for (let i = 0; i < 90; i++) this.drops.push({ x: r() * 400, y: r() * 300, l: 3 + (r() * 3 | 0) });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.cam = { x: this.me.x - this.vw / 2, y: this.me.y - this.vh / 2 };
    this.last = performance.now(); this.loop();
    document.addEventListener("visibilitychange", this.vis);
  }
  /** 岸边一圈：给角度，返回岸外 out 像素的地面点 */
  bank(a: number, out = 15) {
    // 海边：「角度」是沿海岸线的参数（x = 384 + a*220），站在湿沙上，跟后端 little-world 一样
    if (this.scene === "sea") { const x = 384 + Math.max(-1.55, Math.min(1.55, a)) * 220; return { x, y: seaShore(x) - out }; }
    // 夜河：也是一条线，沿河东岸（右边）从上游到下游，y = 280 + a*140
    if (this.scene === "river") { const y = 280 + Math.max(-1.55, Math.min(1.55, a)) * 140; return { x: rcx(y) + rhw(y) + out, y }; }
    // 水边在哪：pondQ 沿射线单调，二分到 0.0005。原来 0.01 一格跳，沿岸走时位置一格一格蹦（试玩反馈"一抽一抽的"）
    let lo = 0.5, hi = 2; const c = Math.cos(a), sn = Math.sin(a);
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (pondQ(PC.x + c * RX * mid, PC.y + sn * RY * mid) > 1) hi = mid; else lo = mid; }
    return { x: PC.x + c * (RX * hi + out), y: PC.y + sn * (RY * hi + out * 0.6) };
  }
  /** 到了钓点：面朝水、甩竿，浮漂落在前面的水里 */
  settle(a: Actor) {
    if (this.scene === "sea") { a.dir = 0; a.rod = true; a.moving = 0; a.act = -1; a.bob = { x: a.x + 4, y: seaShore(a.x) + 34 }; return; } // 海边：面朝大海往下甩
    if (this.scene === "river") { a.dir = 1; a.rod = true; a.moving = 0; a.act = -1; const by = a.y - 8; a.bob = { x: rcx(by) + rhw(by) * 0.25, y: by }; return; } // 夜河：站东岸，朝左甩到河里
    const dx = PC.x - a.x, dy = PC.y - a.y; a.dir = Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
    // 浮漂落点试玩反馈不合理（落在岸边 / 荷叶上 / 线横穿人）。改成朝池塘中心方向甩，落在离岸有段距离的开阔水面：
    // 沿「人 → 池塘中心」找第一个 pondQ < 0.8 的点，避开荷叶和栈桥；朝上甩时还要比竿尖更靠上，线才往前走
    a.rod = true; a.moving = 0; a.act = -1; const L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L; const tipY = this.rodTip(a).y;
    let bx = a.x + ux * 40, by = a.y - 8 + uy * 40;
    for (let k = 24; k < 200; k += 2) {
      const x = a.x + ux * k, y = a.y - 8 + uy * k;
      if (pondQ(x, y) > 0.8 || this.onDock(x, y + 6) || Math.abs(x - (DOCK.x0 + DOCK.x1) / 2) < 22 && y > PC.y) continue;
      if (this.props.some(p => p.kind === "lily" && Math.hypot(p.x - x, p.y - y) < 12)) continue;
      if (a.dir === 3 && y > tipY - 10) continue;
      bx = x; by = y; break;
    }
    a.bob = { x: bx, y: by }; a.rod = true; a.moving = 0;
  }
  /** 开放世界：他们在哪由服务器定，前端不再自己挑钓点乱走（截图页 / 没连上服务器时也不乱走） */
  aiWander = false;
  stallImg!: HTMLImageElement; pelImg!: HTMLImageElement; pelActs!: HTMLImageElement; stallImgs: Record<string, HTMLImageElement> = {};
  /** 秤砣现在在干嘛。t0 = 开始的时刻；fish = 过秤时手里那条（画在他那一帧下面，鳞片碎屑盖在鱼上面） */
  pel: { act: PelAct; t0: number; fish: { sp: string; rarity: number } | null; far: number } = { act: "idle", t0: 0, fish: null, far: 0 };
  pelPlay(act: PelAct, fish?: { sp: string; rarity: number }) {
    this.pel = { ...this.pel, act, t0: this.t, fish: fish ?? null }; if (fish) this.fishCanvas(fish.sp);
    // 秤砣的声音：过秤刮鳞嚓嚓（越稀有越亮）然后亮鳞叮当；成交叮当；瞟人 / 嫌弃 / 看见玩家嘎一声；打盹打呼噜
    const X = PEL_POS.x, Y = PEL_POS.y; const r = fish?.rarity ?? 0;
    if (act === "weigh") { this.sfx("scrape", r, X, Y); window.setTimeout(() => this.sfx("coin", 0, X, Y), 1700); }
    else if (act === "deal") this.sfx("coin", 0, X, Y); else if (act === "peek" || act === "player") this.sfx("squawk", 0, X, Y);
    else if (act === "sniff") this.sfx("squawk", 2, X, Y); else if (act === "soft" || act === "worm") this.sfx("squawk", 1, X, Y);
    else if (act === "nap") this.sfx("snore", 0, X, Y); else if (act === "close") this.sfx("paper", 0, X, Y);
  }
  lastStall: StallKind | null = null;
  stallNow(): StallKind { return stallKind(this.hour, this.wx.rain > 0.4 ? "雨" : "晴"); }
  /** 浮漂的样子（跟玩家装备的浮漂走）：wood / cherry / star / melody */
  bobSkin = "wood"; rodSkin = "pole";
  // 买了新竿画出来还是旧竿（玩家和他俩都是）。姿势里的竿按装备重新上色：
  // 晾衣杆 = 原来的木头色；旧伞骨竿 = 银白 + 竿尖一片粉伞布；竹笛竿 = 黄竹 + 竹节 + 粉流苏；月牙竿 = 银蓝 + 竿尖挂一枚小月牙（偶尔闪一下）
  static ROD: Record<string, { d: string; l: string; band?: string; tip?: string } | undefined> = {
    // 钓具箱里的伞骨竿是粉的，拿在手里成了深灰，丑 → 颜色全照钓具箱那套贴纸（public/world-gear/rod_*）重配
    umbrella: { d: "#a3a8b8", l: "#eceef4", tip: "#f7a8c2" }, flute: { d: "#a57d3c", l: "#e2c783", band: "#7d5a26", tip: "#f49ab6" }, moon: { d: "#8394ba", l: "#e6ecf8", tip: "#f6f8ff" } };
  rodOf(a: Actor) { return a === this.me ? this.rodSkin : a.gear?.rod ?? "pole"; }
  bobOf(a: Actor) { return a === this.me ? this.bobSkin : a.gear?.bobber ?? "wood"; }
  rodOver = new Map<string, HTMLCanvasElement | null>();
  /** 姿势格上叠的一层：只有竿的像素，换成这把竿的颜色 */
  rodLayer(who: Who, which: "side" | "front" | "back", skin: string, w: number, h: number) {
    const key = `${who}.${which}.${skin}`; if (this.rodOver.has(key)) return this.rodOver.get(key)!;
    const P = PixelWorld.ROD[skin], px = this.sheets[who].m.rodpx?.[which]; let c: HTMLCanvasElement | null = null;
    if (P && px) { c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!;
      for (const [x, y, l, k] of px) { const band = P.band && Math.round(k * 26) % 5 === 0; g.fillStyle = band ? P.band! : l ? P.l : P.d; g.fillRect(x, y, 1, 1); } }
    this.rodOver.set(key, c); return c;
  }
  /** 竿尖的小东西：月牙竿挂一枚小月牙，旧伞骨竿一个银点 */
  rodTipDeco(a: Actor, tip: { x: number; y: number }) {
    const skin = this.rodOf(a), P = PixelWorld.ROD[skin]; if (!P?.tip) return; const g = this.g, x = Math.round(tip.x), y = Math.round(tip.y);
    if (skin === "moon") { g.fillStyle = P.tip; g.fillRect(x - 1, y + 1, 1, 3); g.fillRect(x, y + 4, 2, 1); g.fillRect(x, y, 1, 1); g.fillStyle = "#f4dc92"; g.fillRect(x + 1, y + 3, 1, 1);
      if (Math.sin(this.t * 1.3 + a.x) > 0.97) { g.fillStyle = "rgba(255,250,220,.9)"; g.fillRect(x - 3, y + 2, 1, 1); g.fillRect(x + 1, y + 2, 1, 1); g.fillRect(x - 1, y, 1, 1); g.fillRect(x - 1, y + 4, 1, 1); } }
    else if (skin === "umbrella") { const f = Math.sin(this.t * 5 + a.x) > 0 ? 1 : 0; g.fillStyle = P.tip; g.fillRect(x, y, 1, 1); g.fillRect(x + 1, y, 2, 2); g.fillRect(x + 1 + f, y + 2, 2, 1); g.fillStyle = "#e57fa2"; g.fillRect(x + 2, y + 1, 1, 1); } // 竿尖挂一小片粉色伞布，风里一飘一飘
    else if (skin === "flute") { g.fillStyle = P.tip; g.fillRect(x, y + 1, 1, 2); } // 小流苏
    else { g.fillStyle = P.tip; g.fillRect(x, y, 1, 1); }
  }
  /** 截图页：镜头跟谁（默认跟玩家）；玩家不在世界里时不画玩家 */
  camFocus: Actor | null = null; hideMe = false;
/** 海边底图：上半沙丘 + 沙滩（贝壳、礁石），下半海（越远越深）；最上面一条被踩出来的沙路 */
  bakeCabin() {
    this.bakeCabinBg();
    const ld = (k: string) => { const im = new Image(); im.src = `/world-cabin/${k}.webp`; this.thImg[k] = im; };
    for (const A of Object.values(TH_GUEST_ART)) { ld(A.k); ld(A.k + "_off"); ld(A.k + "_sign"); }
    this.bakeCabinRest(ld);
  }
  bakeCabinBg() {
    const W = this.mw, H = this.mh; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#f6d9e6"); gr.addColorStop(0.55, "#e9dcf3"); gr.addColorStop(1, "#cfe3c2"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = rng(19); for (let i = 0; i < 70; i++) { g.fillStyle = i % 3 ? "rgba(255,255,255,.7)" : "rgba(255,200,225,.8)"; g.fillRect((r() * W) | 0, (r() * H * 0.7) | 0, 1, 1); }
    // 有客房时屋子右边露出天：几朵软云 + 小星星（以前屋子把整个场景占满，这块看不到）
    if (W > TH_W) { const rc = rng(31); for (let i = 0; i < 9; i++) { const cx = TH_W - 40 + rc() * (W - TH_W + 40), cy = 40 + rc() * H * 0.62, s = 18 + rc() * 26; g.fillStyle = `rgba(255,255,255,${0.18 + rc() * 0.14})`; for (let j = 0; j < 5; j++) { g.beginPath(); g.ellipse(cx + (j - 2) * s * 0.55, cy + Math.sin(j * 1.7) * s * 0.18, s * (0.5 + rc() * 0.3), s * 0.32, 0, 0, 6.28); g.fill(); } }
      for (let i = 0; i < 40; i++) { const x = TH_W + rc() * (W - TH_W), y = rc() * H * 0.75; g.fillStyle = i % 4 ? "rgba(255,250,235,.85)" : "rgba(255,210,230,.9)"; g.fillRect(x | 0, y | 0, 1, 1); if (i % 7 === 0) { g.fillRect((x | 0) - 1, y | 0, 3, 1); g.fillRect(x | 0, (y | 0) - 1, 1, 3); } } }
    g.fillStyle = "#8a6a4e"; g.fillRect(0, H - 40, W, 40); g.fillStyle = "#9fbf7a"; g.fillRect(0, H - 44, W, 5);
    this.ground = cv; this.water = new Uint8Array(W * H); this.props = [];
  }
  bakeCabinRest(ld: (k: string) => void) {
    ld(TH_SHELL); this.thImg.shell = this.thImg[TH_SHELL]; ld("door_a"); for (const f of TH_FURN) { ld(f.k); if (f.sheet) ld(f.sheet); } for (const A of Object.values(TH_ACTS)) { if (A.over) ld(A.over); if (A.alt) ld(A.alt); } for (const A of Object.values(TH_ACTS)) for (const k of A.acts) for (const who of ["player", "buddy", "pal"]) if (TH_ACT_HAVE.has(`${who}_${k}`)) this.actOk(`${who}_${k}`); // 动作图先拿（没有的就记成没有）
  }
  thImg: Record<string, HTMLImageElement> = {}; thTap: Record<string, number> = {}; thDecor: Record<string, string | null> = {};
  // 家具多的地方点不准 → 能直接点画面里的家具：按贴纸真实的形状判断点中哪件（透明的地方不算），前面的先算；点中描一圈亮边，人自己走过去（隔层就走楼梯），到了再用
  thSel: { id: string; t: number } | null = null; onCabinArrive: ((id: string) => void) | null = null; private thMask: Record<string, { w: number; h: number; a: Uint8ClampedArray } | null> = {};
  private thAlphaAt(k: string, u: number, v: number) {
    let M = this.thMask[k]; if (M === undefined) { const im = this.thImg[k]; if (!im?.complete || !im.naturalWidth) return 0; const w = Math.min(256, im.naturalWidth), h = Math.round(w * im.naturalHeight / im.naturalWidth); const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); if (!x) return 0; x.drawImage(im, 0, 0, w, h); try { M = { w, h, a: x.getImageData(0, 0, w, h).data }; } catch { M = null; } this.thMask[k] = M; }
    if (!M) return 255; const px = Math.floor(u * M.w), py = Math.floor(v * M.h); if (px < 0 || py < 0 || px >= M.w || py >= M.h) return 0; return M.a[(py * M.w + px) * 4 + 3];
  }
  private thSilC: Record<string, HTMLCanvasElement | null> = {};
  private thSil(k: string, im: HTMLImageElement) { let c = this.thSilC[k]; if (c !== undefined) return c; const w = Math.min(320, im.naturalWidth), h = Math.round(w * im.naturalHeight / im.naturalWidth); c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); if (!x) { this.thSilC[k] = null; return null; } x.drawImage(im, 0, 0, w, h); x.globalCompositeOperation = "source-in"; x.fillStyle = "#ff8fb8"; x.fillRect(0, 0, w, h); this.thSilC[k] = c; return c; }
  /** 开源版：换某个人的小人图（null = 自带的通用小人）。读不到 / 规格不对就退回通用小人 */
  private spriteSrc: Partial<Record<Who, string>> = {};
  async setSprite(who: Who, url: string | null) {
    const src = url || STARTER; if (this.spriteSrc[who] === src) return; this.spriteSrc[who] = src;
    const d = (await loadDoll(src)) ?? (src !== STARTER ? await loadDoll(STARTER) : null);
    if (!d || this.spriteSrc[who] !== src) return;
    const s: Sheet = { img: d.sheet, m: d.meta, ok: false }; const done = () => { s.ok = true; };
    if (d.sheet.complete && d.sheet.naturalWidth) done(); else d.sheet.onload = done;
    this.sheets[who] = s; this.restImg[who] = d.rest;
  }
  private actImg: Record<string, HTMLImageElement | null> = {};
  private actOk(key: string) { let im = this.actImg[key]; if (im === undefined) { im = new Image(); im.src = `/world-cabin/acts/${key}.png`; const I = im; I.onerror = () => { this.actImg[key] = null; }; this.actImg[key] = I; } return im && im.complete && im.naturalWidth ? im : null; }
  /** 调试 / 截图用：某个站位现在（摆过家具以后）在哪层哪儿 */
  spotAt(id: string) { const S = TH_SPOTS.find(q => q.id === id); return S ? { x: S.x, y: TH_FLOOR[S.f].y } : null; }
  /** 用家具的动作：有这个人的图就走到位置播，返回 true；坐床那种再点一次就起来 */
  cabinAct(who: Who, spot: string): boolean {
    const A0 = TH_ACTS[spot]; const A = A0 && { ...A0, ...A0.per?.[who] }; const a = who === "player" ? this.me : this.ai[who]; if (!A || !a || (A.only && !A.only.includes(who))) return false; // only：谁的东西只给谁用
    if (a.cact && A.loop && A.acts.includes(a.cact.k)) { a.cact = null; a.actUntil = this.t + 0.25; this.sfx("tap", 0, a.x, a.y); return true; }
    const ks = A.acts.filter(k => TH_ACT_HAVE.has(`${who}_${k}`) && this.actOk(`${who}_${k}`)); if (!ks.length) return false; // 第一次先去拿图，这回先用老办法
    const k = ks[Math.floor(Math.random() * ks.length)]; if (a.rest != null) this.sit(who, false);
    a.x = A.x; a.moving = 0; a.path = null; a.dir = A.face; a.cact = { k, t0: this.t, loop: !!A.loop, flip: A.face === 1, dy: A.dy ?? 0, over: A.over, alt: A.alt, spd: A.spd, swap: A.swap, spot }; this.sfx(A.loop ? "boing" : "tap", 0, a.x, a.y); return true;
  }
  /** 世界坐标 (x, y) 点中了哪件能用的东西 */

  // ── 「做成能让我在游戏里自由编辑家具位置」——摆家具模式 ──
  // 按住一件家具拖：地上的左右挪、上下拖换楼层（贴着那层地板），挂墙上的随便挪；拖空地挪镜头看别处。放在别的家具上的小东西跟着主人走。
  // 存的是挪过的那几件（thLayout = 服务器上的 + edit.moves = 这次没存的）。
  thLayout: THLayout = {};
  thEdit: { sel: string | null; grab: { dx: number; dy: number } | null; moves: THLayout; pan: boolean; focus: { x: number; y: number } } | null = null;
  setLayout(L: THLayout) { this.thLayout = { ...L }; applyLayout(this.thEdit ? { ...L, ...this.thEdit.moves } : L); for (const a of [this.ai.buddy, this.ai.pal]) if (a) a.synced = false; }
  editStart() {
    const m = this.me; m.cact = null; m.path = null; m.moving = 0; this.thSel = null;
    const focus = { x: m.x, y: m.y + 30 }; this.thEdit = { sel: null, grab: null, moves: {}, pan: false, focus }; this.camFocus = focus as unknown as Actor; this.sfx("tap");
  }
  /** keep=true：这次挪的并进 thLayout（存服务器由页面做）；false：全部放回去。返回这次挪过的 */
  editEnd(keep: boolean): THLayout {
    const e = this.thEdit; if (!e) return {}; this.thEdit = null; this.camFocus = null;
    if (keep) Object.assign(this.thLayout, e.moves); applyLayout(this.thLayout); for (const a of [this.ai.buddy, this.ai.pal]) if (a) a.synced = false;
    const m = this.me; const fl = this.thFloor(m.x, m.y); if (fl < 0) { m.x = TH_DOOR_X - 20; m.y = TH_FLOOR[2].y; }
    return keep ? e.moves : {};
  }
  furnBox(f: Furn) { const im = this.thImg[f.k]; const w = f.w ?? (im?.naturalWidth ? (im.naturalWidth / im.naturalHeight) * f.h : f.h); const y0 = f.hang ? f.y : f.y - f.h; return { x0: f.x - w / 2, x1: f.x + w / 2, y0, y1: y0 + f.h, w }; }
  /** 摆家具时点中了哪件（前面的先算；地毯最后；放在别的家具上的小东西不单独拖） */
  editHit(x: number, y: number): string | null {
    const [bk, fr] = this.furnOrder(); const order = [...fr].reverse().concat(bk.filter(f => !f.flat).reverse(), bk.filter(f => f.flat));
    for (const f of order) { if (TH_ATTACH[f.k]) continue; const b = this.furnBox(f); if (x >= b.x0 - 3 && x <= b.x1 + 3 && y >= b.y0 - 3 && y <= b.y1 + 3) return f.k; }
    return null;
  }
  editDown(x: number, y: number) {
    const e = this.thEdit; if (!e) return null; const k = this.editHit(x, y);
    if (k) { const f = TH_FURN.find(q => q.k === k)!; e.sel = k; e.grab = { dx: f.x - x, dy: f.y - y }; this.thTap[f.spot ?? "k:" + k] = this.t; this.sfx("tap", 0, f.x, f.y); }
    else { e.sel = null; e.pan = true; }
    return k;
  }
  /** x / y 世界坐标；cdx / cdy 手指这一下挪了多少 css 像素（挪镜头用） */
  editMove(x: number, y: number, cdx: number, cdy: number) {
    const e = this.thEdit; if (!e) return;
    if (e.grab && e.sel) {
      const k = e.sel, d = thDefault(k), f = TH_FURN.find(q => q.k === k); if (!d || !f) return; const b = this.furnBox(f);
      let nx = x + e.grab.dx, ny = y + e.grab.dy, fl: number;
      if (d.hang) { fl = thFloorOf({ y: ny, hang: true }); const top = fl === 0 ? 96 : TH_FLOOR[fl - 1].y + 14; ny = Math.max(top, Math.min(TH_FLOOR[fl].y - d.h - 6, ny)); }
      else { fl = thFloorOf({ y: ny }); const base = TH_FLOOR[fl].y + (d.y - TH_FLOOR[thFloorOf(d)].y); ny = Math.max(base - 10, Math.min(TH_FLOOR[fl].y + 40, ny)); } // 前后：往墙里 10、往前到地板前沿
      const F = TH_FLOOR[fl]; nx = Math.max(F.x0 + b.w / 2 - 8, Math.min(F.x1 - b.w / 2 + 8, nx));
      const was = e.moves[k]; const sz = was?.s ?? this.thLayout[k]?.s; e.moves[k] = { room: "f" + fl, x: Math.round(nx), y: Math.round(ny), ...(sz && sz !== 1 ? { s: sz } : {}) };
      if (was && was.room !== e.moves[k].room) this.sfx("creak", 0, nx, ny);
      applyLayout({ ...this.thLayout, ...e.moves });
    } else if (e.pan) {
      const kk = (window.devicePixelRatio || 1) / this.scale; e.focus.x = Math.max(0, Math.min(this.mw, e.focus.x - cdx * kk)); e.focus.y = Math.max(0, Math.min(this.mh, e.focus.y - cdy * kk));
    }
  }
  /** 摆家具要能放大缩小。mult 1.12 / .12；0.5~2 倍 */
  editScale(mult: number) {
    const e = this.thEdit; if (!e || !e.sel) return null; const k = e.sel, f = TH_FURN.find(q => q.k === k), d = thDefault(k); if (!f || !d) return null;
    const cur = e.moves[k]?.s ?? this.thLayout[k]?.s ?? 1; const ns = Math.round(Math.max(0.5, Math.min(2, cur * mult)) * 100) / 100; if (ns === cur) { this.sfx("tap"); return ns; }
    const pos = e.moves[k] ?? this.thLayout[k] ?? { room: "f" + thFloorOf(d), x: d.x, y: d.y };
    e.moves[k] = { room: pos.room ?? "f" + thFloorOf(d), x: pos.x, y: pos.y, s: ns }; applyLayout({ ...this.thLayout, ...e.moves });
    this.thTap[f.spot ?? "k:" + k] = this.t; this.sfx(mult > 1 ? "pop" : "tap", 0, f.x, f.y); return ns;
  }
  editUp() {
    const e = this.thEdit; if (!e) return;
    if (e.grab && e.sel) { const f = TH_FURN.find(q => q.k === e.sel); if (f) { this.thTap[f.spot ?? "k:" + f.k] = this.t; this.sfx("boing", 0, f.x, f.y); if (!f.hang) for (let i = 0; i < 6; i++) this.parts.push({ x: f.x + (Math.random() - 0.5) * 30, y: f.y - 1, vx: (Math.random() - 0.5) * 24, vy: -8 - Math.random() * 8, life: 0, max: 0.5, c: i % 2 ? "#ffc4dc" : "#e8d3b4", g: 30 }); } }
    e.grab = null; e.pan = false;
  }

  // ── 客房：朋友第一次来，二楼右边长出树枝、花球鼓起来，木牌一翻写上名字；走了窗帘拉上灯熄，再来拉开 ──
  guests: { id: string; name: string; firstAt: number; here: boolean }[] = [];
  guestFx: Record<string, { born: number; on: number; said: number }> = {};
  /** fresh：这台手机上第一次见到的朋友（要演长出来）。页面记哪些见过 */
  setGuests(gs: { id: string; name: string; firstAt: number; here: boolean }[], fresh: Set<string> = new Set()) {
    this.guests = gs;
    for (const r of thGuestRooms(gs)) if (!this.guestFx[r.g.id]) this.guestFx[r.g.id] = { born: fresh.has(r.g.id) ? this.t + 0.6 + r.slot * 2.4 : -99, on: r.g.here ? 1 : 0, said: fresh.has(r.g.id) ? 0 : 9 };
    if (this.scene !== "cabin") return;
    const rooms = thGuestRooms(gs); const last = rooms[rooms.length - 1];
    const lb = last ? this.guestBox(last.slot, last.art) : null; const mw = lb ? Math.max(TH_W, Math.ceil(lb.x + lb.w + 30)) : TH_W;
    if (mw !== this.mw) { this.mw = mw; this.bakeCabinBg(); }
  }
  /** 一间客房在世界里的框：按树枝根（图左边、树枝中线）缩小；u = 图里 1 像素是世界里多少 */
  guestBox(slot: number, A: { sx: number; sy: number; w: number; h: number; br: [number, number] }) {
    const u = TH_GUEST_SCALE / TH_PX, py = (A.br[0] + A.br[1]) / 2, ax = A.sx / TH_PX + slot * TH_GUEST_GAP, ay = (A.sy + py) / TH_PX;
    return { x: ax, y: ay - py * u, w: A.w * u, h: A.h * u, u };
  }
  /** 点到了哪间客房（点花球 / 木牌，树枝不算） */
  guestHit(x: number, y: number): string | null {
    for (const r of thGuestRooms(this.guests)) { const b = this.guestBox(r.slot, r.art), sp = r.art.split * b.u; if (x >= b.x + sp && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { const fx = this.guestFx[r.g.id]; if (fx && this.t - fx.born > 2) return r.g.id; } }
    return null;
  }
  private gFeather: Record<string, HTMLCanvasElement> = {};
  /** 图的 [x0, x1) 那一竖条画到小画布上，左边 fl / 右边 fr 像素羽化成透明（客房长出来用）。cache 给了就缓存（花球那块不变） */
  guestFeather(im: HTMLImageElement, k: number, x0: number, x1: number, h: number, fl: number, fr: number, cache?: string, band?: { x: number; y0: number; y1: number }) {
    const key = cache ? `${cache}:${im.src}` : "_grow"; let c = this.gFeather[key]; if (c && cache) return c;
    if (!c) c = this.gFeather[key] = document.createElement("canvas"); const W = Math.max(1, Math.ceil((x1 - x0) * k)), H = Math.ceil(h * k);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } const x = c.getContext("2d")!; x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, W, H);
    x.drawImage(im, x0 * k, 0, W, H, 0, 0, W, H); x.globalCompositeOperation = "destination-in"; const gr = x.createLinearGradient(0, 0, W, 0);
    gr.addColorStop(0, fl ? "rgba(0,0,0,0)" : "#000"); if (fl) gr.addColorStop(Math.min(1, fl * k / W), "#000"); if (fr) gr.addColorStop(Math.max(0, 1 - fr * k / W), "#000"); gr.addColorStop(1, fr ? "rgba(0,0,0,0)" : "#000");
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    if (band) { // band.x 往右只留树枝那一横条（花球那几列的花不跟着露出来）
      const m = this.gFeather._mask ?? (this.gFeather._mask = document.createElement("canvas")); m.width = W; m.height = H; const mx = m.getContext("2d")!; const bx = (band.x - x0) * k;
      const hg = mx.createLinearGradient(bx - 30 * k, 0, bx, 0); hg.addColorStop(0, "#000"); hg.addColorStop(1, "rgba(0,0,0,0)"); mx.fillStyle = hg; mx.fillRect(0, 0, W, H);
      mx.globalCompositeOperation = "lighter"; const vg = mx.createLinearGradient(0, band.y0 * k, 0, band.y1 * k); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(0.25, "#000"); vg.addColorStop(0.75, "#000"); vg.addColorStop(1, "rgba(0,0,0,0)"); mx.fillStyle = vg; mx.fillRect(bx - 30 * k, band.y0 * k, W, (band.y1 - band.y0) * k); mx.globalCompositeOperation = "source-over";
      x.globalCompositeOperation = "destination-in"; x.drawImage(m, 0, 0); }
    x.globalCompositeOperation = "source-over"; return c;
  }
  drawGuests() {
    const g = this.g, t = this.t; const rooms = thGuestRooms(this.guests);
    for (let i = rooms.length - 1; i >= 0; i--) { // 后面那间先画：它的树枝从前一间花球后面穿出来
      const { g: G, slot, art: A } = rooms[i]; const on = this.thImg[A.k], off = this.thImg[A.k + "_off"]; if (!on?.complete || !on.naturalWidth) continue;
      const fx = this.guestFx[G.id] ?? (this.guestFx[G.id] = { born: -99, on: G.here ? 1 : 0, said: 9 });
      const a = t - fx.born; if (a < 0) continue;
      const b = this.guestBox(slot, A), k = on.naturalWidth / A.w, sp = A.split, py = (A.br[0] + A.br[1]) / 2; // sp / py：图里的像素
      // 声音 + 花瓣：长枝 → 花开 → 木牌翻
      if (fx.said < 1) { fx.said = 1; this.sfx("creak", 0, b.x + 40, b.y + py * b.u); }
      if (fx.said < 2 && a > 1.25) { fx.said = 2; this.sfx("pop", 0, b.x + b.w * 0.6, b.y + b.h * 0.4); for (let j = 0; j < 22; j++) { const an = Math.random() * 6.28, v = 30 + Math.random() * 60; this.parts.push({ x: b.x + b.w * 0.6, y: b.y + b.h * 0.38, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 20, life: 0, max: 1 + Math.random() * 0.6, c: j % 3 ? "#ffc4dc" : "#fff0f6", g: 40 }); } }
      if (fx.said < 3 && a > 2.3) { fx.said = 3; this.sfx("tap", 0, b.x + A.sign[0] * b.u, b.y + A.sign[1] * b.u); }
      { const tg = G.here ? 1 : 0; if (fx.on !== tg) { const was = fx.on; fx.on = tg > was ? Math.min(1, was + 0.025) : Math.max(0, was - 0.025); if ((was === 0 || was === 1) && a > 2) this.sfx(tg ? "pop" : "tap", 0, b.x + b.w * 0.6, b.y + b.h * 0.4); } } // 窗帘拉开 / 拉上、灯亮灭，约 0.7 秒
      // 长出来割裂 → 树枝露出来的那头、花球左边都是羽化的软边（不再是一刀切的竖线）；花球淡入 + 回弹；木牌单独一层，名字画在木牌上一起晃
      const B = sp, grow = Math.min(1, a / 1.3), ge = 1 - (1 - grow) ** 3, q = Math.max(0, Math.min(1, (a - 1.25) / 0.75)), done = a > 2.2;
      const bs = q >= 1 ? 1 : 0.3 + 0.7 * (1 + 2.4 * (q - 1) ** 3 + 1.4 * (q - 1) ** 2), sway = Math.sin(t * 0.9 + slot) * 0.006 * Math.min(1, q);
      const ox = b.x + B * b.u, oy = b.y + py * b.u;
      const src = (im: HTMLImageElement, alpha: number) => {
        if (alpha <= 0.01 || !im?.complete || !im.naturalWidth) return; g.save(); g.globalAlpha = alpha; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
        if (done) { g.translate(ox, oy); g.rotate(sway); g.translate(-ox, -oy); g.drawImage(im, 0, 0, A.w * k, A.h * k, b.x, b.y, b.w, b.h); g.restore(); return; }
        // 树枝那截在花球底下还有一段：一起长出来，花球再盖上去
        const bw = (B + 130) * ge; if (bw > 2) { const c = this.guestFeather(im, k, 0, bw, A.h, 0, Math.min(60, bw), undefined, { x: B - 10, y0: A.br[0] + 35, y1: A.br[1] - 15 }); g.drawImage(c, b.x, b.y, bw * b.u, b.h); }
        if (q > 0) { const x0 = B - 40, c = this.guestFeather(im, k, x0, A.w, A.h, 40, 0, "bloom"); 
          g.translate(ox, oy); g.rotate(sway); g.scale(bs, bs); g.drawImage(c, -40 * b.u, -py * b.u, (A.w - x0) * b.u, b.h); }
        g.restore();
      };
      src(off, 1); src(on, fx.on);
      // 木牌：挂在花球下面轻轻晃；名字出来那一下荡一大下
      const sg = this.thImg[A.k + "_sign"]; if (q > 0 && sg?.complete && sg.naturalWidth) {
        const [sx0, sy0, sw, sh] = A.sign, [cx0, cy0, cw, chh] = A.sl; const nq = Math.max(0, Math.min(1, (a - 2.2) / 0.5)); const kick = a > 2.2 ? Math.exp(-(a - 2.2) * 1.6) * Math.sin((a - 2.2) * 7) * 0.12 : 0;
        g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
        g.translate(ox, oy); g.rotate(sway); g.scale(bs, bs); g.translate(-B * b.u, -py * b.u); // 跟花球同一个变换
        const px0 = (cx0 + cw / 2) * b.u, py0 = cy0 * b.u; g.translate(px0, py0); g.rotate(Math.sin(t * 1.5 + slot * 2) * 0.03 + kick); // 绕木牌上沿中点荡
        g.drawImage(sg, -cw / 2 * b.u, 0, cw * b.u, chh * b.u);
        if (nq > 0) { const nm = G.name.length > 6 ? G.name.slice(0, 6) + "…" : G.name; const fs = Math.min(sh * b.u * 0.5, (sw * b.u * 0.82) / Math.max(2, nm.length)); const pop = nq < 1 ? 1 + Math.sin(nq * Math.PI) * 0.25 : 1;
          g.translate((sx0 + sw / 2 - (cx0 + cw / 2)) * b.u, (sy0 + sh / 2 - cy0) * b.u + 1); g.scale(pop, pop); g.globalAlpha = Math.min(1, nq * 1.6);
          g.font = `700 ${fs}px "PingFang SC","Hiragino Sans GB",sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,240,220,.55)"; g.fillText(nm, 0.6, 0.8); g.fillStyle = "#6b4226"; g.fillText(nm, 0, 0); }
        g.restore();
      }
      // 在家：偶尔飘一片花瓣
      if (fx.on > 0.5 && a > 2 && Math.random() < 0.012) this.parts.push({ x: b.x + b.w * (0.35 + Math.random() * 0.55), y: b.y + b.h * (0.1 + Math.random() * 0.5), vx: -6 + Math.random() * 12, vy: 6 + Math.random() * 6, life: 0, max: 3.5, c: Math.random() < 0.5 ? "#ffc4dc" : "#fbe3ee", g: 2 });
    }
  }
  // 摆家具要能前后挪 → 家具按前后（脚底 y，z 微调）排谁挡谁；放在别的家具上的小东西跟着主人；挂墙上的都在落地的后面；
  // 挪到地板前沿（比走路那条线靠前）的画在人前面
  furnFront(f: Furn) { if (f.front) return true; if (f.flat || f.hang) return false; const fl = TH_FLOOR[thFloorOf(f)]; return f.y > fl.y + 6; }
  furnKey(f: Furn): number { const p = TH_ATTACH[f.k]; if (p) { const pf = TH_FURN.find(q => q.k === p); if (pf) return this.furnKey(pf) + 0.01; } return f.y + (f.z ?? 0); }
  /** 画的顺序：[背景层（地毯 → 墙上的 → 落地的按前后）, 人前面那层] */
  furnOrder(): [Furn[], Furn[]] {
    const idx = new Map(TH_FURN.map((f, i) => [f, i])); const by = (a: Furn, b: Furn) => this.furnKey(a) - this.furnKey(b) || idx.get(a)! - idx.get(b)!;
    const back = TH_FURN.filter(f => !this.furnFront(f)); const front = TH_FURN.filter(f => this.furnFront(f));
    return [[...back.filter(f => f.flat), ...back.filter(f => !f.flat && f.hang), ...back.filter(f => !f.flat && !f.hang).sort(by)], front.sort(by)];
  }
  cabinHit(x: number, y: number): string | null {
    const [bk, fr] = this.furnOrder(); const order = [...fr].reverse().concat([...bk].reverse()); // 画的顺序倒过来：先算前面的
    for (const f of order) { const im = this.thImg[f.k]; if (!im?.naturalWidth) continue; const h = f.h, w = (im.naturalWidth / im.naturalHeight) * h, top = f.hang ? f.y : f.y - h;
      const u = (x - (f.x - w / 2)) / w, v = (y - top) / h; if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      if (this.thAlphaAt(f.k, u, v) < 60) continue; const id = f.spot ?? (f.k === "ground_08" ? "notes" : null); if (id) return id; if (!f.hang) return null; } // 点中没用途的摆设：落地的挡住后面，挂着的让过去
    const T = TH_TUBE; if (x >= T.x0 - 4 && x <= T.x1 + 4 && y >= T.y0 && y <= T.y1) return "tank";
    if (Math.abs(x - TH_DOOR_X) < 16 && y > TH_FLOOR[2].y - 58 && y <= TH_FLOOR[2].y + 4) return "door";
    return null;
  }
  /** 走到那件东西跟前再用：同一层直接走，隔层先走楼梯 */
  cabinGo(id: string) {
    const S = TH_SPOTS.find(q => q.id === id); const m = this.me; if (!S) return; let fl = this.thFloor(m.x, m.y); if (fl < 0 || m.path) return;
    this.thSel = { id, t: this.t }; this.sit("player", false); m.cact = null; const U = TH_STAIR.up, D = TH_STAIR.down; const P: { x: number; y: number; go?: string }[] = [];
    const FY = (f: number) => TH_FLOOR[f].y;
    while (fl !== S.f) { // 0 阁楼 / 1 二楼 / 2 一楼
      if (fl === 1 && S.f === 0) { P.push(...U.map(q => ({ ...q }))); fl = 0; }
      else if (fl === 1) { P.push(...D.map(q => ({ ...q }))); fl = 2; }
      else if (fl === 0) { P.push(...[...U].reverse().map(q => ({ ...q }))); fl = 1; }
      else { P.push(...[...D].reverse().map(q => ({ ...q }))); fl = 1; }
    }
    // 点收音机跳舞「突然瞬移到左边一大格」→ 有动作的家具直接走到动作站的位置，不再到家具跟前再闪过去
    const A = TH_ACTS[id]; const ax = A && (!A.only || A.only.includes("player")) && A.acts.some(k => TH_ACT_HAVE.has(`player_${k}`)) ? A.per?.player?.x ?? A.x : null;
    const tx = Math.max(TH_FLOOR[S.f].x0 + 6, Math.min(TH_FLOOR[S.f].x1 - 6, ax ?? S.x + (S.x > (P.length ? P[P.length - 1].x : m.x) ? -6 : 6)));
    P.push({ x: tx, y: FY(S.f), go: id });
    if (P.length === 1 && Math.abs(tx - m.x) < 3) { P[0].x = m.x; }
    m.path = P; this.sfx("tap");
  }
  decorImg: Record<string, HTMLImageElement> = {};
  /** 摆设（后端 decor）：slot → 摆设 id */
  setDecor(d: Record<string, string | null>) { this.thDecor = { ...d }; for (const id of Object.values(d)) if (id && !this.decorImg[id]) { const im = new Image(); im.src = `/world-gear/decor_${id}.webp`; this.decorImg[id] = im; } }
  /** 画一件家具：按它的小动作（点过之后 1.6 秒内）变形 */
  drawFurn(f: Furn) {
    const im = this.thImg[f.k]; if (!im?.complete || !im.naturalWidth) return; const g = this.g;
    const h = f.h, w = f.w ?? (im.naturalWidth / im.naturalHeight) * h; const top = f.hang ? f.y : f.y - h;
    const tap = f.spot ? this.thTap[f.spot] : this.thTap["k:" + f.k]; const k = tap == null ? 9 : this.t - tap; const on = k < 1.6; const e = on ? Math.exp(-k * 2.6) : 0;
    let ang = 0, sx = 1, sy = 1, dx = 0;
    if (f.anim === "sway") ang = Math.sin(this.t * 1.3 + f.x) * 0.012 + (on ? Math.sin(k * 9) * 0.16 * e : 0);
    if (on && f.anim === "bounce") { sy = 1 - Math.sin(k * 14) * 0.14 * e; sx = 1 + Math.sin(k * 14) * 0.08 * e; }
    if (on && (f.anim === "shake" || f.anim === "notes" || f.anim === "puff")) dx = Math.sin(k * 40) * 1.4 * e;
    if (on && f.anim === "spin") ang = Math.sin(k * 20) * 0.22 * e;
    if (on && (f.anim === "sparkle" || f.anim === "glow")) { sy = 1 + Math.sin(k * 10) * 0.04 * e; sx = sy; }
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    const ax = f.x, ay = f.hang ? top : f.y; g.translate(ax + dx, ay); g.rotate(ang); g.scale(sx, sy);
    const sel = this.thSel && f.spot === this.thSel.id && this.t - this.thSel.t < 6 ? this.t - this.thSel.t : -1; // 点中的那件：粉色亮边一呼一吸，用了以后慢慢退
    if (sel >= 0) { const fade = this.me.path ? 1 : Math.max(0, 1 - (sel - 0.4) / 1.6); const sil = this.thSil(f.k, im); if (sil && fade > 0) { g.globalAlpha = (0.7 + 0.3 * Math.sin(this.t * 6)) * fade; const o = 1.2; for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) g.drawImage(sil, -w / 2 + ox, (f.hang ? 0 : -h) + oy, w, h); g.globalAlpha = 1; } } // 一圈粉色描边（贴纸轮廓往外扩 1 像素）
    if (this.thEdit && !TH_ATTACH[f.k]) { const on = this.thEdit.sel === f.k; const sil = this.thSil(f.k, im); if (on && this.thEdit.grab) g.translate(0, -2); if (sil) { g.globalAlpha = on ? 0.7 + 0.3 * Math.sin(this.t * 7) : 0.22 + 0.08 * Math.sin(this.t * 2 + f.x); const o = on ? 1.5 : 1; for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) g.drawImage(sil, -w / 2 + ox, (f.hang ? 0 : -h) + oy, w, h); g.globalAlpha = 1; } }
    if (this.thEdit?.sel === f.k) { const y0 = f.hang ? 0 : -h, pad = 3; g.save(); g.lineWidth = 1; g.strokeStyle = "rgba(255,255,255,.9)"; g.strokeRect(-w / 2 - pad, y0 - pad, w + pad * 2, h + pad * 2); g.setLineDash([3, 2]); g.lineDashOffset = -this.t * 8; g.strokeStyle = "#e5709a"; g.strokeRect(-w / 2 - pad, y0 - pad, w + pad * 2, h + pad * 2); g.setLineDash([]); g.fillStyle = "#e5709a"; for (const [cx, cy] of [[-w / 2 - pad, y0 - pad], [w / 2 + pad, y0 - pad], [-w / 2 - pad, y0 + h + pad], [w / 2 + pad, y0 + h + pad]]) g.fillRect(cx - 1.5, cy - 1.5, 3, 3); g.restore(); }
    if (f.spot && TH_ACTS[f.spot]?.hide && [this.me, this.ai.buddy, this.ai.pal].some(a => !!a?.cact && a.cact.spot === f.spot && !!this.actOk(`${a.who}_${a.cact.k}`))) { g.restore(); return; } // 动作图里自带这件（早晨盒子）
    const sw = this.furnSwap(f, w);
    const wa = f.spot ? [this.me, this.ai.buddy, this.ai.pal].find(a => a?.cact?.spot === f.spot && !!a.cact?.alt) : undefined; const alt = wa?.cact?.alt ? this.thImg[wa.cact.alt] : null; // 有人用这件家具时换一张
    if (sw) g.drawImage(sw.im, sw.f * sw.fw, 0, sw.fw, sw.fh, -sw.w / 2, f.hang ? 0 : -sw.h, sw.w, sw.h); else g.drawImage(alt?.complete && alt.naturalWidth ? alt : im, -w / 2, f.hang ? 0 : -h, w, h); g.restore();
  }
  /** 家具换整张图：有人躺吊床（swap）就画「人躺在吊床里」那张，不画人；猫窝（sheet）平时画睡着的猫，有人摸就 0-1-2-1 动起来。宽度跟原家具一样，高度按图的比例 */
  private furnSwap(f: Furn, w: number): { im: HTMLImageElement; f: number; fw: number; fh: number; w: number; h: number } | null {
    if (!f.spot) return null; const who = [this.me, this.ai.buddy, this.ai.pal].find(a => a?.cact?.spot === f.spot);
    const fr = (c: NonNullable<Actor["cact"]>) => [0, 1, 2, 1][Math.floor((this.t - c.t0) / (c.spd ?? 0.32)) % 4];
    let im: HTMLImageElement | null = null, n = 0;
    if (who?.cact?.swap) { im = this.actOk(`${who.who}_${who.cact.k}`); n = fr(who.cact); }
    else if (f.sheet) { im = this.thImg[f.sheet] ?? null; n = who?.cact ? fr(who.cact) : 0; }
    if (!im?.complete || !im.naturalWidth) return null; const fw = Math.floor(im.naturalWidth / 3), fh = im.naturalHeight;
    return { im, f: n, fw, fh, w, h: w * fh / fw };
  }
  /** 屋里一直有的小动静：炉子冒烟、竹管里的水和鱼 */
  thAmbient() {
    const sv = TH_FURN.find(f => f.k === "ground_01"); if (!sv) return; // 跟着炉子走（加宽 / 摆家具以后炉子不在原地了）
    if (Math.random() < 0.08) this.parts.push({ x: sv.x - 16 + (Math.random() - 0.5) * 3, y: sv.y - 76, vx: (Math.random() - 0.5) * 5, vy: -9, life: 0, max: 2.2, c: "rgba(240,236,240,.8)", g: 0 });
    if (Math.random() < 0.05) this.parts.push({ x: sv.x - 4 + (Math.random() - 0.5) * 8, y: sv.y - 52, vx: 0, vy: -6, life: 0, max: 1, c: "rgba(255,255,255,.9)", g: 0 });
  }
  /** 竹管：一管水从一楼通到阁楼，水面在顶上晃；里面的鱼上上下下地游（游的是鱼缸里真的那几条） */
  // 蓝色的东西盖在人和楼梯上面。壳图里本来就画了玻璃管，楼梯是从管子前面过的；原来代码在整个管子矩形上糊一层蓝 + 画在人后面。
  // 改成：水 / 鱼 / 气泡先画进离屏小画布，再用「壳图上真是玻璃的像素」当遮罩裁掉（楼梯台阶、花挡着的地方不画），而且在人物之前画
  tubeMask: HTMLCanvasElement | null = null; tubeCv: HTMLCanvasElement | null = null;
  private buildTubeMask() {
    const sh = this.thImg.shell; if (!sh?.complete || !sh.naturalWidth) return false; const T = TH_TUBE; const W = T.x1 - T.x0, H = T.y1 - T.y0, Q = 2;
    const c = document.createElement("canvas"); c.width = W * Q; c.height = H * Q; const x = c.getContext("2d", { willReadFrequently: true })!;
    const k = sh.naturalWidth / TH_W; x.imageSmoothingEnabled = true; x.drawImage(sh, T.x0 * k, T.y0 * k, W * k, H * k, 0, 0, W * Q, H * Q);
    const d = x.getImageData(0, 0, W * Q, H * Q); const a = d.data;
    for (let i = 0; i < a.length; i += 4) { const r = a[i], gg = a[i + 1], b = a[i + 2]; const glass = b > r + 4 && gg > r - 8 && r + gg + b > 300; a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = glass ? 255 : 0; }
    x.putImageData(d, 0, 0); this.tubeMask = c; const o = document.createElement("canvas"); o.width = W * Q; o.height = H * Q; this.tubeCv = o; return true;
  }
  drawTube() {
    if (!this.tubeMask && !this.buildTubeMask()) return; const T = TH_TUBE; const Q = 2; const cv = this.tubeCv!; const g = cv.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, cv.width, cv.height); g.setTransform(Q, 0, 0, Q, -T.x0 * Q, -T.y0 * Q); g.imageSmoothingEnabled = false;
    const t = this.t; const dt = this.tankT < 0 ? 0 : Math.min(0.1, t - this.tankT); this.tankT = t;
    const top = T.y0 + 6 + Math.sin(t * 1.4) * 1.2;
    g.fillStyle = "rgba(120,200,235,.34)"; g.fillRect(T.x0, top, T.x1 - T.x0, T.y1 - top);
    g.fillStyle = "rgba(210,245,255,.7)"; g.fillRect(T.x0, Math.round(top), T.x1 - T.x0, 1);
    for (let i = 0; i < 8; i++) { const y = T.y1 - ((t * 18 + i * 61) % (T.y1 - top)); const x = T.x0 + 5 + ((i * 7) % (T.x1 - T.x0 - 10)) + Math.sin(t * 3 + i) * 1.5; g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
    for (const f of this.tank) {
      const art = this.fishCanvas(f.sp); const w = art ? Math.round(art.width * 0.7) : 10, h = art ? Math.round(art.height * 0.7) : 5;
      f.y += f.v * dt * 0.8; if (f.y < top + h + 2 && f.v < 0) f.v = -f.v; if (f.y > T.y1 - h - 2 && f.v > 0) f.v = -f.v; if (Math.random() < dt * 0.06) f.v = -f.v;
      const face = Math.sin(t * 0.35 + f.p) > 0; const x = (T.x0 + T.x1) / 2 + Math.sin(t * 0.8 + f.p) * Math.max(0, (T.x1 - T.x0 - w) / 2 - 1); const x0 = Math.round(x - w / 2), y0 = Math.round(f.y - h / 2);
      if (art) { if (face) { g.save(); g.translate(x0 + w, 0); g.scale(-1, 1); g.drawImage(art, 0, y0, w, h); g.restore(); } else g.drawImage(art, x0, y0, w, h); } else this.drawFish(x, y0, "#f08a5d");
    }
    g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(T.x0 + 3, top, 2, T.y1 - top);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-in"; g.drawImage(this.tubeMask!, 0, 0); g.globalCompositeOperation = "source-over";
    this.g.drawImage(cv, T.x0, T.y0, T.x1 - T.x0, T.y1 - T.y0);
  }
  /** 一楼的门（圆顶木门）+ 门口的伞沿风铃（留言挂在铃下面，点了会响） */
  /** 门丑 → 出了两个方案玩家挑了 A：圆拱树洞门贴纸，立在原处，点了晃一下出门 */
  drawThDoor() {
    const g = this.g, x = TH_DOOR_X, y = TH_FLOOR[2].y - 6; const t = this.t;
    const dim = this.thImg.door_a;
    if (dim?.complete && dim.naturalWidth) {
      const dt1 = this.thTap["door"]; const k = dt1 == null ? 9 : t - dt1; const e = k < 1.2 ? Math.exp(-k * 3) * Math.sin(k * 18) : 0;
      const h = 70, w = (dim.naturalWidth / dim.naturalHeight) * h; g.drawImage(dim, Math.round(x - w / 2 + e * 1.2), TH_FLOOR[2].y - h + 2, w, h);
      this.drawChime(); return;
    }
    const dt0 = this.thTap["door"]; const op = dt0 == null ? 0 : Math.max(0, 1 - Math.abs(this.t - dt0 - 0.4) / 0.5); // 出门那一下门开一条缝
    g.fillStyle = "#4a2e1e"; g.fillRect(x - 17, y - 58, 34, 58); this.pxEllipse(x, y - 58, 17, 14, "#4a2e1e", true);
    g.fillStyle = "#ffe7b8"; g.fillRect(x - 15, y - 56, 30, 56); this.pxEllipse(x, y - 56, 15, 12, "#ffe7b8", true); // 门缝里透出来的外面
    const dw = Math.round(30 * (1 - op * 0.55)); g.fillStyle = "#b07a4e"; g.fillRect(x - 15, y - 56, dw, 56); if (op < 0.1) this.pxEllipse(x, y - 56, 15, 12, "#b07a4e", true);
    g.fillStyle = "#95623c"; for (const dx of [-8, -1, 6]) if (x + dx < x - 15 + dw) g.fillRect(x + dx, y - 64, 1, 64); g.fillStyle = "#f3c75b"; g.fillRect(x - 15 + dw - 5, y - 28, 2, 3);
    g.fillStyle = "#f59ab8"; g.fillRect(x - 3, y - 66, 6, 3); g.fillRect(x - 1, y - 68, 2, 7); // 门上一个小蝴蝶结
    this.drawChime();
  }
  drawChime() {
    const g = this.g, x = TH_DOOR_X, y = TH_FLOOR[2].y - 6; const t = this.t;
    // 风铃：一把倒挂的小伞，伞沿挂一圈铃，铃下面吊着纸条（有多少留言挂多少，最多 6 张）
    const cx = x - 36, cy = y - 62; const tap = this.thTap["notes"]; const k = tap == null ? 9 : t - tap; const sw = Math.sin(t * 1.7) * 0.6 + (k < 2 ? Math.sin(k * 10) * 3 * Math.exp(-k * 2) : 0);
    g.fillStyle = "#6b4a36"; g.fillRect(cx, cy - 16, 1, 8);
    for (let i = -9; i <= 9; i++) { const yy = cy - 8 + Math.round((i * i) / 18); g.fillStyle = i % 3 === 0 ? "#f59ab8" : "#ffc4dc"; g.fillRect(cx + i, yy - 3, 1, 12 - Math.round((i * i) / 18) - 6); }
    const n = Math.max(3, Math.min(6, this.thNotes)); for (let i = 0; i < n; i++) { const px = cx - 8 + (i * 16) / (n - 1); const len = 7 + (i % 2) * 4; const ex = px + sw * (1 + i % 2); g.fillStyle = "#c8a47e"; g.fillRect(Math.round(px), cy, 1, len); g.fillStyle = i < this.thNotes ? ["#fff6ec", "#ffe1ec", "#e6e0ff"][i % 3] : "#f7d9a8"; g.fillRect(Math.round(ex) - 2, cy + len, 4, i < this.thNotes ? 6 : 3); }
  }
  // ── 欠条：一楼门边（布谷钟右边那块墙）拉一根小麻绳，没撕的欠条用小夹子夹着挂一排，轻轻晃；点一张打开 ──
  ious: { id: string; mine: boolean; paid: boolean }[] = []; iouFx: Record<string, number> = {};
  static IOU = { x0: 604, x1: 668, y: 466 };
  setIous(list: { id: string; debtor: string; creditor: string; paidMark?: number | null; tornAt?: number | null }[]) {
    const open = list.filter(i => !i.tornAt).slice(0, 5); const had = new Set(this.ious.map(i => i.id));
    for (const i of open) if (!had.has(i.id) && this.ious.length) this.iouFx[i.id] = this.t; // 新挂上来的：从上面落下来夹住
    this.ious = open.map(i => ({ id: i.id, mine: i.creditor === "player", paid: !!i.paidMark }));
  }
  private iouSlot(i: number) { const { x0, x1, y } = PixelWorld.IOU; const n = Math.max(1, this.ious.length); const x = x0 + ((i + 0.5) / n) * (x1 - x0); const k = (x - x0) / (x1 - x0); return { x, y: y + Math.sin(k * Math.PI) * 5 }; }
  drawIous() {
    if (this.scene !== "cabin" || !this.ious.length) return; const g = this.g, t = this.t; const { x0, x1, y } = PixelWorld.IOU;
    g.strokeStyle = "#b08a62"; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 - 3, y - 1); g.quadraticCurveTo((x0 + x1) / 2, y + 10, x1 + 3, y - 1); g.stroke();
    g.fillStyle = "#8a6a4a"; g.fillRect(x0 - 4, y - 2, 2, 2); g.fillRect(x1 + 2, y - 2, 2, 2);
    this.ious.forEach((o, i) => { const p = this.iouSlot(i); const f = this.iouFx[o.id]; const e = f == null ? 9 : t - f; const drop = e < 0.5 ? (1 - e / 0.5) ** 2 * -26 : 0;
      const sw = Math.sin(t * 1.4 + i * 1.7) * 0.06 + (e < 1.4 ? Math.sin(e * 12) * 0.25 * Math.exp(-e * 3) : 0);
      g.save(); g.translate(p.x, p.y + drop); g.rotate(sw);
      g.fillStyle = "rgba(90,60,40,.18)"; g.fillRect(-4.5, 2.5, 10, 13); // 影子
      g.fillStyle = o.mine ? "#fffdf4" : "#fff4f6"; g.fillRect(-5, 1.5, 10, 13);
      g.fillStyle = o.mine ? "#d9b9a4" : "#e8b2c4"; for (let l = 0; l < 3; l++) g.fillRect(-3.5, 5 + l * 3, l === 2 ? 4 : 7, 1); // 字
      if (o.paid) { g.strokeStyle = "rgba(214,70,110,.8)"; g.lineWidth = 0.8; g.strokeRect(-1, 9, 5, 4); } // 标了「还了」的盖个小红印
      g.fillStyle = "#f29bb8"; g.fillRect(-1.5, -1, 3, 4); g.fillStyle = "#fff"; g.fillRect(-0.5, -0.5, 1, 1); // 小夹子
      g.restore(); });
  }
  iouHit(x: number, y: number): string | null { if (this.scene !== "cabin") return null; for (let i = this.ious.length - 1; i >= 0; i--) { const p = this.iouSlot(i); if (Math.abs(x - p.x) <= 8 && y >= p.y - 3 && y <= p.y + 17) return this.ious[i].id; } return null; }
  thNotes = 0;
  /** 点一样家具：它自己动一下 + 出点小东西（音符 / 星星 / 烟） */
  cabinPoke(id: string) {
    this.thTap[id] = this.t; const f = TH_FURN.find(q => q.spot === id); const x = f ? f.x : this.me.x, y = f ? (f.hang ? f.y + f.h : f.y - f.h) : this.me.y - 40;
    const P = (c: string, n: number, vy = -18, g = 0) => { for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 18, y: y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 22, vy: vy - Math.random() * 10, life: 0, max: 0.9 + Math.random() * 0.6, c, g }); };
    const a = f?.anim;
    if (a === "notes") { P("#f59ab8", 5); P("#9b8cf0", 4); this.sfx("chime"); }
    else if (a === "sparkle" || a === "glow") { P("#fff4b0", 8, -12); P("#ffffff", 5, -8); this.sfx("popup"); }
    else if (a === "puff") { P("rgba(240,236,240,.9)", 12, -16); this.sfx("bubble"); }
    else if (a === "bounce") { P("#ffc4dc", 6, -20, 40); this.sfx("pop"); }
    else if (a === "sway") { P("#c9b3ff", 4, -6, 20); this.sfx("rustle"); }
    else if (a === "spin") { P("#c9b3ff", 6, -14); P("#ffc4dc", 6, -14); this.sfx("swing"); }
    else { P("#d9b38e", 5, -14, 40); this.sfx("clack"); }
    if (id === "notes") this.sfx("chime", 1);
  }
  mw = MAP_W; mh = MAP_H; // 这个场景的地图多大
  farmImg: Record<string, HTMLImageElement> = {}; fGates = [false, false, false]; // 三道木闸开没开
  bakeFarm() {
    const W = this.mw, H = this.mh; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
    const img = g.createImageData(W, H); const d = img.data; this.water = new Uint8Array(W * H);
    const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const vn = (x: number, y: number, sc: number) => { const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy); const fx = gx - x0, fy = gy - y0; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), e = hash2(x0 + 1, y0 + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v; };
    const GR = ["#6f9834", "#7ea53a", "#8cb142", "#9bbd4b"].map(hx), DIRT = ["#c9a27a", "#b8906a", "#d6b28a"].map(hx);
    const WAT = ["#7fd0de", "#5db8d2", "#4aa2c6"].map(hx), FOAM = hx("#e3f6f5"), ROCK = ["#8a877e", "#a39e92", "#c4c0b6", "#6c6a64"].map(hx);
    const SOIL = ["#7a4e32", "#8a5a3a", "#6a4229", "#9c6a44"].map(hx), EDGEW = hx("#b8906a"), EDGED = hx("#8c6440");
    const inPlot = (x: number, y: number) => { for (const k in FPLOT) { const q = FPLOT[k]; if (x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) return q; } return null; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = hash2(x, y); let c: number[];
      // 在哪道墙的正面上（墙顶线往下 FACE 像素）
      let wall = -1; for (let i = 0; i < 3; i++) { const wy = fWallY(i, x); if (y >= wy && y < wy + FACE) wall = i; }
      const step = wall >= 0 && Math.abs(x - FSTEP[wall]) < 14;
      const ch = fChanD(x + 0.5, y + 0.5), dq = fDuckQ(x + 0.5, y + 0.5), pd = fPathD(x + 0.5, y + 0.5);
      const pl = inPlot(x, y), fq = Math.hypot((x - FFIELD.x) / FFIELD.rx, (y - FFIELD.y) / FFIELD.ry);
      if (dq < 1) { this.water[y * W + x] = 1; c = dq > 0.94 ? FOAM : WAT[dq > 0.8 ? 0 : dq > 0.45 ? 1 : 2]; }
      else if (ch < 6.5) { this.water[y * W + x] = 1; c = wall >= 0 ? (hash2(x, y >> 1) > 0.45 ? FOAM : WAT[0]) /* 过墙：小瀑布 */ : ch > 5.3 ? FOAM : WAT[ch < 2 ? 2 : 1]; }
      else if (ch < 8.5 || dq < 1.07) c = ROCK[n > 0.6 ? 2 : 1]; // 水渠两边一道石头沿
      else if (wall >= 0 && step) { const k = y - fWallY(wall, x); const row = Math.floor(k / 4); c = k % 4 === 3 ? ROCK[3] : row % 2 ? ROCK[1] : ROCK[2]; } // 台阶：三级石板
      else if (wall >= 0) { const k = y - fWallY(wall, x); const row = Math.floor(k / 4), off = (row % 2) * 5; const row5 = Math.floor((k - 2) / 4), off5 = (row5 % 2) * 6; c = k < 2 ? (k < 1 ? GR[3] : hx("#b7cf6a")) : (k - 2) % 4 === 3 || (x + off5) % 12 === 0 ? ROCK[3] : ROCK[hash2(Math.floor((x + off5) / 12), row5 + wall * 9) > 0.5 ? (k > FACE - 5 ? 0 : 2) : k > FACE - 5 ? 3 : 1]; void row; void off; } // 石墙：墙顶一道亮草边，错缝石块上亮下暗
      else if (pl) { const lx = x - pl.x, ly = y - pl.y; c = lx < 2 || ly < 2 || lx >= pl.w - 2 || ly >= pl.h - 2 ? (lx < 1 || ly < 1 || lx >= pl.w - 1 || ly >= pl.h - 1 ? EDGED : EDGEW) : ly % 8 < 2 ? SOIL[2] : ly % 8 === 2 ? SOIL[3] : SOIL[n > 0.8 ? 0 : 1]; } // 菜地：木条框 + 一垄一垄
      else if (fq < 1) c = fq > 0.93 ? EDGEW : (y - FFIELD.y + 60) % 8 < 2 ? SOIL[2] : SOIL[n > 0.85 ? 3 : 1]; // 大田
      else if (pd < 11) c = DIRT[pd > 9.5 ? 1 : n > 0.93 ? 2 : n < 0.06 ? 1 : 0];
      else {
        const below = FWALL.reduce((m, _, i) => { const k = y - fWallY(i, x) - FACE; return k >= 0 && k < 7 ? Math.max(m, 1 - k / 7) : m; }, 0); // 墙脚阴影，越近越暗
        const lv = FWALL.filter((_, i) => y > fWallY(i, x) + FACE).length; // 第几层（越往下越低，草稍微暗一点，看得出高低）
        const f = vn(x, y, 46) * 0.62 + vn(x + 311, y + 97, 15) * 0.38 - below * 0.5 + 0.1 - lv * 0.06;
        c = GR[Math.max(0, Math.min(3, Math.floor(f * 4.4 - 0.7 + (n - 0.5) * 0.45)))];
      }
      const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const px = (x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };
    // 小路过水渠的地方：一座木板小桥（桥面不算水）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fChanD(x + 0.5, y + 0.5) < 7.5 && fPathD(x + 0.5, y + 0.5) < 10) { this.water[y * W + x] = 0; px(x, y, (x + y * 0) % 5 === 0 ? "#8c6440" : y % 7 === 0 ? "#9c7450" : "#c29a6c"); }
    // 草里的小花
    const r = rng(33); for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H; if (this.water[(y | 0) * W + (x | 0)] || fPathD(x, y) < 14 || fChanD(x, y) < 10) continue; let bad = false; for (const k in FPLOT) { const q = FPLOT[k]; if (x > q.x - 4 && x < q.x + q.w + 4 && y > q.y - 4 && y < q.y + q.h + 4) bad = true; } if (bad) continue; const c = ["#f59ab8", "#ffffff", "#f7b6cc", "#ffe38a"][(r() * 4) | 0]; px(x, y, c); px(x - 1, y + 1, c); px(x + 1, y + 1, c); }
    this.ground = cv;
    // 建筑图
    for (const [k, src] of Object.entries({ cottage: fCottage, windmill: fWindmill, shedPlayer: fShedPlayer, shedBuddy: fShedBuddy, shedPal: fShedPal, greenhouse: fGreenhouse, board: fBoard, gateC: fGateC, gateO: fGateO })) { const im = new Image(); im.src = src; this.farmImg[k] = im; }
    // 树：沿最上面的山脊和左右两边，别挡建筑、菜地、路、水
    const add = (kind: Prop["kind"], x: number, y: number, rr = 0, flat = false) => this.props.push({ kind, x, y, r: rr, flat, flip: hash2(x | 0, y | 0) > 0.5 });
    const busy = (x: number, y: number, dd: number) => this.props.some(q => !q.flat && Math.hypot(q.x - x, q.y - y) < dd);
    const clear = (x: number, y: number, m: number) => { if (fChanD(x, y) < m || fPathD(x, y) < m + 12 || fPathD(x, y - 30) < m + 12 || fDuckQ(x, y) < 1.3) return false; for (const k in FPLOT) { const q = FPLOT[k]; if (x > q.x - m && x < q.x + q.w + m && y > q.y - m && y < q.y + q.h + m + 20) return false; }
      if (Math.hypot((x - FFIELD.x) / (FFIELD.rx + m), (y - FFIELD.y) / (FFIELD.ry + m)) < 1.2) return false; for (const b of Object.values(FB)) if (Math.abs(x - b.x) < b.bw + m + 20 && y > b.y - 110 && y < b.y + m + 10) return false;
      for (let i = 0; i < 3; i++) { const wy = fWallY(i, x); if (y > wy - 6 && y < wy + FACE + 14) return false; } return true; };
    const TREES: Prop["kind"][] = ["treeBig", "tree", "treePink", "tree", "treeSmall"];
    const rt = rng(61); for (let i = 0; i < 400 && this.props.length < 34; i++) { const edge = rt() < 0.85; const x = edge ? (rt() < 0.5 ? 12 + rt() * 40 : W - 12 - rt() * 40) : 20 + rt() * (W - 40), y = edge ? 50 + rt() * (H - 60) : 40 + rt() * (H - 50); if (!clear(x, y, 18) || busy(x, y, 36) || (y > 380 && x > 150 && x < 620) || Math.hypot(x - 384, y - 520) < 90) continue; add(TREES[(rt() * TREES.length) | 0], x, y, 5); }
    for (let x = 200; x < W - 40; x += 34 + rt() * 20) { const y = 40 + rt() * 22; if (clear(x, y, 10) && !busy(x, y, 30) && Math.abs(x - 560) > 40) add(rt() < 0.5 ? "treePink" : "tree", x, y, 5); } // 山脊一排树
    for (let i = 0; i < 60; i++) { const x = 20 + rt() * (W - 40), y = 40 + rt() * (H - 50); if (!clear(x, y, 8) || busy(x, y, 20)) continue; add(rt() < 0.5 ? "bushFlower" : "flowers", x, y, 0, true); }
    for (let i = 0; i < 14; i++) { const t = rt(); const k = Math.floor(t * (FDUCK.rx * 2)); const x = FDUCK.x - FDUCK.rx + k, y = FDUCK.y - FDUCK.ry * 0.9 + rt() * 4; if (fDuckQ(x, y) > 1.02 && fDuckQ(x, y) < 1.25) add("reeds", x, y, 0); }
    this.signPos = { x: 430, y: 516 }; add("sign", this.signPos.x, this.signPos.y, 6);
  }
  treeImg: Record<string, HTMLImageElement> = {}; basketY = FG.y0 + 4; // 吊篮底（没人坐时停在哪）
  /** 伞树农场：远景是 画的一整张（雪山、花田、小村风车、湖）。地面画布里放一份不动的（下面草地用），远景那截每帧按视差另画；树干、树屋、池塘、摆件每帧画（有动画） */
  bakeTree() {
    const W = FX1 - FX0, H = this.mh; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!; g.imageSmoothingEnabled = false;
    this.water = new Uint8Array(this.mw * H); this.props = []; this.signPos = { x: -9999, y: -9999 }; /* 农场没有路牌，走人用地图 */
    g.fillStyle = "#a3ccf8"; g.fillRect(0, 0, W, H); this.ground = cv; this.groundX = FX0; // 地面画布从菜园左头铺到院子右头（画的时候往左挪 FX0）
    const L = (k: string, src: string) => new Promise<HTMLImageElement>(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(im); im.src = src; this.treeImg[k] = im; });
    void L("bg", tBg).then(bg => {
      g.drawImage(bg, -FX0, BG_Y); g.save(); g.scale(-1, 1); g.drawImage(bg, FX0, BG_Y); g.drawImage(bg, FX0 - FARM_W * 2, BG_Y); g.restore(); /* 菜园 / 院子底下的草地：远景图左右各镜像接一张（镜像接缝天然对得上） */ const r = rng(91); const px = (x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };
      // 一条土路（人走的那条），两边压一圈深一点的边，路上零星小石子
      for (let y = FG.y0 + 3; y < FG.y1 - 1; y++) for (let x = 0; x < W; x++) { const n = hash2(x, y * 3); const edge = y === FG.y0 + 3 || y === FG.y1 - 2; if (edge) { if (n > 0.25) px(x, y, "#b99a70"); continue; } px(x, y, n > 0.94 ? "#efdcb8" : n < 0.05 ? "#c4a47c" : "#dfc79f"); }
      for (let i = 0; i < 170; i++) px(r() * W, FG.y0 + 6 + r() * 28, r() < 0.5 ? "#b8a58c" : "#f4e6c8", 2, 1);
    });
    for (const [k, src] of Object.entries({ garden: xGarden, yard: xYard, trunk: tTrunk, house: tHouse, pipe: tPipe, pond: tPond, canopy: tCanopy, boat: tBoat, basket: tBasket, ladder: tLadder, potPlayer: tPotPlayer, potBuddy: tPotBuddy, potPal: tPotPal, potPlayerE: tPotPlayerE, potBuddyE: tPotBuddyE, potPalE: tPotPalE, w0: tW0, w1: tW1, w2: tW2, w3: tW3, w4: tW4, w5: tW5,
      sunflower: pSunflower, pumpkin: pPumpkin, scarecrow: pScarecrow, mushroom: pMushroom, dandelion: pDandelion, bamboo: pBamboo, apple: pApple, peach: pPeach, lemon: pLemon, arch: pArch, hydP: pHydP, hydB: pHydB, hydV: pHydV, lavender: pLavender, clothes: pClothes, board: fBoard })) void L(k, src);
    this.animals = new FarmAnimals(); // 农场扩建的 8 只小动物
    const rb = rng(17); this.bflies = Array.from({ length: 6 }, (_, i) => { const hx = 120 + rb() * 1300; return { x: hx, y: 800 + rb() * 40, hx, hy: 810 + rb() * 30, p: rb() * 6.28, c: ["#ffb3cf", "#ffffff", "#ffe07a", "#c9b3ff"][i % 4], flee: 0 }; });
  }
  noParallax = false; // 远景视差
  bflies: { x: number; y: number; hx: number; hy: number; p: number; c: string; flee: number }[] = [];
  birds: { x: number; y: number; vx: number; vy: number; p: number }[] = []; nextFlock = 6; boatHop = -9; fishJump: { t0: number; x: number } | null = null; nextFish = 8;
  propFx: Record<number, { face: number; turn: number; hit: number; puff: number }> = {}; stepPetal = 0;
  treeOk(k: string) { const im = this.treeImg[k]; return im?.complete && im.naturalWidth ? im : null; }
  /** 远景（视差）+ 云 + 飞鸟 + 湖上的小帆船 + 波光 */
  drawFarBg() {
    const g = this.g, t = this.t, bg = this.treeOk("bg"); const ox = this.farOx();
    if (bg) { const h = SEAM - BG_Y, w = bg.width; const k0 = Math.floor((this.cam.x - ox) / w) - 1, k1 = Math.ceil((this.cam.x + this.vw - ox) / w); /* 按看得见的范围一张正一张镜像循环铺（镜像接缝天然对得上），屏幕再宽也不露底 */
      for (let k = k0; k <= k1; k++) { const x = ox + k * w; if (k % 2 === 0) g.drawImage(bg, 0, 0, w, h, x, BG_Y, w, h); else { g.save(); g.scale(-1, 1); g.drawImage(bg, 0, 0, w, h, -(x + w), BG_Y, w, h); g.restore(); } } }
    // 慢慢飘的小云（比远景还慢）
    for (let i = 0; i < 5; i++) { const w = 40 + hash2(i, 3) * 50, x = Math.round(this.cam.x + ((((hash2(i, 1) * 1800 + t * (2 + i * 0.6) - this.cam.x * 0.75) % 1900) + 1900) % 1900) - 180), y = Math.round(70 + hash2(i, 2) * 200);
      g.fillStyle = "#ffffff"; g.fillRect(x, y, w, 5); g.fillRect(x + 6, y - 4, w - 16, 4); g.fillRect(x + 14, y - 7, w * 0.4, 3); g.fillStyle = "#f6e8f2"; g.fillRect(x + 3, y + 5, w - 6, 2); }
    // 湖面波光：一颗颗亮点明灭
    for (let i = 0; i < 46; i++) { const x = ox + Math.round(hash2(i, 41) * 1536), y = Math.round(LAKE.y0 + 8 + hash2(i, 43) * (LAKE.y1 - LAKE.y0 - 20)); const k = Math.sin(t * (1.2 + hash2(i, 47)) + i * 2.1); if (k < 0.55) continue; g.fillStyle = k > 0.85 ? "#ffffff" : "#f3e6ff"; g.fillRect(x, y, k > 0.85 ? 3 : 2, 1); }
    // 小帆船（远景里原来那只抠出来的）：从左往右慢慢漂一圈要三分多钟，水里一道倒影跟着晃；点它会颠两下、冒小粉心
    const bt = this.treeOk("boat"); if (bt) { const bx = this.boatX(), hop = t - this.boatHop < 1.2 ? -Math.round(Math.abs(Math.sin((t - this.boatHop) * 8)) * 3) : 0, by = 626 + Math.round(Math.sin(t * 1.4) * 0.6) + hop;
      g.globalAlpha = 0.28; for (let k = 0; k < 8; k++) { const sh = Math.ceil(bt.height / 8), dx = Math.round(Math.sin(t * 3 + k) * 1.5); g.save(); g.translate(0, by * 2 + 2); g.scale(1, -1); g.drawImage(bt, 0, k * sh, bt.width, sh, bx - (bt.width >> 1) + dx, by - bt.height + k * sh, bt.width, sh); g.restore(); } g.globalAlpha = 1;
      g.drawImage(bt, bx - (bt.width >> 1), by - bt.height); }
    // 飞鸟：隔一阵从镜头左边飞过一小群；点一下四散
    if (t > this.nextFlock && !this.birds.length) { this.nextFlock = t + 22 + Math.random() * 18; const y0 = this.cam.y + 30 + Math.random() * 60; for (let i = 0; i < 5; i++) this.birds.push({ x: this.cam.x - 20 - i * 14 - (i % 2) * 6, y: y0 + (i % 2 ? 7 : 0) + i * 2, vx: 34 + Math.random() * 4, vy: 0, p: Math.random() * 6 }); }
    for (const b of this.birds) { const up = Math.sin(t * 9 + b.p) > 0; g.fillStyle = "#6f6a86"; const x = Math.round(b.x), y = Math.round(b.y); g.fillRect(x, y, 1, 1); if (up) { g.fillRect(x - 2, y - 2, 2, 1); g.fillRect(x + 1, y - 2, 2, 1); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); } else { g.fillRect(x - 2, y, 2, 1); g.fillRect(x + 1, y, 2, 1); } }
  }
  boatX() { return this.farOx() + Math.round(((this.t * 7 + 420) % 1900) - 160); }
  /** 远景图左边贴在哪（世界 x）。农场加宽：镜头从菜园左头走到院子右头，远景正好从左边滑到右边（不够宽就靠两边的镜像补） */
  farOx() { if (this.noParallax) return 0; const span = FX1 - this.vw - FX0, r = span > 0 ? Math.max(0, Math.min(1, (FARM_W - this.vw) / span)) : 0; return Math.round(this.cam.x - r * (this.cam.x - FX0)); }
  /** 伞面 + 紫藤 + 梯子 + 花盆 + 树干 / 树屋 / 池塘 / 摆件（在人后面画） */
  drawTreeBack() {
    const g = this.g, t = this.t, wind = this.wx?.wind ?? 0.3, m = this.me;
    this.drawFarBg();
    // 左边菜园、右边院子：效果图抠出来的前景（湖岸以下到小路），底边压着小路上沿
    const vx0 = this.cam.x, vx1 = this.cam.x + this.vw;
    const gd = this.treeOk("garden"); if (gd && vx0 < FX0 + gd.width) { g.drawImage(gd, FX0, 856 - gd.height); this.drawGroundCrops(); }
    const yd = this.treeOk("yard"); if (yd && vx1 > FARM_W) g.drawImage(yd, FARM_W, 856 - yd.height);
    // 树干、树屋、小塘、竹管、摆件按脚底 y 排前后
    type D = { y: number; f: () => void }; const L: D[] = [];
    const tr = this.treeOk("trunk"); if (tr) L.push({ y: 876, f: () => { for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(40,70,30," + (0.05 + i * 0.03) + ")"; g.beginPath(); g.ellipse(768, 874, 230 - i * 30, 12 - i * 2, 0, 0, 6.29); g.fill(); } g.drawImage(tr, TRUNK.x, TRUNK.y); } });
    const ho = this.treeOk("house"); if (ho) L.push({ y: 880, f: () => g.drawImage(ho, HOUSE.x, HOUSE.y) });
    const po = this.treeOk("pond"); if (po) L.push({ y: 856, f: () => { g.drawImage(po, POND.x, POND.y); this.drawPondFx(); } });
    const pi = this.treeOk("pipe"); if (pi) L.push({ y: 860, f: () => { g.drawImage(pi, PIPE.x, PIPE.y); if (Math.random() < 0.5) this.parts.push({ x: SPOUT.x + Math.random() * 3, y: SPOUT.y, vx: 6 + Math.random() * 6, vy: 10, life: 0, max: 0.35, c: Math.random() < 0.5 ? "#e8f8ff" : "#9fd8f0", g: 260 }); } });
    FPROPS.forEach((p, i) => { if (!p.front) L.push({ y: p.y, f: () => this.drawFProp(p, i) }); });
    if (this.animals) L.push(...this.animals.drawers(g, t, this.isNight(), v => this.rp(v), { x0: vx0, x1: vx1 }));
    L.sort((a, b) => a.y - b.y); for (const d of L) d.f();
    // 伞下一串小灯笼（晚上亮）
    this.drawFestoon();
    // 梯子：图的中段一截截往下接
    const ld = this.treeOk("ladder"); if (ld) { const top = fWalkY(LADDER_X) - 14, x = LADDER_X - Math.round(ld.width / 2); let y = top; const seg = ld.height - 40; g.drawImage(ld, 0, 0, ld.width, 20, x, y, ld.width, 20); y += 20; while (y < FG.y1 - 10) { const h = Math.min(seg, FG.y1 - 10 - y); g.drawImage(ld, 0, 20, ld.width, h, x, y, ld.width, h); y += h; } }
    // 紫藤：一串串挂在伞沿底下，按段横着错开 = 风吹得晃（不旋转，像素不糊）；玩家从伞面上走过头顶那几串会被带得多晃几下
    const WS = ["w0", "w1", "w2", "w3", "w4", "w5"]; const onTop = Math.abs(m.y - fWalkY(m.x) - 2) <= 8;
    for (let i = 0; i < 22; i++) { const im = this.treeOk(WS[i % 6]); if (!im) continue; const x = 150 + i * 56 + Math.round(hash2(i, 5) * 20); if (x > 1410) continue; const b = CAN_BOT[x - TC.x]; if (b == null || b < 0) continue; const y0 = TC.y + b - 10;
      const near = (onTop || m.ride) && Math.abs(m.x - x) < 34 && m.moving ? 3 : 0; const sl = 6, sh = Math.ceil(im.height / sl);
      for (let k = 0; k < sl; k++) { const dx = Math.round(Math.sin(t * (1.3 + near * 1.5) + i * 0.9) * (1 + wind * 3 + near) * (k / sl)); g.drawImage(im, 0, k * sh, im.width, sh, x - (im.width >> 1) + dx, y0 + k * sh, im.width, sh); } }
    // 伞面：风大时整层轻轻起伏 1 像素
    const cn = this.treeOk("canopy"); const sk = t - this.shakeAt < 0.9 ? Math.round(Math.sin((t - this.shakeAt) * 38) * 3 * (1 - (t - this.shakeAt) / 0.9)) : 0; if (cn) g.drawImage(cn, TC.x + sk, TC.y + Math.round(Math.max(0, Math.sin(t * 0.8)) * (0.4 + wind)));
    if (this.farm) this.drawRainDots();
    this.drawBasket("back");
    // 三个人的旧物花盆，摆在伞面上
    for (const [who, k] of [["player", "potPlayer"], ["buddy", "potBuddy"], ["pal", "potPal"]] as const) { const im = (this.farm && this.treeOk(k + "E")) || this.treeOk(k); if (!im) continue; const x = FPOT[who], y = fWalkY(x) + 8; this.pxEllipse(x, y - 1, im.width * 0.4, 3, "rgba(60,40,60,.25)", true); const x0 = this.rp(x - im.width / 2), y0 = this.rp(y - im.height); g.drawImage(im, x0, y0); if (this.farm) this.drawCrops(who, x0, y0); }
    this.drawStream();
    // 蝴蝶：在地上的花丛间绕；玩家走近就往上飞走
    for (const b of this.bflies) { const up = Math.sin(t * 14 + b.p) > 0; g.fillStyle = b.c; const x = Math.round(b.x), y = Math.round(b.y); if (up) { g.fillRect(x - 2, y - 1, 2, 2); g.fillRect(x + 1, y - 1, 2, 2); } else { g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); } g.fillStyle = "#5a4a5a"; g.fillRect(x, y - 1, 1, 2); }
  }
  /** 前景摆件（压在人前面） */
  drawFarmFront() { FPROPS.forEach((p, i) => { if (p.front) this.drawFProp(p, i); }); for (const b of this.birds) void b; }
  drawFProp(p: FProp, i: number) {
    const im = this.treeOk(p.k); if (!im) return; const g = this.g, t = this.t, m = this.me, wind = this.wx?.wind ?? 0.3;
    const st = this.propFx[i] ??= { face: 1, turn: -9, hit: -9, puff: -9 }; const x0 = Math.round(p.x - im.width / 2), y0 = Math.round(p.y - im.height);
    const hit = t - st.hit < 0.8 ? Math.round(Math.sin((t - st.hit) * 30) * (1 - (t - st.hit) / 0.8) * 2) : 0;
    if (!p.front) this.pxEllipse(p.x, p.y - 1, im.width * 0.36, 2.5, "rgba(40,60,30,.22)", true);
    if (p.kind === "sun") { // 向日葵跟着玩家转头：玩家在哪边就朝哪边，转的时候先压扁再翻过来
      const want = m.x < p.x ? -1 : 1; if (want !== st.face && t - st.turn > 0.6) { st.face = want; st.turn = t; }
      const k = Math.min(1, (t - st.turn) / 0.35); const sx = (k < 0.5 ? -st.face * (1 - k * 2) : st.face * (k * 2 - 1)) || 0.1;
      g.save(); g.translate(p.x + hit, 0); g.scale(Math.abs(sx) < 0.15 ? 0.15 * Math.sign(sx || 1) : sx, 1); g.drawImage(im, -im.width / 2, y0); g.restore(); return; }
    if (p.kind === "cloth") { // 晾衣绳：绳子以下一截截往风里飘
      const top = Math.round(im.height * 0.28), sl = 7, sh = Math.ceil((im.height - top) / sl); g.drawImage(im, 0, 0, im.width, top, x0, y0, im.width, top);
      for (let k = 0; k < sl; k++) { const dx = Math.round(Math.sin(t * 1.9 + k * 0.35) * (0.6 + wind * 2.5) * ((k + 1) / sl)); g.drawImage(im, 0, top + k * sh, im.width, sh, x0 + dx, y0 + top + k * sh, im.width, sh); } return; }
    if (p.kind === "dand" && Math.abs(m.x - p.x) < 20 && Math.abs(m.y - p.y) < 30 && m.moving && t - st.puff > 7) this.puffDandelion(p, st);
    g.drawImage(im, x0 + hit, y0);
  }
  puffDandelion(p: FProp, st: { puff: number }) { st.puff = this.t; this.sfx("pop", 0, p.x, p.y); for (let i = 0; i < 12; i++) this.parts.push({ x: p.x + (Math.random() - 0.5) * 16, y: p.y - 20 - Math.random() * 8, vx: 8 + Math.random() * 22, vy: -8 - Math.random() * 14, life: 0, max: 2 + Math.random(), c: i % 3 ? "#ffffff" : "#f4f0e0", g: -3 }); }
  /** 小塘：竹管的水落下去一圈圈涟漪；隔一阵有小鱼跳出来（点水面也会跳） */
  drawPondFx() {
    const g = this.g, t = this.t; const k = (t * 1.6) % 1; g.globalAlpha = 1 - k; this.pxEllipse(SPOUT.x + 10, SPOUT.y + 16, 2 + k * 9, 1 + k * 3, "#e8f8ff"); g.globalAlpha = 1;
    if (!this.fishJump && t > this.nextFish) this.jumpFish();
    const f = this.fishJump; if (f) { const e = (t - f.t0) / 0.8; if (e >= 1) { this.fishJump = null; this.rings.push({ x: f.x + 22, y: PONDW.y + 4, t: 0, max: 1, c: "#e3f6f5" }); this.sfx("plop", 0, f.x, PONDW.y); }
      else { const x = Math.round(f.x + e * 22), y = Math.round(PONDW.y - Math.sin(e * Math.PI) * 18); const up = e < 0.5; g.fillStyle = "#c8502a"; g.fillRect(x - 4, y - 1, 9, 4); g.fillStyle = "#ff9a5a"; g.fillRect(x - 3, y - 1, 7, 3); g.fillStyle = "#ffd0a8"; g.fillRect(x - 2, y, 4, 1); g.fillStyle = "#2a1a1a"; g.fillRect(x + 2, y - 1, 1, 1);
        g.fillStyle = "#e86a3a"; g.fillRect(x - 6, y + (up ? 0 : -2), 2, 3); g.fillRect(x - 1, y - 2, 2, 1); // 尾巴跟着翻
        if (Math.random() < 0.4) this.parts.push({ x, y: y + 2, vx: 0, vy: 10, life: 0, max: 0.4, c: "#e3f6f5", g: 120 }); } }
  }
  jumpFish() { this.nextFish = this.t + 10 + Math.random() * 12; const x = PONDW.x - 50 + Math.random() * 70; this.fishJump = { t0: this.t, x }; this.rings.push({ x, y: PONDW.y + 4, t: 0, max: 0.9, c: "#e3f6f5" }); this.splash(x, PONDW.y + 2, 4, "#e3f6f5"); }
  /** 伞下挂三串小纸灯笼，晚上亮 */
  drawFestoon() {
    const g = this.g, t = this.t; const night = this.hour >= 18 || this.hour < 6;
    const spans = [[250, 520], [560, 980], [1020, 1290]];
    for (const [a, b] of spans) { const ya = TC.y + (CAN_BOT[a - TC.x] ?? 200) + 4, yb = TC.y + (CAN_BOT[b - TC.x] ?? 200) + 4; const n = Math.round((b - a) / 2);
      g.fillStyle = "#c9a878"; for (let i = 0; i <= n; i++) { const k = i / n; g.fillRect(Math.round(a + (b - a) * k), Math.round(ya + (yb - ya) * k + Math.sin(k * Math.PI) * 26), 1, 1); }
      for (let j = 1; j < 6; j++) { const k = j / 6; const x = Math.round(a + (b - a) * k), y = Math.round(ya + (yb - ya) * k + Math.sin(k * Math.PI) * 26) + 1; const sw = Math.round(Math.sin(t * 1.5 + j + a) * 0.6);
        const C = [["#ff8fb1", "#ffc4d8", "#b8466a"], ["#ffd98a", "#fff0c8", "#b07a2a"], ["#b99cff", "#e0d2ff", "#6a4ab0"]][j % 3];
        g.fillStyle = "#c9a878"; g.fillRect(x, y, 1, 4); // 挂绳
        g.save(); g.translate(x - 7 + sw * 2, y + 4); g.scale(2, 2); // 灯笼按 2 倍画（跟粗伞骨比例对得上）
        g.fillStyle = "#6a4a30"; g.fillRect(1, 0, 5, 1); g.fillStyle = C[2]; g.fillRect(0, 1, 7, 8); g.fillStyle = C[0]; g.fillRect(1, 1, 5, 8); g.fillStyle = C[1]; g.fillRect(2, 2, 2, 5); g.fillStyle = C[2]; g.fillRect(1, 4, 5, 1);
        g.fillStyle = "#6a4a30"; g.fillRect(1, 9, 5, 1); g.fillStyle = C[0]; g.fillRect(3, 10, 1, 2);
        if (night) { g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.35 + Math.sin(t * 2 + j) * 0.08; this.pxEllipse(3.5, 5, 9, 8, "#ffcf8a", true); g.globalAlpha = 0.6; g.fillStyle = "#fff4d0"; g.fillRect(2, 2, 3, 6); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
        g.restore(); } }
  }
  /** 农场里点一下：飞鸟 / 帆船 / 稻草人 / 向日葵 / 蒲公英 / 小塘 / 伞面的绣球。点到了返回 true */
  // ── 种菜（后端 little-world/engine/farm.js）：页面拉到 farm 就 setFarm；盆里 6 格画作物 5 阶段（public/world-farm/crops/<种子>.png 一行 5 帧）
  farm: WFarm | null = null; shakeAt = -9; animals: FarmAnimals | null = null; onAnimalTap?: (id: AnimalId) => void; animalBubs: { id: AnimalId; kind: string; x: number; y: number }[] = [];
  isNight() { const h = this.hour; return h >= 19.5 || h < 5.5; } onPotTap?: (who: string, tile: number) => void;
  private cropImg: Record<string, HTMLImageElement | null> = {};
  private cropFx: Record<string, { plant?: number; up?: number; water?: number; pick?: { t: number; seed: string } }> = {}; onGroundTap?: (i: number) => void;
  private cropOk(seed: string) { let im = this.cropImg[seed]; if (im === undefined) { im = new Image(); im.src = `/world-farm/crops/${seed.startsWith("h:") ? seed.slice(2).split("+")[0] : seed}.png`; const I = im; I.onerror = () => { this.cropImg[seed] = null; }; this.cropImg[seed] = I; } return im && im.complete && im.naturalWidth ? im : null; }
  /** 新数据进来：跟上一份比，刚种下的鼓一下土、长了一阶的冒小星星、收走的弹起来飞进篮子 */
  setFarm(f: WFarm | null) {
    const old = this.farm; this.farm = f; if (!f || !old) return; const t = this.t;
    for (const sl of f.slots) { const o = old.slots.find(q => q.who === sl.who); if (!o) continue;
      sl.tiles.forEach((tl, i) => { const a = o.tiles[i]?.crop, b = tl.crop, fx = this.cropFx[`${sl.who}:${i}`] ??= {};
        if (!a && b) { fx.plant = t; this.sfx("pop", 0); }
        else if (a && b && b.stage > a.stage) { fx.up = t; this.sfx("sprout", 0); }
        else if (a && !b && (a.ripe || a.stage >= 4)) { fx.pick = { t, seed: a.seed }; this.sfx("catch", 1); } }); } // 只有熟了被收走才飞（枯掉 / 换数据不飞）
    f.ground?.forEach((pl, i) => { const a = old.ground?.[i]?.crop, b = pl.crop, fx = this.cropFx[`g:${i}`] ??= {}; if (!old.ground) return; // 地上的菜同样
      if (!a && b) { fx.plant = t; this.sfx("pop", 0); } else if (a && b && b.stage > a.stage) { fx.up = t; this.sfx("sprout", 0); } else if (a && !b && (a.ripe || a.stage >= 4)) { fx.pick = { t, seed: a.seed }; this.sfx("catch", 1); } });
  }
  /** 伞骨上的小亮点 = 伞里存了几格雨水 */
  drawRainDots() {
    const f = this.farm; if (!f) return; const g = this.g, t = this.t; const n = f.water.max || 6;
    for (let i = 0; i < n; i++) { const x = Math.round(FCAN_X0 + 60 + (FCAN_X1 - FCAN_X0 - 120) * (i + 0.5) / n), bot = CAN_BOT[x - TC.x]; if (bot == null || bot > 900) continue; const y = TC.y + bot - 3;
      if (i < f.water.level) { const tw = 0.6 + 0.4 * Math.sin(t * 2.2 + i); g.fillStyle = `rgba(150,215,255,${0.35 * tw})`; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = "#e8f8ff"; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = "#7ec8f0"; g.fillRect(x, y, 1, 1); }
      else { g.fillStyle = "rgba(90,80,100,.35)"; g.fillRect(x - 1, y - 1, 3, 3); } }
  }
  drawCrops(who: "player" | "buddy" | "pal", x0: number, y0: number) {
    const f = this.farm, g = this.g, t = this.t; const sl = f?.slots.find(q => q.who === who); if (!sl) return; const P = FTILE[who];
    sl.tiles.forEach((tl, i) => { const p = P[i]; if (!p) return; const fx = this.cropFx[`${who}:${i}`]; const bx = x0 + p[0], by = y0 + p[1]; const c = tl.crop;
      if (c && c.wet > 0) { g.fillStyle = `rgba(55,35,25,${0.18 + 0.22 * c.wet})`; g.fillRect(bx - 7, by - 2, 14, 3); } // 浇过水：土色深一圈
      if (fx?.pick && t - fx.pick.t < 1.1) { const im = this.cropOk(fx.pick.seed); const k = (t - fx.pick.t) / 1.1; if (im) { const fw = Math.floor(im.naturalWidth / 5), fh = im.naturalHeight; const hx = bx + (BASKET_X - bx) * k * k, hy = by - fh - Math.sin(k * Math.PI) * 40 + k * 30; g.globalAlpha = 1 - k * 0.6; g.drawImage(im, 4 * fw, 0, fw, fh, this.rp(hx - fw / 2), this.rp(hy), fw, fh); g.globalAlpha = 1; } } // 收：往上一拔，弹起来飞向吊篮
      if (!c) return; const im = this.cropOk(c.seed); if (!im) return; const fw = Math.floor(im.naturalWidth / 5), fh = im.naturalHeight; const st = Math.max(0, Math.min(4, c.ripe ? 4 : c.stage));
      const pk = fx?.plant != null && t - fx.plant < 0.6 ? (t - fx.plant) / 0.6 : 1; // 刚种下：从土里鼓出来
      const dry = c.dryDays >= 1; const sway = Math.round(Math.sin(t * 1.4 + i * 1.7) * (st >= 2 ? 0.6 : 0.3));
      const h = Math.max(1, Math.round(fh * (pk < 1 ? 0.4 + 0.6 * pk + Math.sin(pk * Math.PI) * 0.25 : 1) * (dry ? 0.94 : 1)));
      if (dry) g.globalAlpha = 0.8; g.drawImage(im, st * fw, 0, fw, fh, this.rp(bx - fw / 2) + sway, this.rp(by - h), fw, h); g.globalAlpha = 1;
      if (fx?.plant != null && t - fx.plant < 0.6) { g.fillStyle = "#7a5236"; for (let s2 = 0; s2 < 5; s2++) { const k = (t - fx.plant) / 0.6; g.fillRect(this.rp(bx + (s2 - 2) * 3 * (1 + k)), this.rp(by - 2 - Math.sin(k * Math.PI) * (3 + s2 % 2 * 2)), 1, 1); } } // 土粒溅起来
      if (fx?.up != null && t - fx.up < 1.2) { const k = (t - fx.up) / 1.2; g.fillStyle = `rgba(255,240,150,${1 - k})`; for (let s2 = 0; s2 < 4; s2++) { const a = s2 * 1.57 + t * 3; g.fillRect(this.rp(bx + Math.cos(a) * (6 + k * 8)), this.rp(by - h * 0.6 + Math.sin(a) * (4 + k * 6) - k * 8), 2, 2); } } // 长了一阶
      if (c.ripe || c.stage >= 4) { if (Math.sin(t * 3 + i * 2.1) > 0.6) { g.fillStyle = "#fff6c0"; const sx = this.rp(bx + Math.sin(t * 1.3 + i) * 6), sy = this.rp(by - h - 3); g.fillRect(sx, sy - 1, 1, 3); g.fillRect(sx - 1, sy, 3, 1); } } // 熟了：顶上一闪一闪
    });
  }
  /** 菜园地上的菜：跟盆里一样画（刚种鼓一下、长一阶冒星星、熟了一闪、收走飞进篮子），浇过水土色深一圈 */
  drawGroundCrops() {
    const G = this.farm?.ground; if (!G) return; const g = this.g, t = this.t;
    G.forEach((pl, i) => { const p = GPLOT[i]; if (!p) return; const fx = this.cropFx[`g:${i}`]; const [bx, by] = p; const c = pl.crop;
      if (c && c.wet > 0) { g.fillStyle = `rgba(40,25,18,${0.2 + 0.25 * c.wet})`; g.fillRect(bx - 9, by - 2, 18, 4); }
      if (fx?.pick && t - fx.pick.t < 1.1) { const im = this.cropOk(fx.pick.seed); const k = (t - fx.pick.t) / 1.1; if (im) { const fw = Math.floor(im.naturalWidth / 5), fh = im.naturalHeight; g.globalAlpha = 1 - k; g.drawImage(im, 4 * fw, 0, fw, fh, this.rp(bx - fw / 2), this.rp(by - fh - Math.sin(k * Math.PI) * 30 - k * 20), fw, fh); g.globalAlpha = 1; } }
      if (fx?.water != null && t - fx.water < 0.9) { const k = (t - fx.water) / 0.9; for (let s2 = 0; s2 < 6; s2++) { g.fillStyle = s2 % 2 ? "#9fd8ff" : "#e8f8ff"; g.fillRect(this.rp(bx - 8 + s2 * 3), this.rp(by - 26 + k * 24 + (s2 % 3) * 2), 1, 3); } } // 手浇：一串水点落下来
      if (!c) return; const im = this.cropOk(c.seed); if (!im) return; const fw = Math.floor(im.naturalWidth / 5), fh = im.naturalHeight; const st = Math.max(0, Math.min(4, c.ripe ? 4 : c.stage));
      const pk = fx?.plant != null && t - fx.plant < 0.6 ? (t - fx.plant) / 0.6 : 1; const dry = c.dryDays >= 1; const sway = Math.round(Math.sin(t * 1.4 + i * 1.7) * (st >= 2 ? 0.6 : 0.3));
      const h = Math.max(1, Math.round(fh * (pk < 1 ? 0.4 + 0.6 * pk + Math.sin(pk * Math.PI) * 0.25 : 1) * (dry ? 0.94 : 1)));
      if (dry) g.globalAlpha = 0.8; g.drawImage(im, st * fw, 0, fw, fh, this.rp(bx - fw / 2) + sway, this.rp(by - h), fw, h); g.globalAlpha = 1;
      if (fx?.plant != null && t - fx.plant < 0.6) { g.fillStyle = "#6a4530"; for (let s2 = 0; s2 < 5; s2++) { const k = (t - fx.plant) / 0.6; g.fillRect(this.rp(bx + (s2 - 2) * 3 * (1 + k)), this.rp(by - 2 - Math.sin(k * Math.PI) * (3 + s2 % 2 * 2)), 1, 1); } }
      if (fx?.up != null && t - fx.up < 1.2) { const k = (t - fx.up) / 1.2; g.fillStyle = `rgba(255,240,150,${1 - k})`; for (let s2 = 0; s2 < 4; s2++) { const a = s2 * 1.57 + t * 3; g.fillRect(this.rp(bx + Math.cos(a) * (6 + k * 8)), this.rp(by - h * 0.6 + Math.sin(a) * (4 + k * 6) - k * 8), 2, 2); } }
      if (c.ripe || c.stage >= 4) { if (Math.sin(t * 3 + i * 2.1) > 0.6) { g.fillStyle = "#fff6c0"; const sx = this.rp(bx + Math.sin(t * 1.3 + i) * 6), sy = this.rp(by - h - 3); g.fillRect(sx, sy - 1, 1, 3); g.fillRect(sx - 1, sy, 3, 1); } }
    });
  }
  /** 点到地上哪一格（菜地里离点最近那格；后端还没 ground 时也认，交给页面说「还没开」） */
  groundHit(x: number, y: number): number | null {
    // 前排的菜会挡住后排那格 → 先按画的倒序，看点的地方是不是这棵菜真画出来的像素（同一帧、同样缩放和摇摆），都没点中再按最近的空土格
    const G = this.farm?.ground, t = this.t;
    if (G) for (let i = Math.min(G.length, GPLOT.length) - 1; i >= 0; i--) { const c = G[i]?.crop; if (!c) continue; const A = this.cropAlpha(c.seed); if (!A) continue; const fw = Math.floor(A.w / 5), fh = A.h; const [bx, by] = GPLOT[i];
      const st = Math.max(0, Math.min(4, c.ripe ? 4 : c.stage)), sway = Math.round(Math.sin(t * 1.4 + i * 1.7) * (st >= 2 ? 0.6 : 0.3)), h = Math.max(1, Math.round(fh * (c.dryDays >= 1 ? 0.94 : 1)));
      const left = this.rp(bx - fw / 2) + sway, top = this.rp(by - h);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const sx = Math.floor(x + dx - left), sy = Math.floor((y + dy - top) * fh / h); if (sx < 0 || sx >= fw || sy < 0 || sy >= fh) continue; if (A.a[sy * A.w + st * fw + sx] > 40) return i; } }
    let best = -1, bd = 1e9; GPLOT.forEach(([px, py], i) => { if (Math.abs(x - px) > 28 || y > py + 8 || y < py - 34) return; const d = Math.hypot(x - px, (y - (py - 10)) * 1.4); if (d < bd) { bd = d; best = i; } });
    return best >= 0 ? best : null;
  }
  private cropA: Record<string, { a: Uint8Array; w: number; h: number } | null> = {};
  /** 作物贴图的透明度（点菜地时认点到的是哪棵） */
  private cropAlpha(seed: string) {
    if (seed in this.cropA) return this.cropA[seed]; const im = this.cropOk(seed); if (!im) return null;
    try { const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const x = cv.getContext("2d"); if (!x) return null; x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, cv.width, cv.height).data; const a = new Uint8Array(cv.width * cv.height); for (let k = 0; k < a.length; k++) a[k] = d[k * 4 + 3]; return (this.cropA[seed] = { a, w: cv.width, h: cv.height }); }
    catch { return (this.cropA[seed] = null); }
  }
  groundWaterFx(i: number) { (this.cropFx[`g:${i}`] ??= {}).water = this.t; this.sfx("splash", 0); }
  /** 点到哪个盆的哪一格（离点的位置最近那格） */
  potHit(x: number, y: number): { who: string; tile: number } | null {
    if (!this.farm) return null;
    for (const [who, k] of [["player", "potPlayerE"], ["buddy", "potBuddyE"], ["pal", "potPalE"]] as const) { const im = this.treeOk(k); if (!im) continue; const px0 = FPOT[who] - im.width / 2, py1 = fWalkY(FPOT[who]) + 8, py0 = py1 - im.height;
      if (x < px0 || x > px0 + im.width || y < py0 + 20 || y > py1) continue; let best = 0, bd = 1e9; FTILE[who].forEach((p, i) => { const d = Math.hypot(px0 + p[0] - x, py0 + p[1] - 10 - y); if (d < bd) { bd = d; best = i; } }); return { who, tile: best }; }
    return null;
  }
  /** 竹管转向谁的盆：一道水柱从伞顶弧线冲进那盆，土面一圈涟漪（「咔——」） */
  stream: { t0: number; sx: number; sy: number; tx: number; ty: number } | null = null;
  /** 竹管水柱：一道 3 像素宽的弧，从头往盆里伸过去，停 0.6 秒再从尾巴收掉 */
  drawStream() {
    const S = this.stream; if (!S) return; const e = this.t - S.t0; if (e > 1.3) { this.stream = null; return; } const g = this.g;
    const head = Math.min(1, e / 0.35), tail = Math.max(0, (e - 0.95) / 0.35); const N = 28;
    for (let i = 0; i <= N; i++) { const k = i / N; if (k > head || k < tail) continue; const x = S.sx + (S.tx - S.sx) * k, y = S.sy + (S.ty - S.sy) * k - Math.sin(k * Math.PI) * 16 + Math.sin(this.t * 30 + i) * 0.4;
      g.fillStyle = "#5fb4e6"; g.fillRect(this.rp(x) - 2, this.rp(y) - 1, 4, 4); g.fillStyle = "#e8f8ff"; g.fillRect(this.rp(x), this.rp(y) - 1, 1, 1); }
    if (head >= 1 && tail < 1) for (let i = 0; i < 3; i++) { g.fillStyle = "#cfefff"; g.fillRect(this.rp(S.tx + (Math.random() - 0.5) * 10), this.rp(S.ty - Math.random() * 6), 1, 1); } // 落点溅起来
  }
  farmSpoutFx(who: string) {
    const k = who === "buddy" ? "potBuddyE" : who === "pal" ? "potPalE" : "potPlayerE"; const im = this.treeOk(k); if (!im) return; const fx = FPOT[who as "player"] ?? FPOT.player;
    const tx = fx, ty = fWalkY(fx) + 8 - im.height + 64, sx = fx - 64, sy = ty - 34; this.stream = { t0: this.t, sx, sy, tx, ty }; this.sfx("clack", 0); window.setTimeout(() => this.sfx("splash", 0), 250);
    for (let i = 0; i < 40; i++) { const d = i * 0.02; this.parts.push({ x: sx, y: sy, vx: (tx - sx) / 0.5 + (Math.random() - 0.5) * 6, vy: (ty - sy) / 0.5 - 60, life: -d, max: 0.5 + d, c: i % 3 ? "#9fd8ff" : "#e8f8ff", g: 240 }); }
    for (let i = 0; i < 6; i++) this.rings.push({ x: tx - 30 + Math.random() * 60, y: ty + Math.random() * 8, t: -0.45 - i * 0.08, max: 0.6, c: "#cfefff" });
  }
  /** 摇伞：整把伞一抖，水珠从伞沿滚下来落到各个盆；没水只掉几片叶子 */
  farmShake(empty = false) {
    this.shakeAt = this.t; this.sfx(empty ? "rustle" : "splash", 0);
    // 站在伞顶上看不见伞沿，所以水珠直接从每个盆上方落下来、在土面溅开（没水就落几片叶子）
    for (const who of ["player", "buddy", "pal"] as const) { const im = this.treeOk(who === "player" ? "potPlayerE" : who === "buddy" ? "potBuddyE" : "potPalE"); if (!im) continue; const x0 = FPOT[who] - im.width / 2, y1 = fWalkY(FPOT[who]) + 8, top = y1 - im.height;
      for (let i = 0; i < (empty ? 3 : 16); i++) { const x = x0 + 14 + Math.random() * (im.width - 28), d = Math.random() * 0.35;
        this.parts.push(empty ? { x, y: top - 10 - Math.random() * 20, vx: (Math.random() - 0.5) * 16, vy: 6, life: -d, max: 1.6 + d, c: ["#9ac46a", "#c8b060", "#e8a0b8"][i % 3], g: 25 }
          : { x, y: top + 20 - 30 - Math.random() * 25, vx: (Math.random() - 0.5) * 4, vy: 10, life: -d, max: 0.55 + d, c: i % 3 ? "#9fd8ff" : "#e8f8ff", g: 260 }); }
      if (!empty) for (let i = 0; i < 8; i++) this.rings.push({ x: x0 + 20 + Math.random() * (im.width - 40), y: top + 62 + Math.random() * 10, t: -0.25 - Math.random() * 0.3, max: 0.5, c: "#cfefff" }); }
    for (let i = 0; i < (empty ? 10 : 46); i++) { const x = FCAN_X0 + 40 + Math.random() * (FCAN_X1 - FCAN_X0 - 80), bot = CAN_BOT[Math.round(x - TC.x)]; if (bot == null || bot > 900) continue;
      this.parts.push(empty ? { x, y: TC.y + bot - 30, vx: (Math.random() - 0.5) * 20, vy: 10, life: 0, max: 1.8, c: ["#9ac46a", "#c8b060", "#e8a0b8"][i % 3], g: 30 } : { x, y: TC.y + bot - 6, vx: (Math.random() - 0.5) * 8, vy: -10 - Math.random() * 20, life: 0, max: 1.1, c: i % 3 ? "#9fd8ff" : "#e8f8ff", g: 160 }); }
  }
  farmTap(x: number, y: number) {
    const t = this.t;
    const pt = this.potHit(x, y); if (pt) { this.onPotTap?.(pt.who, pt.tile); return true; }
    const gp = this.groundHit(x, y); if (gp != null && this.onGroundTap) { this.onGroundTap(gp); const m = this.me; if (m.y >= FG.y0 - 1 && !m.ride) { const tx = Math.max(FG.x0, Math.min(FG.x1, GPLOT[gp][0] + (m.x < GPLOT[gp][0] ? -18 : 18))); if (Math.abs(m.x - tx) > 24) { m.rest = null; m.path = [{ x: tx, y: m.y }]; } } return true; } // 点菜地：在地上就走过去
    const an = this.animals?.hit(x, y, t); if (an) { this.sfx("pop", 0, x, y); this.onAnimalTap?.(an); return true; } // 点小动物 → 弹大图卡片
    if (this.birds.some(b => Math.hypot(b.x - x, b.y - y) < 26)) { for (const b of this.birds) { b.vy = -30 - Math.random() * 50; b.vx *= 1.8 + Math.random(); } this.sfx("flip", 0, x, y); return true; }
    const bx = this.boatX(); if (Math.abs(x - bx) < 38 && y > 548 && y < 630) { this.boatHop = t; this.sfx("arrive", 0, x, y); for (let i = 0; i < 3; i++) this.parts.push({ x: bx + 4, y: 560, vx: 6 + i * 4, vy: -14, life: 0, max: 1.2, c: "#ff8fb1", g: -2 }); return true; }
    for (let i = FPROPS.length - 1; i >= 0; i--) { const p = FPROPS[i], im = this.treeOk(p.k); if (!im || Math.abs(x - p.x) > im.width / 2 || y > p.y || y < p.y - im.height) continue; const st = this.propFx[i] ??= { face: 1, turn: -9, hit: -9, puff: -9 };
      if (p.kind === "dand") { this.puffDandelion(p, st); return true; }
      st.hit = t; this.sfx(p.kind === "crow" ? "boing" : "rustle", 0, x, y);
      const cs = p.kind === "crow" ? ["#e0c070", "#c9a050"] : p.kind === "sun" ? ["#ffd84a", "#f0b830"] : ["#ffc4dc", "#c9b3ff", "#fff"]; for (let k = 0; k < 8; k++) this.parts.push({ x: p.x + (Math.random() - 0.5) * im.width * 0.6, y: p.y - im.height * 0.6, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, life: 0, max: 0.9, c: cs[k % cs.length], g: 60 }); return true; }
    if (Math.hypot((x - PONDW.x) / PONDW.rx, (y - PONDW.y) / PONDW.ry) < 1) { if (!this.fishJump) this.jumpFish(); this.rings.push({ x, y, t: 0, max: 1, c: "#e3f6f5" }); this.sfx("bubble", 0, x, y); return true; }
    const top = CAN_TOP[Math.round(x - TC.x)], bot = CAN_BOT[Math.round(x - TC.x)]; if (top != null && bot != null && top < 900 && y > TC.y + top - 16 && y < TC.y + bot) { this.sfx("pop", 0, x, y); for (let k = 0; k < 12; k++) this.parts.push({ x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 50, vy: -30 - Math.random() * 30, life: 0, max: 1, c: ["#ff9ec4", "#9fb8ff", "#c9a8ff", "#ffd3e6"][k % 4], g: 80 }); return true; }
    return false;
  }
  /** 每帧：飞鸟 / 蝴蝶动起来；在伞面上走会踩起花瓣 */
  farmStep(dt: number) {
    const m = this.me, t = this.t;
    this.animals?.step(dt, t, m, this.isNight(), /雨/.test(this.weather), (n, x, y) => this.sfx(n, 0, x, y));
    for (const b of this.birds) { b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(t * 2 + b.p) * 0.1; b.vy *= 0.98; } this.birds = this.birds.filter(b => b.x < this.cam.x + this.vw + 40 && b.y > this.cam.y - 60);
    for (const f of this.bflies) { const d = Math.hypot(f.x - m.x, f.y - (m.y - 20)); if (d < 30 && f.flee <= 0) { f.flee = 2.5; this.sfx("flip", 0, f.x, f.y); } f.flee -= dt;
      const tx = f.flee > 0 ? f.x + (f.x > m.x ? 40 : -40) : f.hx + Math.sin(t * 0.7 + f.p) * 26, ty = f.flee > 0 ? f.hy - 60 : f.hy + Math.sin(t * 1.3 + f.p * 2) * 10; const sp = f.flee > 0 ? 2.4 : 0.9;
      f.x += (tx - f.x) * dt * sp; f.y += (ty - f.y) * dt * sp + Math.sin(t * 9 + f.p) * 0.3; }
    if (m.moving && Math.abs(m.y - fWalkY(m.x) - 2) <= 8) { this.stepPetal -= dt; if (this.stepPetal <= 0) { this.stepPetal = 0.12; this.parts.push({ x: m.x + (Math.random() - 0.5) * 10, y: m.y - 2, vx: (Math.random() - 0.5) * 20, vy: -14 - Math.random() * 10, life: 0, max: 0.8, c: ["#ff9ec4", "#9fb8ff", "#c9a8ff", "#ffd3e6"][(Math.random() * 4) | 0], g: 50 }); if (Math.random() < 0.15) this.sfx("rustle", 0, m.x, m.y); } }
  }
  /** 吊篮：图是能看见篮里的角度，所以拆两层——后层（绳子 + 篮子后半圈 + 篮内）在人后面，前层（篮子前沿往下）在人前面，人站在篮里、腰以上露出来 */
  drawBasket(layer: "back" | "front") {
    const g = this.g, m = this.me; const bk = this.treeOk("basket"); if (!bk) return; const riding = !!m.ride; if (layer === "front" && !riding) return;
    const h = bk.height, lip = Math.round(h * 0.845); // 篮子前沿那一行
    const by = riding ? m.y + 15 : this.basketY, bx = this.rp(riding ? m.x : BASKET_X), x0 = bx - Math.round(bk.width / 2), y0 = this.rp(by - h);
    if (layer === "back") { const top = TC.y + (CAN_BOT[BASKET_X - TC.x] ?? 200) - 6; if (y0 > top) { g.fillStyle = "#7a5a38"; g.fillRect(bx - 1, top, 2, y0 - top + 2); g.fillStyle = "#a07a4c"; g.fillRect(bx - 1, top, 1, y0 - top + 2); }
      if (riding) g.drawImage(bk, 0, 0, bk.width, lip, x0, y0, bk.width, lip); else g.drawImage(bk, x0, y0); }
    else g.drawImage(bk, 0, lip - 1, bk.width, h - lip + 1, x0, y0 + lip - 1, bk.width, h - lip + 1);
  }
  /** 站在伞顶或门廊这种「一条线」的台子上 */
  farmOnLine(x: number, y: number) { return (x >= FCAN_X0 - 2 && x <= FCAN_X1 + 2 && Math.abs(y - fWalkY(x) - 2) <= 12) || (Math.abs(y - PORCH.y) <= 5 && x >= PORCH.x0 - 4 && x <= STAIR.x0 + 4); }
  farmWalk(x: number, y: number) {
    if (x >= FG.x0 && x <= FG.x1 && y >= FG.y0 && y <= FG.y1) return true;
    if (x >= FCAN_X0 && x <= FCAN_X1) { const w = fWalkY(x); if (y >= w - 6 && y <= w + 12) return true; }
    if (y >= PORCH.y - 5 && y <= PORCH.y + 3 && x >= PORCH.x0 && x <= PORCH.x1) return true;
    if (x >= STAIR.x0 - 2 && x <= STAIR.x1 + 2 && Math.abs(y - fStairY(x)) < 7) return true;
    if (Math.abs(x - LADDER_X) < 9 && y >= fWalkY(LADDER_X) - 4 && y <= FG.y1) return true;
    return false;
  }
  /** 横着走时顺着伞面弧线 / 楼梯斜线上下（不然一推摇杆就走出台子） */
  farmSlope(x0: number, x1: number, y: number) {
    if (x0 >= FCAN_X0 && x0 <= FCAN_X1 && Math.abs(y - fWalkY(x0) - 2) <= 12) return fWalkY(x1) - fWalkY(x0);
    if (x0 >= STAIR.x0 && x0 <= STAIR.x1 && Math.abs(y - fStairY(x0)) < 7) return fStairY(Math.max(STAIR.x0, Math.min(STAIR.x1, x1))) - fStairY(x0);
    return 0;
  }
  /** 吊篮：站在篮子那儿往上推 = 坐上去慢慢晃上伞面；在伞面那头往下推 = 下去。一个人拉 2.2 秒 */
  farmRide(jy: number) {
    const m = this.me;
    if (m.ride) { const k = Math.min(1, (this.t - m.ride.t0) / m.ride.dur); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; m.y = m.ride.from + (m.ride.to - m.ride.from) * e; m.x = BASKET_X + Math.sin(this.t * 3.1) * 1.5 * Math.sin(k * Math.PI); m.moving = 0;
      if (k >= 1) { const up = m.ride.to < m.ride.from; this.basketY = up ? fWalkY(BASKET_X) + 4 : FG.y0 + 4; m.x = BASKET_X + 60; if (up) m.y = fWalkY(m.x) + 2; m.dir = 2; m.ride = null; if (up && this.potAfterRide) { this.potAfterRide = false; const px = FPOT.player + 26, n = Math.max(1, Math.ceil(Math.abs(px - m.x) / 18)); m.path = Array.from({ length: n }, (_, i) => { const x = m.x + (px - m.x) * (i + 1) / n; return { x, y: fWalkY(x) + 2, fast: true }; }); m.path[m.path.length - 1].go = "pot"; } /* 到了往旁边迈一步出篮 */ this.sfx("clasp"); for (let i = 0; i < 6; i++) this.parts.push({ x: m.x + (Math.random() - 0.5) * 20, y: m.y - 2, vx: (Math.random() - 0.5) * 20, vy: -10, life: 0, max: 0.5, c: i % 2 ? "#ffc4dc" : "#c9b3ff", g: 30 }); }
      return true; }
    void jy; return false;
  }
  /** 吊篮不提示就送上去、上去下不来；楼梯卡脚 → 吊篮 / 楼梯 / 梯子都改成站到跟前冒大按钮，点了自己走完 */
  farmAct(): FarmAct | null {
    if (this.scene === "cabin") { const m = this.me; if (m.path) return null; const fl = this.thFloor(m.x, m.y);
      const Z = TH_STAIR_AT; if (fl === 1 && m.x > Z.up[0] && m.x < Z.up[1]) return "stairUp"; if (fl === 1 && m.x >= Z.down[0] && m.x < Z.down[1]) return "stairDown";
      if (fl === 0 && Math.abs(m.x - Z.atticDown) < 12) return "stairDown"; if (fl === 2 && Math.abs(m.x - Z.groundUp) < 18) return "stairUp"; return null; }
    if (this.scene !== "farm") return null; const m = this.me; if (m.ride || m.path) return null;
    const onGround = m.y >= FG.y0 - 1, onTop = m.x >= FCAN_X0 && m.x <= FCAN_X1 && Math.abs(m.y - fWalkY(m.x) - 2) <= 12, onPorch = Math.abs(m.y - PORCH.y) <= 6 && m.x >= PORCH.x0 - 4 && m.x <= STAIR.x0 + 8;
    if (onPorch && Math.abs(m.x - HOUSE_DOOR_X) < 16 && PixelWorld.cabinReady) return "door";
    if (onPorch && m.x >= HOUSE_DOOR_X + 16) return "stairDown";
    if (onGround && m.x > STAIR.x1 - 24 && m.x < STAIR.x1 + 36) return "stairUp";
    if (onGround && Math.abs(m.x - BASKET_X) < 32) return "rideUp";
    if (onTop && Math.abs(m.x - BASKET_X) < 72) return "rideDown";
    if (onGround && Math.abs(m.x - LADDER_X) < 28) return "ladderUp";
    if (onTop && Math.abs(m.x - LADDER_X) < 44) return "ladderDown";
    if (onTop && this.farm && Math.abs(m.x - FPOT.player) < 80) return "shake"; // 站在自己的盆跟前：摇伞浇水
    return null;
  }
  onFarmShake?: () => void;
  onPotArrive: (() => void) | null = null; potAfterRide = false;
  /** 玩家找不到在哪种菜 → 「种菜」按钮：自己走到玩家的盆跟前（地上先爬梯子、门廊先下楼），到了叫 onPotArrive 开种子袋 */
  goToPot(): boolean {
    if (this.scene !== "farm") return false; const m = this.me; if (m.ride || m.path) return false; m.rest = null;
    const gy = FG.y0 + 12, px = FPOT.player + 26; // 站盆右边一点（站正中会挡住盆里的格子）
    const along = (x0: number, x1: number) => { const out: { x: number; y: number }[] = []; const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 18)); for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; out.push({ x, y: fWalkY(x) + 2 }); } return out; };
    const onTop = m.x >= FCAN_X0 && m.x <= FCAN_X1 && Math.abs(m.y - fWalkY(m.x) - 2) <= 12, onPorch = Math.abs(m.y - PORCH.y) <= 6 && m.x >= PORCH.x0 - 4 && m.x <= Math.max(PORCH.x1, STAIR.x0 + 8) + 2; /* 门廊能走到 x1=572，这里原来只认到 566 */
    let P: { x: number; y: number; climb?: boolean; go?: string; fast?: boolean }[] = [];
    if (onTop) P = along(m.x, px);
    else { // 楼梯 / 梯子中途也能站（摇杆走得上去）→ 先顺着走到底，不然会斜着穿出去走在空中
      const onStair = !onPorch && m.x >= STAIR.x0 - 2 && m.x <= STAIR.x1 + 2 && Math.abs(m.y - fStairY(m.x)) < 7, onLadder = Math.abs(m.x - LADDER_X) < 9 && m.y < FG.y0 - 1;
      if (!onPorch && !onStair && !onLadder && m.y < FG.y0 - 1) return false; // 兜底：认不出站在哪（不在地上 / 伞面 / 门廊 / 楼梯 / 梯子）就不带路，免得斜着穿到空中
      if (onPorch) P.push({ x: STAIR.x0, y: STAIR.y0 }, { x: STAIR.x1, y: STAIR.y1 }, { x: STAIR.x1 + 18, y: gy });
      else if (onStair) P.push({ x: STAIR.x1, y: STAIR.y1 }, { x: STAIR.x1 + 18, y: gy });
      else if (onLadder) { P.push({ x: LADDER_X, y: fWalkY(LADDER_X) + 2, climb: true }, ...along(LADDER_X, px)); P.forEach(q => { q.fast = true; }); P[P.length - 1].go = "pot"; this.potAfterRide = false; m.path = P; this.sfx("creak"); return true; } // 梯子半中间：往上爬近，上去沿伞面走到盆
      // 坐吊篮上去（离盆近，梯子在最右头要走一大截伞面）：走到篮子跟前，到了 go="ride" → 坐上去，上去以后接着走到盆
      P.push({ x: BASKET_X, y: gy }); }
    if (!P.length) { this.onPotArrive?.(); return true; }
    P.forEach(q => { q.fast = true; }); P[P.length - 1].go = onTop ? "pot" : "ride"; this.potAfterRide = !onTop; m.path = P; this.sfx("step"); return true;
  }
  farmDo(a: FarmAct) {
    const m = this.me; m.rest = null; const gy = FG.y0 + 12;
    if (a === "shake") { this.onFarmShake?.(); return; }
    if (this.scene === "cabin") { const fl = this.thFloor(m.x, m.y); const U = TH_STAIR.up, D = TH_STAIR.down;
      const P = fl === 1 ? (a === "stairUp" ? U : D) : fl === 0 ? [...U].reverse().concat([{ x: U[0].x - 8, y: TH_FLOOR[1].y }]) : [...D].reverse().concat([{ x: D[0].x + 6, y: TH_FLOOR[1].y }]);
      // 走楼梯一卡一卡——台阶一级一级的方向忽左忽右忽上，人每一级都在侧身 / 正面 / 背面之间换。整段楼梯固定一个朝向：上楼背过去、下楼朝前
      const face: Dir = P[P.length - 1].y < P[0].y ? 3 : 0; m.path = P.map((q, i) => ({ ...q, face: i < P.length - 1 ? face : undefined })); m.x = P[0].x; this.sfx("creak"); return; }
    if (a === "rideUp") { m.ride = { t0: this.t, from: m.y, to: fWalkY(BASKET_X) + 2, dur: 2.2 }; m.dir = 0; this.sfx("creak"); return; }
    if (a === "rideDown") { this.basketY = fWalkY(BASKET_X) + 4; m.ride = { t0: this.t, from: fWalkY(BASKET_X) + 2, to: gy, dur: 1.8 }; m.dir = 0; this.sfx("creak"); return; }
    const P = ({ stairUp: [{ x: STAIR.x1, y: STAIR.y1 }, { x: STAIR.x0, y: STAIR.y0 }, { x: HOUSE_DOOR_X + 12, y: PORCH.y }],
      stairDown: [{ x: STAIR.x0, y: STAIR.y0 }, { x: STAIR.x1, y: STAIR.y1 }, { x: STAIR.x1 + 18, y: gy }],
      ladderUp: [{ x: LADDER_X, y: gy }, { x: LADDER_X, y: fWalkY(LADDER_X) + 2, climb: true }, { x: LADDER_X - 30, y: fWalkY(LADDER_X - 30) + 2 }],
      ladderDown: [{ x: LADDER_X, y: fWalkY(LADDER_X) + 2 }, { x: LADDER_X, y: gy, climb: true }, { x: LADDER_X + 16, y: gy }] } as Record<string, { x: number; y: number; climb?: boolean }[]>)[a];
    if (P) { m.path = P.map(q => ({ ...q })); this.sfx("creak"); }
  }
  /** 按路线一步步走（楼梯 / 梯子）：走的时候摇杆不管用，走完停在台子上 */
  farmPath(dt: number) {
    const m = this.me; const P = m.path; if (!P) return false; const q = P[0];
    const dx = q.x - m.x, dy = q.y - m.y, d = Math.hypot(dx, dy); const sp = (q.climb ? 44 : 60) * (q.fast ? 1.8 : 1) * dt; // 「种菜」带路走快一点，别让玩家干等
    if (d <= sp) { m.x = q.x; m.y = q.y; P.shift(); if (!P.length && q.go === "ride") { m.path = null; this.farmDo("rideUp"); return true; }
      if (!P.length && q.go === "pot") { m.path = null; m.moving = 0; m.dir = 1; this.onPotArrive?.(); return true; }
      if (!P.length && q.go) { m.path = null; m.moving = 0; const S = TH_SPOTS.find(s => s.id === q.go); if (S) m.dir = S.x < m.x ? 1 : 2; this.onCabinArrive?.(q.go); return true; }
      if (!P.length) { m.path = null; m.moving = 0; this.sfx("clasp"); for (let i = 0; i < 5; i++) this.parts.push({ x: m.x + (Math.random() - 0.5) * 16, y: m.y - 2, vx: (Math.random() - 0.5) * 18, vy: -10, life: 0, max: 0.5, c: i % 2 ? "#ffc4dc" : "#c9b3ff", g: 30 }); } return true; }
    m.x += (dx / d) * sp; m.y += (dy / d) * sp; m.dir = q.face != null ? q.face : q.climb ? (dy < 0 ? 3 : 0) : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); m.moving = 1;
    m.walkT += sp / 11; if (Math.floor(m.walkT / 2) !== this.stepN) { this.stepN = Math.floor(m.walkT / 2); this.sfx(q.climb ? "creak" : "step", 2, m.x, m.y); }
    return true;
  }
  /** 夜里农场的灯：伞下三串纸灯笼、树屋窗户和门口挂灯（加亮叠在天色上） */
  farmLights(cx: number, cy: number, night: number) {
    const t = this.t;
    // 菜园 / 院子图里画着的灯笼，夜里亮起来；一闪的尾灯（夜色是正片叠底压上去的，光要在这之后再加）
    for (const [x, y] of XLAMPS) if (x > cx - 60 && x < cx + this.vw + 60) { const fl = 0.85 + Math.sin(t * 2.3 + x) * 0.1; this.glow(x - cx, y - cy, 30, `rgba(255,196,120,${0.45 * night * fl})`); this.glow(x - cx, y - cy, 7, `rgba(255,236,190,${0.75 * night})`); }
    const ff = this.animals?.list.find(a => a.id === "firefly"); if (ff && this.isNight()) { const p = 0.6 + Math.sin(t * 2.4) * 0.35; this.glow(ff.x - cx, ff.y - cy, 16, `rgba(255,226,120,${0.55 * night * p})`); this.glow(ff.x - cx, ff.y - cy, 3, `rgba(255,250,210,${0.95 * night})`); } const spans = [[250, 520], [560, 980], [1020, 1290]];
    for (const [a, b] of spans) { const ya = TC.y + (CAN_BOT[a - TC.x] ?? 200) + 4, yb = TC.y + (CAN_BOT[b - TC.x] ?? 200) + 4;
      for (let j = 1; j < 6; j++) { const k = j / 6; const x = a + (b - a) * k, y = ya + (yb - ya) * k + Math.sin(k * Math.PI) * 26 + 16; const fl = 0.85 + Math.sin(t * 2 + j + a) * 0.1;
        this.glow(x - cx, y - cy, 34, `rgba(255,190,120,${0.5 * night * fl})`); this.glow(x - cx, y - cy, 10, `rgba(255,236,196,${0.7 * night * fl})`); } }
    for (const [x, y, r] of [[469, 701, 26], [538, 701, 24], [421, 698, 30]] as const) { this.glow(x - cx, y - cy, r, `rgba(255,196,120,${0.62 * night})`); this.glow(x - cx, y - cy, r * 0.35, `rgba(255,240,200,${0.7 * night})`); }
    this.glow(HOUSE_DOOR_X - cx, PORCH.y - 10 - cy, 90, `rgba(255,180,110,${0.18 * night})`);
  }
  /** 农场的建筑按脚底排前后画（shadow + 图） */
  drawFarmB(k: string, x: number, y: number) { const im = this.farmImg[k]; if (!im?.complete || !im.naturalWidth) return; this.pxEllipse(x, y - 1, im.width * 0.42, 4, "rgba(50,60,20,.28)", true); this.g.drawImage(im, this.rp(x - im.width / 2), this.rp(y - im.height + 2)); }
  static cabinReady = false; cabinExt?: HTMLImageElement;
  /** 池塘里站在小屋门口 */
  nearCabinDoor() { return this.farmAct() === "door"; }
  drawCabinExt() { const im = this.cabinExt; if (!im?.complete || !im.naturalWidth) return; this.pxEllipse(CABIN_POS.x, CABIN_POS.y - 2, 62, 6, "rgba(50,60,20,.28)", true); this.g.drawImage(im, this.rp(CABIN_POS.x - im.width / 2), this.rp(CABIN_POS.y - im.height + 2)); }
  /** 站在树洞小屋第几层的线上（不在线上 -1） */
  thFloor(x: number, y: number) { for (let i = 0; i < 3; i++) { const F = TH_FLOOR[i]; if (Math.abs(y - F.y) <= 3 && x >= F.x0 && x <= F.x1) return i; } return -1; }
  /** 玩家站在哪样东西跟前（没有就 null）：同一层、离得最近的那样 */
  /** 跟前能用的全部（近的在前）：好几样挤在一起时，大按钮上面列出来让玩家挑 */
  nearCabinAll(): string[] {
    if (this.scene !== "cabin") return []; const m = this.me; if (m.path) return []; const fl = this.thFloor(m.x, m.y); if (fl < 0) return [];
    return TH_SPOTS.filter(c => c.f === fl && Math.abs(m.x - c.x) < c.r + 8).sort((a, b) => Math.abs(m.x - a.x) - Math.abs(m.x - b.x)).map(c => c.id);
  }
  nearCabin(): CabinSpot | null {
    if (this.scene !== "cabin") return null; const m = this.me; if (m.path) return null; const fl = this.thFloor(m.x, m.y); if (fl < 0) return null; let best: string | null = null, bd = 1e9;
    for (const c of TH_SPOTS) { if (c.f !== fl) continue; const d = Math.abs(m.x - c.x); if (d < c.r && d < bd) { bd = d; best = c.id; } } return best;
  }
  /** 鱼缸里的鱼（小屋页给 species 列表）：各游各的，碰到缸壁掉头；偶尔吐个泡 */
  tank: { sp: string; x: number; y: number; v: number; p: number }[] = [];
  setTank(list: string[]) {
    const keep = this.tank.filter(f => list.includes(f.sp)); const r = rng(list.length * 7 + 3);
    this.tank = list.map((sp, i) => keep.find(f => f.sp === sp && !(f as { used?: boolean }).used && ((f as { used?: boolean }).used = true)) ?? { sp, x: TANK_WATER.x0 + 12 + r() * (TANK_WATER.x1 - TANK_WATER.x0 - 24), y: TANK_WATER.y0 + 8 + ((i * 13) % (TANK_WATER.y1 - TANK_WATER.y0 - 14)), v: (r() < 0.5 ? -1 : 1) * (6 + r() * 8), p: r() * 6.28 });
    for (const f of this.tank) delete (f as { used?: boolean }).used;
  }
  tankT = -1;
  drawTank() {
    const g = this.g, T = TANK_WATER; const dt = this.tankT < 0 ? 0 : Math.min(0.1, this.t - this.tankT); this.tankT = this.t;
    for (const f of this.tank) {
      const art = this.fishCanvas(f.sp); const w = art ? Math.round(art.width * 0.8) : 12, h = art ? Math.round(art.height * 0.8) : 6;
      f.x += f.v * dt; if (f.x < T.x0 + w / 2 + 2 && f.v < 0) f.v = -f.v; if (f.x > T.x1 - w / 2 - 2 && f.v > 0) f.v = -f.v; if (Math.random() < dt * 0.05) f.v = -f.v;
      const y = f.y + Math.sin(this.t * 0.9 + f.p) * 3; const x0 = Math.round(f.x - w / 2), y0 = Math.round(y - h / 2);
      if (art) { if (f.v > 0) { g.save(); g.translate(x0 + w, 0); g.scale(-1, 1); g.drawImage(art, 0, y0, w, h); g.restore(); } else g.drawImage(art, x0, y0, w, h); } // 鱼图都是头朝左画的
      else this.drawFish(f.x, y0, "#f08a5d");
      if (Math.random() < dt * 0.25) this.parts.push({ x: f.x + (f.v < 0 ? -w / 2 : w / 2), y: y - 2, vx: 0, vy: -10, life: 0, max: 1.4, c: "rgba(255,255,255,.9)", g: 0 });
    }
    // 泡泡别冒出水面
    this.parts = this.parts.filter(q => !(q.x > T.x0 && q.x < T.x1 && q.y < T.y0 - 4 && q.y > T.y0 - 40 && q.g === 0 && q.vy === -10));
  }
  bakeSea() {
    const W = MAP_W, H = MAP_H; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
    const img = g.createImageData(W, H); const d = img.data; this.water = new Uint8Array(W * H);
    const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const SEA = ["#8fe3dc", "#63cfd6", "#43b6cf", "#3599c0", "#2d80ae", "#276fa0"].map(hx), SAND = ["#f1dfb0", "#ead3a0", "#f6e7c2"].map(hx), WET = ["#d2b884", "#c9ad78"].map(hx);
    const DUNE = ["#e6d3a2", "#dcc894", "#b9c07a", "#a6b36a"].map(hx), PATH = ["#d9c290", "#cfb682"].map(hx);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sh = seaShore(x); const n = hash2(x, y); const n2 = hash2(x >> 3, y >> 3); let c: number[];
      if (y > sh) { this.water[y * W + x] = 1; const depth = Math.max(0, Math.min(5, Math.floor((y - sh) / 42 + 0.45 * Math.sin(x / 53 + y / 37) + 0.25 * Math.sin(x / 19 - y / 23) + (n - 0.5) * 0.25))); c = SEA[depth]; if (y - sh < 3) c = hx("#e9fbf8"); else if (n > 0.985) c = SEA[0]; }
      else if (y > sh - 12) c = WET[n > 0.8 ? 1 : 0];
      else if (y > sh - 90) c = SAND[n < 0.1 ? 1 : n > 0.92 ? 2 : 0];
      else { const f = Math.sin(x / 47) * 0.45 + Math.sin(y / 29 + x / 83) * 0.45 + Math.sin(x / 17 + y / 31) * 0.2 + (n - 0.5) * 0.25; c = DUNE[f > 0.62 ? 3 : f > 0.3 ? 2 : f > 0 ? 1 : 0]; void n2; }
      if (y < sh - 30 && Math.abs(x - (384 + Math.sin(y * 0.05) * 8)) < 13) c = PATH[n > 0.85 ? 1 : 0];
      const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const r = rng(41); const px = (x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };
    // 贝壳（粉 / 白 / 杏）、小海星、沙滩上的小坑
    for (let i = 0; i < 90; i++) { const x = r() * W, sh = seaShore(x), y = sh - 8 - r() * 80; const k = r(); if (k < 0.45) { const c = ["#f7c6d4", "#fff6ec", "#f3d2a8"][(r() * 3) | 0]; px(x, y, c, 3, 2); px(x + 1, y - 1, c); px(x, y + 2, "#c9a27a", 3, 1); } else if (k < 0.6) { px(x, y, "#f08a6a"); px(x - 1, y + 1, "#f08a6a", 3, 1); px(x, y + 2, "#f08a6a"); px(x - 1, y + 3, "#f08a6a"); px(x + 1, y + 3, "#f08a6a"); } else px(x, y, "#d6bf8c", 2, 1); }
    // 沙丘上的草簇
    for (let i = 0; i < 260; i++) { const x = r() * W, y = r() * (seaShore(x) - 100); if (Math.abs(x - 384) < 22) continue; px(x, y, "#8a9a4a"); px(x + 2, y - 1, "#8a9a4a"); px(x + 1, y - 2, "#b8c46a"); }
    this.ground = cv;
    const add = (kind: Prop["kind"], x: number, y: number, rr = 0, flat = false) => this.props.push({ kind, x, y, r: rr, flat, flip: hash2(x | 0, y | 0) > 0.5 });
    const rt = rng(77);
    for (let i = 0; i < 14; i++) { const x = 30 + rt() * (W - 60); if (Math.abs(x - 384) < 50) continue; const y = seaShore(x) - 14 - rt() * 60; add(rt() < 0.6 ? "rock" : "pebbles", x, y, rt() < 0.6 ? 7 : 0, false); }
    for (let i = 0; i < 26; i++) { const x = 20 + rt() * (W - 40); const y = 30 + rt() * (seaShore(x) - 130); if (Math.abs(x - 384) < 30) continue; add(rt() < 0.7 ? "grass" : "bush", x, y, rt() < 0.3 ? 9 : 0, false); }
    this.signPos = { x: 424, y: 96 }; add("sign", this.signPos.x, this.signPos.y, 6);
  }
  // ─── 夜河 ───
  /** 石拱桥左右两头（桥面横着铺过河，两头搭在步道上） */
  rBridge = { xl: 0, xr: 0 };
  /** 桥栏杆四个角上的小石灯 */
  rStoneLamps: { x: number; y: number }[] = [];
  /** 顺水漂的莲花河灯：y 往下漂，u = 在河里偏左偏右（-1～1），near = 漂过玩家身边响过一声了 */
  rlamps: { y: number; u: number; p: number; near: boolean; scoop?: number; sx?: number; sy?: number; born?: number }[] = []; rlNext = 0;
  /** 早上 5 点散场开始的时刻（-1 = 没散场）：萤火虫先散，再从上游一盏盏熄灯 */
  closeT = -1; closeStep = 0;
  /** 散场时某个高度的灯还亮几成（上游先熄，同一串从左往右隔 0.12 秒） */
  lit(y: number, j = 0) { if (this.closeT < 0) return 1; const at = this.closeT + 1.8 + (y / MAP_H) * 4 + j * 0.12; return Math.max(0, Math.min(1, 1 - (this.t - at) / 0.5)); }
  riverClose() { if (this.closeT >= 0) return; this.closeT = this.t; this.closeStep = 0; this.sfx("flies", 0, this.me.x, this.me.y); }
  /** 玩家身边能捞的河灯：玩家站在河边（步道贴水那一半）或桥上，灯离玩家 46 像素内、亮着；没有 = -1 */
  nearRLamp() {
    if (this.scene !== "river" || this.hideMe || this.closeT >= 0) return -1; const m = this.me; if (riverE(m.x, m.y) > CURB + 16 && !this.onDock(m.x, m.y)) return -1;
    let best = -1, bd = 46; this.rlamps.forEach((l, i) => { if (l.scoop != null) return; const d = Math.hypot(this.rlampX(l) - m.x, l.y - (m.y - 4)); if (this.rlampA(l.y) > 0.6 && d < bd) { bd = d; best = i; } }); return best;
  }
  /** 捞起来：灯从水面划一道弧飞到玩家手上（0.7 秒），水花 + 一圈涟漪 */
  scoopLamp(i: number) { const l = this.rlamps[i]; if (!l || l.scoop != null) return false; l.sx = this.rlampX(l); l.sy = l.y; l.scoop = this.t; this.splash(l.sx, l.sy, 8, "#ffe6c8"); this.sfx("plop", 0, l.sx, l.sy); const m = this.me; m.dir = l.sx < m.x - 6 ? 1 : l.sx > m.x + 6 ? 2 : l.sy < m.y ? 3 : 0; return true; }
  /** 看完放回河里：从玩家脚边最近的水面慢慢浮出来，接着往下游漂 */
  releaseLamp() { const m = this.me; const y = m.y - 4; const side = m.x < rcx(y) ? -1 : 1; this.rlamps.push({ y, u: side * 0.72, p: Math.random() * 6.28, near: true, born: this.t }); const x = rcx(y) + side * 0.72 * rhw(y); this.rings.push({ x, y: y + 1, t: 0, max: 1.4, c: "#ffd9b0" }); this.sfx("lantern", 0, x, y); }
  /** 夜河的萤火虫：hx/hy 平时绕着转的地方；k = 被玩家吸过去的程度（0 自己飞，1 绕着玩家转） */
  rflies: { hx: number; hy: number; p: number; k: number }[] = []; stillT = 0; fliesIn = false;
  /** 夜河底图：斜着的河（中间深、两边浅，贴着石沿一道亮边）→ 石头河沿 → 粉砖步道 → 外面草地；中间一座石拱桥 */
  bakeRiver() {
    const W = MAP_W, H = MAP_H; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
    const img = g.createImageData(W, H); const d = img.data; this.water = new Uint8Array(W * H);
    const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const vn = (x: number, y: number, sc: number) => { const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy); const fx = gx - x0, fy = gy - y0; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), e = hash2(x0 + 1, y0 + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v; };
    const WAT = ["#79c3cf", "#5aaac2", "#468fb2", "#3b78a2", "#326493"].map(hx), EDGE = hx("#cfe8ec");
    const STONE = ["#a4a2ad", "#8e8c98", "#c6c4cd", "#6e6c78"].map(hx);
    const BRICK = ["#c9a898", "#bd9a8b", "#d3b6a7", "#b38e80"].map(hx), MORT = hx("#9a8074"), BORDER = hx("#8c8784");
    const GR = ["#5f8a34", "#6c9a3a", "#7aa843", "#89b44c"].map(hx);
    for (let y = 0; y < H; y++) { const cx0 = rcx(y + 0.5), hw = rhw(y + 0.5); for (let x = 0; x < W; x++) {
      const e = Math.abs(x + 0.5 - cx0) - hw; const n = hash2(x, y); let c: number[];
      if (e < 0) { this.water[y * W + x] = 1; const q = -e / hw; const k = Math.min(4, Math.max(0, Math.floor(q * 4.6 + (vn(x, y, 30) - 0.5) * 0.9 + (n - 0.5) * 0.25))); c = e > -1.5 ? EDGE : e > -3 && n > 0.5 ? WAT[0] : WAT[k]; }
      else if (e < CURB) c = e < 1 ? STONE[3] : y % 9 === 0 ? STONE[1] : e > CURB - 1.2 ? STONE[2] : STONE[n > 0.9 ? 1 : 0]; // 石头河沿：贴水一道暗边，一块块石条
      else if (e < CURB + WALK) { // 粉砖步道：错缝砌，最外面一道灰石边
        const row = Math.floor(y / 3), off = (row % 2) * 3;
        c = e > CURB + WALK - 2 ? BORDER : y % 3 === 0 || (x + off) % 6 === 0 ? MORT : BRICK[n > 0.97 ? 2 : Math.floor(hash2(Math.floor((x + off) / 6), row) * 4)];
      } else { const f = vn(x, y, 46) * 0.62 + vn(x + 311, y + 97, 15) * 0.38 - (e < CURB + WALK + 8 ? 0.12 : 0); c = GR[Math.max(0, Math.min(3, Math.floor(f * 4.4 - 0.7 + (n - 0.5) * 0.45)))]; }
      const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    } }
    g.putImageData(img, 0, 0);
    const px = (x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };
    // 石拱桥：两道栏杆（上面一溜亮边、每 14 像素一根望柱）夹着石板桥面；桥下南边的水压一道影子（像桥洞）
    const { y0, y1 } = RBRIDGE; let xl = 9999, xr = 0; for (let y = y0; y <= y1; y++) { xl = Math.min(xl, rcx(y) - rhw(y)); xr = Math.max(xr, rcx(y) + rhw(y)); }
    xl = Math.floor(xl - CURB - 8); xr = Math.ceil(xr + CURB + 8); this.rBridge = { xl, xr };
    { const ay = y1 + 1, ah = 9; for (let x = xl; x <= xr; x++) { const yb = ay + ah; const inW = this.isWater(x, yb - 1) || this.isWater(x, ay + 2); if (!inW) continue; // 桥身南面（竖着的一面）
        const c0 = rcx(ay + 4), hw0 = rhw(ay + 4); const u = (x - c0) / (hw0 * 0.92); const hole = Math.abs(u) < 1 ? Math.round(ah * Math.sqrt(1 - u * u)) - 1 : -1; // 桥洞：半个椭圆
        for (let y = ay; y < yb; y++) { const k = y - ay; if (hole > 0 && k >= ah - hole) { px(x, y, k === ah - hole ? "#3c3a48" : k === ah - 1 && hash2(x, 3) > 0.6 ? "#4a7aa0" : "#1c2a44"); continue; } const brick = (Math.floor((x - xl + (k > 3 ? 4 : 0)) / 8) + (k > 3 ? 1 : 0)) % 2; px(x, y, k === 0 ? "#6e6c78" : (x - xl + (k > 3 ? 4 : 0)) % 8 === 0 || k === 4 ? "#7a7684" : brick ? "#9a96a4" : "#a8a4b0"); }
        for (let y = ay; y < yb; y++) this.water[y * MAP_W + x] = 0; // 桥身不算水（雨点、水纹不落在上面）
        if (this.isWater(x, yb)) { px(x, yb, "rgba(20,40,70,.45)"); px(x, yb + 1, "rgba(20,40,70,.25)"); } } }
    for (let y = y0 - 3; y < y0; y++) { g.fillStyle = "rgba(230,220,210,.16)"; for (let x = xl; x <= xr; x++) if (this.isWater(x, y)) g.fillRect(x, y, 1, 1); }
    for (let y = y0; y <= y1; y++) for (let x = xl; x <= xr; x++) {
      this.water[y * W + x] = 0; const top = y - y0, bot = y1 - y;
      if (top < 3 || bot < 3) { const r = Math.min(top, bot); const post = (x - xl) % 14 < 3; px(x, y, r === 0 ? "#6e6c78" : post ? (r === 1 ? "#e4e0d8" : "#c6c4cd") : r === 1 ? "#cfc9c0" : "#a8a2a0"); continue; }
      const row = Math.floor((y - y0 - 3) / 7), col = Math.floor((x - xl + (row % 2) * 5) / 10); const ex = (x - xl + (row % 2) * 5) % 10, ey = (y - y0 - 3) % 7;
      const k = hash2(row, col); px(x, y, ex === 0 || ey === 0 ? "#8a847e" : ey === 1 ? "#d0c9c0" : k > 0.66 ? "#c2bbb3" : k > 0.33 ? "#b9b2aa" : "#b0a8a0");
    }
    // 草里的小花（主粉 + 白）
    const r = rng(28); for (let i = 0; i < 180; i++) { const x = r() * W, y = r() * H; if (riverE(x, y) < CURB + WALK + 3) continue; const c = ["#f59ab8", "#f59ab8", "#ffffff", "#f7b6cc"][(r() * 4) | 0]; px(x, y, c); px(x - 1, y + 1, c); px(x + 1, y + 1, c); px(x, y + 2, c); px(x, y + 1, "#ffe08a"); }
    for (let i = 0; i < 500; i++) { const x = r() * W, y = r() * H; if (riverE(x, y) < CURB + WALK + 2) continue; px(x, y, "#4f7a2a"); px(x + 2, y - 1, "#4f7a2a"); px(x + 1, y - 2, "#9cbc48"); }
    this.ground = cv;
    // 物件：灯笼串的木杆、柳树沿河一排、步道边路灯、外面草地零星树丛、路牌
    const add = (kind: Prop["kind"], x: number, y: number, rr = 0, flat = false) => this.props.push({ kind, x, y, r: rr, flat, flip: hash2(x | 0, y | 0) > 0.5 });
    const busy = (x: number, y: number, dd: number) => this.props.some(q => !q.flat && Math.hypot(q.x - x, q.y - y) < dd);
    const nearB = (y: number, m: number) => y > y0 - m && y < y1 + m; const nearS = (y: number, m: number) => LSTR.some(Y => Math.abs(y - Y) < m);
    for (const Y of LSTR) { add("pole", rcx(Y) - rhw(Y) - CURB - 3, Y, 3); add("pole", rcx(Y) + rhw(Y) + CURB + 3, Y, 3); }
    const rt = rng(55);
    for (const side of [-1, 1]) for (let y = 34 + rt() * 20; y < H - 14; y += 50 + rt() * 24) { if (nearB(y, 36) || nearS(y, 22) || busy(rcx(y) + side * (rhw(y) + 30), y, 26)) continue; const x = rcx(y) + side * (rhw(y) + CURB + WALK + 11 + rt() * 5); if (x > 16 && x < W - 16) add("willow", x, y, 6); }
    for (const [side, ys] of [[1, [115, 360, 520]], [-1, [70, 225, 330, 480]]] as [number, number[]][]) for (const y of ys) add("lamp", rcx(y) + side * (rhw(y) + CURB + WALK - 5), y, 4); // 东岸避开钓点（84 196 329 427 483）
    const sy = 452; this.signPos = { x: rcx(sy) + rhw(sy) + CURB + WALK + 18, y: sy };
    const TREES: Prop["kind"][] = ["treeBig", "tree", "tree", "treePink", "treeSmall"];
    for (let i = 0; i < 140 && this.props.length < 70; i++) { const x = 20 + rt() * (W - 40), y = 40 + rt() * (H - 50); if (riverE(x, y) < CURB + WALK + 26 || busy(x, y, 34) || Math.hypot(x - this.signPos.x, y - this.signPos.y) < 60) continue; const k = rt(); add(k < 0.3 ? TREES[(rt() * TREES.length) | 0] : k < 0.5 ? (rt() < 0.4 ? "bushFlower" : "bush") : k < 0.75 ? "flowers" : k < 0.9 ? "grass" : "rock", x, y, k < 0.3 ? 9 : k < 0.5 ? 11 : k >= 0.9 ? 7 : 0); }
    add("sign", this.signPos.x, this.signPos.y, 6);
    this.rStoneLamps = [y0 + 1, y1].flatMap(Y => [{ x: Math.round(rcx(Y) - rhw(Y) - 2), y: Y }, { x: Math.round(rcx(Y) + rhw(Y) + 2), y: Y }]);
    // 一开场河上已经漂着几盏；萤火虫：大多在步道和柳树边，几只在水面上
    for (const y of [40, 150, 330, 470]) this.rlamps.push({ y, u: (hash2(y, 3) - 0.5) * 1.1, p: hash2(y, 7) * 6.28, near: false });
    this.rlNext = 6;
    const rf = rng(91); for (let i = 0; i < 40; i++) { const y = 20 + rf() * (H - 40); const side = rf() < 0.5 ? -1 : 1; const over = i < 8; const x = rcx(y) + side * (over ? rf() * rhw(y) * 0.8 : rhw(y) + CURB + rf() * 60); this.rflies.push({ hx: x, hy: y, p: rf() * 6.28, k: 0 }); }
  }
  /** 河灯现在的 x（顺着河中线漂，左右轻轻荡） */
  rlampX(l: { y: number; u: number; p: number }) { return rcx(l.y) + l.u * rhw(l.y) + Math.sin(this.t * 0.45 + l.p) * 2; }
  /** 捞起来那盏现在在哪（k = 0～1 飞到玩家手上），k ≥ 1 就没了 */
  scoopPos(l: { sx?: number; sy?: number; scoop?: number }) { const k = Math.min(1, (this.t - (l.scoop ?? 0)) / 0.7), e = 1 - (1 - k) ** 3; const m = this.me; const tx = m.x, ty = m.y - 28; return { k, x: l.sx! + (tx - l.sx!) * e, y: l.sy! + (ty - l.sy!) * e - Math.sin(k * Math.PI) * 18 }; }
  /** 河灯的透明度：从上游画外慢慢漂进来、钻桥洞时暗下去、漂出下游淡掉（都是连续变的，不会一下没了） */
  rlampA(y: number) { const cl = (v: number) => Math.max(0, Math.min(1, v)); const b = y < RBRIDGE.y0 ? (RBRIDGE.y0 - 3 - y) / 8 : (y - RBRIDGE.y1 - 11) / 6; return cl((y + 6) / 26) * cl((MAP_H + 4 - y) / 26) * cl(b); }
  /** 萤火虫现在在哪：自己绕着飞的位置 和 绕着玩家转的位置 之间按 k 平滑地过渡 */
  flyPos(f: { hx: number; hy: number; p: number; k: number }) {
    const t = this.t; let bx = f.hx + Math.sin(t * 0.7 + f.p) * 16, by = f.hy + Math.cos(t * 0.5 + f.p * 2) * 10;
    if (this.closeT >= 0) { const e = Math.min(3, t - this.closeT), dx = f.hx - this.me.x, dy = f.hy - this.me.y, L = Math.hypot(dx, dy) || 1; bx += (dx / L) * e * e * 8; by += (dy / L) * e * e * 8 - e * e * 4; } // 散场：往外、往上飘走
    if (f.k <= 0) return { x: bx, y: by };
    const m = this.me; const r = 11 + (f.p % 1) * 10; const ox = m.x + Math.cos(t * 0.9 + f.p * 3) * r, oy = m.y - 30 + Math.sin(t * 1.3 + f.p * 2) * 8; const s = f.k * f.k * (3 - 2 * f.k);
    return { x: bx + (ox - bx) * s, y: by + (oy - by) * s };
  }
  /** 夜河每帧：河灯往下漂（漂过玩家身边叮一声、身后拖一圈暖色水纹）；玩家站着不动 2.5 秒，附近的萤火虫慢慢围过来绕着玩家转，一走就散 */
  riverStep(dt: number) {
    const m = this.me;
    for (const l of this.rlamps) {
      if (l.scoop != null) continue;
      l.y += (4 + 6 * (1 - l.u * l.u)) * dt; const x = this.rlampX(l); const a = this.rlampA(l.y);
      if (!l.near && !this.hideMe && a > 0.5 && Math.hypot(x - m.x, l.y - (m.y - 6)) < 64) { l.near = true; this.sfx("lantern", 0, x, l.y); }
      if (a > 0.3 && Math.random() < dt * 0.45) this.rings.push({ x, y: l.y + 1, t: 0, max: 1.6, c: "#ffd9b0" });
    }
    this.rlamps = this.rlamps.filter(l => l.y < MAP_H + 12 && !(l.scoop != null && this.t - l.scoop > 0.72));
    if (this.t > this.rlNext && this.closeT < 0) { this.rlamps.push({ y: -10, u: (Math.random() - 0.5) * 1.1, p: Math.random() * 6.28, near: false }); this.rlNext = this.t + 10 + Math.random() * 8; }
    this.stillT = m.moving || this.hideMe ? 0 : this.stillT + dt; const gather = this.stillT > 2.5 && this.closeT < 0;
    // 散场：先萤火虫散（一声往下落的叮），每一串灯笼开始熄的时候轻轻一声
    if (this.closeT >= 0) { const e = this.t - this.closeT; const marks = [1.8 + (LSTR[0] / MAP_H) * 4, 1.8 + (RBRIDGE.y0 / MAP_H) * 4, 1.8 + (LSTR[1] / MAP_H) * 4]; if (this.closeStep < marks.length && e > marks[this.closeStep]) { this.closeStep++; this.sfx("lantern", 1, m.x, m.y); } }
    let n = 0;
    for (const f of this.rflies) {
      const bx = f.hx + Math.sin(this.t * 0.7 + f.p) * 16, by = f.hy + Math.cos(this.t * 0.5 + f.p * 2) * 10;
      if (gather && Math.hypot(bx - m.x, by - m.y + 20) < 120) f.k = Math.min(1, f.k + dt * 0.35); else f.k = Math.max(0, f.k - dt * (m.moving ? 1.4 : 0.4));
      if (f.k > 0.85) n++;
    }
    if (!this.fliesIn && n >= 4) { this.fliesIn = true; this.sfx("flies", 1, m.x, m.y); }
    else if (this.fliesIn && n < 2) { this.fliesIn = false; if (m.moving) this.sfx("flies", 0, m.x, m.y); }
  }
  /** 河面：一道道细亮纹顺着河往左下流（中间快两边慢，出现和消失都是慢慢淡的），再画漂着的河灯 */
  drawRiverWater() {
    const g = this.g, t = this.t; const per = this.mh + 30;
    for (let i = 0; i < 90; i++) {
      const u = (hash2(i, 5) - 0.5) * 1.7; const sp = 5 + 13 * (1 - u * u); const y = ((hash2(i, 9) * per + t * sp) % per) - 15;
      const ph = (t * (0.12 + hash2(i, 3) * 0.1) + hash2(i, 13)) % 1; const a = Math.sin(ph * Math.PI) ** 2 * 0.55; if (a < 0.04) continue;
      g.fillStyle = `rgba(214,242,248,${a.toFixed(3)})`; const L = 3 + (i % 3);
      for (let k = 0; k < L; k++) { const yy = y + k, xx = rcx(yy) + u * rhw(yy); if (this.isWater(xx, yy)) g.fillRect(Math.round(xx), Math.round(yy), 1, 1); }
    }
    for (const l of this.rlamps) { if (l.scoop != null) continue; const a = this.rlampA(l.y) * (l.born != null ? Math.min(1, (this.t - l.born) / 0.8) : 1); if (a > 0.01) this.drawRLamp(this.rlampX(l), l.y, a); }
  }
  /** 莲花河灯：粉白花瓣一圈，中间一截小蜡烛，底下一道水影 */
  drawRLamp(x: number, y: number, a: number) {
    const g = this.g; const X = this.rp(x), Y = Math.round(y); const px = (dx: number, dy: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(X + dx, Y + dy, w, h); };
    g.globalAlpha = a;
    px(-3, 1, "rgba(20,40,70,.35)", 7, 1);
    px(-4, 0, "#e87a9a", 9, 1); px(-3, -1, "#f7a8c0", 7, 1); px(-4, -1, "#f28fa6"); px(4, -1, "#f28fa6");
    px(-2, -2, "#ffd0dc", 5, 1); px(-3, -2, "#f7a8c0"); px(3, -2, "#f7a8c0"); px(-4, -2, "#f28fa6"); px(4, -2, "#f28fa6");
    px(-1, -3, "#ffe3ea"); px(1, -3, "#ffe3ea"); px(-3, -3, "#f7a8c0"); px(3, -3, "#f7a8c0");
    px(0, -4, "#fff4d6", 1, 2); px(0, -5, "#ffcf5a");
    g.globalAlpha = 1;
  }
  /** 桥头小石灯：石座、灯室里一点暖光、顶上小屋檐 */
  drawStoneLamp(x: number, y: number) {
    const g = this.g; const px = (dx: number, dy: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x + dx, y + dy, w, h); };
    px(-2, -1, "#8e8c98", 5, 2); px(-1, -5, "#a4a2ad", 3, 4); px(-2, -9, "#c6c4cd", 5, 4); px(-1, -8, "#ffd98a", 3, 2); px(-3, -10, "#6e6c78", 7, 1); px(-1, -11, "#6e6c78", 3, 1);
  }
  /** 两串灯笼每一盏挂在哪：[x, 灯笼顶 y, 这串在地上的 y, 颜色, 编号]。绳子中间往下垂，整串跟风轻轻荡 */
  lanternPts() {
    const t = this.t; const out: { x: number; y: number; Y: number; c: string; i: number }[] = [];
    LSTR.forEach((Y, si) => { const xl = rcx(Y) - rhw(Y) - CURB - 3, xr = rcx(Y) + rhw(Y) + CURB + 3, top = Y - 37; const sw = Math.sin(t * 0.6 + si * 2) * (0.8 + this.wx.wind * 2);
      for (let j = 0; j < 6; j++) { const k = (j + 1) / 7; const i = si * 6 + j; out.push({ x: xl + (xr - xl) * k + Math.sin(t * 1.2 + i * 1.4) * (0.9 + this.wx.wind), y: top + Math.sin(k * Math.PI) * (9 + sw), Y, c: LCOL[i % 3], i }); } });
    return out;
  }
  /** 灯笼串：绳子（中间下垂）+ 一盏盏灯笼（金顶、灯身、左边一道亮、底下流苏），挂在高处压在人上面 */
  drawStrings() {
    const g = this.g, t = this.t;
    LSTR.forEach((Y, si) => { const xl = rcx(Y) - rhw(Y) - CURB - 3, xr = rcx(Y) + rhw(Y) + CURB + 3, top = Y - 37; const sw = Math.sin(t * 0.6 + si * 2) * (0.8 + this.wx.wind * 2); g.fillStyle = "#3b2b2e";
      for (let x = Math.floor(xl); x <= xr; x++) { const k = (x - xl) / (xr - xl); g.fillRect(x, this.rp(top + Math.sin(k * Math.PI) * (9 + sw)), 1, 1); } });
    for (const L of this.lanternPts()) { const X = this.rp(L.x), Y = this.rp(L.y); const px = (dx: number, dy: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(X + dx, Y + dy, w, h); };
      px(0, 0, "#3b2b2e", 1, 2); px(-2, 2, "#f2c14e", 5, 1); px(-2, 3, L.c, 5, 1); px(-3, 4, L.c, 7, 4); px(-2, 8, L.c, 5, 1); px(-2, 9, "#f2c14e", 5, 1);
      px(-1, 4, "rgba(0,0,0,.18)", 1, 4); px(1, 4, "rgba(0,0,0,.18)", 1, 4); // 灯骨两道
      px(-2, 4, "rgba(255,235,210,.75)", 1, 3); px(0, 5, "#fff0d0", 1, 2); px(0, 10, L.c, 1, 3); px(-1, 12, L.c, 3, 1);
      const off = 1 - this.lit(L.Y, L.i % 6); if (off > 0) { g.fillStyle = `rgba(40,28,44,${(off * 0.55).toFixed(3)})`; g.fillRect(X - 3, Y + 3, 7, 6); } }
  }
  /** 夜色罩上以后再加亮的：月亮倒影、灯笼的光和水里的灯影、桥头石灯、河灯、萤火虫（都是慢慢呼吸的明暗，不闪） */
  drawRiverLights(cx: number, cy: number) {
    const g = this.g, t = this.t;
    for (let j = 0; j < 10; j++) { const yy = 116 + j * 2; const w = Math.max(1, Math.round(5 - Math.abs(j - 4.5) * 0.8)); const xx = rcx(yy) - 10 + Math.sin(t * 1.3 + j * 1.1) * 1.6; g.fillStyle = `rgba(255,244,214,${(0.2 + 0.06 * Math.sin(t * 0.7 + j)).toFixed(3)})`; g.fillRect(this.rp(xx - w / 2 - cx), yy - cy, w, 1); }
    for (const L of this.lanternPts()) {
      const b = (0.8 + 0.2 * Math.sin(t * 0.8 + L.i * 1.9)) * this.lit(L.Y, L.i % 6); if (b < 0.01) continue; this.glowA(L.x - cx, L.y + 6 - cy, 16, "255,170,120", 0.55 * b); this.glowA(L.x - cx, L.y + 6 - cy, 5, "255,225,170", 0.6 * b);
      // 水里的灯影：灯笼离地多高，倒影就在地面往下多远；一截竖着的暖光，越往下越淡、左右轻轻抖
      const yr = L.Y + (L.Y - L.y - 6) * 0.75; if (!this.isWater(L.x, yr + 4)) continue;
      this.glowA(L.x - cx, yr + 5 - cy, 7, "255,180,130", 0.22 * b);
      // 碎开的灯影：每一行各抖各的（不连成一条弯线），暖橘色，越往下越淡越碎
      for (let q = 0; q < 13; q++) { const yy = yr + q, xx = L.x + Math.sin(t * 2.2 + q * 1.9 + L.i) * (0.5 + q * 0.14); if (!this.isWater(xx, yy) || (q > 6 && q % 2 === 1)) continue; const w = q < 4 ? 2 : 1; g.fillStyle = `rgba(255,150,80,${(0.28 * b * (1 - q / 13)).toFixed(3)})`; g.fillRect(this.rp(xx - w / 2 - cx), yy - cy, w, 1); }
    }
    for (const s of this.rStoneLamps) this.glowA(s.x - cx, s.y - 7 - cy, 11, "255,200,130", (0.45 + 0.08 * Math.sin(t * 0.9 + s.x)) * this.lit(s.y));
    for (const l of this.rlamps) { if (l.scoop != null) { const q = this.scoopPos(l); if (q.k < 1) this.glowA(q.x - cx, q.y - 4 - cy, 14, "255,200,140", 0.6); continue; } const a = this.rlampA(l.y) * (l.born != null ? Math.min(1, (this.t - l.born) / 0.8) : 1); if (a < 0.02) continue; const x = this.rlampX(l); const b = (0.85 + 0.15 * Math.sin(t * 1.1 + l.p)) * this.lit(l.y);
      this.glowA(x - cx, l.y - 4 - cy, 13, "255,200,140", 0.5 * a * b);
      for (let q = 0; q < 5; q++) { const yy = l.y + 2 + q, xx = x + Math.sin(t * 2.6 + q + l.p) * 0.7; g.fillStyle = `rgba(255,210,160,${(0.35 * a * (1 - q / 5)).toFixed(3)})`; g.fillRect(this.rp(xx - 1 - cx), yy - cy, 2, 1); } }
    const ff = this.closeT < 0 ? 1 : Math.max(0, 1 - (t - this.closeT) / 1.6);
    for (const f of this.rflies) { if (ff <= 0) break; const p = this.flyPos(f); const on = (Math.sin(t * 2.3 + f.p * 3) + 1) / 2; const a = (on + (1 - on) * f.k * 0.8) * ff; this.glowA(p.x - cx, p.y - cy, 7, "220,255,140", 0.5 * a); g.fillStyle = `rgba(250,255,200,${a.toFixed(3)})`; g.fillRect(this.rp(p.x - cx), this.rp(p.y - cy), 1, 1); }
  }
  /** 预先画好的一团光（按半径和颜色存着），每帧只贴图不再新建渐变 */
  glowC: Record<string, HTMLCanvasElement> = {};
  glowA(x: number, y: number, r: number, rgb: string, a: number) {
    if (a <= 0.01) return; const key = r + "|" + rgb; let c = this.glowC[key];
    if (!c) { c = document.createElement("canvas"); c.width = c.height = r * 2 * 4; const gg = c.getContext("2d")!; const gr = gg.createRadialGradient(r * 4, r * 4, 0, r * 4, r * 4, r * 4); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`); gg.fillStyle = gr; gg.fillRect(0, 0, r * 8, r * 8); this.glowC[key] = c; }
    const g = this.g; g.globalAlpha = Math.min(1, a); g.imageSmoothingEnabled = true; g.drawImage(c, x - r, y - r, r * 2, r * 2); g.imageSmoothingEnabled = false; g.globalAlpha = 1;
  }
  /** 海浪：岸边一层白沫来回冲上沙滩又退下去；远处三道浪往岸边推、推近了散掉。刮风时浪更大更急 */
  drawWaves(cx: number) {
    const g = this.g, t = this.t, wind = this.wx.wind; const x0 = Math.max(0, Math.floor(cx) - 2), x1 = Math.min(this.mw, Math.ceil(cx + this.vw) + 2);
    for (let x = x0; x < x1; x++) {
      const sh = seaShore(x); const wash = (Math.sin(t * (0.8 + wind * 0.5) + x * 0.015) + 1) / 2; const up = 3 + wash * (7 + wind * 6);
      g.fillStyle = "rgba(205,180,130,.55)"; g.fillRect(x, Math.round(sh - up - 2), 1, 2); // 湿沙
      g.fillStyle = "rgba(255,255,255,.92)"; g.fillRect(x, Math.round(sh - up), 1, hash2(x, 1) > 0.3 ? 2 : 1); // 白沫
      for (let k = 0; k < 3; k++) {
        const ph = (t * (0.07 + wind * 0.05) + k / 3 + hash2(x >> 5, k) * 0.04) % 1; const y = sh + 6 + (1 - ph) * (70 + wind * 30) + Math.sin(x * 0.045 + k * 2) * 3;
        if (hash2(x >> 3, k + Math.floor(t * 0.07 + k / 3)) < 0.22) continue;
        const a = ph < 0.15 ? ph / 0.15 : ph > 0.85 ? (1 - ph) / 0.15 : 1; g.fillStyle = `rgba(240,253,251,${0.8 * a})`; g.fillRect(x, Math.round(y), 1, 2); g.fillStyle = `rgba(200,240,238,${0.35 * a})`; g.fillRect(x, Math.round(y) + 2, 1, 1);
      }
    }
  }
  /** 玩家走到路牌跟前了没有（出发 / 回去） */
  nearSign() { const m = this.me; return Math.hypot(m.x - this.signPos.x, m.y - this.signPos.y - 8) < 34; }
  /** 秤砣：站着 → 没人来久了打盹（玩家走近会猛地醒）→ 卖鱼时过秤（鱼在下面、鳞片碎屑在上面、按稀有度撒彩色鳞）→ 钱不够时心软 → 空手时塞蚯蚓 */
  drawPelican() {
    const g = this.g; const P = this.pel; const m = this.me; const near = Math.hypot(m.x - PEL_POS.x, m.y - PEL_POS.y) < 110 && !this.hideMe;
    if (near) { if (P.act === "nap") { this.pelPlay("idle"); P.far = -1; } else P.far = 0; } else if (P.act === "idle") { P.far += 1 / 60; if (P.far > 25) this.pelPlay("nap"); }
    this.pxEllipse(PEL_POS.x, PEL_POS.y - 1, 12, 3, "rgba(30,50,30,.28)", true);
    const meta = pelActsMeta as { cw: number; ch: number; rows: Record<string, number> };
    const dt = this.t - P.t0; let row = -1, fr = 0;
    if (P.act === "nap") { row = meta.rows.nap; fr = Math.floor(dt / 1.4) % 2; }
    else if (P.act !== "idle" && meta.rows[P.act] != null) { row = meta.rows[P.act]; fr = Math.min(2, Math.floor(dt / 0.8)); if (dt > 3.4) { this.pelPlay("idle"); row = -1; } }
    if (P.far === -1 && P.act === "idle" && dt < 0.9) { row = meta.rows.nap; fr = 2; } // 被吵醒那一下：猛地抬头推眼镜
    if (row < 0 || !this.pelActs.naturalWidth) { const im = this.pelImg; if (!im.naturalWidth) return; const bob = Math.sin(this.t * 1.3) > 0.85 ? 1 : 0; g.drawImage(im, this.rp(PEL_POS.x - im.width / 2), this.rp(PEL_POS.y - im.height + 1 + bob)); return; }
    const x0 = PEL_POS.x - meta.cw / 2, y0 = PEL_POS.y - meta.ch + 1;
    // 过秤第 1 帧：玩家卖的那条鱼画在秤砣下面（他翅膀捏着），刮下来的鳞片（粒子）在最上面
    if (P.act === "weigh" && fr === 0 && P.fish) { const art = this.fishArt[P.fish.sp]; if (art) g.drawImage(art, this.rp(x0 + 46 - art.width / 2), this.rp(y0 + 30 - art.height / 2)); if (Math.random() < 0.5) this.parts.push({ x: x0 + 40 + Math.random() * 10, y: y0 + 26 + Math.random() * 8, vx: (Math.random() - 0.3) * 30, vy: -10 - Math.random() * 20, life: 0, max: 0.6, c: RARITY_PX[P.fish.rarity] ?? RARITY_PX[0], g: 60 }); }
    if (P.act === "weigh" && fr === 2 && Math.random() < 0.35 && P.fish) this.parts.push({ x: x0 + 52, y: y0 + 22, vx: 20 + Math.random() * 25, vy: -5 + Math.random() * 10, life: 0, max: 0.7, c: RARITY_PX[P.fish.rarity] ?? "#e3f6f5", g: 40 });
    g.drawImage(this.pelActs, fr * meta.cw, row * meta.ch, meta.cw, meta.ch, this.rp(x0), this.rp(y0), meta.cw, meta.ch);
  }
  /** 玩家走到秤砣的柜台前面了没有 */
  nearShop() { const m = this.me; if (this.scene !== "pond") return false; return Math.hypot(m.x - PEL_POS.x, m.y - PEL_POS.y) < 44 || (Math.abs(m.x - SHOP_POS.x) < 78 && m.y > SHOP_POS.y && m.y < SHOP_POS.y + 34); }
  /** 站着不钓：面朝水、不拿竿 */
  faceIdle(a: Actor) { if (this.scene === "river") { a.dir = 1; a.rod = false; a.bob = null; a.moving = 0; return; } if (this.scene === "sea") { a.dir = 0; a.rod = false; a.bob = null; a.moving = 0; return; } const dx = PC.x - a.x, dy = PC.y - a.y; a.dir = Math.abs(dx) > Math.abs(dy) * 1.4 ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0); a.rod = false; a.bob = null; a.moving = 0; }
  /** 服务器给的岸边角度 → 附近站得住的角度（避开路灯 / 芦苇 / 栈桥，只是画的时候挪一点） */
  goodAng(t: number) { for (let i = 0; i < 40; i++) { const g = t + (i % 2 ? 1 : -1) * 0.04 * Math.ceil(i / 2); if (this.goodSpot(this.bank(g))) return g; } return t; }
  /** 开放世界：伙伴在哪、在干什么以服务器为准（玩家关掉页面他们也在那儿）。skew = 服务器时间 - 本机时间 */
  syncAi(who: "buddy" | "pal", srv: { ang: number; walk: { from: number; to: number; at: number; dur: number } | null; act: string; place?: string; cab?: { spot: string } | null; gear?: { rod?: string; bobber?: string } }, skew = 0) {
    if (srv.gear && this.ai[who]) this.ai[who].gear = srv.gear;
    const a = this.ai[who];
    // 在小屋：服务器说他在哪件家具跟前（cab.spot），放过去，隔一会儿用一次那件家具（cabinAiStep）
    if (this.scene === "cabin" && srv.place === "cabin") { const sp = srv.cab?.spot ?? (who === "buddy" ? "buddy" : "pal"); if (a.cabSpot !== sp || !a.synced) { const S = TH_SPOTS.find(q => q.id === sp); if (!S) return; a.synced = true; a.cabSpot = sp; a.cact = null; a.rod = false; a.bob = null; a.goal = null; a.moving = 0; a.x = TH_ACTS[sp]?.per?.[who]?.x ?? TH_ACTS[sp]?.x ?? S.x; a.y = TH_FLOOR[S.f].y; a.dir = TH_ACTS[sp]?.per?.[who]?.face ?? TH_ACTS[sp]?.face ?? 0; a.nextMove = this.t + 1 + Math.random() * 2; } return; }
    a.cabSpot = null;
    // 他在别的钓点：这边不画（挪到画面外）；回到这个钓点时 synced=false → 直接放到服务器说的位置
    if ((srv.place ?? "pond") !== this.scene) { a.x = -9999; a.y = -9999; a.rod = false; a.bob = null; a.goal = null; a.synced = false; a.moving = 0; return; } const now = Date.now() + skew; const tw = (x: number) => { if (this.scene === "sea" || this.scene === "river") return x; const t = 2 * Math.PI; return ((((x + Math.PI) % t) + t) % t) - Math.PI; }; // 海边是一条线，不绕圈
    const cur = srv.walk ? srv.walk.from + (srv.walk.to - srv.walk.from) * Math.min(1, (now - srv.walk.at) / srv.walk.dur) : srv.ang;
    const walking = !!srv.walk && now < srv.walk.at + srv.walk.dur;
    const target = this.goodAng(walking ? srv.walk!.to : srv.ang);
    a.srvAct = srv.act;
    // 第一次、或者跟服务器差太远（刚打开页面 / 卡了很久）：直接放到那儿
    if (!a.synced || Math.abs(tw((a.ang ?? 0) - (walking ? cur : target))) > 0.35) {
      a.synced = true; a.ang = walking ? cur : target; a.goal = null; const p = this.bank(a.ang); a.x = p.x; a.y = p.y; a.off = 0;
      if (!walking) { if (srv.act !== "idle") this.settle(a); else this.faceIdle(a); }
    }
    if (Math.abs(tw((a.goal ?? a.ang ?? 0) - target)) > 0.004) { a.goal = (a.ang ?? 0) + tw(target - (a.ang ?? 0)); a.rod = false; a.bob = null; if (a.act !== 4 || this.t >= a.actUntil) a.act = -1; } // 正举着鱼就举完再走
    if (a.goal == null) { if (srv.act !== "idle" && !a.bob) this.settle(a); else if (srv.act === "idle" && a.rod) this.faceIdle(a); }
  }
  /** 这个岸边点能不能当钓点：不挨着路灯 / 牌子 / 水桶 / 芦苇 / 树，不在栈桥两边，站得住 */
  goodSpot(p: { x: number; y: number }) {
    if (p.y < 60 || p.x < 30 || p.x > this.mw - 30) return false;
    if (this.scene === "river") { if (p.y > RBRIDGE.y0 - 26 && p.y < RBRIDGE.y1 + 30) return false; } // 桥头不站
    else if (this.scene !== "sea" && Math.abs(p.x - (DOCK.x0 + DOCK.x1) / 2) < 44 && p.y > PC.y) return false;
    if (!this.walkable(p.x, p.y)) return false;
    return !this.props.some(q => !q.flat && q.kind !== "grass" && q.kind !== "flowers" && Math.hypot(q.x - p.x, (q.y - p.y) * 1.3) < (q.kind === "reeds" || q.kind === "pampas" ? 34 : q.r ? q.r + 18 : 14));
  }
  /** 鱼的像素图（public/world-fish），缩到世界里的大小 */
  fishCanvas(sp: string) {
    if (sp in this.fishArt) return this.fishArt[sp]; this.fishArt[sp] = null;
    const img = new Image();
    img.onload = () => {
      const w = sp === "pond_lord" ? 30 : 20; const h = Math.max(4, Math.round((img.height / img.width) * w));
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!; g.imageSmoothingQuality = "high"; g.drawImage(img, 0, 0, w, h);
      // 缩完边上半透明的像素要么留要么扔，保持像素边
      const d = g.getImageData(0, 0, w, h); for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0; g.putImageData(d, 0, 0); this.fishArt[sp] = c;
    };
    img.src = `/world-fish/${sp}.png`; return null;
  }
  destroy() { cancelAnimationFrame(this.raf); this.raf = 0; this.ro.disconnect(); document.removeEventListener("visibilitychange", this.vis); this.cv.remove(); }
  vis = () => { if (document.hidden) { cancelAnimationFrame(this.raf); this.raf = 0; } else if (!this.raf) { this.last = performance.now(); this.loop(); } };

  resize() {
    const dpr = window.devicePixelRatio || 1; const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return;
    // 画面高度大约 300 个美术像素（人 60 像素高 ≈ 五分之一屏），按整数倍放大
    this.scale = this.scene === "farm" ? Math.max(1, Math.round((h * dpr) / 450 * 2) / 2) : Math.max(1, Math.round((h * dpr) / 300)); // 农场太近 → /480（玩家手机 2 倍）；又说远了近一点点 → 允许半倍，玩家手机 2.5 倍；农场扩建玩家看了 3 / 3.5 / 4 倍对比选 4 倍 → /292；进去玩了说太近；我原来按 1170 高算错了（玩家手机 1290 高），按真实尺寸对比后玩家选 3 倍（/450，看得到远处小镇），人物放大 1.25 倍（PEOPLE_K）
    this.vw = Math.ceil((w * dpr) / this.scale); this.vh = Math.ceil((h * dpr) / this.scale);
    // 第三轮：画布按设备像素开（每个美术像素 = scale 个设备像素），人和镜头可以停在「半格」上。
    // 原来画布就是美术像素大小，人每帧只能整格跳，伙伴一秒走 36 格、一帧 0.6 格，就一顿一顿的（试玩反馈还是卡卡的）
    this.cv.width = Math.round(this.vw * this.scale); this.cv.height = Math.round(this.vh * this.scale); this.g.imageSmoothingEnabled = false;
    // 画布按整数倍摆（每个美术像素正好 scale 个物理像素）。原来拉伸到 100% 有零点几的缩放，像素糊、粗细不均（试玩反馈草地糊）
    this.cv.style.width = `${(this.vw * this.scale) / dpr}px`; this.cv.style.height = `${(this.vh * this.scale) / dpr}px`;
  }
  /** 世界坐标 → 画布元素里的 CSS 像素（给 React 放气泡） */
  toCss(x: number, y: number) { const k = this.scale / (window.devicePixelRatio || 1); return { x: (x - this.rp(this.cam.x)) * k, y: (y - this.rp(this.cam.y)) * k }; }
  /** 取整到设备像素（1/scale 美术像素） */
  rp(v: number) { return Math.round(v * this.scale) / this.scale; }

  // ─── 地图 ───
  isWater(x: number, y: number) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.mw || y >= this.mh) return false; return this.water[y * this.mw + x] === 1; }
  onDock(x: number, y: number) { if (this.scene === "river") return x >= this.rBridge.xl + 2 && x <= this.rBridge.xr - 2 && y >= RBRIDGE.y0 + 6 && y <= RBRIDGE.y1 - 2; if (this.scene === "sea") return false; return x >= DOCK.x0 + 3 && x <= DOCK.x1 - 3 && y >= DOCK.y0 + 8 && y <= PC.y + RY + 20; }
  /** 人和人不能叠在一起：离别人太近、而且还在往里挤就算挡住（已经叠着的时候往外走可以） */
  bumps(self: Actor, x: number, y: number) {
    for (const o of [this.me, this.ai.buddy, this.ai.pal]) { if (o === self || o.cact || o.rest != null || o.sitting) continue; /* 他坐在床边挡住玩家上不了床另一边——坐着 / 躺着 / 用家具的人能穿过去 */ const d1 = Math.hypot((x - o.x) / 1.7, y - o.y), d0 = Math.hypot((self.x - o.x) / 1.7, self.y - o.y); if (d1 < 15 && d1 < d0) return true; } // 原来 9，人有 35 像素宽，挨着站会叠在一起（试玩反馈透视）
    return false;
  }
  walkable(x: number, y: number) {
    if (this.scene === "cabin") return this.thFloor(x, y) >= 0;
    if (this.scene === "farm") return this.farmWalk(x, y);
    if ((this.scene as string) === "farm_old") { // 石墙只能走台阶；建筑挡脚底一块
      if (x < 12 || x > this.mw - 12 || y < 40 || y > this.mh - 6) return false;
      for (let i = 0; i < 3; i++) { const wy = fWallY(i, x); if (y > wy - 3 && y < wy + FACE + 2 && Math.abs(x - FSTEP[i]) > 11) return false; }
      for (const b of Object.values(FB)) if (Math.abs(x - b.x) < b.bw && y > b.y - b.bh && y < b.y + 3) return false;
    }
    if (x < 12 || x > this.mw - 12 || y < 34 || y > this.mh - 6) return false;
    if (this.scene === "lake" && y < lakeCliff(x) + 6) return false; // 雪山崖壁
    if (this.onDock(x, y)) return true;
    if (this.scene === "river" && y >= RBRIDGE.y0 - 1 && y <= RBRIDGE.y1 + 11 && riverE(x, y) < CURB + 1) return false; // 桥上只能走桥面，栏杆上不行
    if (this.scene === "pond" && Math.abs(x - SHOP_POS.x) < 74 && y > SHOP_POS.y - 44 && y < SHOP_POS.y + 3) return false; // 小摊柜台
    if (this.scene === "pond" && Math.hypot((x - PEL_POS.x) / 1.4, y - PEL_POS.y) < 10) return false; // 秤砣本人
    for (let dx = -5; dx <= 5; dx += 5) if (this.isWater(x + dx, y) || this.isWater(x + dx, y - 3)) return false;
    for (const p of this.props) if (p.r && Math.hypot((x - p.x) / 1.4, y - p.y) < p.r) return false;
    return true;
  }
  bake() {
    const W = this.mw, H = this.mh; const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d")!;
    const img = g.createImageData(W, H); const d = img.data; this.water = new Uint8Array(W * H);
    const hx = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const GR = ["#6f9834", "#7ea53a", "#8cb142", "#9bbd4b"].map(hx), SAND = ["#e8d6a4", "#d9c290", "#f1e3b8"].map(hx), DIRT = ["#c9a27a", "#b8906a", "#d6b28a"].map(hx);
    const lake = this.scene === "lake";
    if (lake) { GR.splice(0, 4, ...["#a07c34", "#b08c3e", "#c29e4a", "#d2b058"].map(hx)); SAND.splice(0, 3, ...["#a39e92", "#8a877e", "#c4c0b6"].map(hx)); }
    const ROCK = ["#6c7182", "#7f8596", "#959bab", "#5c606e"].map(hx), SNOW = ["#f4f6fb", "#dfe6f0", "#c9d3e2"].map(hx);
    const WAT = (lake ? ["#7fcfc4", "#4fb3b4", "#3796a6", "#2b7c96", "#236688"] : ["#7fd0de", "#5db8d2", "#4aa2c6", "#3d8cb6", "#357fab"]).map(hx), FOAM = hx("#e3f6f5");
    const pathAt = (x: number, y: number) => y > PC.y + RY * 0.9 && Math.abs(x - (384 + Math.sin(y * 0.045) * 6)) < 15 + Math.sin(y * 0.13) * 1.5;
    // 草地明暗：两层平滑噪声（大片 + 小片），分成四档，档和档交界处撒一点点颗粒过渡。
    // 试玩反馈原来的草"太奇怪、太糊"：原来按 8×8 格子随机明暗，放大后是一块块棋盘格
    const vn = (x: number, y: number, sc: number) => { const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy); const fx = gx - x0, fy = gy - y0; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const q = pondQ(x + 0.5, y + 0.5); const n = hash2(x, y); const n2 = hash2(x >> 3, y >> 3); let c: number[];
      const ie = inIsle(x + 0.5, y + 0.5);
      const cl = lake ? lakeCliff(x) : -1;
      if (y < cl) { // 雪山崖壁：上面积雪、下面一层层岩石、根部一道阴影
        const sl = cl - 24 - 9 * Math.sin(x / 37 + 1) - n * 3; const band = Math.floor((y + x * 0.35 + Math.sin(x / 7) * 2) / 5) % 3;
        // 一座座山峰：每 ~110 像素一个尖，左坡受光（白）、右坡背光（淡蓝灰），峰脊一道线；雪里露几块石头
        const pw = 110, u = ((x + 40) % pw) / pw, ridgeY = sl - 8 - (1 - Math.abs(u - 0.5) * 2) * 36; const lit = u < 0.5;
        const rockOut = vn(x, y, 9) > 0.78 && y > ridgeY + 6;
        void ridgeY; void lit; void rockOut; const sh = vn(x, y, 22) + (n - 0.5) * 0.12; // 雪：大片平滑的明暗，不要竖线和斑点
        c = y > cl - 3 ? ROCK[3] : y < sl ? SNOW[sh > 0.62 ? 1 : sh < 0.2 ? 2 : 0] : y < sl + 3 ? SNOW[2] : ROCK[n > 0.93 ? 2 : band];
      }
      else if (ie < 1) c = WAT[3]; // 湖中间是石龟（精灵画在上面），底下画成深水但不算水
      else if (ie < 1.14 && lake) { this.water[y * W + x] = 1; c = WAT[2]; }
      else if (q < 1) {
        this.water[y * W + x] = 1;
        const depth = lake ? Math.min(4, Math.floor((1 - q) * 6.5 + (vn(x, y, 38) - 0.5) * 1.1 + (n - 0.5) * 0.3 + 0.4)) : Math.min(4, Math.floor((1 - q) * 9 + n2 * 0.6)); c = WAT[Math.max(0, depth)]; // 湖大，按格子随机会一块块的，改平滑噪声
        if (q > 0.965) c = FOAM; else if (q > 0.93 && n > 0.55) c = WAT[0];
      } else if (q < 1.055) c = lake ? SAND[hash2(x >> 1, y >> 1) > 0.7 ? 2 : hash2(x >> 1, y >> 1) < 0.25 ? 1 : 0] : SAND[n < 0.12 ? 1 : n > 0.9 ? 2 : 0]; // 湖：灰石子岸
      else if (pathAt(x, y)) { const e = Math.abs(x - (384 + Math.sin(y * 0.045) * 6)); c = DIRT[e > 13 ? 1 : n > 0.93 ? 2 : n < 0.06 ? 1 : 0]; }
      else {
        const f = vn(x, y, 46) * 0.62 + vn(x + 311, y + 97, 15) * 0.38 - (q < 1.16 ? 0.12 : 0);
        const k = Math.max(0, Math.min(3, Math.floor(f * 4.4 - 0.7 + (n - 0.5) * 0.45)));
        c = GR[k]; void n2;
      }
      const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const r = rng(26);
    const px = (x: number, y: number, c: string, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, w, h); };
    // 草叶小簇
    for (let i = 0; i < 700; i++) { const x = r() * W, y = r() * H; if (pondQ(x, y) < 1.12 || pathAt(x, y) || (lake && y < lakeCliff(x) + 2)) continue; px(x, y, lake ? "#8a6a2a" : "#5f7f2c"); px(x + 2, y - 1, lake ? "#8a6a2a" : "#5f7f2c"); px(x + 1, y - 2, lake ? "#e0c46a" : "#b3c948"); }
    // 小花（主粉 + 白 + 一点黄）
    const FL = ["#f59ab8", "#f59ab8", "#ffffff", "#ffd66b", "#f7b6cc"];
    if (lake) for (let i = 0; i < 420; i++) { const x = r() * W, y = r() * H; if (pondQ(x, y) < 1.08 || y < lakeCliff(x) + 2) continue; const c = ["#c9502c", "#e0813a", "#eeb04a", "#a83c26"][(r() * 4) | 0]; px(x, y, c, 2, 1); if (r() < 0.5) px(x + 1, y - 1, c); } // 地上的落叶
    else for (let i = 0; i < 140; i++) { const x = r() * W, y = r() * H; if (pondQ(x, y) < 1.15 || pathAt(x, y) || y < 30) continue; const c = FL[(r() * FL.length) | 0]; px(x, y, c); px(x - 1, y + 1, c); px(x + 1, y + 1, c); px(x, y + 2, c); px(x, y + 1, "#ffe08a"); px(x, y + 3, "#5f7f2c"); }
    // 栈桥：木板 + 桩
    const dy1 = PC.y + RY + 16;
    if (lake) { // 湖：一块块青石板铺出去的码头
      for (let y = DOCK.y0; y < dy1; y++) for (let x = DOCK.x0; x < DOCK.x1; x++) { const row = Math.floor((y - DOCK.y0) / 9), col = Math.floor((x - DOCK.x0 + (row % 2) * 6) / 12); const ex = (x - DOCK.x0 + (row % 2) * 6) % 12, ey = (y - DOCK.y0) % 9; const k = hash2(row, col); const c = ex === 0 || ey === 0 ? "#6f7a78" : ey === 1 ? "#c3cbc4" : k > 0.66 ? "#a9b3ac" : k > 0.33 ? "#9aa59f" : "#b3bcb4"; px(x, y, hash2(x, y) > 0.96 ? "#88a06a" : c); }
      for (let x = DOCK.x0; x < DOCK.x1; x++) px(x, dy1, "#5d6664"); for (let y = DOCK.y0; y < dy1; y++) { px(DOCK.x0 - 1, y, "#d8f2f5"); px(DOCK.x1, y, "#d8f2f5"); }
    } else
    for (let y = DOCK.y0; y < dy1; y++) for (let x = DOCK.x0; x < DOCK.x1; x++) { const plank = ((y - DOCK.y0) % 6); const c = plank === 5 ? "#7d5335" : x === DOCK.x0 || x === DOCK.x1 - 1 ? "#8a5d3b" : hash2(x, y) > 0.9 ? "#c29062" : plank === 0 ? "#c99668" : "#b07d52"; px(x, y, c); }
    if (!lake) for (const [x, y] of [[DOCK.x0 - 2, DOCK.y0 + 2], [DOCK.x1 - 1, DOCK.y0 + 2], [DOCK.x0 - 2, DOCK.y0 + 40], [DOCK.x1 - 1, DOCK.y0 + 40]]) { px(x, y, "#6a4630", 3, 7); px(x, y, "#8a5d3b", 3, 1); px(x - 1, y + 7, "#d8f2f5", 5, 1); }
    this.ground = cv;
    // 场景物件（都从 props 图集里画；r = 挡路半径，flat = 贴地画、不参与前后遮挡）
    const add = (kind: Prop["kind"], x: number, y: number, r = 0, flat = false) => this.props.push({ kind, x, y, r, flat, flip: hash2(x | 0, y | 0) > 0.5 });
    const busy = (x: number, y: number, d: number) => this.props.some(p => !p.flat && Math.hypot(p.x - x, p.y - y) < d);
    const free = (x: number, y: number, m: number, d = 30) => pondQ(x, y) > 1.12 + m && !pathAt(x, y) && !(Math.abs(x - 384) < 44 && y > 400) && !busy(x, y, d);
    const rt = rng(99);
    // 荷叶（几片开粉莲花）、岸边芦苇
    for (let i = 0; i < (lake ? 0 : 9); i++) { const a = rt() * 6.28, k = 0.45 + rt() * 0.4; const x = PC.x + Math.cos(a) * RX * k, y = PC.y + Math.sin(a) * RY * k; if (Math.abs(x - 384) < 40 && y > PC.y - 10 || inIsle(x, y) < 1.8) continue; add("lily", x, y, 0, true); }
    if (lake) { // 湖心亭；山脚一排松树
      add("turtle", ISLE!.x, ISLE!.y + 24, 0); this.turtleHead = { x: ISLE!.x - 41, y: ISLE!.y - 1 };
      for (let x = 20; x < W - 10; x += 22 + rt() * 26) { const y = lakeCliff(x) + 12 + rt() * 22; if (pondQ(x, y) > 1.2) add("pine", x, y, 6); }
    }
    for (let i = 0; i < (lake ? 14 : 9); i++) { const a = rt() * 6.28; if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.45) continue; let k = 1; for (; k > 0.8; k -= 0.005) if (pondQ(PC.x + Math.cos(a) * RX * k, PC.y + Math.sin(a) * RY * k) < 0.97) break; add(lake ? "pampas" : "reeds", PC.x + Math.cos(a) * RX * k, PC.y + Math.sin(a) * RY * k + 6); }
    // 树：沿着地图四周一圈，中间零星几棵；粉花树少放几棵当点缀
    const TREES: Prop["kind"][] = lake ? ["treeBig", "tree", "pine", "tree", "pine", "treeSmall"] : ["treeBig", "tree", "tree", "treeBig", "treeSmall", "treePink"];
    for (let i = 0; i < 90 && this.props.filter(p => p.kind.startsWith("tree")).length < 26; i++) { const edge = rt(); const x = edge < 0.5 ? (rt() < 0.5 ? 16 + rt() * 70 : W - 16 - rt() * 70) : 30 + rt() * (W - 60); const y = edge < 0.5 ? 70 + rt() * (H - 70) : (rt() < 0.6 ? 60 + rt() * 40 : H - rt() * 24); if (free(x, y, 0.25, 46)) add(TREES[(rt() * TREES.length) | 0], x, y, 9); }
    for (let i = 0; i < 50; i++) { const x = 40 + rt() * (W - 80), y = 70 + rt() * (H - 90); if (free(x, y, 0.15, 36)) add(rt() < 0.4 ? "bushFlower" : "bush", x, y, 11); if (this.props.filter(p => p.kind.startsWith("bush")).length >= 10) break; }
    for (let i = 0; i < 60; i++) { const x = 30 + rt() * (W - 60), y = 50 + rt() * (H - 60); if (free(x, y, 0.04, 22) && !(lake && y < lakeCliff(x) + 10)) { const k = rt(); add(k < 0.35 ? "grass" : k < 0.6 ? (lake ? "pebbles" : "flowers") : k < 0.78 ? "pebbles" : k < 0.9 ? "rock" : "stump", x, y, k >= 0.6 && k < 0.78 ? 0 : k < 0.6 ? 0 : 8); } if (this.props.length > 90) break; }
    add("lamp", DOCK.x0 - 14, PC.y + RY + 30, 4); add("lamp", DOCK.x1 + 14, PC.y + RY + 30, 4);
    this.signPos = { x: DOCK.x1 + 40, y: PC.y + RY + 50 }; add("sign", this.signPos.x, this.signPos.y, 6); if (!lake) add("bucket", DOCK.x0 - 34, PC.y + RY + 44, 5);
    if (lake) { this.props = this.props.filter(q => !(q.y < lakeCliff(q.x) + 8)); return; } // 山上不长东西
    // 秤砣的小摊那块地空出来（树、灌木、石头都挪走）
    this.props = this.props.filter(q => !(Math.abs(q.x - SHOP_POS.x) < 92 && q.y > SHOP_POS.y - 118 && q.y < SHOP_POS.y + 20) && !(Math.abs(q.x - PEL_POS.x) < (q.kind.startsWith("tree") ? 58 : 34) && q.y > PEL_POS.y - 60 && q.y < PEL_POS.y + (q.kind.startsWith("tree") ? 90 : 26)));
  }

  // ─── 钓鱼 ───
  /** 附近有水吗（任一方向 26 像素内），有就返回朝哪边 */
  waterDir(): Dir | -1 { const m = this.me; let best: Dir | -1 = -1, bd = 99; for (const d of [0, 1, 2, 3] as Dir[]) for (let k = 6; k <= 30; k += 2) { if (this.isWater(m.x + DV[d][0] * k, m.y - 4 + DV[d][1] * k)) { const kk = k + (d === m.dir ? -4 : 0); if (kk < bd) { bd = kk; best = d; } break; } } return best; }
  faceWater() { const d = this.waterDir(); if (d !== -1) this.me.dir = d; }
  /** 落点：沿瞄的方向（没瞄就是面朝的方向）按力度往外找，最远的一格水；这个方向上没水就退回面朝水的方向 */
  landPoint(power: number) {
    const m = this.me; const want = 26 + power * 130;
    const ray = (dx: number, dy: number) => { let lastW: { x: number; y: number } | null = null;
      for (let k = 8; k <= want; k += 2) { const x = m.x + dx * k, y = m.y - 6 + dy * k * 0.9; if (this.isWater(x, y) && !this.onDock(x, y + 6)) lastW = { x, y }; else if (lastW) break; }
      return lastW; };
    // 这个方向没水时原来直接落在人面前的地上（「我在地上也能钓鱼吗」）。现在换成面朝水的方向，还没有就返回 null（不甩）
    const [dx, dy] = DV[m.dir]; const hit = ray(dx, dy); if (hit) return hit;
    const wd = this.waterDir(); if (wd === -1 || wd === m.dir) return null;
    const hit2 = ray(DV[wd][0], DV[wd][1]); if (hit2) m.dir = wd; return hit2;
  }
  setAim(on: boolean) { this.aiming = on; this.me.rod = on || !!this.bobber; if (on) { this.faceWater(); const lp = this.landPoint(0.35); this.aimPt = lp ?? { x: this.me.x + DV[this.me.dir][0] * 28, y: this.me.y - 6 + DV[this.me.dir][1] * 26 }; } else this.aimPt = null; }
  /** 挪落点圈（世界像素）：离人最远 AIM_MAX，人跟着转向圈的方向 */
  moveAim(dx: number, dy: number) {
    const m = this.me; const p = this.aimPt ?? this.landPoint(0.35) ?? { x: m.x, y: m.y - 6 }; let x = p.x + dx, y = p.y + dy;
    const ox = x - m.x, oy = y - (m.y - 6); const L = Math.hypot(ox, oy); if (L > PixelWorld.AIM_MAX) { x = m.x + (ox / L) * PixelWorld.AIM_MAX; y = m.y - 6 + (oy / L) * PixelWorld.AIM_MAX; }
    x = Math.max(4, Math.min(this.mw - 4, x)); y = Math.max(4, Math.min(this.mh - 4, y)); this.aimPt = { x, y };
    if (Math.hypot(x - m.x, y - m.y + 6) > 6) m.dir = this.dirOf(Math.atan2(y - m.y + 6, x - m.x));
  }
  /** 手指在屏幕上挪的 CSS 像素 → 世界像素 */
  moveAimCss(dx: number, dy: number) { const k = this.scale / (window.devicePixelRatio || 1); this.moveAim(dx / k, dy / k); }
  aimOk() { const p = this.aimPt; return !!p && this.isWater(p.x, p.y) && !this.onDock(p.x, p.y + 6); }
  aimPower() { const p = this.aimPt; if (!p) return 0.35; return Math.min(1, Math.hypot(p.x - this.me.x, p.y - this.me.y + 6) / PixelWorld.AIM_MAX); }
  /** 松手：圈在水里就甩到圈那儿；圈在岸上就沿着人到圈的方向找最近的水 */
  aimTarget() {
    const m = this.me; const p = this.aimPt; if (!p) return this.landPoint(0.35); if (this.aimOk()) return p;
    const L = Math.hypot(p.x - m.x, p.y - m.y + 6) || 1; const ux = (p.x - m.x) / L, uy = (p.y - m.y + 6) / L;
    for (let k = 8; k <= PixelWorld.AIM_MAX; k += 2) { const x = m.x + ux * k, y = m.y - 6 + uy * k; if (this.isWater(x, y) && !this.onDock(x, y + 6)) return { x, y }; }
    return this.landPoint(0.35);
  }
  /** 瞄的方向 → 人朝哪边（四个方向里最近的） */
  dirOf(ang: number): Dir { const c = Math.cos(ang), s = Math.sin(ang); return Math.abs(c) > Math.abs(s) ? (c < 0 ? 1 : 2) : (s < 0 ? 3 : 0); }
  stepN = 0;
  sfx(name: string, arg = 0, x = this.me.x, y = this.me.y) { this.opts.onSfx?.(name, arg, x, y); }
  castTo(p: { x: number; y: number }) { this.sfx("cast"); const tip = this.rodTip(this.me); this.bobber = { x: tip.x, y: tip.y, fx: tip.x, fy: tip.y, t: 0, phase: "fly" }; (this.bobber as unknown as { to: typeof p }).to = p; this.me.rod = true; this.aiming = false; }
  setBite(on: boolean) { if (!this.bobber) return; this.bobber.phase = on ? "bite" : "float"; if (on) { this.sfx("bite", 0, this.bobber.x, this.bobber.y); this.splash(this.bobber.x, this.bobber.y, 8, "#e3f6f5"); this.rings.push({ x: this.bobber.x, y: this.bobber.y, t: 0, max: 0.8, c: "#ffffff" }); } }
  setFight(k: number, tension: number) { if (!this.bobber) return; this.bobber.phase = "fight"; this.bobber.fight = { k, tension }; }
  clearBobber(result?: "landed" | "snapped" | "escaped") {
    const b = this.bobber; this.bobber = null; this.me.rod = false;
    if (b && result === "landed") { this.splash(b.x, b.y, 14, "#e3f6f5"); }
    if (b && result === "snapped") { this.shake = 0.35; this.splash(b.x, b.y, 6, "#ffffff"); }
  }
  /** 坐一会儿：抱着坐垫坐下，两帧慢慢晃（走一步 / 再点一次就站起来） */
  sit(who: Who, on = true) {
    const a = who === "player" ? this.me : this.ai[who]; if (!a) return;
    if (on) { if (a.rest != null) return; a.rest = this.t; a.rod = false; a.bob = null; a.moving = 0; a.act = -1; if (a !== this.me) a.goal = null; this.sfx("boing", 0, a.x, a.y);
      for (let i = 0; i < 8; i++) this.parts.push({ x: a.x + (Math.random() - 0.5) * 30, y: a.y - 2, vx: (Math.random() - 0.5) * 24, vy: -8 - Math.random() * 10, life: 0, max: 0.5, c: i % 2 ? "#ffd3e0" : "#fff4f8", g: 30 }); }
    else if (a.rest != null) { a.rest = null; a.actUntil = this.t + 0.25; this.sfx("tap", 0, a.x, a.y); for (let i = 0; i < 5; i++) this.parts.push({ x: a.x + (Math.random() - 0.5) * 20, y: a.y - 3, vx: (Math.random() - 0.5) * 16, vy: -6, life: 0, max: 0.4, c: "#fff4f8", g: 20 }); }
  }
  sittingOf(who: Who) { const a = who === "player" ? this.me : this.ai[who]; return a?.rest != null; }
  celebrate(who: Who, rarity: number, sp?: string) {
    const a = who === "player" ? this.me : this.ai[who]; a.fish = { c: RARITY_PX[rarity] ?? RARITY_PX[0], sp, until: this.t + 3.2 }; if (sp) this.fishCanvas(sp);
    if (who === "player" && this.sheets.player.m.hold) { a.act = 3; a.actUntil = this.t + 2.6; } // 图里画了举鱼那帧才举；标准小人图没有 → 鱼浮在头顶蹦
    // 伙伴甲 / 放下竿、转过来、双手把鱼举过头顶（蹦两下），3 秒后放下接着钓——不会一直举着
    else if (this.sheets[who].m.hold) { a.act = 4; a.actUntil = this.t + 3; a.rod = false; a.goal = null; a.moving = 0; a.fish = { ...a.fish!, until: a.actUntil, t0: this.t }; }
    for (let i = 0; i < 16; i++) { const an = (i / 16) * 6.28; this.parts.push({ x: a.x, y: a.y - 48, vx: Math.cos(an) * 40, vy: Math.sin(an) * 40 - 20, life: 0, max: 0.8, c: i % 2 ? "#ffd66b" : "#f59ab8", g: 60 }); }
  }
  splash(x: number, y: number, n: number, c: string) { for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + Math.random() * 0.7); const v = 25 + Math.random() * 35; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.3, c, g: 140 }); } this.rings.push({ x, y, t: 0, max: 1.1, c: "#e3f6f5" }); }

  // ─── 每帧 ───
  loop = () => { this.raf = requestAnimationFrame(this.loop); const now = performance.now(); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt; this.update(dt); this.draw(); };
  update(dt: number) {
    const m = this.me; let jx = this.joy.x, jy = this.joy.y;
    const K = this.keys; if (K.size) { jx += (K.has("d") || K.has("arrowright") ? 1 : 0) - (K.has("a") || K.has("arrowleft") ? 1 : 0); jy += (K.has("s") || K.has("arrowdown") ? 1 : 0) - (K.has("w") || K.has("arrowup") ? 1 : 0); }
    const mag = Math.min(1, Math.hypot(jx, jy)); m.moving = 0;
    // 蓄力中：摇杆不走路，改成转落点（慢慢跟过去，不会一下甩到背后）
    if (this.aiming && mag > 0.12) this.moveAim(jx * 110 * dt, jy * 110 * dt);
    if (mag > 0.12 && m.rest != null) this.sit("player", false); // 摇杆一推就站起来
    if (mag > 0.12 && m.cact) m.cact = null; // 用家具的动作：推摇杆就停
    if (this.scene === "farm") this.farmStep(dt);
    if (this.scene === "cabin" && mag > 0.3 && m.path?.some(q => q.go)) { m.path = null; this.thSel = null; } // 点家具自己走的路上推摇杆 = 不去了
    const riding = (this.scene === "farm" && (this.farmPath(dt) || this.farmRide(jy))) || (this.scene === "cabin" && this.farmPath(dt)); if (this.scene === "cabin") { this.thAmbient(); }
    if (!riding && mag > 0.12 && !m.rod && this.t > m.actUntil) {
      let sp = 78 * mag; let vx = (jx / (Math.hypot(jx, jy) || 1)) * sp, vy = (jy / (Math.hypot(jx, jy) || 1)) * sp;
      // 伞顶走路还是卡脚——手机摇杆推不正，带一点上下就被推出那条窄路。伞顶 / 门廊是一条线的台子：只认左右，上下交给大按钮
      if ((this.scene === "farm" && this.farmOnLine(m.x, m.y)) || this.scene === "cabin") { sp = Math.abs(jx) > 0.15 ? 78 * Math.min(1, Math.abs(jx) * 1.4) : 0; vx = Math.sign(jx) * sp; vy = 0; }
      const nx = m.x + vx * dt, ny = m.y + vy * dt + (this.scene === "farm" ? this.farmSlope(m.x, m.x + vx * dt, m.y) : 0);
      const ok = (x: number, y: number) => this.walkable(x, y) && !this.bumps(m, x, y);
      if (ok(nx, ny)) { m.x = nx; m.y = ny; } else if (ok(nx, m.y)) m.x = nx; else if (ok(m.x, ny)) m.y = ny;
      m.dir = Math.abs(jx) > Math.abs(jy) * 1.1 ? (jx < 0 ? 1 : 2) : (jy < 0 ? 3 : 0); m.moving = mag; m.walkT += (sp * dt) / 11; if (Math.floor(m.walkT / 2) !== this.stepN) { this.stepN = Math.floor(m.walkT / 2); this.sfx("step", this.onDock(m.x, m.y) ? (this.scene === "lake" || this.scene === "river" ? 3 : 2) : this.scene === "sea" ? 1 : this.scene === "river" && riverE(m.x, m.y) < CURB + WALK ? 3 : 0, m.x, m.y); } // 按走过的距离换帧：每走 11 像素换一帧，快慢都不会滑步
      if (Math.random() < dt * 6 * mag) this.parts.push({ x: m.x + (Math.random() - 0.5) * 8, y: m.y, vx: -vx * 0.1, vy: -6, life: 0, max: 0.45, c: this.onDock(m.x, m.y) ? "#d6b28a" : "#b9dca0" });
    } else m.walkT = 0;
    // 伙伴甲 / 偶尔做个小动作
    for (const a of Object.values(this.ai)) if (a.x > -5000) this.aiStep(a, dt); // 在别的钓点的不走
    // 天气慢慢变
    const tg = WX_TARGET[this.weather] ?? WX_TARGET["晴"]; const k = this.wxInit ? Math.min(1, dt / 25) : 1; this.wxInit = true;
    for (const key of ["rain", "fog", "cloud", "wind"] as const) this.wx[key] += (tg[key] - this.wx[key]) * k;
    // 浮漂
    const b = this.bobber as (PixelWorld["bobber"] & { to?: { x: number; y: number } }) | null;
    if (b) {
      b.t += dt;
      if (b.phase === "fly" && b.to) { const k = Math.min(1, b.t / 0.6); b.x = b.fx + (b.to.x - b.fx) * k; b.y = b.fy + (b.to.y - b.fy) * k - Math.sin(k * Math.PI) * 34; if (k >= 1) { this.sfx("plop", 0, b.to.x, b.to.y); b.phase = "float"; b.x = b.to.x; b.y = b.to.y; this.splash(b.x, b.y, 6, "#e3f6f5"); } }
      if (b.phase === "fight" && b.fight && b.to) { const tip = this.rodTip(m); const k = Math.min(0.85, b.fight.k); const tx = b.to.x + (tip.x - b.to.x) * k, ty = b.to.y + (tip.y + 18 - b.to.y) * k; b.x += (tx - b.x) * Math.min(1, dt * 6) + Math.sin(this.t * 30) * b.fight.tension * 0.8; b.y += (ty - b.y) * Math.min(1, dt * 6); if (Math.random() < dt * 8) this.parts.push({ x: b.x + (Math.random() - 0.5) * 6, y: b.y, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, life: 0, max: 0.4, c: "#e3f6f5", g: 120 }); }
      if ((b.phase === "float" || b.phase === "bite") && Math.random() < dt * (b.phase === "bite" ? 5 : 0.7)) this.rings.push({ x: b.x, y: b.y, t: 0, max: 1, c: "#e3f6f5" });
    }
    // 伙伴甲 / 咬钩时浮漂周围起涟漪，拉鱼时时不时溅水花；刚咬钩那一下溅一下
    for (const a of Object.values(this.ai)) {
      const act = a.srvAct; if (a.bob && act !== a.lastAct && (act === "bite" || act === "hooked")) this.splash(a.bob.x, a.bob.y, act === "hooked" ? 10 : 6, "#e3f6f5");
      a.lastAct = act; if (!a.bob || !a.rod) continue;
      if (act === "bite" && Math.random() < dt * 5) this.rings.push({ x: a.bob.x, y: a.bob.y, t: 0, max: 0.9, c: "#e3f6f5" });
      if (act === "hooked" && Math.random() < dt * 2.2) this.splash(a.bob.x + Math.sin(this.t * 7 + a.x) * 4, a.bob.y, 4, "#e3f6f5");
    }
    // 偶尔有鱼跳
    if (Math.random() < dt / 5) { const a = Math.random() * 6.28, k = Math.random() * 0.75; const ry = 20 + Math.random() * (this.mh - 40); const x = this.scene === "river" ? rcx(ry) + (Math.random() - 0.5) * 1.4 * rhw(ry) : this.scene === "sea" ? Math.random() * MAP_W : PC.x + Math.cos(a) * RX * k, y = this.scene === "river" ? ry : this.scene === "sea" ? seaShore(x) + 40 + Math.random() * 180 : PC.y + Math.sin(a) * RY * k; if (this.isWater(x, y)) { this.rings.push({ x, y, t: 0, max: 1.3, c: "#d8f2f5" }); this.splash(x, y, 3, "#d8f2f5"); } }
    if (this.scene === "river") this.riverStep(dt);
    for (const p of this.parts) { p.life += dt; if (p.life < 0) continue; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 0) * dt; } // life < 0 = 还没开始（摇伞的水珠一颗颗错开落）
    this.parts = this.parts.filter(p => p.life < p.max); for (const r of this.rings) r.t += dt; this.rings = this.rings.filter(r => r.t < r.max);
    this.shake = Math.max(0, this.shake - dt);
    // 镜头：直接锁在人身上（按取整后的位置算）。原来是慢慢追，人和镜头各自取整，放大后人会 1 格 1 格来回抖（试玩反馈"走起来卡卡的"）
    const fc = this.camFocus ?? m; this.cam.x = fc.x - this.vw / 2; this.cam.y = fc.y - 30 - this.vh / 2;
    const cl = (v: number, span: number, view: number) => (view >= span ? (span - view) / 2 : Math.max(0, Math.min(span - view, v)));
    this.cam.x = this.scene === "farm" ? FX0 + cl(this.cam.x - FX0, FX1 - FX0, this.vw) : cl(this.cam.x, this.mw, this.vw); this.cam.y = cl(this.cam.y, this.mh, this.vh);
  }
  /** 伙伴甲 / 钓一会儿 → 偶尔做个小动作 → 过一阵收竿，沿着岸走到别的钓点 */
  /** 小屋里的伙伴甲 / 站在自己那件家具跟前，隔十几秒用一次（坐床的一直晃） */
  cabinAiStep(a: Actor) { if (!a.cabSpot || a.cact) return; if (this.t > (a.nextMove ?? 0)) { this.cabinAct(a.who, a.cabSpot); a.nextMove = this.t + 12 + Math.random() * 14; } }
  aiStep(a: Actor, dt: number) { if (this.scene === "cabin") { this.cabinAiStep(a); return; } if (a.rest != null) return; // 坐着就不溜达
    a.moving = 0;
    if (a.act === 4 && this.t < a.actUntil) return;
    if (a.goal == null) {
      // 试玩截图：举完鱼 / 做完小动作原来一律 rod = true，服务器说他没在钓也摆钓鱼姿势。现在按服务器：在钓就重新甩好，没钓就面朝水站着
      if (this.t > a.actUntil && a.act >= 0) { a.act = -1; if (a.srvAct && a.srvAct !== "idle") { a.bob = null; this.settle(a); } else this.faceIdle(a); }
      if (a.act < 0 && a.srvAct === "idle" && Math.random() < dt / 16) { a.act = Math.random() < 0.5 ? 2 : 3; a.actUntil = this.t + 3.2; a.rod = false; }
      if (this.aiWander && a.act < 0 && this.t > (a.nextMove ?? 0) && !(a.fish && this.t < a.fish.until)) {
        // 挑一个离自己够远、离别人也远、不在栈桥和地图最上沿的钓点
        const others = [this.me, ...Object.values(this.ai)].filter(o => o !== a);
        for (let i = 0; i < 24; i++) {
          const g = (a.ang ?? 0) + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 1.6); const p = this.bank(g);
          if (!this.goodSpot(p)) continue;
          if (others.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 50)) continue;
          a.goal = g; a.rod = false; a.bob = null; a.act = -1; break;
        }
        a.nextMove = this.t + 25 + Math.random() * 45;
      }
      return;
    }
    // 沿岸走：角度一点点挪，速度大约 36 像素 / 秒
    const cur = a.ang ?? 0; const d = a.goal - cur;
    if (Math.abs(d) < 0.004) { a.ang = a.goal; a.goal = null; if (a.srvAct && a.srvAct !== "idle") this.settle(a); else this.faceIdle(a); return; }
    const p0 = this.bank(cur); const step = Math.sign(d) * Math.min(Math.abs(d), 0.02); const p1 = this.bank(cur + step); const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const k = Math.min(1, (36 * dt) / len); const na = cur + step * k;
    // 有人挡在岸边：往外（离水远的一侧）绕一个弧过去；没人挡了再慢慢收回岸边
    let off = a.off ?? 0; let np = this.bank(na, 15 + off); let detour = false;
    if (this.bumps(a, np.x, np.y)) { detour = true; off = Math.min(30, off + 40 * dt); np = this.bank(cur + step * k * 0.4, 15 + off); if (this.bumps(a, np.x, np.y) || !this.walkable(np.x, np.y)) { a.off = off; a.walkT = 0; return; } }
    else off = Math.max(0, off - 18 * dt);
    a.off = off;
    const vx = np.x - a.x, vy = np.y - a.y; a.x = np.x; a.y = np.y; a.ang = detour ? cur + step * k * 0.4 : na;
    // 朝向：新方向要连续保持 0.18 秒才换（岸是弯的，沿岸走 x/y 谁大谁小会来回跳，人就一帧朝左一帧朝下）
    const want: Dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : (vy < 0 ? 3 : 0);
    if (want !== a.dir) { a.dirHold = (a.dirHold ?? 0) + dt; if (a.dirHold > 0.18) { a.dir = want; a.dirHold = 0; } } else a.dirHold = 0;
    a.moving = 1; a.walkT += Math.hypot(vx, vy) / 11;
  }
  /** 朝左 / 朝右钓鱼时用图里画好的那套钓鱼姿势，竿是画好的，竿尖位置在 meta.rt */
  castPose(a: Actor) { const m = this.sheets[a.who].m; if (!a.rod || a.moving || (a.act >= 0 && this.t < a.actUntil)) return false; return a.dir === 1 || a.dir === 2 ? !!m.rt : !!(m.pose && m.prt); }
  rodTip(a: Actor) {
    if (this.castPose(a) && (a.dir === 0 || a.dir === 3)) { const m = this.sheets[a.who].m; const [, , , pax, pby] = m.pose!; const [tx, ty] = m.prt![a.dir === 0 ? 0 : 1]; return { x: a.x - pax + tx, y: a.y - pby + ty }; }
    if (this.castPose(a)) { const m = this.sheets[a.who].m; const [tx, ty] = m.rt!; return { x: a.dir === 2 ? a.x - m.aax + tx : a.x + m.aax - tx, y: a.y - m.ah + 1 + ty }; }
    const [dx, dy] = DV[a.dir]; const h = this.hand(a); const up = a.dir === 0 || a.dir === 3; return { x: h.x + dx * 20 + (up ? 6 : 0), y: h.y + dy * 12 - (up ? 34 : 18) }; } // 标准小人头大：朝上 / 朝下时竿尖要高过头顶，不然竿全被头挡住
  hand(a: Actor) { return a.dir === 1 ? { x: a.x - 7, y: a.y - 22 } : a.dir === 2 ? { x: a.x + 7, y: a.y - 22 } : a.dir === 3 ? { x: a.x - 8, y: a.y - 24 } : { x: a.x + 8, y: a.y - 21 }; }

  draw() {
    const g = this.g; const sx = this.shake ? (Math.random() - 0.5) * 4 : 0;
    const S = this.scale; const cx = this.rp(this.cam.x + sx), cy = this.rp(this.cam.y); const t = this.t;
    g.setTransform(S, 0, 0, S, 0, 0); g.fillStyle = "#6a8c30"; g.fillRect(0, 0, this.vw, this.vh);
    g.setTransform(S, 0, 0, S, -cx * S, -cy * S);
    g.drawImage(this.ground, this.groundX, 0);
    if (this.scene === "farm") this.drawTreeBack();
    if (this.scene === "cabin") { const sh = this.thImg.shell; if (sh?.complete && sh.naturalWidth) { g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high"; g.drawImage(sh, 0, 0, TH_W, TH_H); g.restore(); }
      this.drawGuests(); this.drawTube(); this.drawThDoor(); this.drawIous(); for (const f of this.furnOrder()[0]) this.drawFurn(f);
      for (const [slot, id] of Object.entries(this.thDecor)) { const P = TH_DECOR[slot], im = id ? this.decorImg[id] : null; if (!P || !im?.complete || !im.naturalWidth) continue; const w = (im.naturalWidth / im.naturalHeight) * P.h; g.save(); g.imageSmoothingEnabled = true; g.translate(P.x, P.hang ? P.y : P.y - P.h); if (P.hang) g.rotate(Math.sin(t * 1.1 + P.x) * 0.03); g.drawImage(im, -w / 2, 0, w, P.h); g.restore(); } }
    if (this.scene === "sea") this.drawWaves(cx);
    // 水面闪光：几颗亮点按正弦明灭（夜河换成顺着流的水纹 + 漂着的河灯）
    if (this.scene === "cabin") { /* 竹管在人前面画 */ } else if (this.scene === "river") this.drawRiverWater(); else for (let i = 0; i < 40; i++) { const a = hash2(i, 3) * 6.28, k = hash2(i, 7) * 0.9; const sx = hash2(i, 11) * MAP_W; const x = (this.scene === "sea" ? sx : PC.x + Math.cos(a) * RX * k) | 0, y = (this.scene === "sea" ? seaShore(sx) + 30 + hash2(i, 13) * 200 : PC.y + Math.sin(a) * RY * k) | 0; const ph = Math.sin(t * 1.6 + i * 1.7); if (ph > 0.55 && this.isWater(x, y) && !(x >= DOCK.x0 && x <= DOCK.x1 && y >= DOCK.y0)) { g.fillStyle = ph > 0.85 ? "#ffffff" : "#bfe9f1"; g.fillRect(x, y, ph > 0.85 ? 3 : 2, 1); } }
    for (const r of this.rings) { if (r.t < 0) continue; const k = r.t / r.max; g.globalAlpha = (1 - k) * 0.85; this.pxEllipse(r.x, r.y, 2 + k * 12, 1 + k * 5, r.c); } g.globalAlpha = 1;
    // 按脚底 y 排序画
    type D = { y: number; f: () => void }; const L: D[] = [];
    const vis = (p: Prop) => !(p.x + 60 < cx || p.x - 60 > cx + this.vw || p.y - 110 > cy + this.vh || p.y + 20 < cy);
    for (const p of this.props) if (p.flat && vis(p)) this.drawProp(p);
    for (const p of this.props) if (!p.flat && vis(p)) L.push({ y: p.y, f: () => this.drawProp(p) });
    // 鱼线和浮漂跟着人一起排前后：原来最后统一画，线会压在站在前面的人身上（试玩反馈透视）
    // 背对镜头钓鱼（朝上）：竿尖在头顶，浮漂在前面的水里，线从头顶往前下到水面，在俯视画面里会横穿过人的后脑勺（试玩反馈了好几次「透视」）。
    // 朝上时先画线再画人，人把线挡住；其他方向人先画、线在前
    for (const a of [this.me, this.ai.buddy, this.ai.pal].filter(o => o.x > -5000)) L.push({ y: a.y, f: () => { if (a.dir === 3) { this.drawLine(a); this.drawActor(a); } else { this.drawActor(a); this.drawLine(a); } } });
    // 秤砣站在小摊前面左边（站柜台后面会挡住他的动作），整个人露出来
    const sk = this.stallNow(); const stallIm = this.stallImgs[sk]?.naturalWidth ? this.stallImgs[sk] : this.stallImg;
    if (sk === "closed" && this.lastStall && this.lastStall !== "closed") this.pelPlay("close"); this.lastStall = sk;
    const closing = sk === "closed" && this.pel.act === "close" && this.t - this.pel.t0 < 3.3;
    if (this.scene === "pond" && ((sk !== "closed" && sk !== "away") || closing)) L.push({ y: PEL_POS.y, f: () => this.drawPelican() }); // 打烊 / 喝茶去了：人不在
    if (this.scene === "pond" && stallIm.complete && stallIm.naturalWidth) L.push({ y: SHOP_POS.y, f: () => { const im = stallIm; this.pxEllipse(SHOP_POS.x, SHOP_POS.y - 1, 74, 6, "rgba(50,60,20,.28)", true); this.g.drawImage(im, this.rp(SHOP_POS.x - im.width / 2), this.rp(SHOP_POS.y - im.height + 1)); } });
    if (this.scene === "river") for (const b of this.rStoneLamps) L.push({ y: b.y, f: () => this.drawStoneLamp(b.x, b.y) });
    if ((this.scene as string) === "farm_old") { const B = FB; const put = (k: string, b: { x: number; y: number }) => L.push({ y: b.y, f: () => this.drawFarmB(k, b.x, b.y) });
      put("cottage", B.cottage); put("windmill", B.windmill); put("shedPlayer", B.shedPlayer); put("shedBuddy", B.shedBuddy); put("shedPal", B.shedPal); put("greenhouse", B.greenhouse); put("board", B.board); }
    L.sort((a, b) => a.y - b.y); for (const d of L) d.f();
    if (this.scene === "farm") { this.drawBasket("front"); this.drawFarmFront(); }
    if (this.scene === "cabin") { for (const f of this.furnOrder()[1]) this.drawFurn(f); }
    if (this.scene === "river") { this.drawStrings(); for (const l of this.rlamps) if (l.scoop != null) { const q = this.scoopPos(l); if (q.k < 1) this.drawRLamp(q.x, q.y, 1); } } // 灯笼串挂在高处，压在人上面；捞起来的河灯飞到玩家手上
    // 蓄力时：落点画一个粉色小圈 + 一串虚点弧线（从竿尖到落点），力度越大圈越往外
    if (this.aiming && this.aimPt) { const p = this.aimPt; const ok = this.aimOk(); const tip = this.rodTip(this.me); const n = 14;
      for (let i = 1; i < n; i++) { if (i % 2) continue; const k = i / n; const x = tip.x + (p.x - tip.x) * k, y = tip.y + (p.y - tip.y) * k - Math.sin(k * Math.PI) * 26; g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
      const pul = 1 + Math.sin(t * 8) * 0.6; const c = ok ? "#ff8fb1" : "#b8b0b4"; this.pxEllipse(p.x, p.y, 6 + pul, 2.5 + pul * 0.4, c); this.pxEllipse(p.x, p.y, 3.5, 1.5, c); this.pxEllipse(p.x, p.y, 1.5, 1, "#ffffff", true); }
    // 浮漂 + 鱼线（自己的）

    // 粒子
    for (const p of this.parts) { if (p.life < 0) continue; g.globalAlpha = 1 - p.life / p.max; g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); } g.globalAlpha = 1;
    // 湖：落叶从画面左上往右下飘，一边飘一边翻
    if (this.scene === "lake") {
      if (!this.leaves.length) { const r = rng(12); for (let i = 0; i < 26; i++) this.leaves.push({ x: r() * 400, y: r() * 300, p: r() * 6.28, c: ["#c9502c", "#e0813a", "#eeb04a", "#a83c26"][i % 4] }); }
      const sp = 1 + this.wx.wind * 2.5;
      // 水面漂着的红叶（慢慢打转），石龟隔一会儿从鼻子冒一串泡泡
      for (let i = 0; i < 18; i++) { const a = hash2(i, 31) * 6.28, k = 0.3 + hash2(i, 37) * 0.6; const x = Math.round(PC.x + Math.cos(a) * RX * k + Math.sin(t * 0.08 + i) * 10), y = Math.round(PC.y + Math.sin(a) * RY * k + Math.cos(t * 0.06 + i * 2) * 4); if (!this.isWater(x, y)) continue; g.fillStyle = "rgba(20,60,80,.25)"; g.fillRect(x, y + 1, 3, 1); g.fillStyle = ["#c9502c", "#e0813a", "#eeb04a", "#a83c26"][i % 4]; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y - 1, 1, 1); }
      if (Math.random() < 0.006) { const h = this.turtleHead; this.sfx("bubble", 0, h.x, h.y); this.rings.push({ x: h.x - 2, y: h.y + 4, t: 0, max: 1.1, c: "#e3f6f5" }); this.splash(h.x - 2, h.y + 2, 2, "#e3f6f5"); }
      for (const l of this.leaves) { const x = ((l.x + t * 14 * sp + Math.sin(t * 0.8 + l.p) * 10) % (this.vw + 20) + this.vw + 20) % (this.vw + 20) + cx - 10, y = ((l.y + t * 11 * (0.7 + (l.p % 1))) % (this.vh + 20)) + cy - 10; const flip = Math.sin(t * 3 + l.p * 2) > 0; g.fillStyle = l.c; g.fillRect(Math.round(x), Math.round(y), flip ? 2 : 1, flip ? 1 : 2); }
    }
    // 下雨
    const rain = this.wx.rain > 0.03 && this.scene !== "cabin";
    if (rain) { g.fillStyle = "rgba(210,230,255,.55)"; const nDrop = Math.round(this.drops.length * this.wx.rain); for (const d of this.drops.slice(0, nDrop)) { const x = ((d.x + t * 60) % (this.vw + 20)) + cx - 10, y = ((d.y + t * 190) % (this.vh + 20)) + cy - 10; for (let i = 0; i < d.l; i++) g.fillRect(Math.round(x - i * 0.4), Math.round(y - i), 1, 1); } if (Math.random() < 0.5 * this.wx.rain) { const x = cx + Math.random() * this.vw, y = cy + Math.random() * this.vh; if (this.isWater(x, y)) this.rings.push({ x, y, t: 0, max: 0.6, c: "#d8f2f5" }); } }
    // 阴天压暗一点；起雾：一层慢慢飘的白（两层正弦斑，雾浓的地方更白）
    if (this.wx.cloud > 0.02) { g.fillStyle = `rgba(70,80,100,${0.16 * this.wx.cloud})`; g.fillRect(cx, cy, this.vw, this.vh); }
    if (this.wx.fog > 0.02 && this.scene !== "cabin") { for (let yy = 0; yy < this.vh; yy += 6) for (let xx = 0; xx < this.vw; xx += 6) { const wx0 = cx + xx, wy0 = cy + yy; const n = Math.sin(wx0 / 53 + t * 0.12) + Math.sin(wy0 / 37 - t * 0.09) + Math.sin((wx0 + wy0) / 91 + t * 0.05); g.fillStyle = `rgba(236,240,246,${Math.max(0, Math.min(0.75, (0.35 + n * 0.12) * this.wx.fog))})`; g.fillRect(wx0, wy0, 6, 6); } }
    // 天色：乘法罩一层颜色，灯和萤火虫再加亮
    g.setTransform(S, 0, 0, S, 0, 0);
    const tint = this.tint(); if (tint) { g.globalCompositeOperation = "multiply"; g.fillStyle = tint.c; g.fillRect(0, 0, this.vw, this.vh); g.globalCompositeOperation = "source-over"; }
    if (rain) { g.fillStyle = "rgba(90,110,140,.18)"; g.fillRect(0, 0, this.vw, this.vh); }
    if (tint && tint.night > 0) {
      g.globalCompositeOperation = "lighter";
      for (const p of this.props) if (p.kind === "lamp") { const lt = this.scene === "river" ? this.lit(p.y) : 1; if (lt > 0.01) this.glow(p.x + 10 - cx, p.y - 32 - cy, 50, `rgba(255,190,110,${0.38 * tint.night * lt})`); }
      // 夜里农场和秤砣小摊的灯一点都不亮 → 灯画在天色罩之后再用「加亮」叠一层暖光
      if (this.scene === "pond") { const sk = this.stallNow(); if (sk !== "closed" && sk !== "away") { this.glow(180 - cx, 372 - cy, 46, `rgba(255,196,120,${0.75 * tint.night})`); this.glow(180 - cx, 372 - cy, 14, `rgba(255,236,190,${0.8 * tint.night})`); this.glow(250 - cx, 392 - cy, 70, `rgba(255,190,120,${0.32 * tint.night})`); } }
      if (this.scene === "farm") this.farmLights(cx, cy, tint.night);
      if (this.scene === "cabin") { const n = tint.night; const fl = 0.9 + Math.sin(t * 2.2) * 0.08; const at = (k: string, dx: number, dy: number, r: number, a: number) => { const f = TH_FURN.find(q => q.k === k); return f ? [f.x + dx, f.y + dy, r, a] : [-999, -999, 0, 0]; }; /* 灯跟着家具走（摆家具以后） */ for (const [x, y, r, a] of [at("ground_01", -10, -46, 50, 0.55), at("attic_05", 0, -17, 30, 0.6), at("attic_16", 0, -8, 36, 0.6), at("mid_16", 4, -36, 34, 0.5), at("mid_26", 0, 14, 60, 0.18), [260, 345, 85, 0.2], [900, 345, 75, 0.26], at("ground_03", 0, -74, 70, 0.26), [551, 166, 50, 0.22]]) this.glow(x - cx, y - cy, r, `rgba(255,196,120,${a * n * fl})`); this.glow(737 - cx, 340 - cy, 60, `rgba(150,215,255,${0.2 * n})`); } // 树洞小屋夜里：炉火、萤火虫罐、两间卧室、牌桌上方、圆窗、竹管微微发蓝
      else if (this.scene === "river") this.drawRiverLights(cx, cy); else for (const f of this.flies) { const x = f.x + Math.sin(t * 0.7 + f.p) * 20 - cx, y = f.y + Math.cos(t * 0.5 + f.p * 2) * 12 - cy; const on = (Math.sin(t * 2.3 + f.p * 3) + 1) / 2; this.glow(x, y, 7, `rgba(220,255,140,${0.5 * on * tint.night})`); g.fillStyle = `rgba(250,255,200,${on * tint.night})`; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
      g.globalCompositeOperation = "source-over";
    }
    // 白天：两只小蝴蝶（粉的）
    if ((!tint || tint.night < 0.3) && this.scene !== "cabin") for (let i = 0; i < 2; i++) { const x = (200 + i * 330 + Math.sin(t * 0.4 + i) * 80) - cx, y = (140 + i * 220 + Math.sin(t * 0.9 + i * 2) * 30) - cy; const w = Math.sin(t * 14 + i) > 0 ? 1 : 0; g.fillStyle = i ? "#f59ab8" : "#ffffff"; g.fillRect(Math.round(x - 1 - w), Math.round(y), 1 + w, 2); g.fillRect(Math.round(x + 1), Math.round(y), 1 + w, 2); g.fillStyle = "#4a3a40"; g.fillRect(Math.round(x), Math.round(y), 1, 2); }
    // 给 React 的头顶位置
    if (this.opts.onFrame) { const pos: Record<string, { x: number; y: number }> = {}; for (const a of [this.me, this.ai.buddy, this.ai.pal]) pos[a.who] = this.toCss(a.x, a.y - (a.rest != null ? (this.restImg[a.who]?.naturalHeight || 46) - 4 : (this.sheets[a.who].m.ch - 2) + (a.act === 4 && this.t < a.actUntil ? 16 : 0)) * (this.scene === "farm" ? PEOPLE_K : 1)); /* 举鱼时名牌 / 气泡往上让，别压着鱼 */ pos.pel = this.scene === "pond" ? this.toCss(PEL_POS.x, PEL_POS.y - 66) : { x: -9999, y: -9999 }; pos.note = this.scene === "cabin" ? this.toCss(TH_NOTE.x, TH_NOTE.y) : { x: -9999, y: -9999 }; pos.chalk = this.scene === "cabin" ? this.toCss(TH_CHALK.x, TH_CHALK.y) : { x: -9999, y: -9999 }; this.animalBubs = this.scene === "farm" && this.animals ? this.animals.bubbles().map(b => ({ ...b, ...this.toCss(b.x, b.y) })) : []; pos.pot = this.scene === "farm" ? this.toCss(FPOT.player, fWalkY(FPOT.player) + 8 - (this.treeOk("potPlayerE")?.height ?? 40) - 4) : { x: -9999, y: -9999 }; for (const k of ["buddy", "pal"] as const) if (this.ai[k].x < -5000) pos[k] = { x: -9999, y: -9999 }; this.opts.onFrame(pos); }
  }
  tint(): { c: string; night: number } | null {
    if (this.scene === "cabin") { const h = this.hour; const n = h >= 19.5 || h < 5 ? 1 : h >= 17.5 ? (h - 17.5) / 2 : h < 6.5 ? 1 - (h - 5) / 1.5 : 0; return n > 0.01 ? { c: mixc("#ffffff", "#b7a6cf", n), night: n } : null; } // 屋里夜里只暗一点、偏暖紫
    if (this.scene === "river") { const k = this.closeT < 0 ? 0 : Math.max(0, Math.min(1, (this.t - this.closeT - 5) / 3)); return k ? { c: mixc("#5d67ae", "#f3d8cc", k * 0.8), night: 1 - k * 0.8 } : { c: "#5d67ae", night: 1 }; } // 夜河只在夜里开，一直是夜色；散场后慢慢亮成清晨
    const h = this.hour; // 6–17 白天；17–19.5 黄昏；19.5–5 夜；5–6 清晨
    if (h >= 6.5 && h < 16.5) return null;
    if (h >= 16.5 && h < 18.5) { const k = (h - 16.5) / 2; return { c: mixc("#ffffff", "#ffc9a8", k), night: 0 }; }
    if (h >= 18.5 && h < 20) { const k = (h - 18.5) / 1.5; return { c: mixc("#ffc9a8", "#6a74b8", k), night: k }; }
    if (h >= 5 && h < 6.5) { const k = (h - 5) / 1.5; return { c: mixc("#6a74b8", "#ffe2d0", k), night: 1 - k }; }
    return { c: "#5f6ab0", night: 1 };
  }
  glow(x: number, y: number, r: number, c: string) { const g = this.g; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  pxEllipse(cx: number, cy: number, rx: number, ry: number, c: string, fill = false) {
    const g = this.g; g.fillStyle = c;
    if (fill) { for (let y = -Math.ceil(ry); y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1); } return; }
    const n = Math.max(12, Math.round((rx + ry) * 2)); for (let i = 0; i < n; i++) { const a = (i / n) * 6.28; g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1); }
  }
  /** 图集里没有的：松树、湖心亭（程序画一次存着） */
  sprCache: Record<string, HTMLCanvasElement> = {};
  turtleHead = { x: 0, y: 0 };
  spr(kind: "pine" | "turtle" | "pampas" | "bonsai" | "pole" | "willow" | "willowT") {
    if (this.sprCache[kind]) return this.sprCache[kind];
    const c = document.createElement("canvas"); const g = c.getContext("2d")!; const px = (x: number, y: number, col: string, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    if (kind === "pine") {
      c.width = 30; c.height = 56; px(13, 44, "#5a3e2a", 4, 12); px(14, 44, "#7a553a", 1, 12);
      const G = ["#24483a", "#2f5c47", "#3f7457", "#5a9068"];
      for (let tier = 0; tier < 4; tier++) { const top = 2 + tier * 10, hh = 16, half = 5 + tier * 3; for (let y = 0; y < hh; y++) { const w = Math.round(1 + (half * y) / hh); for (let x = -w; x <= w; x++) { const edge = x === -w || x === w || y === hh - 1; px(15 + x, top + y, edge ? G[0] : x < -w / 3 ? (hash2(x + 40, y + tier * 20) > 0.7 ? G[2] : G[3]) : hash2(x + 40, y + tier * 20) > 0.72 ? G[1] : G[2]); } } }
      px(14, 1, "#3f7457", 2, 2);
    } else if (kind === "pole") { // 夜河挂灯笼串的木杆：顶上一道横木，脚下一块石墩
      c.width = 6; c.height = 40; px(2, 2, "#4a3428", 2, 36); px(2, 2, "#6b4a34", 1, 36); px(0, 0, "#3b2b2e", 6, 2); px(0, 37, "#6e6c78", 6, 3); px(0, 37, "#a4a2ad", 6, 1);
    } else if (kind === "willowT") { // 柳树干（单独一张：画的时候干不动、柳条晃）
      c.width = 40; c.height = 60; px(18, 30, "#4a3426", 5, 30); px(19, 30, "#6b4a34", 2, 30); px(15, 57, "#4a3426", 11, 3); px(16, 57, "#6b4a34", 3, 1);
    } else if (kind === "willow") { // 柳树冠 + 一蓬往下垂的柳条，长短不一，下梢亮一点
      c.width = 40; c.height = 60; const L = ["#35602f", "#4f8a3c", "#72a848", "#a4cc62"];
      for (let y = 2; y < 16; y++) for (let x = 6; x < 34; x++) { const e = ((x - 20) / 13) ** 2 + ((y - 9) / 7) ** 2; if (e > 1 - hash2(x, y) * 0.2) continue; px(x, y, y < 6 && x < 22 ? L[3] : e > 0.7 ? L[0] : hash2(x * 3, y) > 0.55 ? L[2] : L[1]); }
      // 柳条：从树冠往两边拱出去再垂下来（像喷泉），外圈的更长；叶子一粒一粒挂在条上
      for (let i = 0; i < 22; i++) { const f = i / 21 - 0.5, x0 = 20 + f * 22, y0 = 8 + Math.abs(f) * 8, len = 20 + Math.round(Math.abs(f) * 22 + hash2(i, 9) * 10);
        for (let k = 0; k < len; k++) { const q = k / len; const x = Math.round(x0 + f * 14 * Math.sin(Math.min(1, q * 2.2) * Math.PI / 2) + Math.sin(k / 7 + i) * 0.6), y = Math.round(y0 + k * 0.95); if (y >= 59) break; px(x, y, q > 0.85 ? L[3] : k % 4 === 1 ? L[2] : i % 3 === 0 ? L[0] : L[1]); if (k % 3 === 0 && q > 0.2) px(x + (f < 0 ? -1 : 1), y, L[2]); } }
    } else if (kind === "bonsai") { // 石龟背上的盆景红枫：歪脖子粗树干、三团扁扁的红叶云、树根扒着龟壳
      c.width = 62; c.height = 44; const T = ["#3f2b20", "#6b4a34", "#8f6848"];
      const trunk: [number, number, number][] = [[30, 43, 5], [30, 40, 5], [29, 37, 5], [27, 34, 4], [25, 31, 4], [24, 28, 4], [25, 25, 3], [28, 22, 3], [31, 20, 3], [34, 18, 3]];
      for (const [x, y, w] of trunk) { px(x - (w >> 1) - 1, y, T[0], w + 2, 3); px(x - (w >> 1), y, T[1], w, 3); px(x - (w >> 1), y, T[2], 1, 3); }
      for (let i = 0; i < 9; i++) { px(26 + i, 29 - Math.round(i * 0.4), T[0], 1, 2); } // 横枝往右
      for (let i = 0; i < 8; i++) { px(24 - i, 27 - Math.round(i * 0.6), T[0], 1, 2); } // 横枝往左
      px(20, 42, T[0], 8, 2); px(33, 42, T[0], 10, 2); px(16, 43, T[0], 4, 1); px(42, 43, T[0], 4, 1); // 根
      const R = ["#6e2419", "#a8382a", "#cc5230", "#e8843a", "#f4b453"];
      const pad = (cx: number, cy: number, rx: number, ry: number) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const e = (x / rx) ** 2 + (y / ry) ** 2; if (e > 1 - hash2(cx + x, cy + y) * 0.2) continue; px(cx + x, cy + y, y >= ry - 1 ? R[0] : y <= -ry + 1 && x < rx / 2 ? R[4] : e < 0.35 && hash2(x, y + cx) > 0.55 ? R[3] : hash2(cx + x * 3, cy + y) > 0.72 ? R[1] : R[2]); } };
      pad(14, 21, 12, 6); pad(34, 11, 17, 8); pad(46, 24, 11, 5);
      px(6, 32, R[2], 2, 1); px(52, 34, R[3], 2, 1); px(40, 36, R[1], 2, 1);
    } else if (kind === "pampas") { // 芒草：一簇细秆，顶上奶白的穗子往一边垂
      c.width = 28; c.height = 38;
      for (let i = 0; i < 9; i++) { const lean = (i - 4) * 1.6; for (let y = 0; y < 14; y++) px(Math.round(14 + lean * (y / 14) * 1.4 + (i % 2)), 37 - y, i % 3 ? "#9c8446" : "#b89a5a"); } // 叶子
      for (let i = 0; i < 6; i++) { const bx = 6 + i * 3.2, h = 22 + (i * 7) % 9; for (let y = 0; y < h; y++) px(Math.round(bx + (y / h) * (i - 2.5) * 1.2), 37 - y, "#b89a5a");
        const tx = Math.round(bx + (i - 2.5) * 1.2), ty = 37 - h; for (let k = 0; k < 9; k++) for (let w = -1; w <= 1; w++) if (hash2(i * 13 + k, w + 5) > 0.2) px(tx + w + Math.round(k * 0.45), ty + k - 2, k < 2 ? "#fbf6e8" : hash2(i, k * 3 + w) > 0.5 ? "#f1e6c8" : "#dccca0"); }
    } else { // 石龟：睡在湖中间，壳上长青苔、落了红叶，头露在水面，闭着眼
      c.width = 108; c.height = 62; const cxs = 58, cys = 42, rx = 40, ry = 30;
      const shell = (x: number, y: number) => y <= cys && ((x - cxs) / rx) ** 2 + ((y - cys) / ry) ** 2 < 1;
      // 水面一圈白沫 + 倒影
      for (let x = 10; x < 104; x++) { const e = Math.sqrt(Math.max(0, 1 - ((x - cxs) / 46) ** 2)); if (e > 0) { px(x, Math.round(cys + 1 + e * 7), "#d8f2f5"); if (hash2(x, 7) > 0.5) px(x, Math.round(cys + 2 + e * 7), "#bfe6ea"); } }
      px(18, 43, "#3b6e82", 84, 4);
      for (let y = 10; y <= cys; y++) for (let x = 16; x < 100; x++) {
        if (!shell(x, y)) continue; const edge = !shell(x, y - 1) || !shell(x - 1, y) || !shell(x + 1, y);
        const row = Math.floor((y - 10) / 9), col = Math.floor((x - 16 + (row % 2) * 7) / 14); const ex = (x - 16 + (row % 2) * 7) % 14, ey = (y - 10) % 9;
        const moss = hash2(Math.floor(x / 5), Math.floor(y / 4)) > 0.62 && y < cys - 4;
        const k = hash2(row, col); let col_ = k > 0.6 ? "#9aa290" : k > 0.3 ? "#8d9683" : "#a7ae9c";
        if (ex === 0 || ey === 0) col_ = "#5e665a"; else if (moss) col_ = hash2(x, y) > 0.5 ? "#6f8f4a" : "#86a85a"; else if (x < cxs - 10 && y < cys - 14) col_ = "#b8bfae";
        px(x, y, edge ? "#4d544a" : col_);
      }
      for (let i = 0; i < 14; i++) { const x = 26 + Math.round(hash2(i, 2) * 64), y = 16 + Math.round(hash2(i, 5) * 22); if (shell(x, y)) { px(x, y, ["#c9502c", "#e0813a", "#eeb04a"][i % 3], 2, 1); } }
      // 头（左边，半浸在水里）、闭着的眼睛、鼻孔
      for (let y = 28; y <= 44; y++) for (let x = 2; x < 26; x++) { const e = ((x - 13) / 12) ** 2 + ((y - 36) / 8) ** 2; if (e < 1) px(x, y, e > 0.8 ? "#4d544a" : y < 33 ? "#a7ae9c" : "#8d9683"); }
      px(8, 33, "#3a3f38", 4, 1); px(7, 32, "#3a3f38"); px(12, 32, "#3a3f38"); px(4, 36, "#3a3f38"); px(6, 39, "#5e665a", 6, 1);
      // 前脚、尾巴尖
      for (let y = 38; y <= 45; y++) for (let x = 84; x < 102; x++) if (((x - 93) / 9) ** 2 + ((y - 42) / 4) ** 2 < 1) px(x, y, y < 40 ? "#a7ae9c" : "#8d9683");
      px(102, 38, "#8d9683", 4, 3); px(105, 39, "#4d544a", 2, 1);
    }
    this.sprCache[kind] = c; return c;
  }
  /** 湖：图集里的树 / 灌木 / 草换成秋天的颜色（红枫、金桦两种），不另外画图 */
  atlasFall: HTMLCanvasElement[] = [];
  fallAtlas() {
    if (this.atlasFall.length || !this.atlasOk) return this.atlasFall;
    const im = this.atlas; const base = document.createElement("canvas"); base.width = im.naturalWidth; base.height = im.naturalHeight; base.getContext("2d")!.drawImage(im, 0, 0);
    for (const pal of [["#6e2a1c", "#9c3a22", "#c85a2c", "#e3893a", "#f2c25a"], ["#7a5a1c", "#a67a24", "#cf9e32", "#e8c048", "#f6de7a"]]) {
      const c = document.createElement("canvas"); c.width = base.width; c.height = base.height; const g = c.getContext("2d")!; g.drawImage(base, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height); const P = pal.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      for (let i = 0; i < d.data.length; i += 4) { const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2]; if (!d.data[i + 3] || !(gg > r + 6 && gg > b)) continue; const l = (r + gg + b) / 3; const k = l < 60 ? 0 : l < 90 ? 1 : l < 125 ? 2 : l < 165 ? 3 : 4; d.data[i] = P[k][0]; d.data[i + 1] = P[k][1]; d.data[i + 2] = P[k][2]; }
      g.putImageData(d, 0, 0); this.atlasFall.push(c);
    }
    return this.atlasFall;
  }
  /** 湖上飘的落叶（画面坐标，风大飘得快） */
  leaves: { x: number; y: number; p: number; c: string }[] = [];
  drawProp(p: Prop) {
    if (p.kind === "pole") { const im = this.spr("pole"); this.g.drawImage(im, Math.round(p.x - 3), Math.round(p.y - im.height + 1)); return; }
    if (p.kind === "willow") { // 柳条分三截，越往下晃得越多（按设备像素挪，不会一格一格跳）
      const g = this.g; const tr = this.spr("willowT"), cn = this.spr("willow"); const x = Math.round(p.x - 20), y = Math.round(p.y - 59); const w = Math.sin(this.t * 0.9 + p.x * 0.05) * (1 + this.wx.wind * 1.5);
      this.pxEllipse(p.x, p.y - 1, 12, 3, "rgba(30,50,30,.28)", true); g.drawImage(tr, x, y);
      for (const [a, b, k] of [[0, 16, 0.25], [16, 30, 0.6], [30, 60, 1.2]]) g.drawImage(cn, 0, a, 40, b - a, x + this.rp(w * k), y + a, 40, b - a); return; }
    if (p.kind === "pine" || p.kind === "turtle" || p.kind === "pampas") { const im = this.spr(p.kind); const g = this.g; const x = Math.round(p.x - im.width / 2), y = Math.round(p.y - im.height + 1); if (p.kind !== "turtle") this.pxEllipse(p.x, p.y - 1, im.width * 0.32, 3, "rgba(50,60,20,.25)", true); const cut = p.kind === "pine" ? 26 : p.kind === "pampas" ? 20 : im.height, dx = p.kind === "turtle" ? 0 : Math.round(Math.sin(this.t * (p.kind === "pampas" ? 1.4 : 0.9) + p.x * 0.05) * (p.kind === "pampas" ? 1.3 : 0.8)); if (p.kind === "turtle") { const bob = Math.sin(this.t * 0.5) > 0.6 ? 1 : 0; g.drawImage(im, x, y + bob); const bz = this.spr("bonsai"); g.drawImage(bz, x + 30, y - 24 + bob); return; } g.drawImage(im, 0, 0, im.width, cut, x + dx, y, im.width, cut); if (cut < im.height) g.drawImage(im, 0, cut, im.width, im.height - cut, x, y + cut, im.width, im.height - cut); return; }
    if (!this.atlasOk) return; const g = this.g; const [sx, sy, w, h] = (propsMeta as number[][])[PI_[p.kind]];
    const x = Math.round(p.x - w / 2), y = Math.round(p.y - h + 1);
    if (!p.flat && p.kind !== "reeds") this.pxEllipse(p.x, p.y - 1, w * 0.3, Math.max(2, w * 0.07), "rgba(50,60,20,.25)", true);
    const tree = p.kind.startsWith("tree"); const flip = p.flip && p.kind !== "lamp" && p.kind !== "sign";
    const fa = this.scene === "lake" ? this.fallAtlas() : []; const src: CanvasImageSource = fa.length ? fa[hash2(p.x | 0, p.y | 0) > 0.55 ? 1 : 0] : this.atlas;
    const put = (srcY: number, hh: number, dx: number) => { if (flip) { g.save(); g.translate(x + w + dx, 0); g.scale(-1, 1); g.drawImage(src, sx, sy + srcY, w, hh, 0, y + srcY, w, hh); g.restore(); } else g.drawImage(src, sx, sy + srcY, w, hh, x + dx, y + srcY, w, hh); };
    if (tree || p.kind === "reeds" || p.kind === "flowers" || p.kind === "grass") {
      // 风：上半截每隔一会儿偏 1 格，像叶子在晃
      const cut = Math.round(h * (tree ? 0.62 : 0.5)); const dx = Math.round(Math.sin(this.t * 1.1 + p.x * 0.07) * 0.8);
      put(0, cut, dx); put(cut, h - cut, 0);
    } else put(0, h, 0);
  }
  fishLine(a: { x: number; y: number }, b: { x: number; y: number }, sag: number) {
    const g = this.g; g.fillStyle = "rgba(255,255,255,.75)"; const n = Math.max(8, Math.round(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let i = 0; i <= n; i++) { const k = i / n; const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * sag; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  }
  drawBobber(x: number, y: number, dip: number, skin = "wood") { const g = this.g; x = Math.round(x); y = Math.round(y) + dip; g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(x - 2, y + 2, 5, 1);
    // 浮漂跟装备换样子：樱桃（红 + 绿梗）、星星（黄）、美乐蒂耳朵（粉 + 两只白耳朵）
    if (skin === "cherry") { g.fillStyle = "#d8283f"; g.fillRect(x - 1, y - 2, 3, 3); g.fillStyle = "#5a9a3a"; g.fillRect(x, y - 4, 1, 2); g.fillRect(x + 1, y - 4, 1, 1); return; }
    if (skin === "star") { g.fillStyle = "#ffd84a"; g.fillRect(x - 1, y - 2, 3, 3); g.fillRect(x - 2, y - 1, 5, 1); g.fillRect(x, y - 3, 1, 1); g.fillStyle = "#fff4b0"; g.fillRect(x, y - 1, 1, 1); return; }
    if (skin === "melody") { g.fillStyle = "#ff9ec4"; g.fillRect(x - 1, y - 1, 3, 2); g.fillStyle = "#ffffff"; g.fillRect(x - 2, y - 4, 1, 3); g.fillRect(x + 2, y - 4, 1, 3); g.fillRect(x - 1, y, 3, 1); return; }
    g.fillStyle = "#ff5a7a"; g.fillRect(x - 1, y - 2, 3, 2); g.fillStyle = "#ffffff"; g.fillRect(x - 1, y, 3, 2); g.fillStyle = "#c93c5c"; g.fillRect(x, y - 3, 1, 1); }
  drawRod(a: Actor) {
    const g = this.g; const h = this.hand(a), tip = this.rodTip(a); const n = Math.round(Math.hypot(tip.x - h.x, tip.y - h.y));
    const P = PixelWorld.ROD[this.rodOf(a)];
    for (let i = 0; i <= n; i++) { const k = i / n; const x = h.x + (tip.x - h.x) * k, y = h.y + (tip.y - h.y) * k - Math.sin(k * Math.PI) * 2; g.fillStyle = P ? (P.band && i % 5 === 0 ? P.band : k < 0.3 ? P.d : P.l) : k < 0.3 ? "#6a4630" : "#a8784c"; g.fillRect(Math.round(x), Math.round(y), 1, k < 0.25 ? 2 : 1); }
    this.rodTipDeco(a, tip);
  }
  drawLine(a: Actor) {
    const t = this.t; if (a.rod && this.castPose(a)) this.rodTipDeco(a, this.rodTip(a));
    if (a === this.me) { const b = this.bobber; if (b) { const tip = this.rodTip(this.me); this.fishLine(tip, b, b.phase === "fight" ? 1 : b.phase === "fly" ? 3 : 7); this.drawBobber(b.x, b.y, b.phase === "bite" ? Math.abs(Math.sin(t * 18)) * 2 : Math.sin(t * 2.4) > 0.6 ? 1 : 0, this.bobSkin); } return; }
    if (a.rod && a.bob) {
      // 开放世界：伙伴的浮漂跟服务器状态——咬钩时一下一下点水，拉鱼时线绷直、浮漂左右乱窜
      const act = a.srvAct;
      if (act === "hooked") { const bx = a.bob.x + Math.sin(t * 7 + a.x) * 4 + Math.sin(t * 17) * 1.5, by = a.bob.y + Math.sin(t * 5.3) * 1.5; this.fishLine(this.rodTip(a), { x: bx, y: by }, 1); this.drawBobber(bx, by, Math.abs(Math.sin(t * 11)) > 0.5 ? 2 : 1, this.bobOf(a)); }
      else { this.fishLine(this.rodTip(a), a.bob, act === "bite" ? 5 : 7); this.drawBobber(a.bob.x, a.bob.y, act === "bite" ? Math.abs(Math.sin(t * 18)) * 2 : Math.sin(t * 2 + a.x) > 0.6 ? 1 : 0, this.bobOf(a)); }
    }
  }
  /** 两人一起用同一件家具（TH_DUO）：玩家画那张合图，伙伴甲不另外画；没凑成一对 / 图还没到就各画各的 */
  private duoK: Record<string, string> = {};
  private duoOf(a: Actor): { skip: true } | { im: HTMLImageElement; x: number; dy: number; t0: number; spd: number } | null {
    if ((a.who !== "player" && a.who !== "buddy") || !a.cact) return null; const spot = a.cact.spot; const D = spot ? TH_DUO[spot] : undefined; if (!spot || !D) return null;
    const me = this.me, buddy = this.ai.buddy; if (!me?.cact || !buddy?.cact || me.cact.spot !== spot || buddy.cact.spot !== spot) { delete this.duoK[spot]; return null; }
    const k = this.duoK[spot] ??= D.k[Math.floor(Math.random() * D.k.length)]; const im = this.actOk(k); if (!im) return null;
    if (a.who === "buddy") return { skip: true };
    return { im, x: (me.x + buddy.x) / 2, dy: Math.round((me.cact.dy + buddy.cact.dy) / 2), t0: Math.min(me.cact.t0, buddy.cact.t0), spd: D.spd ?? 0.9 };
  }
  /** 农场里人画大 1.25 倍（镜头退回 3 倍看全景，试玩反馈人太小，对比后选了 1.25），以脚底为中心放大 */
  drawActor(a: Actor) {
    if (this.scene !== "farm") return this.drawActor0(a);
    const g = this.g; g.save(); g.translate(a.x, a.y); g.scale(PEOPLE_K, PEOPLE_K); g.translate(-a.x, -a.y); this.drawActor0(a); g.restore();
  }
  drawActor0(a: Actor) {
    if (a === this.me && this.hideMe) return;
    const duo = this.duoOf(a);
    if (duo) { if ("skip" in duo) return; const g = this.g, im = duo.im; const fw = Math.floor(im.naturalWidth / 3), fh = im.naturalHeight; const f = [0, 1, 2, 1][Math.floor((this.t - duo.t0) / duo.spd) % 4];
      g.drawImage(im, f * fw, 0, fw, fh, this.rp(duo.x - fw / 2), this.rp(a.y - fh + 1 + duo.dy), fw, fh); return; }
    const g = this.g; const S = this.sheets[a.who]; const m = S.m;
    if (a.cact?.swap && this.actOk(`${a.who}_${a.cact.k}`)) return; // 人画在家具那张图里了（drawFurn → furnSwap）
    if (!(a.cact && a.cact.dy < 0)) this.pxEllipse(a.x, a.y - 1 + (a.cact && a.cact.dy > 0 ? a.cact.dy : 0), 11, 3, "rgba(30,50,30,.28)", true); // 坐在床上就不画地上的影子
    if (!S.ok) return;
    if (a.cact) { // 用家具的动作：一行 3 帧；一次性的播完停一下回到站着，循环的（坐床晃腿）0-1-2-1 一直晃
      const im = this.actOk(`${a.who}_${a.cact.k}`); const e = this.t - a.cact.t0;
      if (!a.cact.loop && e > 3 * 0.55 + 1.3) a.cact = null;
      else if (im) { const fw = Math.floor(im.naturalWidth / 3), fh = im.naturalHeight; const f = a.cact.loop ? [0, 1, 2, 1][Math.floor(e / (a.cact.spd ?? 0.32)) % 4] : Math.min(2, Math.floor(e / 0.55));
        const pop = e < 0.12 ? Math.round((1 - e / 0.12) * 2) : 0; const x0 = this.rp(a.x - fw / 2), y0 = this.rp(a.y - fh + 1 + a.cact.dy - pop);
        if (a.cact.flip) { g.save(); g.translate(x0 + fw, y0); g.scale(-1, 1); g.drawImage(im, f * fw, 0, fw, fh, 0, 0, fw, fh); g.restore(); } else g.drawImage(im, f * fw, 0, fw, fh, x0, y0, fw, fh);
        if (a.cact.over) { const ov = a.cact.over; const F = TH_FURN.find(q => ov === q.k || ov.startsWith(q.k + "_")); if (F) this.drawFurn({ ...F, k: ov }); } // 跟家具本体一样晃（吊床 sway） // 家具的前半截（椅背）盖在人前面
        return; } }
    const R = this.restImg[a.who];
    if (a.rest != null && R?.complete && R.naturalWidth) {
      // 坐下：先往下一沉（0.22 秒落到坐垫上、压扁一下），之后两帧每 1.1 秒换一次，慢慢左右晃
      const e = this.t - a.rest, fw = Math.floor(R.naturalWidth / 2), fh = R.naturalHeight;
      const k = e < 0.22 ? 0 : Math.floor((e - 0.22) / 1.1) % 2, drop = e < 0.22 ? -Math.round((1 - e / 0.22) * 4) : 0;
      const sq = e >= 0.22 && e < 0.34 ? 1 : 0; // 落垫那一下扁 1 像素
      g.drawImage(R, k * fw, 0, fw, fh, this.rp(a.x - fw / 2), this.rp(a.y - fh + 3 + drop + sq), fw, fh - sq);
      return;
    }
    const pose = this.castPose(a);
    const holding = a.act === 4 && !!m.hold && this.t < a.actUntil; const rodBehind = a.rod && a.dir === 3 && !pose && !holding; if (rodBehind) this.drawRod(a);
    // 画 sheet 最下面那行姿势的第 k 格（mirror = 朝左时镜像）
    const poseCell = (k: number, mirror = false) => { const [py, pw, ph, pax, pby] = m.pose!; const y0 = this.rp(a.y - pby);
      const ov = k === 3 || k === 4 ? this.rodLayer(a.who, k === 3 ? "front" : "back", this.rodOf(a), pw, ph) : null;
      if (!mirror) { g.drawImage(S.img, k * pw, py, pw, ph, this.rp(a.x - pax), y0, pw, ph); if (ov) g.drawImage(ov, this.rp(a.x - pax), y0); }
      else { g.save(); g.translate(this.rp(a.x + pax) + 1, 0); g.scale(-1, 1); g.drawImage(S.img, k * pw, py, pw, ph, 0, y0, pw, ph); g.restore(); } };
    const bobY = a.moving ? 0 : Math.round(Math.sin(this.t * 2.2 + a.x) * 0.5 + 0.5) * 0; // 站着不抖
    if (pose && (a.dir === 0 || a.dir === 3)) poseCell(a.dir === 0 ? 3 : 4); // 正面 / 背面钓鱼：画的拿竿姿势
    else if (pose) {
      // 钓鱼姿势那帧是朝右画的；朝左就整张镜像（以脚底锚点为轴）
      const y0 = this.rp(a.y - m.ah + 1);
      const ov = this.rodLayer(a.who, "side", this.rodOf(a), m.aw, m.ah);
      if (a.dir === 2) { g.drawImage(S.img, m.aw, m.ay, m.aw, m.ah, this.rp(a.x - m.aax), y0, m.aw, m.ah); if (ov) g.drawImage(ov, this.rp(a.x - m.aax), y0); }
      else { g.save(); g.translate(this.rp(a.x + m.aax) + 1, 0); g.scale(-1, 1); g.drawImage(S.img, m.aw, m.ay, m.aw, m.ah, 0, y0, m.aw, m.ah); if (ov) g.drawImage(ov, 0, y0); g.restore(); }
    } else if (a.act === 4 && m.hold && this.t < a.actUntil) {
      // 举鱼：开头蹦两下（落地那一下鱼跟着颠），中间鱼在手里扑腾（上下 1 像素），最后 0.3 秒手往下放一点
      const [hx, hy, hw, hh, hax, lx, ly, rx, ry] = m.hold; const e = this.t - (a.fish?.t0 ?? a.actUntil - 3), left = a.actUntil - this.t;
      const hop = e < 0.72 ? -Math.round(Math.abs(Math.sin((e / 0.36) * Math.PI)) * 3) : 0; const drop = left < 0.3 ? Math.round((0.3 - left) / 0.3 * 3) : 0;
      const x0 = this.rp(a.x - hax), y0 = this.rp(a.y - hh + 1 + hop);
      g.drawImage(S.img, hx, hy, hw, hh, x0, y0, hw, hh);
      const art = a.fish?.sp ? this.fishCanvas(a.fish.sp) : null;
      if (art) { const fw = Math.max(art.width, rx - lx + 4), fh = Math.round(art.height * fw / art.width); const flop = e > 0.72 && left > 0.3 ? Math.round(Math.sin(e * 11)) : 0;
        g.drawImage(art, x0 + Math.round((lx + rx) / 2 - fw / 2), y0 + Math.min(ly, ry) - fh + 3 + flop + drop, fw, fh); }
      else if (a.fish) this.drawFish(x0 + (lx + rx) / 2, y0 + Math.min(ly, ry) - 6 + drop, a.fish.c);
      if (Math.random() < 0.12) this.parts.push({ x: a.x + (Math.random() - 0.5) * 30, y: a.y - hh + Math.random() * 10, vx: 0, vy: -12, life: 0, max: 0.6, c: Math.random() < 0.5 ? "#fff3b0" : "#ffd66b", g: 0 });
    } else if (a.act >= 0 && this.t < a.actUntil) {
      const fx = a.act * m.aw, fy = m.ay; g.drawImage(S.img, fx, fy, m.aw, m.ah, this.rp(a.x - m.aax), this.rp(a.y - m.ah + 1), m.aw, m.ah);
    } else {
      if (!a.moving && m.pose) poseCell(a.dir === 0 ? 0 : a.dir === 3 ? 1 : 2, a.dir === 1); // 站着：画的站姿（脚并拢），不再用走路的某一帧
      else { const f = a.moving ? Math.floor(a.walkT) % 4 : (m.idle?.[a.dir] ?? 0); g.drawImage(S.img, f * m.cw, a.dir * m.ch, m.cw, m.ch, this.rp(a.x - m.ax), this.rp(a.y - m.ch + 1 + bobY), m.cw, m.ch); }
    }
    if (a.rod && !rodBehind && !pose && !holding) this.drawRod(a);
    if (a.act === 4 && m.hold && this.t < a.actUntil) { /* 鱼已经画在手上了 */ }
    else if (a.fish && this.t < a.fish.until) {
      const art = a.fish.sp ? this.fishCanvas(a.fish.sp) : null;
      if (art && a.who === "player" && a.act === 3 && this.t < a.actUntil) g.drawImage(art, this.rp(a.x - m.aax + 57 - art.width / 2), this.rp(a.y - m.ah + 1 + 22 - art.height / 2)); // 玩家举起来的那条：画在手上
      else { const y = a.y - m.ch - 6 - Math.abs(Math.sin(this.t * 6)) * 3; if (art) g.drawImage(art, this.rp(a.x - art.width / 2), Math.round(y - art.height / 2)); else this.drawFish(a.x, y, a.fish.c); }
    } else a.fish = null;
  }
  drawFish(x: number, y: number, c: string) { const p = new Px(13, 7); p.ellipse(7, 3.5, 5, 3, c); p.rect(0, 1, 2, 5, c); p.set(9, 2, "#2a2026"); return this.g.drawImage(p.outline(undefined, 0.5).canvas(), Math.round(x - 6), Math.round(y)); }
}
function mixc(a: string, b: string, k: number) { const A = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), B = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`; }
