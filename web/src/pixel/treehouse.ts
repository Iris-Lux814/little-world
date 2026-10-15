// 树洞小屋（伞树农场的树屋里面）：侧视剖面三层。空壳一张图，
// 家具每样一张透明贴纸（同目录 attic_ / mid_ / ground_*.webp），代码摆放，每样都能点，点了有自己的小动作。
// 竹管鱼缸里的鱼、灯、风铃、门都是代码画的。摆设（decor slot）、鱼缸、留言、鱼拓都在后端 /world/cabin，大家看到同一间。
// 世界坐标 = 壳图 1254 像素 × K（人 60 高，一层差不多两个半人高）
// 玩家选 A：玩家和伙伴甲不分房（粉房间合成两人卧室）、蓝房间给伙伴乙，房间要宽一点不挤 → 换宽壳图 shell_wide.webp。
// 1 世界单位 = 壳图 1.389 像素（层高跟原来差不多，人不变小）。原来的方壳在 
export const TH_SHELL = "shell_wide";
export const TH_PX = 1.389;
export const TH_K = 702 / 1254;
export const TH_W = Math.round(1536 / TH_PX), TH_H = Math.round(1024 / TH_PX);
/** 三层能走的线：0 阁楼 / 1 二楼 / 2 一楼 */
export const TH_FLOOR = [{ y: 239, x0: 194, x1: 929 }, { y: 407, x0: 101, x1: 1037 }, { y: 576, x0: 144, x1: 943 }];
/** 竹管（玻璃管）鱼缸：从一楼通到阁楼，鱼在里面上下游 */
export const TH_TUBE = { x0: 722, x1: 752, y0: 101, y1: 558 };
export const TH_DOOR_X = 695;
/** 楼梯：二楼 ↔ 阁楼（管子左边那段）、二楼 ↔ 一楼（管子右边那段）。按大按钮自己走完。照宽壳图一级一级描的台阶 */
export const TH_STAIR = {
  up: [{ x: 727, y: 407 }, { x: 720, y: 392 }, { x: 713, y: 378 }, { x: 706, y: 364 }, { x: 700, y: 349 }, { x: 695, y: 335 }, { x: 693, y: 320 }, { x: 693, y: 306 }, { x: 695, y: 292 }, { x: 700, y: 277 }, { x: 703, y: 265 }, { x: 697, y: 248 }, { x: 684, y: 239 }],
  down: [{ x: 763, y: 407 }, { x: 774, y: 423 }, { x: 788, y: 446 }, { x: 806, y: 461 }, { x: 821, y: 475 }, { x: 835, y: 490 }, { x: 846, y: 504 }, { x: 853, y: 518 }, { x: 860, y: 533 }, { x: 864, y: 547 }, { x: 862, y: 563 }, { x: 853, y: 576 }, { x: 842, y: 576 }],
};
/** 哪里按「上楼 / 下楼」：二楼上楼口 / 下楼口的 x 范围，阁楼下楼口、一楼上楼口 */
export const TH_STAIR_AT = { up: [710, 744], down: [756, 788], atticDown: 684, groundUp: 846 };
export type Anim = "sway" | "bounce" | "puff" | "notes" | "sparkle" | "shake" | "spin" | "glow";
/** 家具：k 图名；x 中线；y 脚底（hang 的是顶）；h 画多高；spot = 站到跟前大按钮能点的那个东西 */
export type Furn = { k: string; x: number; y: number; h: number; w?: number; hang?: boolean; flat?: boolean; front?: boolean; z?: number; spot?: string; anim?: Anim; sheet?: string };
export const TH_FURN: Furn[] = [
  // ── 阁楼（地板 239）：左边望远镜、旧木箱、萤火虫罐、吊床；圆窗底下一堆枕头；管子右边那块是伙伴乙的吊床角
  { k: "attic_06", x: 240, y: 122, h: 50, hang: true, anim: "sway" }, // 晾衣绳
  { k: "attic_10", x: 470, y: 132, h: 54, hang: true, anim: "sway" }, // 星图挂毯
  { k: "attic_04", x: 215, y: 239, h: 62, spot: "telescope", anim: "shake" },
  { k: "attic_07", x: 275, y: 239, h: 38, spot: "chest", anim: "shake" },
  { k: "attic_05", x: 322, y: 239, h: 32, spot: "jar", anim: "glow" },
  { k: "attic_01", x: 380, y: 164, h: 52, hang: true, spot: "hammock", anim: "sway" },
  { k: "attic_02", x: 551, y: 176, h: 48, hang: true, anim: "sway" },
  { k: "mid_07", x: 440, y: 230, h: 50, spot: "buddy", anim: "shake" }, // 阁楼的小桌是他写信的地方 → 他的书桌搬上来
  { k: "mid_08", x: 424, y: 198, h: 17 },
  { k: "attic_16", x: 458, y: 204, h: 20, anim: "glow" }, // 煤油灯，夜里亮
  { k: "attic_15", x: 505, y: 239, h: 58, spot: "shelf", anim: "shake" }, // 圆窗边的书架：《小王子》《当你像鸟飞往你的山》《动物农场》
  { k: "attic_09", x: 551, y: 241, h: 26, spot: "window", anim: "bounce" },
  { k: "attic_14", x: 600, y: 239, h: 26, anim: "shake" }, // 邮票册靠着墙
  { k: "attic_08", x: 628, y: 239, h: 44, spot: "pinwheel", anim: "spin" },
  { k: "attic_18", x: 662, y: 240, h: 18, spot: "mbox", anim: "shake" }, // 墙角的早晨盒子（木头、铜扣）
  { k: "attic_03", x: 786, y: 164, h: 52, hang: true, spot: "hammock2", anim: "sway" },
  { k: "ground_18", x: 872, y: 241, h: 55, spot: "tea", anim: "shake" }, // 小圆桌、两把椅子、一壶茶两个杯（从一楼楼梯边搬上来）
  { k: "attic_12a", x: 900, y: 142, h: 42, hang: true, anim: "sway" }, // 鸽笼
  // ── 二楼（地板 407）：左边是玩家和伙伴甲的卧室（两张床并排），中间走廊，管子右边是伙伴乙的房间
  { k: "mid_26", x: 288, y: 262, h: 30, w: 150, hang: true, anim: "glow" }, // 暖黄小灯串，从床头绕过去
  { k: "mid_27", x: 364, y: 282, h: 22, hang: true, anim: "sway" }, // 拍立得照片绳：农场的爱心、第一条鱼、玩家的锁屏、一张空白（留给以后）
  { k: "mid_28", x: 200, y: 300, h: 22, hang: true, anim: "sway" }, // 床头那边的粉边圆挂钟
  { k: "mid_17", x: 275, y: 302, h: 44, hang: true, spot: "painting", anim: "sway" }, // 玩家画的第一张画：粉发熊耳小女孩 + 橙色小螃蟹（螃蟹是他）
  { k: "mid_20", x: 280, y: 405, h: 12, w: 156, flat: true }, // 奶白粉边地毯：平铺在床前的地板上
  { k: "mid_10b", x: 395, y: 258, h: 70, hang: true, anim: "sway" }, // 门边垂下来的花藤
  { k: "mid_01", x: 146, y: 398, h: 84, spot: "wardrobe", anim: "shake" }, // 衣柜往里挪（原来贴着最左边，被左边两个圆按钮盖住）
  { k: "mid_16", x: 200, y: 396, h: 50, anim: "glow" }, // 玩家那边的床头柜：暖黄小台灯、玩家的手机、一杯水
  { k: "mid_15", x: 275, y: 402, h: 62, spot: "bed", anim: "bounce" }, // 两张床并成一张，粉蓝各半被子
  { k: "mid_04", x: 240, y: 380, h: 20, anim: "bounce" }, // 美乐蒂坐在玩家那半边床尾
  { k: "mid_19", x: 310, y: 382, h: 24, anim: "bounce" }, // 玉桂狗玩偶在床右边，跟美乐蒂对称
  { k: "mid_18", x: 392, y: 400, h: 24, z: -3, anim: "sway" }, // 一盆农场的红烬椒
  { k: "mid_02", x: 365, y: 398, h: 62, spot: "mirror", anim: "sparkle" },
  { k: "mid_03", x: 470, y: 290, h: 36, hang: true, anim: "sway" }, // 贴纸墙（从卧室挪到走廊）
  { k: "mid_30", x: 530, y: 302, h: 24, hang: true, anim: "sparkle" }, // 走廊的小镜子
  { k: "mid_29", x: 664, y: 312, h: 42, hang: true, anim: "sway" }, // 挂钩：一粉一蓝两件外套 + 一把伞
  { k: "mid_06", x: 465, y: 397, h: 70, spot: "cabinet", anim: "sparkle" },
  { k: "mid_13b", x: 530, y: 397, h: 62, spot: "dex", anim: "shake" },
  { k: "mid_13a", x: 575, y: 318, h: 44, hang: true, spot: "board", anim: "sway" },
  { k: "mid_12", x: 612, y: 397, h: 72, spot: "books", anim: "shake" },
  { k: "mid_21", x: 850, y: 296, h: 36, hang: true, anim: "sway" }, // 旧地铁图
  { k: "mid_22", x: 930, y: 300, h: 32, hang: true, anim: "sway" }, // 天气图
  { k: "mid_23", x: 786, y: 320, h: 22, hang: true, anim: "sway" }, // 温度计
  { k: "mid_31", x: 1000, y: 296, h: 26, hang: true, anim: "sway" }, // 停在某一页不翻的旧挂历
  { k: "attic_12b", x: 800, y: 398, h: 36, spot: "record", anim: "notes" }, // 伙伴乙的唱片机（从阁楼搬下来）
  { k: "attic_11", x: 840, y: 398, h: 34, spot: "pal", anim: "notes" }, // 收音机，上面一盆仙人掌
  { k: "attic_13", x: 842, y: 366, h: 22 },
  { k: "mid_25", x: 898, y: 404, h: 52, spot: "paldesk", anim: "shake" }, // 他的书桌：空咖啡杯、翻开的书
  { k: "mid_24", x: 944, y: 404, h: 44, anim: "shake" }, // 床边的椅子，椅背搭一件灰外套
  { k: "mid_14", x: 995, y: 402, h: 58, spot: "palbed", anim: "bounce" }, // 伙伴乙的床
  // ── 一楼（地板 576）：炉子、柴筐、钓竿架、牌桌三把椅子、猫窝、留声机 + 布谷钟、鞋架、伞筒、风铃、门；楼梯底下横横的工具箱
  { k: "ground_10", x: 360, y: 598, h: 20, w: 130, flat: true }, // 餐桌底下的地毯
  { k: "ground_02", x: 305, y: 446, h: 60, hang: true, anim: "shake" }, // 果酱架（挪开，不挨着炉子烟囱）
  { k: "ground_15", x: 370, y: 468, h: 38, hang: true, anim: "sway" }, // 锅铲挂架
  { k: "ground_19", x: 455, y: 462, h: 46, hang: true, anim: "sway" }, // 一大张小世界手绘地图
  { k: "ground_13", x: 577, y: 454, h: 54, hang: true, spot: "clock", anim: "sway" },
  { k: "ground_16", x: 165, y: 570, h: 26, anim: "shake" },
  { k: "ground_01", x: 210, y: 568, h: 100, spot: "stove", anim: "puff" },
  { k: "ground_09", x: 272, y: 568, h: 56, spot: "rods", anim: "shake" },
  { k: "ground_06", x: 360, y: 562, h: 42, anim: "bounce" },
  { k: "ground_03", x: 360, y: 574, h: 44, spot: "table", anim: "shake" },
  { k: "ground_04", x: 322, y: 578, h: 42, anim: "bounce" },
  { k: "ground_05", x: 398, y: 578, h: 42, anim: "bounce" },
  { k: "ground_17", x: 472, y: 574, h: 50, spot: "sofa", anim: "bounce" }, // 小客厅：奶白双人沙发（粉毯子 + 抱枕）
  { k: "ground_22", x: 540, y: 578, h: 40, z: -11, spot: "crab", anim: "bounce" }, // 橙色小螃蟹玩偶
  { k: "ground_14", x: 577, y: 568, h: 52, spot: "gramo", anim: "notes" },
  { k: "ground_08", x: 607, y: 570, h: 42, z: -3, anim: "shake" },
  { k: "ground_07", x: 636, y: 568, h: 40, spot: "shoes", anim: "shake" },
  { k: "ground_21", x: 662, y: 572, h: 13, anim: "bounce" }, // 两双拖鞋贴着鞋架，一粉一蓝
  { k: "ground_11", x: 498, y: 594, h: 20, front: true, spot: "cat", anim: "bounce", sheet: "ground_11_cat" },
];
/** 站在哪个 x 附近能点什么（每层自己的） */
export const TH_SPOTS: { id: string; f: number; x: number; r: number }[] = [
  { id: "telescope", f: 0, x: 215, r: 18 }, { id: "chest", f: 0, x: 273, r: 20 }, { id: "jar", f: 0, x: 322, r: 12 }, { id: "hammock", f: 0, x: 380, r: 22 },
  { id: "buddy", f: 0, x: 440, r: 18 }, { id: "shelf", f: 0, x: 505, r: 14 }, { id: "window", f: 0, x: 551, r: 26 }, { id: "pinwheel", f: 0, x: 625, r: 14 }, { id: "mbox", f: 0, x: 662, r: 12 }, { id: "hammock2", f: 0, x: 778, r: 16 }, { id: "tea", f: 0, x: 876, r: 18 },
  { id: "wardrobe", f: 1, x: 146, r: 22 }, { id: "painting", f: 1, x: 275, r: 10 }, { id: "bed", f: 1, x: 248, r: 22 }, { id: "buddybed", f: 1, x: 302, r: 22 }, { id: "mirror", f: 1, x: 365, r: 20 }, { id: "cabinet", f: 1, x: 465, r: 20 }, { id: "dex", f: 1, x: 530, r: 14 },
  { id: "board", f: 1, x: 572, r: 14 }, { id: "books", f: 1, x: 614, r: 18 }, { id: "record", f: 1, x: 800, r: 16 }, { id: "pal", f: 1, x: 840, r: 16 }, { id: "paldesk", f: 1, x: 902, r: 18 }, { id: "palbed", f: 1, x: 995, r: 24 },
  { id: "clock", f: 2, x: 572, r: 10 }, { id: "stove", f: 2, x: 210, r: 22 }, { id: "rods", f: 2, x: 272, r: 14 }, { id: "table", f: 2, x: 360, r: 28 }, { id: "sofa", f: 2, x: 472, r: 18 }, { id: "crab", f: 2, x: 540, r: 14 }, { id: "cat", f: 2, x: 498, r: 10 }, { id: "gramo", f: 2, x: 580, r: 10 },
  { id: "shoes", f: 2, x: 636, r: 12 }, { id: "notes", f: 2, x: TH_DOOR_X - 36, r: 10 }, { id: "door", f: 2, x: TH_DOOR_X, r: 14 }, { id: "tank", f: 2, x: 716, r: 6 },
];
/** 摆设的 6 个位置（后端 decor slot）：图挂 / 放在这儿 */
/** 床头上方贴一张小纸条「和伙伴甲在一起 N 天」（起算，跟主页计数器一样；字是网页叠上去的） */
export const TH_NOTE = { x: 275, y: 326 };
/** 一楼门边小黑板上的「今天：」（网页叠字） */
export const TH_CHALK = { x: 700, y: 510 };
export const TH_DECOR: Record<string, { x: number; y: number; h: number; hang?: boolean }> = {
  hall_wall: { x: 640, y: 300, h: 30, hang: true }, hall_shelf: { x: 467, y: 351, h: 18 }, attic_hook: { x: 500, y: 144, h: 28, hang: true },
  kitchen_wall: { x: 640, y: 472, h: 26, hang: true }, window: { x: 551, y: 196, h: 20, hang: true }, door_top: { x: TH_DOOR_X, y: 490, h: 18, hang: true },
};

