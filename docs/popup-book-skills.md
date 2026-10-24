# 立体书制作技能手册 · 生图 Prompt 版

> 用途：导入生图软件（Midjourney / SD / Flux / GPT-Image / 即梦 等），生成立体书效果图和可拆分的纸片素材。
> 结构：① 核心原则 → ② 结构库 → ③ 机关库 → ④ 视觉风格库 → ⑤ 主题→结构映射 → ⑥ Prompt 模板 → ⑦ 负面词 → ⑧ 完整示例 → ⑨ 检查清单
> 每个条目都附英文 prompt 片段（生图模型对英文更敏感），可直接拼接使用。

---

## ① 核心原则（每次生成前必读）

1. **结构讲故事**：先问"这个主题是什么动态/形状"，再选结构。向上的主题用高耸结构，包围的主题用环绕结构，循环的主题用转盘/环形。
2. **底页即地面**：底页是一幅完整的画（地面、地图、海面、草地），立体件从中"长出来"，不是贴上去的。
3. **层层景深**：前景饱和、暖、清晰；后景淡、冷、偏灰蓝（空气透视）。每层都要有镂空，让人看到后一层。
4. **合书约束**：所有纸片合书时必须收进页面内（离书脊距离 + 纸片高度 ≤ 页高）；**打开时**可以向读者方向伸出页边。
5. **轮廓即设计**：纸片边缘是有机的模切形状（树冠、岩石、云朵、羽毛），带白色或浅色纸边。
6. **文字固定位置**：说明文字放在角落的方卡片里，不抢立体件的戏。
7. **全书节奏**：逐页升级，最后一个跨页最大最复杂；平面知识页与大立体页一张一弛。
8. **系列统一**：每页一个重复出现的小标志（如举着缎带的小天使、角落区域标签卡），统一版式。

**通用质感词（任何 prompt 都可加）：**
```
pop-up book, paper engineering, die-cut cardstock layers, visible paper edges, crisp fold lines, layered paper diorama, soft natural shadows between paper layers, tactile printed paper texture, open hardcover book on a table
```

---

## ② 结构库

| # | 结构 | 中文说明 | 适合 | 英文 prompt 片段 |
|---|---|---|---|---|
| S1 | 平行折 | 纸片与书脊平行，像舞台布景一层层立起 | 城市天际线、多层场景 | `parallel-fold pop-up layers standing parallel to the spine like stage flats` |
| S2 | V 折 | 两条粘贴线与书脊成相同角度，纸片向后仰成扇面 | 主角、龙、树、岩石、背景山 | `V-fold pop-up rising from the center gutter, angled fan-like paper planes` |
| S3 | V 叠 V | V 折上再长出小 V 折，越长越繁复 | 悬崖、珊瑚、森林、海浪 | `multi-level V-fold on V-fold, intricate cascading paper rock formations` |
| S4 | 箱形折 | 方盒随开书立起，可做墙、屋顶、内部 | 建筑、房子、货架、桌子 | `box-fold pop-up building with walls and roof, architectural paper model` |
| S5 | 箱体 + 内部肋片 | 箱体内放一排平行斜片 | 教堂飞扶壁、拱廊、桥梁结构 | `box-fold cathedral with internal parallel ribs as flying buttresses` |
| S6 | 多层舞台 | 多排平行景片前后排开，每排镂空 | 雨林、街道、剧场、隧道 | `tunnel-book style layered scenery, multiple cut-out planes receding in depth` |
| S7 | 十字插片 | 两片开槽十字交叉，撑成四面立体 | 塔、龙卷风、仙人掌、柱子 | `cross-slotted X-shaped pop-up, two intersecting paper planes forming a 3D tower` |
| S8 | 手风琴立面 | 长立面折成 Z 字，角楼落在折线上 | 宫殿、沿街建筑群 | `accordion-folded long palace facade zigzagging across the spread` |
| S9 | 金字塔 / 多面体 | 开书拉起多个斜面 | 金字塔、穹顶、山峰 | `pyramid pop-up with four triangular faces, faceted dome pop-up` |
| S10 | 跨页大拱 | 一道拱桥跨过书脊连接左右页 | 桥、过山车、海蛇、彩虹、拱门 | `large arch pop-up spanning the gutter, truss arch casting shadows on the page` |
| S11 | 放射 / 爆炸 | 纸片从中心向外放射 | 愤怒、烟花、太阳、彗星、庆典 | `radial burst pop-up, paper rays exploding outward from the center` |
| S12 | 环形 / 球形 | 嵌套圆环开书成球 | 天体、星座、地球仪、浑天仪 | `nested paper rings forming an armillary sphere pop-up` |
| S13 | 螺旋弹簧 | 纸条螺旋上升 | 混乱、旋风、DNA、楼梯 | `spiral paper coil springing up from the page` |
| S14 | 纸带线条 | 一排细纸条垂下 | 雨丝、瀑布、光束、头发 | `rows of thin paper strips as falling rain` |
| S15 | 悬线 | 用金线/细线把两个元素连起来 | 神谕、风筝、弓弦、联系 | `gold thread suspended between pop-up elements` |
| S16 | 外伸纸片 | 打开时伸出页面前缘 | 云海、海浪、冲出画面的主角 | `pop-up elements overhanging beyond the front edge of the book` |
| S17 | 房间角落 / 旋转木马 | 书开 90°/360° 形成房间 | 室内场景、展览、旋转剧场 | `carousel pop-up book opened into a room corner diorama` |

