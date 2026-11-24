# 住吉街区 · OOO 游戏设计与开发交接

访客开场坐在沙发上，透过电视看作品。推门沿雨中的街道向左走，第二栋是团队经营的咖啡馆。向右走，可以在 VISION 贩卖机取一瓶印着工作室愿景的可乐。客厅、街道、咖啡馆各用独立坐标系，通过门连接。

## 建筑和街段

| 场所 | 可核实的空间特征 | 游戏中的处理 |
| --- | --- | --- |
| 住吉长屋 | 安藤忠雄，1976 年，大阪。在三户木造长屋的中段置入清水混凝土住宅。今村创平记载其面宽约 3.5 m、进深约 14 m，临街墙高约 6 m，入口开口约 0.8 × 2.3 m。 | 以窄面宽、高实墙和凹入口作为街道的方位标记。点击区域比门洞宽，便于触屏选中。 |
| 邻栋与街道 | 事务所的街景与发表照片可读到紧贴的邻栋、屋檐、架空电线与门前小型植栽。照片摄于不同时期。 | 直接邻栋取其轮廓关系。约 48 m 长、九个地块的延展街段、咖啡馆的位置、贩卖机及其他立面均按本游戏动线编排。 |
| 客厅与庭院 | 原宅沿进深分三段，中段露天，阳光、风雨由庭院进入，楼上两翼以桥连接。 | 本作另行设计较宽的放映客厅。横向景窗、低沙发、电视、水盘、苔地与雨庭形成同一视线，供横屏观影和近距离步行。室内宽度独立于临街立面的历史尺度。 |
| Forest Café | OOO 自身的住宅项目提供了半透明表皮、木框与院落植栽的设计语汇。 | 将这些元素转译为可进入的咖啡馆。深木吧台、红陶地面和桌间走道为七位成员的点单、休息与交谈留出位置。[FOREST-WANNA-BE HOUSE 项目页](https://ooo-web.vercel.app/project/472d1c39-1118-4f38-8e4a-dffa0ace25d2) |

建筑档案和尺度可复核于 [事务所临街立面馆藏](https://artsandculture.google.com/asset/row-house-sumiyoshi-tadao-ando/mQE3TP9KPZt-GQ)、[事务所专题及施工照片](https://artsandculture.google.com/story/row-house-in-sumiyoshi-a-stronghold-for-the-independent-urban-dweller/RgXR5cYQ-WUWEw) 与 [今村创平《Little Houses in a Big City》，2003，印刷页 50](https://www.jef.or.jp/journal/pdf/architecture0307.pdf)。邻栋形态另见 [METALOCUS 街景，2021](https://www.metalocus.es/en/news/row-house-sumiyoshi-azuma-house-tadao-ando)。[街景建模记录](street/notes.md)

## 《集合啦！动物森友会》的参考与转译

资料核对日期为 **2026 年 11 月 23 日**。任天堂入门指南第 6–8 页分别说明了交谈、动作、入座、镜头俯仰，以及肤色、发型与发色、眼形与眼色、鼻口与腮红的组合。任天堂英国支持页确认后续可以通过镜子或梳妆台重新编辑外观。开发团队在 2019 年 6 月 11 日的 Treehouse 演示中展示了角色在可步行环境中生活、布置物品和互动。操作细节以指南为依据。[官方指南入口](https://animalcrossing.nintendo.com/new-horizons/getting-started/) · [《Official Starter Guide》PDF 副本](https://comic-cons.xyz/wp-content/uploads/Animal_Crossing_New_Horizons_Starter_Guide.pdf) · [Nintendo UK 镜子说明](https://www.nintendo.com/en-gb/Support/Purchases-Subscriptions/Games/Can-I-Change-My-Character-s-Appearance-Animal-Crossing-New-Horizons--1747981.html) · [Nintendo Treehouse 实机演示](https://www.youtube.com/watch?v=dEh3MPy4GAU)

OOO 在 Blender 中以发型、肤色、眉眼、鼻口、腮红、眼镜和服装组合来表现七位真实成员。发型、眼镜和衣领轮廓来自公开肖像。服装配色和三维网格由团队游戏自行设定。访客开场持遥控器，走到街上时撑伞。OOO 网页的交互重心是靠近、交谈和翻看作品。网页提供点击寻路、目的地清单和两档步行镜头。人物预设目前由开发者配置。[角色预设](cast/roster.json) · [OOO 成员资料](https://ooo-web.vercel.app/team)

## 游玩与状态

| 场景 | 玩家能做什么 | 镜头与状态 |
| --- | --- | --- |
| 客厅 `home` | 用遥控器、左右键或底部胶片换作品。点电视放大，再选 **Project details** 在屏内阅读介绍和翻看图集。按 **E** 起身，在沙发旁可重新坐下，右侧前门通往街道。 | `seated` 从肩后同时看见电视和庭院。`focus` 可查看封面或详情。详情中按 Esc 回到当前封面，再按一次回到沙发。重新入座保留本次已选的作品。 |
| 街道 `street` | 对着长屋时左行到咖啡馆，右行到 VISION。点地面或用 WASD／方向键移动，**E** 使用附近目标，**M** 打开目的地。 | `walk` 随人物左右移动，**C** 调整观察高度。点击远处的门或人物会先走到相应接近点，再触发动作。 |
| 咖啡馆 `cafe` | 两位成员在吧台，五位在桌边、座椅及门厅附近。逐位走近或从名单中选择，读完介绍后可继续探索或从门口返回街道。 | `talk` 面向当前成员，显示官网姓名、肖像与介绍。第一位店员隔柜接待，其谈话接近点位于顾客一侧。 |
| VISION 贩卖机 | 取 OOO Cola，拖动或点按钮旋转瓶身，点瓶子或 **Read label** 阅读完整愿景。 | `vendor` 靠近机器，`bottle` 单独照亮并展示瓶身。取过的可乐在本次页面停留内可再次检查，刷新后重新开始。 |

## 地图、资产和扩展

Three.js 以米为单位，Y 向上，街道沿 X 展开，正 Z 朝向道路。Blender 坐标使用 `(x, -z, y)` 对应 Three.js 的 `(x, y, z)`。在 [world.ts](../../src/components/sumiyoshi/world.ts) 中，每个站点都有位置 `point`、点击范围 `hitbox`、交互站位 `approach`、跨门落脚点 `spawn` 和动作 `action`。两扇成对的门互指对方 ID。室内桌椅、吧台和人体分别参与碰撞，玩家半径 0.27 m。点击走路与键盘走路使用相同的碰撞规则。

1. **新增一栋可进入的建筑**。在 `art/sumiyoshi/` 建立该建筑的 Blender 源文件，与当地面原点对齐后导出到 `public/sumiyoshi/models/`。在 `world.ts` 增加区域边界、障碍和内外两扇门。将二者的 `arrival` 互指，`spawn` 放在门内外可站立的位置。在 [scene.ts](../../src/components/sumiyoshi/scene.ts) 载入室内、接入灯光，在 [camera.ts](../../src/components/sumiyoshi/camera.ts) 检查横竖屏构图，再补游戏界面的门名。
2. **新增一位可交谈的成员**。更新 [roster.json](cast/roster.json) 的人物组合和正式公开资料，重新运行 [build_people.py](cast/build_people.py) 导出角色。给成员分配稳定的 `member-N`、模型名和 CMS 对应顺序，在 `world.ts` 加人物位置、站位、足迹，在界面加场内角色说明，确认镜头可以从桌侧或顾客侧看到脸。
3. **验收**。在仓库根运行 `node --test tests/sumiyoshi-world.test.mjs`，它覆盖当前 13 个站点、77 组区内起终点、七次对话和两对往返门。新增建筑后，把新路线加进完整往返用例。浏览器另查桌面与竖屏的电视四角、近景对话、可乐转动与标签阅读，以及减少动态效果时的镜头切换。[步行回归测试](../../tests/sumiyoshi-world.test.mjs)

## 本地入口与版本

在 `dev/sumiyoshi-street` 分支从仓库根运行 `npm run preview:sumiyoshi`，访问 [本地街区](http://127.0.0.1:3018)。运行 `npm run package:sumiyoshi` 可在仓库的上一级生成可双击的 `OOO-Sumiyoshi.html`。本地离线预览包含 34 个作品的封面、项目资料、图集和七位成员资料。进入客厅电视的 **Gallery** 后，可用遥控器、左右键或触屏滑动翻图。

`dev/drive-in` 保存雨夜汽车影院，`main` 对应正式作品集。三个版本可在各自分支复用。
