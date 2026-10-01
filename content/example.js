// 示例内容包：谁是谁、鱼、商店、台词。换成你自己的：复制一份改，再用 WORLD_CONTENT=你的文件 启动。
// 鱼的签名（sign）大多留空——那是给你写的。
"use strict";
module.exports = {
 "ROLES": {
  "host": "player",
  "partner": "buddy",
  "companions": [
   "buddy",
   "pal"
  ],
  "names": {
   "player": "你",
   "buddy": "阿树",
   "pal": "小石"
  }
 },
 "SPECIES": [
  {
   "id": "crucian",
   "name": "小鲫鱼",
   "spot": "pond",
   "r": 0,
   "kg": [
    0.05,
    0.4
   ],
   "sign": "还在长。"
  },
  {
   "id": "minnow",
   "name": "麦穗鱼",
   "spot": "pond",
   "r": 0,
   "kg": [
    0.02,
    0.1
   ],
   "sign": "我们很多。"
  },
  {
   "id": "loach",
   "name": "泥鳅",
   "spot": "pond",
   "r": 1,
   "kg": [
    0.03,
    0.2
   ],
   "sign": "滑。"
  },
  {
   "id": "carp_red",
   "name": "红鲤鱼",
   "spot": "pond",
   "r": 2,
   "kg": [
    0.5,
    3
   ],
   "sign": "早上才红。",
   "hours": [
    5,
    10
   ]
  },
  {
   "id": "koi_gold",
   "name": "金锦鲤",
   "spot": "pond",
   "r": 3,
   "kg": [
    1,
    5
   ],
   "sign": "傍晚见。",
   "hours": [
    16,
    20
   ]
  },
  {
   "id": "pond_lord",
   "name": "水底之主",
   "spot": "pond",
   "r": 4,
   "kg": [
    8,
    20
   ],
   "sign": "这片水是我的。",
   "hours": [
    0,
    4
   ]
  },
  {
   "id": "hemiculter",
   "name": "白条",
   "spot": "pond",
   "r": 0,
   "kg": [
    0.02,
    0.12
   ],
   "sign": ""
  },
  {
   "id": "bitterling",
   "name": "鳑鲏",
   "spot": "pond",
   "r": 0,
   "kg": [
    0.01,
    0.04
   ],
   "sign": ""
  },
  {
   "id": "tilapia",
   "name": "罗非鱼",
   "spot": "pond",
   "r": 0,
   "kg": [
    0.2,
    1.2
   ],
   "sign": ""
  },
  {
   "id": "crayfish",
   "name": "小龙虾",
   "spot": "pond",
   "r": 0,
   "kg": [
    0.02,
    0.06
   ],
   "sign": ""
  },
  {
   "id": "grass_carp",
   "name": "草鱼",
   "spot": "pond",
   "r": 1,
   "kg": [
    1,
    6
   ],
   "sign": ""
  },
  {
   "id": "yellow_cat",
   "name": "黄颡鱼",
   "spot": "pond",
   "r": 1,
   "kg": [
    0.05,
    0.3
   ],
   "sign": ""
  },
  {
   "id": "bream",
   "name": "鳊鱼",
   "spot": "pond",
   "r": 1,
   "kg": [
    0.3,
    1.5
   ],
   "sign": ""
  },
  {
   "id": "silver_carp",
   "name": "鲢鱼",
   "spot": "pond",
   "r": 1,
   "kg": [
    1,
    8
   ],
   "sign": ""
  },
  {
   "id": "culter",
   "name": "翘嘴",
   "spot": "pond",
   "r": 2,
   "kg": [
    0.5,
    4
   ],
   "sign": "",
   "hours": [
    16,
    20
   ]
  },
  {
   "id": "snakehead",
   "name": "黑鱼",
   "spot": "pond",
   "r": 2,
   "kg": [
    1,
    5
   ],
   "sign": ""
  },
  {
   "id": "catfish",
   "name": "鲶鱼",
   "spot": "pond",
   "r": 2,
   "kg": [
    1,
    10
   ],
   "sign": "",
   "hours": [
    20,
    24
   ]
  },
  {
   "id": "turtle",
   "name": "甲鱼",
   "spot": "pond",
   "r": 2,
   "kg": [
    0.5,
    3
   ],
   "sign": ""
  },
  {
   "id": "mandarin_fish",
   "name": "鳜鱼",
   "spot": "pond",
   "r": 3,
   "kg": [
    0.5,
    3
   ],
   "sign": ""
  },
  {
   "id": "sucker",
   "name": "胭脂鱼",
   "spot": "pond",
   "r": 3,
   "kg": [
    1,
    6
   ],
   "sign": "",
   "hours": [
    5,
    9
   ]
  },
  {
   "id": "eel",
   "name": "鳗鱼",
   "spot": "pond",
   "r": 3,
   "kg": [
    0.3,
    2
   ],
   "sign": "",
   "hours": [
    0,
    5
   ]
  },
  {
   "id": "black_carp",
   "name": "青鱼王",
   "spot": "pond",
   "r": 4,
   "kg": [
    10,
    30
   ],
   "sign": ""
  },
  {
   "id": "sardine",
   "name": "沙丁鱼",
   "spot": "sea",
   "r": 0,
   "kg": [
    0.05,
    0.2
   ],
   "sign": "挤在一起才不怕。"
  },
  {
   "id": "mackerel",
   "name": "小鲭鱼",
   "spot": "sea",
   "r": 0,
   "kg": [
    0.2,
    0.8
   ],
   "sign": ""
  },
  {
   "id": "goby",
   "name": "虾虎鱼",
   "spot": "sea",
   "r": 0,
   "kg": [
    0.02,
    0.1
   ],
   "sign": ""
  },
  {
   "id": "croaker",
   "name": "小黄鱼",
   "spot": "sea",
   "r": 0,
   "kg": [
    0.1,
    0.5
   ],
   "sign": ""
  },
  {
   "id": "sea_bream",
   "name": "真鲷",
   "spot": "sea",
   "r": 1,
   "kg": [
    0.5,
    3
   ],
   "sign": ""
  },
  {
   "id": "flounder",
   "name": "比目鱼",
   "spot": "sea",
   "r": 1,
   "kg": [
    0.3,
    2
   ],
   "sign": ""
  },
  {
   "id": "squid",
   "name": "乌贼",
   "spot": "sea",
   "r": 1,
   "kg": [
    0.2,
    1.5
   ],
   "sign": ""
  },
  {
   "id": "sea_bass",
   "name": "海鲈",
   "spot": "sea",
   "r": 1,
   "kg": [
    0.8,
    4
   ],
   "sign": ""
  },
  {
   "id": "clownfish",
   "name": "小丑鱼",
   "spot": "sea",
   "r": 2,
   "kg": [
    0.05,
    0.15
   ],
   "sign": ""
  },
  {
   "id": "puffer",
   "name": "河豚",
   "spot": "sea",
   "r": 2,
   "kg": [
    0.3,
    1.5
   ],
   "sign": ""
  },
  {
   "id": "octopus",
   "name": "章鱼",
   "spot": "sea",
   "r": 2,
   "kg": [
    0.5,
    5
   ],
   "sign": ""
  },
  {
   "id": "grouper",
   "name": "石斑鱼",
   "spot": "sea",
   "r": 2,
   "kg": [
    1,
    8
   ],
   "sign": ""
  },
  {
   "id": "seahorse",
   "name": "海马",
   "spot": "sea",
   "r": 3,
   "kg": [
    0.01,
    0.05
   ],
   "sign": ""
  },
  {
   "id": "tuna",
   "name": "金枪鱼",
   "spot": "sea",
   "r": 3,
   "kg": [
    20,
    80
   ],
   "sign": "那根竿拉不动我。"
  },
  {
   "id": "lanternfish",
   "name": "灯笼鱼",
   "spot": "sea",
   "r": 3,
   "kg": [
    0.02,
    0.1
   ],
   "sign": "",
   "hours": [
    19,
    24
   ]
  },
  {
   "id": "moon_jelly",
   "name": "月光水母",
   "spot": "sea",
   "r": 4,
   "kg": [
    0.5,
    2
   ],
   "sign": "",
   "hours": [
    21,
    24
   ]
  },
  {
   "id": "shell",
   "name": "贝壳",
   "spot": "sea",
   "r": 0,
   "kg": [
    0.02,
    0.1
   ],
   "junk": true,
   "sign": ""
  },
  {
   "id": "kelp",
   "name": "海带",
   "spot": "sea",
   "r": 0,
   "kg": [
    0.2,
    1
   ],
   "junk": true,
   "sign": ""
  },
  {
   "id": "starfish",
   "name": "海星",
   "spot": "sea",
   "r": 1,
   "kg": [
    0.1,
    0.4
   ],
   "junk": true,
   "sign": ""
  },
  {
   "id": "icefish",
   "name": "小银鱼",
   "spot": "lake",
   "r": 0,
   "kg": [
    0.005,
    0.02
   ],
   "sign": ""
  },
  {
   "id": "lake_shrimp",
   "name": "湖虾",
   "spot": "lake",
   "r": 0,
   "kg": [
    0.01,
    0.03
   ],
   "sign": ""
  },
  {
   "id": "trout",
   "name": "虹鳟",
   "spot": "lake",
   "r": 1,
   "kg": [
    0.5,
    3
   ],
   "sign": ""
  },
  {
   "id": "bighead",
   "name": "胖头鱼",
   "spot": "lake",
   "r": 1,
   "kg": [
    2,
    12
   ],
   "sign": ""
  },
  {
   "id": "pike",
   "name": "狗鱼",
   "spot": "lake",
   "r": 2,
   "kg": [
    1,
    8
   ],
   "sign": ""
  },
  {
   "id": "yellowcheek",
   "name": "鳡鱼",
   "spot": "lake",
   "r": 2,
   "kg": [
    2,
    15
   ],
   "sign": ""
  },
  {
   "id": "sturgeon",
   "name": "中华鲟",
   "spot": "lake",
   "r": 3,
   "kg": [
    20,
    80
   ],
   "sign": ""
  },
  {
   "id": "mist_carp",
   "name": "雾鲤",
   "spot": "lake",
   "r": 4,
   "kg": [
    5,
    18
   ],
   "sign": "起雾才在。",
   "fog": true
  },
  {
   "id": "oar",
   "name": "旧船桨",
   "spot": "lake",
   "r": 0,
   "kg": [
    1,
    2
   ],
   "junk": true,
   "sign": ""
  },
  {
   "id": "paper_boat",
   "name": "纸船",
   "spot": "lake",
   "r": 1,
   "kg": [
    0.01,
    0.02
   ],
   "junk": true,
   "sign": ""
  },
  {
   "id": "lifebuoy",
   "name": "救生圈",
   "spot": "sea",
   "r": 0,
   "kg": [
    1,
    2
   ],
   "junk": true,
   "sign": ""
  },
  {
   "id": "duck",
   "name": "小黄鸭",
   "spot": "pond",
   "r": 1,
   "junk": true,
   "kg": [
    0.03,
    0.05
   ],
   "sign": ""
  },
  {
   "id": "umbrella",
   "name": "旧雨伞",
   "spot": "pond",
   "r": 0,
   "junk": true,
   "kg": [
    0.3,
    0.6
   ],
   "sign": ""
  },
  {
   "id": "boot",
   "name": "旧靴子",
   "spot": "pond",
   "r": 0,
   "junk": true,
   "kg": [
    0.4,
    0.9
   ],
   "sign": ""
  },
  {
   "id": "bottle",
   "name": "瓶中信",
   "spot": "pond",
   "r": 2,
   "junk": true,
   "kg": [
    0.3,
    0.5
   ],
   "sign": ""
  },
  {
   "id": "glow_shrimp",
   "name": "萤火虾",
   "spot": "river",
   "r": 0,
   "kg": [
    0.01,
    0.03
   ],
   "sign": ""
  },
  {
   "id": "knifefish",
   "name": "刀鱼",
   "spot": "river",
   "r": 0,
   "kg": [
    0.05,
    0.3
   ],
   "sign": ""
  },
  {
   "id": "moonfish",
   "name": "月亮鱼",
   "spot": "river",
   "r": 1,
   "kg": [
    0.3,
    1.5
   ],
   "sign": ""
  },
  {
   "id": "lamprey",
   "name": "七鳃鳗",
   "spot": "river",
   "r": 1,
   "kg": [
    0.2,
    1
   ],
   "sign": ""
  },
  {
   "id": "lantern_fish",
   "name": "提灯鱼",
   "spot": "river",
   "r": 2,
   "kg": [
    0.1,
    0.6
   ],
   "sign": ""
  },
  {
   "id": "star_carp",
   "name": "星斑鲤",
   "spot": "river",
   "r": 3,
   "kg": [
    1,
    6
   ],
   "sign": "",
   "hours": [
    21,
    24
   ]
  },
  {
   "id": "river_lord",
   "name": "夜河之主",
   "spot": "river",
   "r": 4,
   "kg": [
    12,
    40
   ],
   "sign": "等到三点。",
   "hours": [
    0,
    3
   ],
   "lord": true
  },
  {
   "id": "paper_umbrella",
   "name": "旧油纸伞",
   "spot": "river",
   "r": 0,
   "junk": true,
   "kg": [
    0.3,
    0.6
   ],
   "sign": ""
  },
  {
   "id": "river_lantern",
   "name": "莲花河灯",
   "spot": "river",
   "r": 1,
   "junk": true,
   "kg": [
    0.05,
    0.1
   ],
   "sign": ""
  },
  {
   "id": "star_jar",
   "name": "星星罐",
   "spot": "river",
   "r": 2,
   "junk": true,
   "kg": [
    0.2,
    0.4
   ],
   "sign": ""
  },
  {
   "id": "button_fish",
   "name": "纽扣鱼",
   "spot": "pond",
   "r": 0,
   "kg": [
    0.01,
    0.03
   ],
   "sign": "",
   "v2": true
  },
  {
   "id": "marsh_crucian",
   "name": "棉花糖鲫",
   "spot": "pond",
   "r": 1,
   "kg": [
    0.2,
    0.6
   ],
   "sign": "",
   "v2": true,
   "when": "rainAfter",
   "tags": [
    "sweet"
   ]
  },
  {
   "id": "lily_catfish",
   "name": "睡莲鲶",
   "spot": "pond",
   "r": 2,
   "kg": [
    1,
    4
   ],
   "sign": "",
   "v2": true,
   "when": "dawn"
  },
  {
   "id": "berry_snakehead",
   "name": "草莓斑鳢",
   "spot": "pond",
   "r": 2,
   "kg": [
    0.8,
    3
   ],
   "sign": "",
   "v2": true,
   "when": "farmBerry"
  },
  {
   "id": "mirror_fish",
   "name": "镜子鱼",
   "spot": "pond",
   "r": 3,
   "kg": [
    0.3,
    1
   ],
   "sign": "",
   "v2": true,
   "when": "noonSun"
  },
  {
   "id": "new_year_carp",
   "name": "年年有余鲤",
   "spot": "pond",
   "r": 3,
   "kg": [
    2,
    8
   ],
   "sign": "",
   "v2": true,
   "fest": "spring"
  },
  {
   "id": "firecracker_shrimp",
   "name": "爆竹虾",
   "spot": "pond",
   "r": 1,
   "kg": [
    0.01,
    0.03
   ],
   "sign": "",
   "v2": true,
   "fest": "spring"
  },
  {
   "id": "zongzi_fish",
   "name": "粽子鱼",
   "spot": "pond",
   "r": 2,
   "kg": [
    0.3,
    1
   ],
   "sign": "",
   "v2": true,
   "fest": "duanwu"
  },
  {
   "id": "dumpling_fish",
   "name": "饺子鱼",
   "spot": "pond",
   "r": 1,
   "kg": [
    0.1,
    0.4
   ],
   "sign": "",
   "v2": true,
   "fest": "dongzhi"
  },
  {
   "id": "ring_fish",
   "name": "年轮鱼",
   "spot": "pond",
   "r": 4,
   "kg": [
    1,
    5
   ],
   "sign": "",
   "v2": true,
   "fest": "anniv"
  },
  {
   "id": "boba_catfish",
   "name": "珍珠奶茶鲶",
   "spot": "pond",
   "r": 1,
   "kg": [
    0.3,
    1.5
   ],
   "sign": "",
   "v2": true,
   "tags": [
    "sweet"
   ]
  },
  {
   "id": "yarn_fish",
   "name": "毛线鱼",
   "spot": "pond",
   "r": 1,
   "kg": [
    0.1,
    0.4
   ],
   "sign": "",
   "v2": true
  },
  {
   "id": "slipper",
   "name": "一只拖鞋",
   "spot": "pond",
   "r": 0,
   "kg": [
    0.1,
    0.2
   ],
   "sign": "",
   "v2": true,
   "junk": true
  },
  {
   "id": "bubble_word_fish",
   "name": "泡泡字鱼",
   "spot": "sea",
   "r": 0,
   "kg": [
    0.05,
    0.2
   ],
   "sign": "",
   "v2": true
  },
  {
   "id": "envelope_ray",
   "name": "信封鳐",
   "spot": "sea",
   "r": 1,
   "kg": [
    0.5,
    2
   ],
   "sign": "",
   "v2": true,
   "likes": "letter"
  },
  {
   "id": "soda_jelly",
   "name": "汽水水母",
   "spot": "sea",
   "r": 2,
   "kg": [
    0.2,
    1
   ],
   "sign": "",
   "v2": true,
   "when": "hotAfternoon"
  },
  {
   "id": "constellation_eel",
   "name": "星座海鳗",
   "spot": "sea",
   "r": 3,
   "kg": [
    1,
    5
   ],
   "sign": "",
   "v2": true,
   "when": "clearNight"
  },
  {
   "id": "lighthouse_whale",
   "name": "灯塔小鲸",
   "spot": "sea",
   "r": 4,
   "kg": [
    3,
    9
   ],
   "sign": "",
   "v2": true,
   "when": "fogNight"
  },
  {
   "id": "jade_rabbit_bream",
   "name": "玉兔鲷",
   "spot": "sea",
   "r": 2,
   "kg": [
    0.5,
    2
   ],
   "sign": "",
   "v2": true,
   "fest": "midautumn"
  },
  {
   "id": "reindeer_catfish",
   "name": "铃铛驯鹿鲇",
   "spot": "sea",
   "r": 2,
   "kg": [
    1,
    4
   ],
   "sign": "",
   "v2": true,
   "fest": "xmas"
  },
  {
   "id": "bow_angelfish",
   "name": "蝴蝶结神仙鱼",
   "spot": "sea",
   "r": 1,
   "kg": [
    0.1,
    0.4
   ],
   "sign": "",
   "v2": true
  },
  {
   "id": "cat_bream",
   "name": "猫耳鲷",
   "spot": "sea",
   "r": 2,
   "kg": [
    0.5,
    2
   ],
   "sign": "",
   "v2": true
  },
  {
   "id": "inkstone_squid",
   "name": "墨斗鱼",
   "spot": "sea",
   "r": 2,
   "kg": [
    0.3,
    1.5
   ],
   "sign": "",
   "v2": true,
   "likedBy": "pal"
  },
  {
   "id": "pincer_crab",
   "name": "小钳子蟹",
   "spot": "sea",
   "r": 1,
   "kg": [
    0.05,
    0.2
   ],
   "sign": "",
   "v2": true
  },
  {
   "id": "meteor_fish",
   "name": "流星鱼",
   "spot": "sea",
   "r": 4,
   "kg": [
    0.1,
    0.5
   ],
   "sign": "",
   "v2": true,
   "when": "deepClearNight"
  },
  {
   "id": "old_earphones",
   "name": "旧耳机",
   "spot": "sea",
   "r": 0,
   "kg": [
    0.02,
    0.05
   ],
   "sign": "",
   "v2": true,
   "junk": true
  },
  {
   "id": "sail_fish",
   "name": "小帆船鱼",
   "spot": "lake",
   "r": 0,
   "kg": [
    0.02,
    0.08
   ],
   "sign": "",
   "v2": true
  },
  {
   "id": "rock_sugar_fish",
   "name": "冰糖鱼",
   "spot": "lake",
   "r": 0,
   "kg": [
    0.03,
    0.1
   ],
   "sign": "",
   "v2": true,
   "when": "cold",
   "tags": [
    "sweet"
   ]
  },
  {
   "id": "snowcap_trout",
   "name": "雪顶鳟",
   "spot": "lake",
   "r": 1,
   "kg": [
    0.5,
    2.5
   ],
   "sign": "",
   "v2": true
  },
  {
   "id": "windbell_fish",
   "name": "风铃鱼",
   "spot": "lake",
   "r": 2,
   "kg": [
    0.3,
    1.2
   ],
   "sign": "",
   "v2": true,
   "when": "windy"
  },
  {
   "id": "cloud_carp",
   "name": "云朵鲤",
   "spot": "lake",
   "r": 2,
   "kg": [
    1,
    5
   ],
   "sign": "",
   "v2": true,
   "when": "sunAfterRain"
  },
  {
   "id": "mirror_image_fish",
   "name": "倒影鱼",
   "spot": "lake",
   "r": 3,
   "kg": [
    0.5,
    3
   ],
   "sign": "",
   "v2": true,
   "when": "calmSun"
  },
  {
   "id": "tangyuan_fish",
   "name": "汤圆鱼",
   "spot": "lake",
   "r": 2,
   "kg": [
    0.1,
    0.4
   ],
   "sign": "",
   "v2": true,
   "fest": "lantern",
   "tags": [
    "sweet"
   ]
  },
  {
   "id": "qingtuan_fish",
   "name": "青团鱼",
   "spot": "lake",
   "r": 1,
   "kg": [
    0.1,
    0.3
   ],
   "sign": "",
   "v2": true,
   "fest": "qingming",
   "tags": [
    "sweet"
   ]
  },
  {
   "id": "chrysanthemum_fish",
   "name": "菊花鱼",
   "spot": "lake",
   "r": 2,
   "kg": [
    0.3,
    1.5
   ],
   "sign": "",
   "v2": true,
   "fest": "chongyang"
  },
  {
   "id": "laba_fish",
   "name": "八宝鱼",
   "spot": "lake",
   "r": 2,
   "kg": [
    0.3,
    1.2
   ],
   "sign": "",
   "v2": true,
   "fest": "laba"
  },
  {
   "id": "macaron_fish",
   "name": "马卡龙鱼",
   "spot": "lake",
   "r": 1,
   "kg": [
    0.05,
    0.2
   ],
   "sign": "",
   "v2": true,
   "tags": [
    "sweet"
   ]
  },
  {
   "id": "receiver_fish",
   "name": "听筒鱼",
   "spot": "lake",
   "r": 2,
   "kg": [
    0.3,
    1
   ],
   "sign": "",
   "v2": true,
   "when": "calling"
  },
  {
   "id": "page_fish",
   "name": "书页鱼",
   "spot": "lake",
   "r": 1,
   "kg": [
    0.01,
    0.05
   ],
   "sign": "",
   "v2": true,
   "when": "readToday"
  },
  {
   "id": "clock_fish",
   "name": "时钟鱼",
   "spot": "lake",
   "r": 2,
   "kg": [
    0.3,
    1
   ],
   "sign": "",
   "v2": true,
   "when": "hourEdge"
  },
  {
   "id": "rainbow_trout2",
   "name": "彩虹鳟",
   "spot": "lake",
   "r": 3,
   "kg": [
    1,
    4
   ],
   "sign": "",
   "v2": true,
   "when": "sunAfterRain"
  },
  {
   "id": "kite_string",
   "name": "断了的风筝线",
   "spot": "lake",
   "r": 0,
   "kg": [
    0.05,
    0.1
   ],
   "sign": "",
   "v2": true,
   "junk": true
  },
  {
   "id": "crescent_bitterling",
   "name": "月牙鳑鲏",
   "spot": "river",
   "r": 0,
   "kg": [
    0.01,
    0.04
   ],
   "sign": "",
   "v2": true,
   "when": "night"
  },
  {
   "id": "wick_fish",
   "name": "灯芯鱼",
   "spot": "river",
   "r": 1,
   "kg": [
    0.05,
    0.2
   ],
   "sign": "",
   "v2": true,
   "when": "night"
  },
  {
   "id": "wish_fish",
   "name": "许愿鱼",
   "spot": "river",
   "r": 3,
   "kg": [
    0.2,
    0.8
   ],
   "sign": "",
   "v2": true,
   "when": "wishDone"
  },
  {
   "id": "dream_fish",
   "name": "梦鱼",
   "spot": "river",
   "r": 4,
   "kg": [
    0.1,
    0.6
   ],
   "sign": "",
   "v2": true,
   "when": "dreaming"
  },
  {
   "id": "rabbit_lantern_fish",
   "name": "兔子灯鱼",
   "spot": "river",
   "r": 2,
   "kg": [
    0.2,
    0.6
   ],
   "sign": "",
   "v2": true,
   "fest": "lantern"
  },
  {
   "id": "dragonboat_loach",
   "name": "龙舟鳅",
   "spot": "river",
   "r": 2,
   "kg": [
    0.2,
    0.8
   ],
   "sign": "",
   "v2": true,
   "fest": "duanwu"
  },
  {
   "id": "magpie_bridge_fish",
   "name": "鹊桥鱼",
   "spot": "river",
   "r": 3,
   "kg": [
    0.1,
    0.3
   ],
   "sign": "",
   "v2": true,
   "fest": "qixi",
   "pair": true
  },
  {
   "id": "pumpkin_fish",
   "name": "南瓜灯鱼",
   "spot": "river",
   "r": 2,
   "kg": [
    0.5,
    2
   ],
   "sign": "",
   "v2": true,
   "fest": "halloween"
  },
  {
   "id": "earphone_eel",
   "name": "耳机鳗",
   "spot": "river",
   "r": 2,
   "kg": [
    0.2,
    0.8
   ],
   "sign": "",
   "v2": true,
   "when": "listening"
  },
  {
   "id": "drift_wish",
   "name": "漂流的许愿纸",
   "spot": "river",
   "r": 0,
   "kg": [
    0.01,
    0.02
   ],
   "sign": "",
   "v2": true,
   "junk": true
  },
  {
   "id": "heartbeat_fish",
   "name": "心跳鱼",
   "spot": "any",
   "r": 3,
   "kg": [
    0.2,
    0.6
   ],
   "sign": "",
   "v2": true,
   "fest": "love"
  },
  {
   "id": "mooncake_puffer",
   "name": "月饼鲀",
   "spot": "any",
   "r": 2,
   "kg": [
    0.3,
    1.2
   ],
   "sign": "",
   "v2": true,
   "fest": "midautumn",
   "tags": [
    "sweet"
   ]
  },
  {
   "id": "snowflake_fish",
   "name": "雪花鱼",
   "spot": "any",
   "r": 2,
   "kg": [
    0.1,
    0.4
   ],
   "sign": "",
   "v2": true,
   "fest": "snow"
  }
 ],
 "KEEPSAKE_IDS": [
  "bottle",
  "lord_scale"
 ],
 "MOONCAKE_DAYS": [
  [
   "2026-09-18",
   "2026-10-08"
  ]
 ],
 "SHOP": {
  "bait": {
   "worm": {
    "name": "蚯蚓",
    "price": 0,
    "pack": 0,
    "odds": [
     70,
     22,
     6.5,
     1.4,
     0.1
    ],
    "bite": [
     6,
     22
    ],
    "note": "不卖。你空手的时候秤砣偷偷塞的"
   },
   "bread": {
    "name": "面包屑",
    "price": 20,
    "pack": 10,
    "odds": [
     60,
     25,
     11,
     3.5,
     0.5
    ],
    "bite": [
     5,
     18
    ],
    "note": "新手饵，普通鱼多"
   },
   "jelly": {
    "name": "草莓软糖",
    "price": 80,
    "pack": 10,
    "odds": [
     45,
     30,
     17,
     6.5,
     1.5
    ],
    "bite": [
     5,
     16
    ],
    "note": "更容易钓到稀有鱼"
   },
   "star": {
    "name": "纸星星",
    "price": 120,
    "pack": 10,
    "odds": [
     65,
     22,
     9,
     3.5,
     0.5
    ],
    "night": [
     30,
     30,
     26,
     11,
     3
    ],
    "bite": [
     5,
     16
    ],
    "note": "白天一般，夜里（20 点到 5 点）稀有多"
   },
   "rain": {
    "name": "雨水珠",
    "price": 60,
    "pack": 10,
    "odds": [
     60,
     25,
     11,
     3.5,
     0.5
    ],
    "bite": [
     5,
     18
    ],
    "rainFast": true,
    "note": "下雨天咬钩快一倍"
   },
   "letter": {
    "name": "旧信纸屑",
    "price": 50,
    "pack": 10,
    "odds": [
     55,
     25,
     13,
     5.5,
     1.5
    ],
    "bite": [
     5,
     18
    ],
    "junk": 4,
    "note": "更容易钓到怪东西：瓶中信、纸条、发卡"
   },
   "mooncake": {
    "name": "月饼渣",
    "price": 200,
    "pack": 5,
    "odds": [
     25,
     30,
     28,
     13,
     4
    ],
    "bite": [
     4,
     12
    ],
    "limited": true,
    "fest": "midautumn",
    "note": "限时，节日前后才有"
   },
   "boba": {
    "name": "珍珠奶茶饵",
    "price": 90,
    "pack": 10,
    "odds": [
     45,
     30,
     17,
     6.5,
     1.5
    ],
    "bite": [
     5,
     16
    ],
    "sweet": true,
    "v2": true,
    "note": "甜点系的鱼（奶茶鲶、马卡龙、汤圆……）多三倍"
   },
   "firefly": {
    "name": "萤火饵",
    "price": 150,
    "pack": 10,
    "odds": [
     55,
     25,
     13,
     5.5,
     1.5
    ],
    "night": [
     28,
     28,
     26,
     13,
     5
    ],
    "bite": [
     5,
     16
    ],
    "v2": true,
    "note": "夜里 4★ 以上多（夜河最好用）"
   },
   "carrot": {
    "name": "胡萝卜丁",
    "price": 40,
    "pack": 10,
    "odds": [
     55,
     28,
     12,
     4,
     1
    ],
    "bite": [
     5,
     18
    ],
    "v2": true,
    "note": "池塘鱼爱吃；以后农场收的菜能自己切"
   },
   "magnet": {
    "name": "吸铁石",
    "price": 300,
    "pack": 5,
    "odds": [
     100,
     0,
     0,
     0,
     0
    ],
    "bite": [
     6,
     20
    ],
    "junkOnly": true,
    "v2": true,
    "note": "不钓鱼，专门吸怪东西"
   },
   "tangyuan": {
    "name": "汤圆馅",
    "price": 120,
    "pack": 5,
    "odds": [
     50,
     28,
     15,
     5.5,
     1.5
    ],
    "bite": [
     5,
     16
    ],
    "limited": true,
    "fest": "lantern",
    "v2": true,
    "note": "元宵前后才卖，元宵的鱼多两倍"
   },
   "zongye": {
    "name": "粽叶",
    "price": 120,
    "pack": 5,
    "odds": [
     50,
     28,
     15,
     5.5,
     1.5
    ],
    "bite": [
     5,
     16
    ],
    "limited": true,
    "fest": "duanwu",
    "v2": true,
    "note": "端午前后才卖，端午的鱼多两倍"
   },
   "jiaozi": {
    "name": "饺子馅",
    "price": 120,
    "pack": 5,
    "odds": [
     50,
     28,
     15,
     5.5,
     1.5
    ],
    "bite": [
     5,
     16
    ],
    "limited": true,
    "fest": "dongzhi",
    "v2": true,
    "note": "冬至前后才卖，冬至的鱼多两倍"
   }
  },
  "rod": {
   "pole": {
    "name": "晾衣杆",
    "price": 0,
    "pull": 1,
    "hold": 0,
    "note": "家里拆下来的"
   },
   "umbrella": {
    "name": "旧伞骨竿",
    "price": 300,
    "pull": 0.92,
    "hold": 0.03,
    "note": "张力涨得慢 8%"
   },
   "flute": {
    "name": "竹笛竿",
    "price": 900,
    "pull": 0.84,
    "hold": 0.06,
    "note": "张力涨得慢 16%"
   },
   "moon": {
    "name": "月牙竿",
    "price": 2400,
    "pull": 0.75,
    "hold": 0.1,
    "note": "张力涨得慢 25%"
   },
   "umbrella_handle": {
    "name": "伞柄竿",
    "price": 1600,
    "pull": 0.88,
    "hold": 0.05,
    "luck": 0.03,
    "v2": true,
    "note": "伞树枝做的，张力慢 12%，运气 +3%"
   },
   "star": {
    "name": "钓星竿",
    "price": 5000,
    "pull": 0.7,
    "hold": 0.12,
    "nightLuck": 0.05,
    "v2": true,
    "note": "张力慢 30%，夜里运气 +5%"
   }
  },
  "bobber": {
   "wood": {
    "name": "木头浮漂",
    "price": 0,
    "luck": 0,
    "note": "普普通通"
   },
   "cherry": {
    "name": "樱桃浮漂",
    "price": 800,
    "luck": 0.05,
    "note": "运气 +5%"
   },
   "star": {
    "name": "星星浮漂",
    "price": 1500,
    "luck": 0.05,
    "nightLuck": 0.1,
    "note": "运气 +5%，夜里 +10%"
   },
   "melody": {
    "name": "兔耳浮漂",
    "price": 2500,
    "luck": 0.1,
    "note": "运气 +10%"
   },
   "bell": {
    "name": "铃铛浮漂",
    "price": 1000,
    "luck": 0,
    "aiWait": 20000,
    "v2": true,
    "note": "咬钩时叮一声；伙伴们咬钩多等 20 秒"
   },
   "lantern": {
    "name": "灯笼浮漂",
    "price": 1800,
    "luck": 0,
    "nightLuck": 0.12,
    "v2": true,
    "note": "夜里运气 +12%"
   },
   "duck": {
    "name": "小鸭浮漂",
    "price": 600,
    "luck": 0,
    "v2": true,
    "note": "没效果，就是可爱，漂着会转圈"
   }
  },
  "reel": {
   "cotton": {
    "name": "棉线轴",
    "price": 0,
    "reel": 1,
    "cap": 1,
    "note": "普普通通"
   },
   "brass": {
    "name": "铜线轴",
    "price": 1200,
    "reel": 0.85,
    "cap": 1.15,
    "note": "收线快 15%，线结实 15%"
   },
   "silver": {
    "name": "银线轴",
    "price": 2800,
    "reel": 0.7,
    "cap": 1.3,
    "note": "收线快 30%，线结实 30%"
   },
   "gold": {
    "name": "金线轴",
    "price": 5200,
    "reel": 0.6,
    "cap": 1.45,
    "v2": true,
    "note": "收线快 40%，线结实 45%"
   }
  },
  "charm": {
   "none": {
    "name": "没挂",
    "price": 0,
    "note": ""
   },
   "glasses": {
    "name": "秤砣的旧眼镜",
    "price": 1800,
    "note": "咬钩的时候就看得出几星"
   },
   "watch": {
    "name": "秤砣的怀表",
    "price": 2200,
    "hint": true,
    "v2": true,
    "note": "打开能看这会儿哪条特别的鱼在出（[钓鱼:怀表]）"
   },
   "clover": {
    "name": "四叶草",
    "price": 1200,
    "luck": 0.04,
    "v2": true,
    "note": "运气 +4%"
   },
   "windbell": {
    "name": "小风铃挂件",
    "price": 900,
    "windLuck": 0.08,
    "v2": true,
    "note": "风大的时候运气 +8%"
   }
  },
  "bucket": {
   "pail": {
    "name": "小水桶",
    "price": 0,
    "size": 20,
    "note": "20 格"
   },
   "basket": {
    "name": "野餐篮",
    "price": 600,
    "size": 32,
    "note": "32 格"
   },
   "tank": {
    "name": "玻璃背包鱼缸",
    "price": 1500,
    "size": 48,
    "note": "48 格"
   },
   "icebox": {
    "name": "冰鱼箱",
    "price": 3200,
    "size": 64,
    "fresh": true,
    "v2": true,
    "note": "64 格，鱼放进去不会臭"
   }
  },
  "item": {
   "sunny_doll": {
    "name": "晴天娃娃",
    "price": 250,
    "v2": true,
    "note": "挂上，你在的钓点接下来一小时小世界里天晴"
   },
   "rain_pot": {
    "name": "雨壶",
    "price": 150,
    "v2": true,
    "note": "往伞树农场的伞里倒 2 格水"
   },
   "wrap": {
    "name": "包装纸",
    "price": 30,
    "v2": true,
    "note": "下次送鱼包起来，对方拆开有一小段动画"
   },
   "rubbing": {
    "name": "鱼拓纸",
    "price": 200,
    "v2": true,
    "note": "把你钓过最重的那条拓下来，挂进小屋"
   },
   "rumor": {
    "name": "秤砣的小道消息",
    "price": 50,
    "v2": true,
    "note": "秤砣压低声音告诉你一条今天哪儿有稀罕货（偶尔瞎说）"
   }
  },
  "decor": {
   "decor_fish_chime": {
    "name": "鱼形风铃",
    "price": 600,
    "v2": true,
    "note": "挂在小屋窗边，风一吹叮叮响"
   },
   "decor_lanterns": {
    "name": "小纸灯笼串",
    "price": 800,
    "v2": true,
    "note": "晚上会亮"
   },
   "decor_fishbone_clock": {
    "name": "鱼骨挂钟",
    "price": 1200,
    "v2": true,
    "note": "走的是真实时间"
   },
   "decor_shell_frame": {
    "name": "贝壳相框",
    "price": 500,
    "v2": true,
    "note": "放一张你们的照片"
   },
   "decor_glass_float": {
    "name": "玻璃浮球灯",
    "price": 1500,
    "v2": true,
    "note": "渔网兜着的玻璃浮球，里面亮着"
   }
  }
 },
 "SHOP_HELP": "秤砣的店（亮鳞）：饵 面包屑20 草莓软糖80 纸星星120（夜里灵） 雨水珠60（下雨快） 旧信纸屑50（怪东西多） 月饼渣200（限时）；竿 旧伞骨300 竹笛900 月牙2400；浮漂 樱桃800 星星1500 兔耳2500；线轴 铜1200 银2800；挂件 秤砣的旧眼镜1800；桶 野餐篮600 玻璃背包鱼缸1500。卖鱼按星级 + 重量刮鳞，不设上限。[钓鱼:卖 鱼名] [钓鱼:卖 全部] [钓鱼:买 草莓软糖] [钓鱼:换 纸星星]",
 "WHEN_TEXT": {
  "dreaming": "伙伴在做梦",
  "listening": "你们在一起听歌",
  "calling": "你们在打电话"
 },
 "CHEER_LINES": {
  "加油": [
   "稳住！",
   "快了！",
   "别松手！"
  ],
  "放线": [
   "放线！"
  ]
 }
};
