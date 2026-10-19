# gu812 の 小站

基于 **Hexo + Butterfly + GitHub Pages** 的个人博客，`git push` 到 `main` 后由 GitHub Actions 自动构建发布。

线上地址：<https://gu812.github.io>

没有后端、没有数据库，所有内容都是仓库里的 Markdown 和 YAML 文件。

## 目录结构

```
_config.yml                 站点配置（标题 / 网址 / 主题选择）
_config.butterfly.yml       主题配置（覆盖式，只写要改的项，带中文注释）
themes/butterfly/           主题副本，已改造 —— 升级前先看「主题改造」一节
scaffolds/                  hexo new 用的模板
scripts/thoughts.js         自定义生成器：把想法数据渲染成 /thoughts/
source/
  _posts/                   文章
  _data/thoughts.yml        想法数据
  _data/link.yml            友链数据
  about/ link/ tags/ categories/ 404.md    各独立页面
  css/                      自定义样式（custom.css / post-minimal.css）
  js/                       页面动效脚本（5 个）
  fonts/noto-serif-sc/      自托管思源宋体（中文 3 个字重）
  vendor/                   自托管 three.js r134 + vanta.globe（只有首页会加载）
.github/workflows/deploy.yml  自动部署流程
```

## 日常写作

### 新文章

```bash
npx hexo new post "文章标题"
# 编辑 source/_posts/文章标题.md
```

front-matter 里的 `categories` 决定它出现在哪个分类页。想上首页星网节点，就用现有的
`旅行` / `成长` / `安利` 三个分类之一。

### 新建页面（如友情链接页）

```bash
npx hexo new page links
# 编辑 source/links/index.md
```

### 想法（/thoughts/）

不用写文章，直接编辑 `source/_data/thoughts.yml`，加一条：

```yaml
- date: 2026-09-26
  content: 你的想法内容
```

push 后自动出现在 `/thoughts/` 时间线上。页面按日期倒序，所以写在哪里都行。
生成逻辑在 `scripts/thoughts.js`（自己排序 + 转义 HTML，支持多行内容）。

### 友链

编辑 `source/_data/link.yml`，按现有格式加条目。

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

不用手动部署。`git push` 到 `main` 后，GitHub Actions 会跑 `npm ci` → `npx hexo generate`
→ 发布到 GitHub Pages。进度在仓库的 **Actions** 标签页看。

## 页面与动效清单

除首页星网外，其余动效都尊重 `prefers-reduced-motion`，用户开了「减弱动态效果」会自动降级。

| 文件 | 生效范围 | 做什么 |
| --- | --- | --- |
| `source/js/globe-hero.js` | 仅首页 | Vanta GLOBE 线框地球 + 6 个发光导航节点。每帧把网格点投影成屏幕坐标，再同步给覆盖在上面的 `<a>` |
| `source/js/glow-banner.js` | 归档 / 分类 / 标签 / 普通页 | 页头辉光三角徽章：呼吸、顺时针光带流转、鼠标靠近聚光、点击切换彩虹模式 |
| `source/js/page-intro.js` | 同上 | 开屏动画：粒子从四周聚合成分页标题，停留后沿对角线分裂飞走；点击 / 滚动 / 按键可跳过 |
| `source/js/morph-cards.js` | 列表页 | 文章卡片交互：悬停时封面上的日期 pill 变形为「阅读全文 →」。封面点击扩展、加载占位变形目前是骨架，等文章配了封面才会生效 |
| `source/js/post-minimal.js` | 文章页 | 标题「修 bug」叙事动画：先注入乱码 → 巡检框逐字扫描 → 逐个修复 |
| `source/css/custom.css` | 全站 | 墨金配色、首页 `globe-home` 布局、列表页 `glow-page` 深色布局、想法时间线、卡片网格 |
| `source/css/post-minimal.css` | 文章页 | 暖白纸面 + 衬线正文 + 大号宽字距标题的极简排版 |

配色约定：

- 首页和列表页：暖黑 `#0e0d0b` + 香槟金 `#d6cfc4`
- 文章页：暖白纸面 `#faf7f2`，金色 `#d8ba78` 只做点缀

首页是整屏 hero，**文章列表和页脚都被隐藏**，导航栏和右下角悬浮按钮也隐藏（纯净模式）。
实现方式：`_config.butterfly.yml` 的 `inject.head` 里有段内联脚本，在渲染前给 `<html>`
加上 `globe-home` class，剩下的交给 `custom.css` 里的 `html.globe-home` 规则。

## 主题改造（重要：升级前必读）

`themes/butterfly/` 是主题的**完整副本**，直接改过源码。Hexo 优先用 `themes/` 目录，
所以真正生效的是这份，`package.json` 里那个 `hexo-theme-butterfly` 依赖只是版本记录。

相对上游 Butterfly 5.x 改了这些：

| 文件 | 改了什么 |
| --- | --- |
| `layout/archive.pug` `category.pug` `tag.pug` | 原来的时间线列表换成卡片网格 |
| `layout/includes/mixins/postIndexList.pug` `postCardGrid.pug` | **新增**，卡片网格的实现 |
| `layout/includes/header/index.pug` | 文章页不显示顶部大图；列表页用辉光三角 canvas + 粒子开屏替代原来蓝色 banner |
| `layout/includes/layout.pug` | 文章页关闭侧栏；列表页给 body 加 `glow-page` |
| `layout/includes/header/post-info.pug` | 文章页头部信息极简化 |
| `layout/post.pug` | 去掉上下篇引导和相关文章推荐 |

因此**不能直接 `npm update` 升级主题**，得对照新版手工合并上面这几个 pug 文件。

## 常用配置位置

| 内容 | 文件 |
| --- | --- |
| 站点标题 / 副标题 / 作者 | `_config.yml` |
| 菜单、页脚、inject 注入、侧栏 | `_config.butterfly.yml` |
| 首页星网导航节点的位置和链接 | `source/js/globe-hero.js` 顶部 `NAV_ITEMS` |
| 星网颜色和地球仪大小 | 同文件 `VANTA_OPTIONS` |
| 全站配色 / 动效样式 | `source/css/custom.css` |
| 文章页排版 | `source/css/post-minimal.css` |
| 想法数据 | `source/_data/thoughts.yml` |
| 友链数据 | `source/_data/link.yml` |

## 换封面图

把图片放进 `source/img/`（目录不存在就自己建），然后在 `_config.butterfly.yml` 里把
`index_img`、`default_cover` 等配置项改成 `/img/你的图片.jpg`。文件里有详细中文注释。

也可以在单篇文章的 front-matter 里指定：

```yaml
---
title: 某篇文章
cover: /img/xxx.jpg
---
```

注意：文章页现在是极简排版，`post.pug` 里把 `top_img` 强制设成了 `false`，
所以文章页不会显示封面大图，`cover` 目前只影响列表卡片。

## 分类占位文章

`source/_posts/` 下的 `travel-example.md` / `growth-example.md` / `anli-example.md`
是「旅行 / 成长 / 安利」三个分类的占位文章（让首页星网节点有页面可跳）。
正式写作时直接改写它们的内容，或删掉后用 `npx hexo new post` 写新文章，
但记得在 front-matter 里写 `categories: 旅行` 之类的分类，否则首页节点会跳空。