---

## ③ 机关库（互动元素）

| # | 机关 | 作用 | 英文 prompt 片段 |
|---|---|---|---|
| M1 | 拉片 | 让元素沿直线移动（船过河、车开动、桥升起） | `pull-tab with arrow at the page edge` |
| M2 | 转盘 | 转动换图（摩天轮、星盘、时钟） | `volvelle rotating paper wheel` |
| M3 | 掀卡 / 小翻页 | 隐藏信息、补充知识 | `lift-the-flap panel, small fold-out booklet` |
| M4 | 迷你书 / 名画卡 | 侧边插页 | `tipped-in mini booklet on the side of the spread` |
| M5 | 放入分类 | 把元素放进不同容器 | `slot-in paper pieces sorted into paper jars` |
| M6 | 风车 | 动态点缀 | `paper pinwheel` |
| M7 | 章节标志小件 | 每页书脊下方弹出的统一小件 | `small recurring pop-up banner figure at the bottom of the gutter` |
| M8 | 区域标签卡 | 角落固定的标题卡 | `framed label card in the corner with title text` |
| M9 | 镂空 / 金属镭射 | 透光和闪光 | `laser-cut lace patterns, metallic foil accents` |

---

## ④ 视觉风格库

| 风格 | 适合主题 | 英文 prompt 片段 |
|---|---|---|
| 中世纪手抄本 | 宗教、神话、历史 | `medieval illuminated manuscript style, gold leaf halos, ornamental floral borders, decorated drop caps` |
| 博物画写实 | 自然、动物、鸟类、植物 | `naturalist field-guide painting, realistic gouache birds and plants` |
| 拼贴 | 儿童、美食、数数 | `Eric Carle-like painted tissue collage textures` |
| 城市地图 | 旅行、城市 | `vintage city street map base page, pastel ochre blocks, blue river, street name labels` |
| 线描建筑 | 地标、建筑 | `fine architectural line drawing printed on cream paper, muted blue roofs` |
| 民间童趣 | 童话、故事 | `warm folk-art picture book illustration, terracotta roofs` |
| 扁平北欧 | 童话、冒险 | `Scandinavian flat illustration, limited palette, teal and navy, starry patterns` |
| 丝巾印花 | 品牌、时尚 | `luxury silk scarf print patterns, bold ornamental graphics` |
| 拼贴摄影 | 当代、艺术 | `mixed-media photo collage cut-outs, surreal editorial` |
| 白模 | 建筑、作品集、网页 | `all-white paper model, no print, dramatic desk-lamp lighting, dark background` |

**配色规则：**
- 一页一个主色调，与情绪一致（愤怒=红，忧伤=蓝，平静=绿，快乐=黄，爱=粉）。
- 后层降饱和偏冷，前层饱和偏暖。

**光线选择：**
- 柔和摄影棚光：`soft studio lighting, clean cream backdrop`
- 自然窗光：`natural window light, bookshelf background`
- 戏剧聚光：`single warm spotlight, dark background, long paper shadows`

---

## ⑤ 主题 → 结构映射（选结构速查）