/** 人物用家具的动作。内容表：家具 → 动作图（public/world-cabin/acts/<谁>_<图>.png，一行 3 帧）。
 * 谁有这张图就播谁的，没有就只有家具自己动。at = 站到哪（x，dy 往上抬多少）、face 2 朝右 / 1 朝左；loop = 一直播到推摇杆，spd 每帧几秒；几张图随机挑一张 */
export const TH_ACTS: Record<string, { acts: string[]; x: number; dy?: number; face: 1 | 2; loop?: boolean; over?: string; alt?: string; spd?: number; only?: string[]; swap?: boolean; hide?: boolean; per?: Record<string, { x?: number; dy?: number; face?: 1 | 2; over?: string }> }> = { // per：同一件家具每个人站的位置 / 朝向不一样（身形不同、各坐各的椅子）
  bed: { acts: ["bed"], only: ["player"], x: 248, dy: -9, face: 2, loop: true, spd: 0.34 }, // 坐玩家床的被子前沿正中，腿垂在被子前面（图缩到 0.7）
  telescope: { acts: ["scope"], x: 249, face: 1, loop: true, spd: 0.8 }, // 目镜在右边那头 → 站右边朝左
  mirror: { acts: ["mirrorA", "mirrorB", "mirrorC"], x: 349, face: 2, loop: true, spd: 0.7 },
  buddybed: { acts: ["bed"], only: ["buddy"], x: 302, dy: -13, face: 1, loop: true }, // 伙伴甲坐他那半边（蓝被子）晃腿
  palbed: { acts: ["bed"], only: ["pal"], x: 991, dy: -15, face: 1, loop: true }, // 伙伴乙有自己的房间和床了
  buddy: { acts: ["letter"], x: 434, face: 2, alt: "mid_07_nochair", loop: true, spd: 0.9 }, // 背影露裤子不要、侧坐看不出坐在椅子上 → 书桌换成去掉背对椅子的（alt），他坐自己带的侧面木椅上写信
  pal: { acts: ["radio"], x: 864, face: 1, loop: true, spd: 0.75 }, // 伙伴乙的收音机：蹲在右边
  hammock: { acts: ["hammock"], only: ["player", "buddy"], x: 380, face: 2, loop: true, spd: 0.9, swap: true }, // 躺吊床：整张「人躺在吊床里」换掉吊床本身
  hammock2: { acts: ["hammock"], only: ["pal"], x: 786, face: 2, loop: true, spd: 0.9, swap: true },
  window: { acts: ["window"], x: 551, dy: -6, face: 2, loop: true, spd: 0.8 }, // 跪在软垫上背对我们趴窗
  chest: { acts: ["chest"], x: 253, face: 2, loop: true, per: { buddy: { x: 265 } }, spd: 0.7 }, // 蹲在木箱左边翻
  jar: { acts: ["jar"], x: 350, face: 1, loop: true, spd: 0.8 }, // 站罐子右边捧着看
  pinwheel: { acts: ["pinwheel"], x: 606, face: 2, loop: true, spd: 0.6 }, // 站风车左边吹
  record: { acts: ["dance"], x: 778, face: 2, loop: true, spd: 0.5 }, // 唱片机搬到伙伴乙的房间，在门口那块空地跳
  gramo: { acts: ["dance"], x: 548, face: 2, loop: true, per: { buddy: { x: 604 } }, spd: 0.5 }, // 留声机边跳舞
  wardrobe: { acts: ["wardrobe"], x: 178, face: 1, loop: true, spd: 0.8 }, // 衣柜右边拿裙子比
  cabinet: { acts: ["cabinet"], x: 437, face: 2, loop: true, spd: 0.8 }, // 纪念品柜左边贴着看
  dex: { acts: ["dex"], x: 556, face: 1, loop: true, spd: 0.8 }, // 图鉴柜右边翻书
  board: { acts: ["board"], x: 563, face: 2, loop: true, spd: 0.8 }, // 照片绳底下踮脚挂照片
  books: { acts: ["books"], x: 644, face: 1, loop: true, spd: 0.8 }, // 书架右边抽书看
  stove: { acts: ["stove"], x: 252, face: 1, loop: true, spd: 0.8 }, // 蹲在炉子右边往炉膛添柴扇风
  rods: { acts: ["rods"], x: 296, face: 1, loop: true, spd: 0.8 }, // 钓竿架左边挑竿
  table: { acts: ["table"], x: 324, face: 2, loop: true, per: { buddy: { x: 396, face: 1 } }, spd: 0.9 }, // 坐粉色那把椅子，朝着牌桌喝茶
  cat: { acts: ["cat"], x: 474, dy: 14, face: 2, loop: true, spd: 0.7 }, // 猫窝在前景 → 往前蹲到猫窝左边摸猫
  shoes: { acts: ["shoes"], x: 614, face: 2, loop: true, spd: 0.8 }, // 鞋架右边拿鞋换上
  clock: { acts: ["clock"], x: 555, face: 2, loop: true, spd: 0.8 }, // 布谷钟底下仰头看
  tank: { acts: ["tank"], x: 706, face: 2, loop: true, spd: 0.8 }, // 竹管左边贴着玻璃看鱼（哪层点就在哪层）
  // 新家具的动作。acts 里按人有没有图自动挑：玩家 / 伙伴各用各的
  sofa: { acts: ["sofa", "sofaarm"], x: 470, dy: -11, face: 2, loop: true, spd: 0.9, per: { buddy: { x: 480 }, pal: { x: 487 } } }, // 坐沙发抱抱枕；伙伴乙正常坐右边那个座位看手机
  crab: { acts: ["crab", "crabpoke"], x: 516, face: 2, loop: true, spd: 0.7, per: { buddy: { x: 566, dy: 2 } } }, // 玩家扑上去抱住蹭；伙伴甲坐旁边被钳子搭肩；伙伴乙戳一下眼睛走开（一次性）
  tea: { acts: ["tea"], x: 848, dy: -2, face: 2, loop: true, spd: 0.9, per: { buddy: { x: 898, dy: -11 }, pal: { x: 899 } } }, // 阁楼小圆桌：玩家捧杯吹；伙伴甲倒茶递出去；伙伴乙倒一杯直接喝
  shelf: { acts: ["shelf"], x: 534, face: 1, loop: true, spd: 1, per: { buddy: { x: 522 }, pal: { face: 1, x: 486 } } }, // 靠着书架看书：玩家《小王子》、伙伴甲《当你像鸟飞往你的山》，伙伴乙翻两页插回去
  mbox: { acts: ["mbox", "mboxput"], x: 650, face: 2, loop: true, spd: 0.9, hide: true }, // 早晨盒子：玩家打开看；伙伴甲只往里放、扣好（图里自带盒子，用的时候家具那个先藏起来）
  painting: { acts: ["paint", "paintglance"], x: 255, face: 2, loop: true, spd: 0.9 }, // 玩家歪头看；伙伴甲摸画里的小螃蟹回头看玩家；伙伴乙看一眼就走
  paldesk: { acts: ["desk"], only: ["pal"], x: 942, dy: -4, face: 1, loop: true, spd: 1 }, // 伙伴乙的书桌：空杯 + 书翻过去又翻回来
};
/** 两个人一起用：玩家和伙伴甲都在这件家具上时，换成一张两人合在一起的图（acts/<k>.png，一行 3 帧），画在两人中间。
 * 沙发：一个靠另一个肩膀（谁靠谁随机）。伙伴乙不参与 */
