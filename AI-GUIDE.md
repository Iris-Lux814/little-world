# 给 AI 看的安装与陪玩指南

> 这份文件是写给 **AI 助手**（Claude / GPT / 任何能读文件、跑命令的 agent）看的。你的人类把这个仓库给了你，让你帮他跑起来、再陪他玩。请按顺序读完，再一步一步带着他做。遇到做不到的，照「卡住了怎么办」那节处理，不要瞎猜。

## 0. 先弄清楚你在帮谁、要做到什么

little-world 是一个**一直在转的像素钓鱼小世界**。人类关掉页面，世界还在跑：天气会变，AI 伙伴自己钓鱼、种菜、打牌。
根目录是**后端**（规则 + 服务，没有 npm 依赖），`web/` 是**前端**（像素画面、拉鱼手感，React + Vite，要 `npm install`）。人类要玩画面就两个都装（第 2.1 节）；只想让你用接口陪他玩，后端就够（见第 5 节）。

一共有两种服务，先问人类要哪种：

| | 单人版 `server/solo.js` | 联机版 `server/server.js` |
|---|---|---|
| 适合 | 一个人玩，伙伴由简单自动玩法驱动 | 邀请朋友来自己的世界 |
| 要不要登录 | 不要，只听本机 | 要邀请链接 + 密码 + 设备同意 |
| 状态 | 测过整套流程 | **没在别的环境实测过，可能有 bug** |

第一次一律先装单人版。

## 1. 环境检查（你先替他查，别让他自己猜）

```bash
node -v          # 要 18 以上
git --version
```

- Node 没装：Windows / macOS 去 nodejs.org 下 LTS；Linux 用发行版的包或 nvm。装完重开终端再 `node -v`。
- 后端**没有任何 npm 依赖**；前端（`web/`）要 `npm --prefix web install` 一次，装下来一两百 MB。国内网络装不动就换镜像：`npm --prefix web install --registry=https://registry.npmmirror.com`。
- 磁盘只需要几 MB；存档写在 `DATA_DIR`（默认 `server/data/`）。

## 2. 装起来（照抄这些命令，一行一行跑，每行看输出）

```bash
git clone <仓库地址> little-world
cd little-world
node test/engine.test.js     # 规则测试，几秒；末尾要看到「全部通过」
node test/solo.test.js       # 单人服务整套流程（临时目录起服务，自己钓一条、聊天、传小人图），约 1 分钟
```

两个都「全部通过」再往下。任一失败：把终端输出原文记下来，去第 7 节。

启动单人服务：

```bash
mkdir -p data
DATA_DIR=./data PORT=29901 node server/solo.js
```

看到 `[little-world solo] http://127.0.0.1:29901/api/world  data=...` 就是起来了。**这个终端别关**（关了世界就停）。要常驻就用 pm2 / systemd / nssm，把同一条命令放进去。

Windows PowerShell 里设环境变量写法不同：

```powershell
$env:DATA_DIR="./data"; $env:PORT="29901"; node server/solo.js
```

验证（另开一个终端）：

```bash
curl http://127.0.0.1:29901/api/world/ping
curl http://127.0.0.1:29901/api/world
```

第二条应该回一大段 JSON，里面有 `players`（三个人）、`dex`（图鉴）、`weathers`。

### 2.1 带上画面（前端）

先把上面单人服务停掉（Ctrl+C），然后在仓库根目录：

```bash
npm --prefix web install     # 第一次，要几分钟
node dev.js                  # 后端 + 前端一起起，只给本机，Ctrl+C 一起停
node dev.js --lan            # 手机也要玩：对同一个 WiFi 开放
```

终端里 vite 会打印 `Local: http://127.0.0.1:5173/`，电脑上开它。用 `--lan` 起的还会打印 `Network: http://192.168.x.x:5173/`，手机和电脑连同一个 WiFi 时手机开这个。进门页「世界服务地址」**留空**直接点「进去」（开发页会把 `/api` 转到本机 29901）。

