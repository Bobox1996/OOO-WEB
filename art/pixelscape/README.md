# OOO · 住吉街区雨夜

像素版的起点仍是客厅沙发。电视播放真实项目封面，放大后可在屏内阅读资料、翻看照片。前门通往大阪街景，长屋左数第二栋是 Forest-Wanna-Be House 咖啡馆。街道右手边的 VISION 售卖机提供印有工作室愿景的玻璃瓶。

## 本地游玩

从仓库根目录运行 `npm run preview:sumiyoshi` 并访问 [本地街区](http://127.0.0.1:3021)。运行 `npm run package:sumiyoshi` 会在仓库上一级生成可离线打开的 `OOO-Sumiyoshi-Pixelscape.html`。原动森风格版本已在 GitHub 的 `dev/sumiyoshi-street` 分支归档，提交为 `4b3ccb9`。

| 位置 | 操作 |
| --- | --- |
| 沙发 | 左右键、遥控器或底部胶片选项目。点击电视或 **Watch closely** 靠近，选择 **Project details** 阅读。图集可滑动或按左右键翻页，Esc 返回封面。 |
| 步行 | 空格起身。WASD、方向键或点击地面走动。到门、座位、人物或售卖机前按空格互动。C 切换近景与高视角，M 打开目的地。手机可点场景或就近操作按钮。 |
| 咖啡馆和售卖机 | 向七位成员交谈，或在机器前取瓶、旋转瓶身并阅读标签。支持键盘 Tab 切换焦点及原生按钮操作。 |

## 镜头与像素

模型使用米。街道人物约 1.7 m，Forest 的门高 2.10 m。默认街道镜头随人物横移，在立面处约覆盖 15.6 m。1280 × 720 的街景渲染到 640 × 360 后最近邻放大，每米约 41 个原生像素，5 cm 构件约 2 像素。用 `?pixels=480` 可在相同宽高比验证 480 × 270。两档在相同摄影机位置比较，不改变空间尺度。

竖屏使用独立视角，沿街取景约宽 8.65 m，按屏幕比例限制在 320 × 520 以内。进入咖啡馆前镜头向建筑中轴轻移，入口仍保持在真实的偏右位置。客厅使用透视镜头，初始横屏从沙发左后方取景，使屏幕、庭院和地面反光都可入画。电视详情、对话及项目目录在设备原始分辨率显示。

## Forest-Wanna-Be House

以 OOO 提供的正立面照片校准屋顶、檐线、门洞和三处树池，并用工作室项目图库的另一张正立面及斜视图核对。模型立面宽 7.10 m，主要檐口高 2.59 m，屋顶高 5.92 m。这些尺寸用于游戏比例，未经现场测绘校核。聚碳酸酯为前倾的分片表皮，翻窗、穿孔推拉门、花箱、树冠和深处的玻璃门分别处于不同进深。建筑的中轴为世界 X = −11.80 m，偏右的入口中心为 X = −10.74 m。咖啡馆的陈列和暖光位于门板后方。

## 可编辑资产

| 部分 | Blender 源文件 | 可重建输入 |
| --- | --- | --- |
| 客厅、雨庭 | [Garden-room.blend](house/Garden-room.blend) | `house/build.py`、`house/paint.cjs` 及 `house/paint/` 的独立像素图层 |
| 住吉街道和周边建筑 | [Sumiyoshi-night.blend](street/Sumiyoshi-night.blend) | `street/build_street.py`、`street/paint.py` 与 `street/street-atlas.png` |
| Forest 立面、咖啡馆室内 | [cafe-front.blend](cafe/cafe-front.blend)、[cafe.blend](cafe/cafe.blend) | `cafe/build.py`、`cafe/paint.cjs` 及树冠、网板与货架图集 |
| 七位成员及玩家的坐姿、步态和转向 | [Residents.blend](cast/Residents.blend) | 编辑 `cast/cast-sheet.png`、`cast/player-sheet.png`，运行 `node art/pixelscape/cast/prepare_sprites.cjs`，然后用 Blender 运行 `cast/build_cast.py`。人物图集经过最近邻采样，置于三维场景中参与遮挡和投影。 |
| VISION 玻璃瓶 | [Returnable-Cola.blend](cast/Returnable-Cola.blend) | `cast/build_cola.py`，瓶身文字取自工作室愿景 |

六个 GLB 均位于 `public/sumiyoshi/models/`。镜头、可交互范围、光源与湿面反射分别由 `src/components/sumiyoshi/` 下的 `camera.ts`、`world.ts`、`objects.ts` 和 `pixelscapeEffects.ts` 控制。雨纹和倒影用世界坐标定位，两侧的电视补光从当前封面左右区域采样。PNG 图集可直接修绘，打包过程不依赖 Aseprite。

例如，从仓库根目录在 PowerShell 中重建 Forest 立面。以下命令读取现有 PNG，适合手工改过贴图后使用。

```powershell
& '..\Tools\Blender-5.3.0\blender.exe' -b -t 3 -P art/pixelscape/cafe/build.py -- cafe-front
npm run package:sumiyoshi
```

## 图像验收

在桌面 Chrome 中以 1280 × 720 视口和 390 × 844 触屏模拟检查入座、开门、交谈、取瓶与电视详情。调档对比使用同一台街道摄影机。640 档可读出雨棚和网板的边线，静止机位的主要运动集中在雨丝与水面。[正立面对照](screens/forest-study.webp) · [480 与 640 对比](screens/raster-comparison.webp) · [手机街景](screens/forest-facade-mobile.webp) · [客厅](screens/living-room-desktop.webp) · [咖啡馆](screens/cafe.webp)

进一步手工精修可集中在侧看树冠时的枝条厚度、半透明板在掠射角的折光，以及从正面人像推定的侧脸和后脑。
