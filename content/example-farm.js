// 农场的示例内容：种子、帮手的台词、谁有盆。
"use strict";
const C = {
 "SEEDS": {
  "strawberry": {
   "name": "草莓",
   "price": 30,
   "sell": 18,
   "likesRain": false,
   "sign": "红了就是熟了。"
  },
  "tomato": {
   "name": "小番茄",
   "price": 25,
   "sell": 14,
   "likesRain": true,
   "sign": "一串一串的。"
  },
  "radish": {
   "name": "小萝卜",
   "price": 15,
   "sell": 8,
   "likesRain": true,
   "sign": "不是巨型的那个。"
  },
  "sunflower": {
   "name": "向日葵",
   "price": 40,
   "sell": 24,
   "likesRain": false,
   "sign": "跟着太阳转。"
  },
  "mint": {
   "name": "薄荷",
   "price": 20,
   "sell": 10,
   "likesRain": true,
   "sign": "泡水喝。"
  },
  "cotton": {
   "name": "棉花",
   "price": 35,
   "sell": 20,
   "likesRain": false,
   "sign": "软的。"
  }
 },
 "PACK": 3,
 "HELPERS": {
  "buddy": {
   "odds": 0.5,
   "line": [
    "帮你浇了。",
    "竹管我应该转回去了吧。"
   ]
  },
  "pal": {
   "odds": 0.35,
   "line": [
    "浇了。",
    "水够。"
   ],
   "sign": [
    "请勿踩",
    "已浇"
   ]
  }
 },
 "FLOOD_LINE": "我浇了，好像有点多。",
 "NAMES": {
  "player": "你",
  "buddy": "阿树",
  "pal": "小石"
 },
 "HOST": "player",
 "HOME": [
  "player",
  "buddy",
  "pal"
 ],
 "POT_KIND": {
  "player": "umbrella",
  "buddy": "boat",
  "pal": "suitcase"
 },
 "FLOODER": "buddy"
};
C.HYBRID_NAME = (a, b, nameA, nameB) => `${nameA.slice(0, 1)}${nameB.slice(0, 1)}${String(C.SEEDS[a]?.name || a).slice(0, 2)}${String(C.SEEDS[b]?.name || b).slice(-1)}`;
module.exports = C;
