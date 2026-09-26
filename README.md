# gu812 の 小站

基于 **Hexo + Butterfly + GitHub Pages** 的个人博客，通过 GitHub Actions 自动部署。

线上地址：<https://gu812.github.io>

## 写新文章

```bash
npx hexo new post "文章标题"
# 编辑 source/_posts/文章标题.md
```

新建页面（如友情链接页）：

```bash
npx hexo new page links
# 编辑 source/links/index.md
```

## 本地预览

```bash
npm install        # 首次克隆后先装依赖
npx hexo server    # 访问 http://localhost:4000
```

写作模式（草稿 + 自动刷新）：

```bash
npx hexo server --draft
```

## 部署

不用手动部署！`git push` 到 `main` 分支后，GitHub Actions 会自动构建并发布到 GitHub Pages。
部署进度在仓库的 **Actions** 标签页查看。

## 首页星网导航（GLOBE hero）

首页整屏 hero 是 Vanta.js 的 GLOBE 效果（粉色网格 + 线框地球仪），上面飘着 6 个
发光导航节点，点击直达对应板块。

- 节点配置在 `source/js/globe-hero.js` 顶部的 `NAV_ITEMS`（label / href / 期望位置的屏幕比例 tx,ty）
- GLOBE 视觉参数在同文件的 `VANTA_OPTIONS`（颜色、背景、地球仪大小）
- 节点样式在 `source/css/custom.css`（呼吸发光 / 悬停标签 / 点击涟漪）
- 依赖文件自托管在 `source/vendor/`（three.js r134 + vanta.globe），不走 CDN
- 只在首页加载和运行，其他页面零开销；樱花特效首页不飘（避免视觉冲突），其他页面保留

## 「想法」页（/thoughts/）

发想法不用写文章，直接编辑 `source/_data/thoughts.yml`，加一条：

```yaml
- date: 2026-09-26
  content: 你的想法内容
```

push 后自动出现在 /thoughts/ 时间线上（按日期倒序）。生成逻辑在 `scripts/thoughts.js`。

## 分类示例文章

`source/_posts/` 下的 `travel-example.md` / `growth-example.md` / `anli-example.md`
是「旅行 / 成长 / 安利」三个分类的占位文章（让首页节点有页面可跳）。
要正式写作时直接改写它们的内容，或删掉后用 `npx hexo new post` 写新文章
（记得在 front-matter 里写 `categories: 旅行` 之类的分类）。

## 常用配置位置

| 内容 | 文件 |
| --- | --- |
| 站点标题 / 副标题 / 作者 | `_config.yml` |
| 主题配置（菜单、页脚、inject 注入等） | `_config.butterfly.yml` |
| 首页星网导航节点 | `source/js/globe-hero.js`（NAV_ITEMS） |
| 自定义样式（hero 节点 / 转场 / 想法时间线） | `source/css/custom.css` |
| 樱花飘落特效 | `source/js/sakura.js` |
| 想法数据 | `source/_data/thoughts.yml` |
| 友链数据 | `source/_data/link.yml` |
| 图片放这里 | `source/img/`（自己新建） |

换文章封面：把图片放进 `source/img/`，然后在 `_config.butterfly.yml` 里
把 `index_img`、`default_cover` 等配置项改成 `/img/你的图片.jpg` 即可（文件里有详细中文注释）。

也可以在文章 front-matter 里单独指定封面：

```yaml
---
title: 某篇文章
cover: /img/xxx.jpg
---
```
