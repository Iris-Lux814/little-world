# little-world · 小世界

一个一直在转的小钓鱼世界的**后端**：你关掉页面，世界还在跑；AI 伙伴在里面自己钓鱼、种菜、打牌，跟你一样用同一套规则。

- 钓鱼：池塘 / 海边 / 湖 / 夜河，四个钓点各有天气（一两个小时一变）、昼夜、节日鱼和条件鱼（雨后、起雾、清晨……）。
- 商店：饵、竿、浮漂、线轴、挂件、桶、道具、摆设；卖鱼按星级和重量算钱。
- 一起玩：传说鱼要大家一起拉，在场的人喊「加油 / 放线」；打赌（谁钓得最重 / 谁先钓到 / 谁钓得多），输了记欠条。
- 伞树农场：每人一个花盆，伞里存雨水，摇伞 / 转竹管浇水，挨着的两盆同时开花会串粉出杂交种子。
- 鱼桶牌：用自己钓过的鱼当牌，天气牌改规则，出最小的那张能偷看下一轮天气。
- 斗地主：完整牌型、叫分、提示、托管，人和 AI 伙伴混坐。
- 联机：发邀请链接给朋友（密码 + 设备 + 主人点同意），朋友来你的世界一起钓；存档能导出 / 导入（带签名）。

前端（像素画面、拉鱼手感）在另一个仓库 little-world-web，还在收尾，推上去以后这里放链接。

## 结构

```
engine/   规则：core.js（钓鱼 / 商店 / 天气 / 地形 / 一起玩 / 打赌 / 小屋）、farm.js、cards.js、ddz.js
          纯函数，只动传进来的存档对象，不碰文件和网络
content/  内容包：谁是谁、鱼和签名、商店、台词。example.js 是示例，换成你自己的
server/   联机服务（Node，无依赖）：邀请、同意设备、钓鱼接口、聊天、斗地主牌桌、存档导出导入
test/     node test/xxx.test.js
```

## 先说清楚

- **单人版**（`server/solo.js`）：一个人玩，AI 伙伴由简单的自动玩法驱动（走走、甩竿、卖鱼、接赌、接牌），不需要接任何大模型。接口在 `/api/world/...`。
- **联机版**（`server/server.js`）：邀请朋友来你的世界。**联机没在别的环境实测过，可能有 bug**，当作参考实现。

## 单人版跑起来

```bash
node test/solo.test.js            # 整套流程（临时目录起服务）
DATA_DIR=./data PORT=29901 node server/solo.js
# 前端把世界接口地址指到 http://127.0.0.1:29901/api/world
```

环境变量：`PORT`（默认 29901）、`HOST`（默认 127.0.0.1，只听本机）、`DATA_DIR`（存档）、`WORLD_PREFIX`（接口前缀，默认 `/api/world`）、`WORLD_CONTENT` / `WORLD_FARM_CONTENT` / `WORLD_DUEL_CONTENT`（内容包）。

接口跟联机版 / 原版一致：`GET /api/world`（带 `px/py/pd` 报站位）、`/cast` `/hook` `/land`、`/travel` `/visit` `/sell` `/buy` `/equip` `/use` `/act`、`/farm/*`、`/cabin/*`、`/legend/*`、`/bet/*`、`/ddz/*`、`/cards/*`、`/chat`。

小人图（前端那边 48×64 一格、5 行 × 5 格）：

- `POST /api/world/sprite`（正文直接放 PNG，`Content-Type: image/png`，240×320、≤512KB；`?who=<id>` 给伙伴换）
- `GET /api/world/sprite/<id>`、`DELETE /api/world/sprite`
- `GET /api/world` 里每个人带 `sprite` 字段：有图是 `/api/world/sprite/<id>?v=时间`，没有是 `null`（前端用默认小人）。

## 联机版跑起来

```bash
node test/ddz.test.js            # 斗地主规则 + 托管自己打 500 局
node test/online-flow.test.js    # 联机整套流程（临时目录起服务）
node test/ddz-flow.test.js       # 三个人打完一局斗地主

mkdir -p data && echo '{"online":"换成一串长随机","sign":"再换一串"}' > data/secret.json
DATA_DIR=./data PORT=29900 node server/server.js
```

服务只听 127.0.0.1，外面用 nginx 之类转 `/online/` 进来。

## 内容包

`content/example.js` 的形状：

- `ROLES`：`host`（拿手机玩的那个人）、`partner`（成对的鱼另一条给谁）、`companions`（自己玩的 AI 伙伴）、`names`。
- `SPECIES`：鱼。`spot` 钓点、`r` 稀有度 0~4、`kg` 重量范围、`hours` 出没钟点、`when` 条件、`fest` 节日、`junk` 怪东西、`fog` 起雾才多、`pair` 成对、`likedBy` 某个伙伴更容易钓到、`sign` 图鉴里那句话。
- `SHOP`：每类商品的数值和说明。
- `KEEPSAKE_IDS`：不卖、不占桶的纪念品。

用你自己的：`WORLD_CONTENT=/path/to/mine.js node server/server.js`。农场的内容同理：`WORLD_FARM_CONTENT`。

时区默认 UTC+8（节日按中国的日子），改 `WORLD_TZ`。

## AI 伙伴怎么玩

伙伴不调接口，而是在回复里写短指令，比如 `[联机钓鱼:甩竿]` `[联机钓鱼:出 3 3 3 4]`，由你自己的桥转给 `POST /api/home/ai`；世界里发生的事（咬钩了、轮到你出牌）从 `GET /api/home/feed` 取，递回给伙伴。怎么递取决于你的伙伴跑在哪里。

## 许可

AGPL-3.0。
