// node test/ddz.test.js —— 斗地主规则：牌型、比大小、提示、托管自己打完整局
"use strict";
const D = require("../engine/ddz.js");
let fail = 0; const ok = (c, m) => { if (c) console.log(`✓ ${m}`); else { fail++; console.log(`✗ ${m}`); } };
// 点数 → 编号（同点数取不同花色）
const ids = (...rs) => { const used = {}; return rs.map((r) => { if (r === 16) return 52; if (r === 17) return 53; const k = (used[r] = (used[r] || 0) + 1) - 1; return (r - 3) * 4 + k; }); };
const T = (rs) => (D.analyze(ids(...rs)) || {}).type;
ok(T([5]) === "single", "单张");
ok(T([5, 5]) === "pair", "对子");
ok(T([16, 17]) === "rocket", "王炸");
ok(T([9, 9, 9, 9]) === "bomb", "炸弹");
ok(T([9, 9, 9, 4]) === "triple1", "三带一");
ok(T([9, 9, 9, 4, 4]) === "triple2", "三带二");
ok(T([3, 4, 5, 6, 7]) === "straight", "顺子");
ok(T([10, 11, 12, 13, 14]) === "straight", "顺子到 A");
ok(!T([11, 12, 13, 14, 15]), "顺子不能带 2");
ok(T([3, 3, 4, 4, 5, 5]) === "pairs", "连对");
ok(T([6, 6, 6, 7, 7, 7]) === "plane", "飞机");
ok(T([6, 6, 6, 7, 7, 7, 3, 9]) === "plane1", "飞机带单");
ok(T([6, 6, 6, 7, 7, 7, 3, 3, 9, 9]) === "plane2", "飞机带对");
ok(T([8, 8, 8, 8, 3, 5]) === "four2", "四带二");
ok(T([8, 8, 8, 8, 3, 3, 5, 5]) === "four2p", "四带两对");
ok(!T([3, 4]), "乱牌不算");
const A = (rs) => D.analyze(ids(...rs));
ok(D.beats(A([6]), A([5])) && !D.beats(A([5]), A([6])), "单张比大小");
ok(D.beats(A([4, 4, 4, 4]), A([15, 15])), "炸弹压对子");
ok(D.beats(A([16, 17]), A([15, 15, 15, 15])), "王炸压炸弹");
ok(!D.beats(A([4, 5, 6, 7, 8, 9]), A([3, 4, 5, 6, 7])), "顺子长度不同不能压");
ok(D.hint(ids(3, 5, 9, 9, 15), D.analyze(ids(8, 8))).map(D.rankOf).join() === "9,9", "提示：最小能压的对子");
ok(D.hint(ids(3, 5), D.analyze(ids(15))) === null, "提示：压不过返回空");
ok(D.idsFromText(ids(3, 3, 3, 4, 16, 17), "3 3 3 4").length === 4 && D.idsFromText(ids(16, 17), "小王 大王").length === 2, "文字出牌");
// 托管自己打 500 局：每局都能打完、分数加起来是 0、不报错
let games = 0, errs = 0, steps = 0;
for (let i = 0; i < 500; i++) {
  let g = D.deal(["a", "b", "c"]); let n = 0;
  while (g.phase !== "done" && n < 400) { const r = D.autoStep(g); n++; if (r && r.redeal) { g = D.deal(["a", "b", "c"]); continue; } if (!r || r.error) { errs++; break; } }
  if (g.phase === "done") { games++; const sum = Object.values(g.score).reduce((a, b) => a + b, 0); if (sum !== 0) errs++; const total = Object.values(g.hands).reduce((a, h) => a + h.length, 0) + g.plays.filter((p) => !p.pass).reduce((a, p) => a + p.ids.length, 0); if (total !== 54) errs++; }
  steps += n;
}
ok(games === 500 && errs === 0, `托管打完 500 局（${games} 局完成，${errs} 个错，平均 ${Math.round(steps / 500)} 步）`);
console.log(fail ? `\n${fail} 项没过` : "\n全部通过"); process.exit(fail ? 1 : 0);