export const TH_DUO: Record<string, { k: string[]; spd?: number }> = {}; // 开源版：两人合图是玩家和伙伴甲的样子，不带 // 小圆桌不用合图：玩家那张本来就是捧杯吹、他那张是倒茶递过去，各坐一把椅子就是一对
/** 已经有图的（新生了图放进 acts/ 再在这儿加一个名字） */
// 开源版：人物用家具的动作图都是玩家们三个人的样子，不带；家具照样能点，人站在旁边
export const TH_ACT_HAVE = new Set<string>([]);

// ── 「做成能让我在游戏里自由编辑家具位置」——摆家具。
// 后端只存挪过的那几件（GET/POST /world/cabin/layout，{key:{room:"f0|f1|f2",x,y}}，单位跟这里一样是世界坐标）。
// applyLayout 在默认位置上改：家具挪了，站位（TH_SPOTS）、动作站哪（TH_ACTS）、床头纸条跟着平移；放在别的家具上的小东西跟着主人走。
export type THMove = { room?: string; x: number; y: number; s?: number; hide?: boolean };
export type THLayout = Record<string, THMove>;
/** 放在别的家具上的：跟着主人挪，自己不能单独拖 */
export const TH_ATTACH: Record<string, string> = { mid_08: "mid_07", attic_16: "mid_07", attic_13: "attic_11", mid_04: "mid_15", mid_19: "mid_15" };
/** 没有自己家具图的站位跟谁走 */
const SPOT_FURN: Record<string, string> = { buddybed: "mid_15" };
/** 动作的人坐 / 站在哪件家具上（跟站位的家具不是同一件的）：伙伴乙的书桌 → 坐那把椅子 */
const ACT_FURN: Record<string, string> = { paldesk: "mid_24" };
const F0 = TH_FURN.map(f => ({ ...f }));
const S0 = TH_SPOTS.map(q => ({ ...q }));
const A0: Record<string, { x: number; dy?: number; per?: Record<string, { x?: number; dy?: number }> }> = Object.fromEntries(Object.entries(TH_ACTS).map(([k, a]) => [k, { x: a.x, dy: a.dy, per: a.per ? Object.fromEntries(Object.entries(a.per).map(([w, p]) => [w, { x: p.x, dy: p.dy }])) : undefined }]));
const NOTE0 = { ...TH_NOTE };
/** 东西在哪一层：地上的看脚底离哪层地板最近，挂墙上的算它下面那层 */
export function thFloorOf(f: { y: number; hang?: boolean }) {
  if (f.hang) { for (let i = 0; i < TH_FLOOR.length; i++) if (TH_FLOOR[i].y > f.y) return i; return TH_FLOOR.length - 1; }
  let b = 0; for (let i = 1; i < TH_FLOOR.length; i++) if (Math.abs(TH_FLOOR[i].y - f.y) < Math.abs(TH_FLOOR[b].y - f.y)) b = i; return b;
}
export const thDefault = (k: string) => F0.find(f => f.k === k);
export function applyLayout(L: THLayout) {
  TH_FURN.forEach((f, i) => {
    const d = F0[i]; const par = TH_ATTACH[d.k]; const mv = L[par ?? d.k]; const pd = par ? thDefault(par) : d;
    if (mv && pd) { f.x = d.x + (mv.x - pd.x); f.y = d.y + (mv.y - pd.y); } else { f.x = d.x; f.y = d.y; }
    const k = par ? 1 : (L[d.k]?.s ?? 1); f.h = d.h * k; f.w = d.w != null ? d.w * k : undefined; // 放大缩小（放在上面的小东西不跟着变大）
  });
  const shift = (k: string) => { const i = F0.findIndex(f => f.k === k); return i < 0 ? null : { dx: TH_FURN[i].x - F0[i].x, f: thFloorOf(TH_FURN[i]), x0: F0[i].x, x: TH_FURN[i].x, sc: TH_FURN[i].h / F0[i].h }; };
  for (const q of TH_SPOTS) {
    const d = S0.find(z => z.id === q.id)!; const k = SPOT_FURN[q.id] ?? F0.find(f => f.spot === q.id)?.k; const s = k ? shift(k) : null;
    q.x = d.x + (s?.dx ?? 0); q.f = s ? s.f : d.f;
    // 「放大了互动还那么小」→ 家具放大缩小，人站 / 坐的位置离家具中心的距离、坐的高度（dy）跟着同样缩放
    const sa = ACT_FURN[q.id] ? shift(ACT_FURN[q.id]) : s;
    const ax = (x0: number) => (sa ? sa.x + (x0 - sa.x0) * sa.sc : x0), ady = (d?: number) => (d == null ? d : Math.round(d * (sa?.sc ?? 1)));
    const a = TH_ACTS[q.id], a0 = A0[q.id]; if (a && a0) { a.x = ax(a0.x); a.dy = ady(a0.dy); if (a.per && a0.per) for (const [w, p] of Object.entries(a.per)) { const p0 = a0.per[w]; if (!p0) continue; if (p0.x != null) p.x = ax(p0.x); if (p0.dy != null) p.dy = ady(p0.dy); } }
  }
  const b = shift("mid_15"); const bi = F0.findIndex(f => f.k === "mid_15");
  TH_NOTE.x = NOTE0.x + (b?.dx ?? 0); TH_NOTE.y = NOTE0.y + (bi >= 0 ? TH_FURN[bi].y - F0[bi].y : 0);
}

