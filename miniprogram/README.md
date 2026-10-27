# 创业板/红利比值看板 · 微信小程序

与仓库根目录的 Web 版（Vite + React）功能一致的 Taro 小程序，数据与 Web **同源**：
不直连行情接口，只消费 GitHub Pages 上由数据管线每日更新的两个静态 JSON。

## 数据链路（两端共用，天然对齐）

```
GitHub Actions（scripts/ 数据管线，每日更新）
        │ 产出
        ▼
public/data/{metadata.json, historical.json}   ←── 唯一数据源
        │ 部署到
        ▼
https://atwu5.github.io/chinext-dividend-dashboard/data/
        ├──── Web（src/services/marketData/loader.ts）
        └──── 小程序（miniprogram/src/services/marketData/loader.ts）
```

两端共用且必须保持一致的代码：

- `shared/types.ts` —— `DailyRecord` / `Metadata` 数据契约（两端直接 import，改一处两端生效）
- `shared/indices.ts` —— 指数口径与参考线常量（REF_LOW / REF_HIGH 等）
- `src/utils/calculations.ts` —— 比值/区间纯函数（小程序临时跨目录引用；合并回 main 时迁入 `shared/`，两端改 import 即可）

## 本地开发

1. `cd miniprogram && npm install`
2. 构建产物：`npm run build:weapp`（或 `npm run dev:weapp` 监听模式）
3. 微信开发者工具「导入项目」→ 选择 `miniprogram/` 目录（配置读取自 `project.config.json`，`miniprogramRoot` 指向 `dist`）
4. 把 `project.config.json` 里的 `appid` 占位（touristappid）换成你的小程序 AppID

### 域名白名单（真机必需）

小程序 `wx.request` 有合法域名校验，需在 mp.weixin.qq.com → 开发管理 → 开发设置 → 服务器域名，
把以下域名加入 **request 合法域名**：

```
https://atwu5.github.io
```

开发者工具里可临时勾选「不校验合法域名」调试，但真机必须配置白名单。

## 代码对齐约定（两端迭代）

1. **分支只用一次**：本 `miniprogram` 分支仅用于搭骨架，验证通过后尽快 PR 合回 `main` 并删除分支；
   之后 Web 与小程序都在 `main` 上按目录隔离迭代（`src/` 为 Web，`miniprogram/` 为小程序），
   不养长期并行分支。
2. **单一事实来源**：数据契约、口径常量、纯计算函数只允许存在于 `shared/`（合并后），
   两端 import；禁止在小程序里复制一份改。
3. **数据层行为对齐**：小程序 `loader.ts` 与 Web `loader.ts` 的版本校验、缓存策略保持一致；
   Web 端改了数据流程，需同步检查小程序端。
4. **CI 兜底**：后续可在根 `package.json` 的 build 前增加 `npm --prefix miniprogram run build:weapp`，
   让任一端破坏对齐时 CI 变红。

## 抖音小程序平台（tt）

Taro 多端：与微信小程序共用同一套 `src/` 代码与数据层，仅平台插件不同。

- 构建：`npm run build:tt`（监听模式 `npm run dev:tt`）
- 调试：抖音开发者工具直接导入 `miniprogram/dist` 目录（`dist/project.config.json` 由 `project.tt.json` 在构建时生成，appid 已配置为真实抖音小程序 AppID）
- 域名白名单：同样需在抖音开放平台把 `https://atwu5.github.io` 加入 request 合法域名
- 注意：两个平台共用 `dist` 输出目录，切换平台需重新构建；微信开发者工具导入的是 `miniprogram/` 根目录，互不影响
- 工具内提示「不在配置的域名白名单」：白名单绑定真实 AppID，`project.tt.json` 的 `appid` 还是占位时必现——换成你的抖音 AppID 后重新 `npm run build:tt`；调试期也可在工具「详情 → 本地设置」勾选不校验域名（上线仍会校验白名单）
- 平台差异兜底：图表文字测量在无离屏画布的平台（抖音低版本基础库）自动退化为估算；触控交互（tooltip/dataZoom）需在抖音开发者工具与真机回归

## 功能对齐状态（与 Web 端）

**已对齐（两端同源）：**

- 四张核心指标卡：比值卡（状态胶囊 + 距 0.300/0.700 参考线差值）、双指数卡（收盘 + 当日涨跌幅 + 数据日期）、区间位置条（越界提示）
- 双纵轴三序列主图：左轴指数点位、右轴相对比值；0.300/0.700 参考线（隐藏比值曲线时仍持续显示）
- 全历史最低/最高比值圆点标记，点击查看当日两指数点位与比值
- 两组独立时间控制：坐标刻度（年/月/日）+ 快捷范围（近1年/3年/5年/全部）
- 触控浮层（仅展示当日真实行情记录，缺失日期不编造）+ 十字竖线；双击重置缩放
- 一键全屏横屏查看（pageOrientation: auto，平台不支持时 CSS 旋转兜底）
- 说明弹窗（底部抽屉；文案与 Web 共用 `shared/explanation.ts`）
- 数字滚动 / 卡片淡入动效；calculations / format / 弹窗文案已收口 `shared/`，两端 import 同源

**已知差异（等效替代，非缩水）：**

- 鼠标滚轮缩放为 PC 专属 → 小程序走底部 slider + 双击重置；双指捏合待真机增强
- framer-motion 动效 → CSS 动画等效；小程序无「减少动态效果」系统 API
- 全屏为独立页面（Web 为元素全屏/覆盖层）；抖音端 pageOrientation 支持待真机验证

**真机回归项：** 图例 chips 显隐、极值圆点点击、slider 拖动、全屏横屏（微信/抖音）、旋转模式触控换算

