# 寒带赤狐 · Arctic Fox

在线版：**https://handaichihu.github.io/arctic-fox/**

一只体素（voxel）赤狐坐在冰原上的 Three.js 场景，打开即可拖拽旋转、滚轮缩放、点击互动。

纯静态页面，零构建、零依赖安装：Three.js r128 已经放在 `vendor/` 里，所有脚本都是相对路径的 `<script>` 标签，直接双击 `index.html` 也能跑。

## 本地运行

```bash
./start.sh
```

然后浏览器打开 http://127.0.0.1:8765/ 。或者直接双击 `index.html`（`file://` 方式同样可用）。

## 交互

| 操作 | 效果 |
| --- | --- |
| 拖拽 | 旋转视角（OrbitControls，带阻尼） |
| 滚轮 | 拉近 / 拉远 |
| 点一下狐狸 | 跳一下 |
| 自动旋转 | 开关相机自转 |
| 飘雪 | 开关双层雪粒子 |
| 重置视角 | 回到初始机位 |

## 结构

```
index.html        页面骨架 + HUD
css/style.css     玻璃质感 HUD、暗角、响应式
js/voxel.js       体素数据生成（纯数据，不依赖 Three.js，可在 Node 里审计）
js/main.js        Three.js 场景、光照、Shader 水面、雪粒子、交互
vendor/           three.min.js r128 + OrbitControls
tools/            开发期的 CDP 截图 / 交互自测脚本，运行页面不需要
```

`js/voxel.js` 刻意不引入 Three.js：每个体素是 `[x, y, z, 颜色]`，可以在 Node 里跑 `buildFox()` / `buildWorld()` 检查体素数量、包围盒和颜色合法性，再交给浏览器渲染。

## 实现要点

- 冰壁由三排不同深度、高度随机、逐列错落的体素柱构成，顶部收边成阶梯并覆雪帽，40+ 根冰棱垂下，避免整齐的方块墙感。
- 水面是自定义 ShaderMaterial：顶点做双正弦波动，片元做径向深浅渐变 + 波纹高光，圆心外 `discard` 裁出水池轮廓。
- 光照用冷色 hemisphere + ambient 打底，左上方暖白主光投影，背面冷色 rim 勾边，池底青色点光。
- 体素材质加 8.5% 自发光，避免冷光下暗面发黑；白色胸腹靠这一档亮度和压暗的雪地调色板拉开层次。
- 窄屏按宽高比放大 `camera.fov`，手机上狐狸不会被裁掉。

## 授权

代码 MIT。Three.js 遵循其自身的 MIT 许可。