/**
 * 空分类占位页
 *
 * Hexo 的 hexo-generator-category 只会为「已经有文章」的分类生成页面。
 * 星网导航上的「成长」「生活」在写出第一篇之前属于空分类，点过去会 404。
 *
 * 这里给还没文章的分类补一个占位页：
 *   - 有文章后，本脚本自动跳过（真实分类页由 hexo-generator-category 生成）
 *   - 占位页套用 page 布局，靠 layout.pug 里的 isIndexSkin 认成深色索引页，
 *     视觉上和真实分类页一致，只是没有列表
 */

'use strict';

// 首页星网导航里出现的分类，顺序无所谓
const NAV_CATEGORIES = ['成长', '生活'];

hexo.extend.generator.register('empty-categories', function (locals) {
  const existing = new Set((locals.categories || []).map(c => c.name));

  return NAV_CATEGORIES
    .filter(name => !existing.has(name))
    .map(name => ({
      path: `categories/${name}/index.html`,
      layout: ['page'],
      data: {
        title: name,
        type: 'category-empty',
        comments: false,
        content: `<p class="category-empty-tip">这个分类还没有文章。写出第一篇后，这里会自动变成文章列表。</p>`
      }
    }));
});