| 主题 / 情绪 | 推荐结构 | 推荐机关 |
|---|---|---|
| 城市天际线 | S1 平行折 + S8 手风琴立面 | M1 拉片（车、船） |
| 城市地标 | 地图底页 + S4/S7/S9/S10 按建筑选 | M8 区域标签卡 |
| 高塔 / 钟楼 | S7 十字插片 | — |
| 教堂 / 宫殿 | S5 箱体 + 肋片 / S8 | — |
| 桥 | S10 跨页大拱 | M1 桥面升起 |
| 摩天轮 / 天体 | S12 环形 | M2 转盘 |
| 森林 / 雨林 | S6 多层舞台 / S3 | — |
| 山 / 悬崖 | S3 V 叠 V / S9 | — |
| 海浪 / 风暴 | S3 环绕主体 + S16 外伸 | — |
| 下雨 | 云片 + S14 纸带 + S10 彩虹 | — |
| 龙卷风 / 旋风 | S7 十字插片 + S13 螺旋 | — |
| 沙漠 / 草原 | 稀疏 S7 + 低矮 V 折远山 | — |
| 天使 / 飞翔 | S2 高耸 V 折 + S15 悬线 | M7 章节标志 |
| 庆典 / 愤怒 / 爆发 | S11 放射 | — |
| 混乱 | S13 螺旋 | — |
| 室内 / 房间 | S4 / S17 | M3 掀卡 |
| 科普 / 机械 | 能动结构本身 | M1 / M2 / M3 |
| 数数 / 递进 | 每页多一个元素 | — |

---

## ⑥ Prompt 模板

### T1 · 完整跨页效果图（看整体效果用）

```
A photograph of an open hardcover pop-up book on a [table/surface], [THEME] spread.
Base page: [底页描述, e.g. vintage street map of Westminster / painted grassland ground].
Pop-up structures: [结构 from ②, e.g. a cross-slotted X-shaped Big Ben tower rising near the gutter, an accordion-folded palace facade behind it].
Interactive elements: [机关 from ③].
Style: [风格 from ④]. Color: [主色调], background layers paler and cooler, foreground saturated.
Text card in the [bottom-left] corner with the title "[TITLE]".
Paper engineering, die-cut cardstock, visible paper edges and fold lines, soft shadows between layers, [光线], high detail, 3/4 elevated view.
```

### T2 · 单张纸片素材（给网页引擎用，可抠图）

```
A single flat die-cut paper piece for a pop-up book: [元素, e.g. Tower Bridge facade].
Front orthographic view, perfectly flat, no perspective, no shadow.
Organic die-cut silhouette with a thin [white/cream] paper border.
Style: [风格]. Isolated on a pure white background (or transparent PNG).
Printed cardstock texture, crisp edges, high resolution.
```
> 提示：网页引擎需要正视角、无透视、无阴影的扁平纸片，阴影和立体由代码生成。

### T3 · 底页（下层页 / 地面）

```
Flat top-down illustration for the bottom page of a pop-up book spread, [宽:高 e.g. 2:1] landscape.
[底页内容, e.g. vintage street map of central London with the Thames, pastel ochre city blocks, green parks, street labels].
Leave clear empty areas at [位置] for pop-up pieces. Center vertical fold line subtly visible.
Style: [风格]. No perspective, no 3D elements, no shadows.
```

### T4 · 背景页（上层页 / 天空）

```
Flat illustration for the upright back page of a pop-up book spread, [比例].
[天空 / 远景, e.g. soft dawn sky with faint distant skyline silhouettes].
Pale, cool, low-saturation colors (atmospheric perspective). Center fold line subtly visible.
Style: [风格]. No perspective, no 3D.
```

### T5 · 分层素材套组（一次生成一整页的所有层）

```
A sprite sheet of separate flat die-cut paper pieces for one pop-up book spread about [THEME],
arranged in a grid with spacing, each piece isolated on pure white:
1) [远景层] 2) [中景层] 3) [前景层] 4) [主角] 5) [小装饰]
All front orthographic view, no perspective, no shadows, thin paper borders,
consistent [风格], back layers pale and cool, front layers saturated and warm.
```

### T6 · 数字样稿（带模切线，用来规划结构）

```
A digital mockup of a pop-up book spread, flat illustration of [场景],
with thin pink die-cut outlines marking each separable pop-up piece,
rectangular glue-tab placeholders, dashed center fold line,
labeled "digital mockup spread [N]" in the corner. Style: [风格].
```