- 后端默认 29901；被占了就换：`PORT=29911 node dev.js`（PowerShell：`$env:PORT="29911"; node dev.js`），前端转发会跟着走。
- `--lan` 起的时候，同一个 WiFi 里的设备都能打开、也能通过它操作世界（单人版没有鉴权）。在公共网络（咖啡店、宿舍、公司）里别加 `--lan`。
- 手机上玩就用 `--lan` 的 Network 地址：后端照旧只听本机，手机的请求由开发页转过去。**不要**为了手机把后端 `HOST` 改成对外地址（单人版没有鉴权，见第 9 节）。
- `npm --prefix web run build` 出的 `web/dist/` 是静态文件，放到哪都行，但它要能连到后端：同一台机器上用反向代理把 `/api/world` 转给 127.0.0.1:29901 最稳。没把握就一直用 `node dev.js`。

## 3. 可以改的东西（都是环境变量，不改代码）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 29901 | 端口 |
| `HOST` | 127.0.0.1 | 只听本机。**不要改成 0.0.0.0 直接暴露**——单人版没有鉴权 |
| `DATA_DIR` | `server/data` | 存档目录 |
| `WORLD_PREFIX` | `/api/world` | 接口前缀 |
| `WORLD_TZ` | `Etc/GMT-8` | 游戏时区（夜河几点开门、节日按哪天） |
| `WORLD_CONTENT` | `content/example.js` | 内容包：谁是谁、鱼、商店、台词 |
| `WORLD_FARM_CONTENT` | `content/example-farm.js` | 农场内容 |
| `WORLD_DUEL_CONTENT` | `content/example-duel.json` | 打赌的预设赌注和台词 |
| `WORLD_LAT` / `WORLD_LON` / `WORLD_CITY` | 不设 | 小屋望远镜看星空用的位置（纬度、经度、城市名）。不设就按 `WORLD_TZ` 估一个（纬度 35°）；前端设置里填的优先 |

星空（小屋的望远镜 / 圆窗点进去）是本机算的，不联网：`GET $B/sky/now` 看此刻的天，`POST $B/sky/where {"lat":48.9,"lon":2.4,"city":"巴黎"}` 存位置（只留一位小数，约 10 公里，够看星星了），`{"clear":true}` 删掉。**位置是人类的隐私**：问他愿不愿意给、给到城市就够，别替他去查 IP 定位。

### 3.1 把伙伴改成人类想要的名字

复制 `content/example.js` 为 `content/mine.js`，改最上面的 `ROLES`：

```js
ROLES: { host: "player", partner: "buddy", companions: ["buddy", "pal"], names: { player: "你", buddy: "阿树", pal: "小石" } }
```

- `host`：拿手机玩的那个人类。
- `companions`：自己会动的 AI 伙伴，可以一个、两个或更多（带 `web/` 前端玩只支持**两个**）；**id 用英文小写**，前端会按这些 id 找人物图。
- `names`：显示名。

然后 `WORLD_CONTENT=./content/mine.js node server/solo.js`。鱼、商店、台词也都在这个文件里，想加鱼照着一条抄。

### 3.2 前端

用 `node dev.js` 起的开发页，进门页「世界服务地址」留空就行。前端放在别处时填后端的地址（只写到端口，例 `http://127.0.0.1:29901`，前端自己加 `/api/world`）；服务开了 CORS。
前端里的人物 id 固定是 `player / buddy / pal`；服务端 `roles` 不一样时前端会自己翻译，但最省事是内容包就用这三个 id、只改 `names`。

## 4. 存档、备份、搬家

- 存档只有一个文件：`DATA_DIR/world.json`（每次有变化就整份写，先写临时文件再改名，不会写坏一半）。
- 小人图在 `DATA_DIR/sprites/<id>.png`。
- 备份 = 复制整个 `DATA_DIR`。搬家 = 把目录拷过去、用同样的环境变量启动。
- 想重来：停服务、删 `world.json`。

## 5. 没有前端时，你怎么陪他玩

所有动作都是 HTTP 接口，你可以替人类调，也可以把结果念给他听。几条最常用的：

