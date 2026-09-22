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

## 常用配置位置

| 内容 | 文件 |
| --- | --- |
| 站点标题 / 副标题 / 作者 | `_config.yml` |
| 主题配置（菜单、头图、封面、页脚等） | `_config.butterfly.yml` |
| 樱花飘落特效 | `source/js/sakura.js` |
| 图片放这里 | `source/img/`（自己新建） |

换首页大图 / 文章封面：把图片放进 `source/img/`，然后在 `_config.butterfly.yml` 里
把 `index_img`、`default_cover` 等配置项改成 `/img/你的图片.jpg` 即可（文件里有详细中文注释）。

也可以在文章 front-matter 里单独指定封面：

```yaml
---
title: 某篇文章
cover: /img/xxx.jpg
---
```