### T7 · 白模（研究结构 / 网页白模模式）

```
An all-white unprinted paper prototype of a pop-up book spread showing [结构],
pure white cardstock, crisp folds, dramatic warm desk-lamp lighting from the upper left,
dark background, long soft shadows, minimal, architectural model photography.
```

---

## ⑦ 负面词（Negative prompt）

**效果图通用：**
```
plastic, 3D render look, CGI, glossy, blurry, warped book, extra pages floating, distorted text, gibberish letters, melted shapes, photographic people, watermark, logo
```

**纸片素材专用（T2/T3/T4/T5）：**
```
perspective, shadow, drop shadow, 3D, depth of field, background scene, table, hands, book, cropped piece, overlapping pieces
```

---

## ⑧ 完整示例

### 例 1：伦敦 · 威斯敏斯特跨页（效果图）
```
A photograph of an open hardcover pop-up book on a wooden bookshelf, London Westminster spread.
Base page: vintage street map of Westminster with the blue Thames, pastel ochre blocks, street labels.
Pop-up structures: Big Ben as a cross-slotted X-shaped tower standing at its real map location, the Houses of Parliament as an accordion-folded gothic facade along the river, Westminster Bridge as a low arch spanning the gutter, a pull-tab red double-decker bus on the bridge.
Style: fine architectural line drawing printed on cream paper, muted blue-grey roofs, gold accents.
Framed label card in the bottom-left corner reading "WESTMINSTER".
Paper engineering, die-cut cardstock, visible paper edges and fold lines, soft natural window light, 3/4 elevated view, high detail.
```

### 例 2：伦敦眼（纸片素材）
```
A single flat die-cut paper piece for a pop-up book: the London Eye wheel with capsules,
front orthographic view, perfectly flat, no perspective, no shadow, circular volvelle disc with a center pivot hole,
thin cream paper border, fine architectural line drawing style, isolated on pure white, high resolution.
```

### 例 3：天气 · 龙卷风（效果图）
```
A photograph of an open pop-up book on a cream backdrop, tornado spread.
Base page: farmland with a red barn, horses, a road and crop fields.
Pop-up: a tall cross-slotted twisting tornado funnel rising from the center with debris pieces, a red pickup truck pop-up on the road.
Style: soft gouache picture-book illustration, stormy blue-grey funnel, green fields.
Paper engineering, visible paper edges, soft studio lighting, 3/4 view.
```

### 例 4：情绪 · 愤怒（效果图）
```
Open pop-up book, anger spread: a radial burst V-fold of red paint-splatter rays exploding from the gutter, a scribbly red monster pop-up in the center, white page, crayon-and-paint textures, soft studio light.
```

### 例 5：森林层景（分层素材套组）
```
A sprite sheet of separate flat die-cut paper pieces for a pop-up rainforest spread, grid layout on pure white:
1) pale misty distant tree silhouettes 2) mid-ground mossy tree trunks with cut-out gaps 3) foreground ferns 4) a spotted owl on a branch 5) small birds.
Front orthographic, no perspective, no shadows, thin paper borders, naturalist gouache style, back layers pale and cool, front saturated.
```

---

## ⑨ 生成前检查清单

- [ ] 主题的动态/形状是什么？选的结构对应吗？（对照 ⑤）
- [ ] 底页是完整的地面画吗？留出立体件的位置了吗？
- [ ] 前后层有空气透视（后淡冷、前艳暖）吗？
- [ ] 每层都有镂空，能透到后一层吗？
- [ ] 合书时纸片能收进页内吗？外伸部分只在打开时出现吗？
- [ ] 文字卡位置固定吗？有系列统一标志吗？
- [ ] 风格和主题匹配吗？（对照 ④）
- [ ] 给网页用的素材：正视角、无透视、无阴影、白底或透明底？
- [ ] 全书节奏：是否逐页升级，最后一页最华丽？

---

## 附：素材命名建议（给 paper-city-popup 引擎用）

```
{书名}_{页码}_{层}_{元素}.png
层：base（底页）/ back（背景页）/ L1…Ln（纸片，L1 最靠后）/ fx（装饰）/ ui（标签卡）
例：london_03_base_westminster-map.png
    london_03_L2_parliament-facade.png
    london_03_L4_bigben-a.png  london_03_L4_bigben-b.png   ← 十字插片的两片
```