```bash
B=http://127.0.0.1:29901/api/world
curl -s $B | jq '.weather, .players[].name, .me'                  # 看一眼
curl -s -X POST $B/cast -H 'Content-Type: application/json' -d '{"power":0.5,"dir":0}'   # 甩竿 → 记下 castId 和 biteIn（毫秒）
# 等 biteIn 过了再提竿（提早了鱼会跑；晚于 biteMs 也跑）
curl -s -X POST $B/hook -d '{"castId":"c..."}'                     # 上钩 → 回 fight.reelMs
# 等 reelMs 的一半以上再报结果（服务会核对时间，太快不算）
curl -s -X POST $B/land -d '{"castId":"c...","result":"landed"}'   # landed / snapped / escaped
curl -s -X POST $B/sell -d '{"fish":"全部"}'                        # 卖给秤砣
curl -s -X POST $B/travel -d '{"to":"sea"}'                         # 换钓点：pond / sea / lake / river（夜河 19 点后）
curl -s "$B/chat?since=0"                                           # 看聊天
curl -s -X POST $B/chat -d '{"text":"今天钓到什么了？"}'            # 说一句，伙伴会接一句
```

陪玩时的规矩（这些是给你的）：

- **别替人类做决定**：卖不卖、送不送、跟谁打赌，问他。
- **咬钩窗口很短**（`biteMs`，默认 4 秒）。你替他操作时要自己算时间；念给他听时提前说「快了」。
- 伙伴是自动玩法，台词是固定几句。人类问「阿树怎么老说一样的话」——如实说：开源版不接模型，想让伙伴真会聊，要把伙伴接到你自己（见 README「AI 伙伴怎么玩」）。
- 接口回 `ok:false` 都带 `error` 一句人话，直接转述即可，不要自己编原因。

## 6. 小人图（人类想自己画人物）

- 一张 240×320 的透明 PNG，5 行 × 5 格，每格 48×64。行的含义见 `web/README.md`「换成你自己的小人」；画法教程 `web/docs/piskel-tutorial.md`。前端里「设置 → 我的小人」能当场检查、试走一圈再换上，比 curl 省事。
- 上传：`curl -X POST "$B/sprite" -H 'Content-Type: image/png' --data-binary @mine.png`；给伙伴换加 `?who=buddy`。
- 尺寸不对、不是 PNG、超过 512KB 都会被拒，错误里写着原因。
- 删掉回默认：`curl -X DELETE "$B/sprite"`。

## 6.1 星空（小屋的望远镜 / 圆窗）

- 在小屋阁楼点望远镜或圆窗，画面推进去就是此刻、此地真实的星空：星座连线、月相、五颗行星，对准星云 / 星系会出照片卡（带作者和许可）。全在本机算，不联网。
- 位置：前端「设置 → 星空 → 看星星的位置」点「改」：常用城市点一下就存；也可以「定位」（局域网 http 下浏览器多半不给）；都不行就手填经纬度。没填就按 `WORLD_TZ` 估（纬度 35°），页面上会写「按时区估的」。
- 先问人类愿不愿意给位置；给到城市就够了，服务只存一位小数（约 10 公里）。不要替他用 IP 去查位置。
- 窗外的天气跟游戏里小池塘的天气走（不是真实天气）；下雨、起雾时星星会被挡住，这是对的。
- 想自己核对：`curl "$B/sky/now"` 看 `where`（`approx:true` = 按时区估的）、`sun.alt`（负的是太阳在地平线下）、`moon.name`（月相）。

## 7. 卡住了怎么办

| 现象 | 先看 | 怎么办 |
|---|---|---|
| `node: command not found` | 第 1 节 | 装 Node，重开终端 |
| 测试不是「全部通过」 | 终端里 `✗` 那行 | 把 `✗` 和它上面 20 行原文发给维护者；别改规则文件 |
| `EADDRINUSE` | 端口被占 | 换 `PORT` |
| `world.json 读不出` / `不是对象` | 存档坏了 | 服务**不会**覆盖坏档。把 `world.json` 挪走再启动（从头开始），或从备份拷回来 |
| 前端连不上 | `curl $B/ping` | 通就是前端填错地址 / 前缀；不通就是服务没起 |
| 接口回 404「没有这个接口」 | 路径 | 对照 README 的接口清单 |
| 伙伴一动不动 | `curl $B` 看 `open` | `open:false` 时世界不转，`POST $B/open {"open":true}` |
| 星空对不上（白天显示夜里、星座位置怪） | `curl "$B/sky/now"` 看 `where` | 位置没填就是按时区估的，让人类在设置里填城市；`WORLD_TZ` 跟他实际时区不一样也会错 |
| 望远镜里没有照片卡 | `curl -I "$B/sky/img/M31.jpg"` | 404 就是 `content/sky/img/` 不全，重新 `git pull` |

