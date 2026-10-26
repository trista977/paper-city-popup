# 测试

```bash
npm install                      # 只装 Playwright
npx playwright install chromium  # 第一次需要
npm test                         # 全部跑一遍（软件渲染，约 15–25 分钟）
npm test -- paper phone          # 只跑文件名含这些词的
npm run test:update              # 画面有意改动后，重新录制截图基准
```

| 文件 | 检查什么 |
|---|---|
| `specs/01-paper.mjs` | 折纸检查 0 问题；合书时没有纸片互相穿插；`docs/structure.md` 是最新的 |
| `specs/02-mechanisms.mjs` | 每页的主机关：蓝鲸、恐龙、拨钟、游船、拍立得、巴士、碰面、绞盘开桥 |
| `specs/03-flaps.mjs` | 卡片盒、小册子、明信片、信封、小知识转盘；翻页前机关先收好 |
| `specs/04-phone.mjs` | 手机竖屏：翻角翻页、底栏一行、双击放大 / 还原 |
| `specs/05-memory.mjs` | 只保留当前页和前后页；手机贴图内存峰值 |
| `specs/06-share.mjs` | 「保存这一页」生成 2160 × 2880 的分享图 |
| `specs/07-screens.mjs` | 五个跨页的固定视角截图，和 `baseline/` 对比（允许 4% 像素差异） |

截图对比失败时，实际截图和差异图写在 `tests/output/`。

GitHub 自动检查：把 `ci/test.yml` 复制到仓库的 `.github/workflows/test.yml`（在 GitHub 网页上 Add file → Create new file，文件名填 `.github/workflows/test.yml`，粘贴内容）。之后每次推送都会自动跑全部测试，失败时实际截图和差异图会作为 `test-output` 附件。
画面是有意改的，就运行 `npm run test:update` 重新录制基准并一起提交。
