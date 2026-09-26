/**
 * 「想法」页生成器
 * 数据源：source/_data/thoughts.yml（Hexo 自动解析为 site.data.thoughts）
 * 格式：
 *   - date: 2026-09-26
 *     content: 想法内容
 * 生成 /thoughts/index.html，套用 Butterfly 的 page 布局，保留全站样式。
 */

'use strict';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return String(d);
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

hexo.extend.generator.register('thoughts', function (locals) {
  // hexo 8：generator 收到的 locals 顶层即 posts/pages/data 等键
  const data = locals.data || {};
  const list = Array.isArray(data.thoughts) ? data.thoughts.slice() : [];

  // 按日期倒序
  list.sort((a, b) => new Date(b.date) - new Date(a.date));

  const items = list.map(t => `
    <div class="thought-item">
      <span class="thought-date">${escapeHtml(formatDate(t.date))}</span>
      <div class="thought-content">${escapeHtml(t.content).replace(/\n/g, '<br>')}</div>
    </div>`).join('');

  const content = `
    <p>随手记下的碎碎念和想法 💭</p>
    <div class="thoughts-timeline">
      ${items || '<p>还没有想法，去 source/_data/thoughts.yml 写一条吧。</p>'}
    </div>`;

  return {
    path: 'thoughts/index.html',
    layout: ['page'],
    data: {
      title: '想法',
      type: 'thoughts',
      comments: false,
      content
    }
  };
});
