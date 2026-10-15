// 打赌欠条的假后端：只在测试版（VITE_TEST_OPEN）+ 网址带 ?betmock 时用。规则照 设计说明；台词占位。
import type { WBetState, WBet, WIou } from "../api/ccBridge";

const st: WBetState = {
  bet: null,
  ious: [
    { id: "i1", debtor: "buddy", creditor: "player", stake: "给你唱首歌", at: Date.now() - 86400e3 * 2 },
    { id: "i2", debtor: "player", creditor: "pal", stake: "请他喝奶茶", at: Date.now() - 86400e3, paidMark: null },
    { id: "i0", debtor: "pal", creditor: "player", stake: "夸你十句", at: Date.now() - 86400e3 * 5, tornAt: Date.now() - 86400e3 * 4 },
  ],
  presets: ["唱首歌", "讲个睡前故事", "夸对方十句", "请喝奶茶", "画一张画", "听对方安排一天"],
  kinds: [{ k: "biggest", name: "谁钓的最大" }, { k: "count", name: "谁钓得多" }],
  spans: [{ k: "30m", name: "30 分钟" }, { k: "1h", name: "1 小时" }, { k: "tonight", name: "到今晚 12 点" }],
};
const clone = (): WBetState => JSON.parse(JSON.stringify(st));
let n = 3;
export const betMock = {
  bet: async (): Promise<WBetState> => {
    const b = st.bet; // 演示：开赌 3 秒后对方接；之后分数慢慢涨；到点结算
    if (b?.phase === "asking" && Date.now() - b.startAt > 3000) { b.phase = "on"; b.lines = [...(b.lines ?? []), { who: b.with, line: b.with === "buddy" ? "赌就赌！输了别哭哦" : "行。", at: Date.now() }]; }
    if (b?.phase === "on") { const t = (Date.now() - b.startAt) / 1000; b.score = { player: { w: Math.round(t * 30) / 10, n: Math.floor(t / 4) }, [b.with]: { w: Math.round(t * 26) / 10, n: Math.floor(t / 5) } };
      if (Date.now() > b.endAt) { b.phase = "done"; const win = (b.score.player?.w ?? 0) >= (b.score[b.with]?.w ?? 0) ? "player" : b.with; b.result = { winner: win, line: win === "player" ? "……愿赌服输。" : "嘿嘿，记得还哦" };
        st.ious.unshift({ id: "i" + n++, debtor: win === "player" ? b.with : "player", creditor: win, stake: b.stake, at: Date.now(), betId: b.id }); } }
    return clone();
  },
  betStart: async (body: { with: "buddy" | "pal"; kind: string; span: string; stake: string }): Promise<WBetState> => {
    const now = Date.now(); const bet: WBet = { id: "b" + now, with: body.with, kind: body.kind, stake: body.stake, startAt: now, endAt: now + (new URLSearchParams(location.search).has("betfast") ? 20000 : 30 * 60e3), phase: "asking", score: { player: { n: 0 }, [body.with]: { n: 0 } }, lines: [] };
    st.bet = bet; return clone();
  },
  betCancel: async (): Promise<WBetState> => { if (st.bet) st.bet.phase = "cancelled"; st.bet = null; return clone(); },
  iouPaid: async (id: string): Promise<WBetState> => { const i = st.ious.find(q => q.id === id) as WIou; i.paidMark = Date.now(); return clone(); },
  iouTear: async (id: string): Promise<WBetState> => { const i = st.ious.find(q => q.id === id) as WIou; i.tornAt = Date.now(); return clone(); },
};