// ── 客房──
// 二楼右边外面横出一根树枝，枝头一个花球房间，下面挂木牌（名字代码写）。图在 shell 像素里量的（÷TH_PX = 世界坐标）：
// sx/sy 图左上角在 shell 图里的位置，w/h 图大小，sign 木牌板子的框（写名字），sl 木牌那一层（绳子 + 板子 + 两边小花）的框，br 树枝那段的上下沿，split 树枝和花球的分界（长出来的动画用）
export type GuestArt = { k: string; sx: number; sy: number; w: number; h: number; sign: [number, number, number, number]; sl: [number, number, number, number]; br: [number, number]; split: number };
export const TH_GUEST_ART: Record<string, GuestArt> = { // 图左边多接了 90px 树枝根（淡进墙里，不留断口）
  c3: { k: "guest_c3", sx: 1426.8, sy: 36.6, w: 808, h: 736, sign: [441, 611, 205, 103], sl: [405, 557, 287, 179], br: [391, 581], split: 200 },
  c2: { k: "guest_c2", sx: 1426.8, sy: 49.8, w: 810, h: 739, sign: [441, 611, 207, 103], sl: [396, 557, 301, 182], br: [377, 587], split: 190 },
  c: { k: "guest_c", sx: 1426.8, sy: 47.4, w: 813, h: 732, sign: [447, 601, 206, 102], sl: [410, 547, 286, 179], br: [379, 586], split: 190 },
};
/** 效果图里花球画得太大（床比小屋里的床大一倍）：整间按树枝根缩小 */
export const TH_GUEST_SCALE = 0.58;
/** 第 2、3 间往右排：后一间的树枝从前一间花球后面穿出来 */
export const TH_GUEST_GAP = 268;
export const TH_GUEST_MAX = 3;
const ghash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** 谁住哪间、什么样：按第一次来的先后排位置；第一个朋友是 C3，后面的按名字随机 C2 / C1（同一个人每次都一样） */
export function thGuestRooms<G extends { id: string; firstAt: number }>(gs: G[]): { g: G; slot: number; art: GuestArt }[] {
  return [...gs].sort((a, b) => a.firstAt - b.firstAt).slice(0, TH_GUEST_MAX).map((g, i) => ({ g, slot: i, art: TH_GUEST_ART[i === 0 ? "c3" : ghash(g.id) % 2 ? "c2" : "c"] }));
}