还解决不了：把 **命令、完整输出、`node -v`、操作系统** 四样一起整理好，让人类发到仓库的 issue。不要把 `DATA_DIR` 里的存档整个贴出去（里面有他的聊天）。

## 8. 注意事项（装之前就跟人类说清楚）

**安全 / 隐私**
- 单人版**没有鉴权**，所以只听本机。谁能访问这台电脑的 127.0.0.1，谁就能动这个世界。共用电脑、公司电脑要想清楚。
- 存档 `world.json` 里有聊天记录和所有事件。求助、发 issue、给别人看日志时，**不要整份贴出去**，只贴报错那几行。
- 这个仓库不联网、不上报、不收集任何东西；后端唯一的网络就是本机 HTTP，你可以 `grep -rn "http" engine/ server/` 自己核。前端开发页默认只给本机，`node dev.js --lan` 才对同一个局域网开放，见 2.1。
- 联机版要公开给朋友时：只能走 HTTPS 反向代理（nginx / Caddy），`secret.json` 里两把钥匙要长随机、不进 git。

**还没验证的**
- 联机版（`server/server.js`）没在别的环境实测过，可能有 bug；装了出问题先回单人版。
- 传说鱼合力拉、一对一打赌到结算，只测了规则逻辑，没在真人玩里跑完整一局。
- 只在 Node 18 / 20 / 24 跑过；更老的 Node 不保证。

**玩法上的限制**
- 伙伴是自动玩法：会走、钓、卖、接赌、接牌、托管打斗地主，但**台词只有固定几句**，不会真聊天。要真会聊的伙伴得接模型（README「AI 伙伴怎么玩」）。
- 时区默认 UTC+8：夜河 19 点开门、节日按中国的日子。人类不在这个时区就改 `WORLD_TZ`，不然「怎么还没到晚上」。
- 咬钩窗口默认 4 秒，手机网络慢的话前端那边有宽限；你替他用接口操作时自己掐时间。
- 鱼桶大小、钱、装备数值都在内容包和 `engine/core.js` 顶部的常量里；想改难度改常量，别改逻辑。

**资源**
- 一个 Node 进程，常驻内存几十 MB，每 2 秒一次 tick，几乎不占 CPU。树莓派也能跑。
- 存档每有变化就整份写盘，一天几百次，文件通常不到 1 MB。放机械盘、U 盘都没问题。

**许可**
- AGPL-3.0：自己用随便改；要是改了拿去给别人**通过网络用**，得把改动开源。商用前让人类自己读一遍 LICENSE。
- 像素图、鱼的名字和签名是示例内容，可以换成自己的；换了记得把 `content/` 里的旧文案一起换掉。
- 前端里有第三方角色的同人图（`web/public/fanart`、斗地主牌面、小屋家具），**不在 AGPL 许可范围**，版权归原作者。自己玩没事；要公开部署给别人用、或者商用，先把这些图换掉（`web/README.md`「素材说明」列了在哪）。

**人类常见的误会**
- 「关掉页面世界就停了？」——不会，服务还在跑；**关掉终端 / 进程才停**。
- 「伙伴怎么半天不动？」——先看 `open` 是不是 false；再看伙伴的 `nextAt`，他们本来就几分钟才动一次，这是设计。
- 「我的鱼怎么没了？」——桶满了伙伴不会动你的；但 `sell {"fish":"全部"}` 是真卖光。帮他操作前复述一遍。

## 9. 你不该做的

- 不要为了「跑起来」去改 `engine/` 里的规则文件，测试会告诉你改坏了什么。
- 不要把 `HOST` 改成对外地址来「方便手机连」；要外网访问走联机版 + 反向代理。
- 不要替人类点「付款」「删存档」这类不可逆的事——这个项目里没有付款，但删存档有，先问。
