/**
 * 文章页标题「修 bug」叙事动画（.post-minimal 配套）
 *
 * 三个阶段：
 *  1. Bug 注入：标题以带 bug 状态出现（替换乱码 / 插入乱码 / 相邻颠倒，随机 1~3 个）
 *  2. 巡检：单个选中框（圆角描边，绝对定位，连续变形）逐字扫描，两行时先扫第一行
 *  3. 修复：替换→竖直滚动刷洗；插入→变红收拢删除；颠倒→框撑宽覆盖两字后交换位置
 *
 * 只在文章页（#post.post-minimal .post-title）执行；
 * prefers-reduced-motion 直接显示正确标题；收尾恢复纯文本节点。
 */
(function () {
  'use strict';

  /* ========== 可调参数 ========== */
  var GLYPH_POOL = '#%&ｺ';
  var BUG_SHOW_MS = 400;   // 阶段1 bug 展示停顿
  var SCAN_MS = 150;       // 阶段2 每字扫描节奏（130~180ms 区间）
  var SPEED = 1;           // 调试：整体节奏倍率（抓帧时调大）
  var FORCE_BUGS = null;   // 调试：强制 bug 类型与位置，如 [{type:'swap',index:2}]；null = 随机 1~3 个
  var BOX_PAD = 4;         // 选中框相对字符的外扩

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var title = document.querySelector('#post.post-minimal .post-title');
  if (!title) return;
  var text = title.textContent;
  if (!text || !text.trim()) return;

  /* ========== 解析弹簧（与 morph 同款：mass=1，速度继承） ========== */
  function Spring(stiffness, damping, initial) {
    var s = {
      k: stiffness, c: damping, x: initial, v: 0, t: initial,
      setTarget: function (nt) { s.t = nt; },
      jump: function (nv) { s.x = nv; s.t = nv; s.v = 0; },
      step: function (dt) {
        var x0 = s.x - s.t, v0 = s.v;
        var zeta = s.c / (2 * Math.sqrt(s.k));
        var w0 = Math.sqrt(s.k), x1, v1;
        if (zeta < 0.999) {
          var wd = w0 * Math.sqrt(1 - zeta * zeta);
          var alpha = zeta * w0;
          var A = x0, B = (v0 + alpha * x0) / wd;
          var e = Math.exp(-alpha * dt);
          var cos = Math.cos(wd * dt), sin = Math.sin(wd * dt);
          x1 = e * (A * cos + B * sin);
          v1 = e * ((B * wd - A * alpha) * cos - (A * wd + B * alpha) * sin);
        } else {
          var h = dt / 4;
          for (var i = 0; i < 4; i++) {
            var f = -s.k * x0 - s.c * v0;
            v0 += f * h;
            x0 += v0 * h;
          }
          x1 = x0; v1 = v0;
        }
        s.x = s.t + x1;
        s.v = v1;
        return s.x;
      },
      resting: function () {
        return Math.abs(s.x - s.t) < 0.5 && Math.abs(s.v) < 0.5;
      }
    };
    return s;
  }

  /* ========== 工具 ========== */
  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms * SPEED); });
  }
  function poolChar() {
    return GLYPH_POOL[Math.floor(Math.random() * GLYPH_POOL.length)];
  }
  function shuffled(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ========== 阶段 1：注入 bug ==========
     items: [{ch, bug}]；bug = {type:'sub',correct} | {type:'ins'} | {type:'swap'} */
  var items = text.split('').map(function (ch) { return { ch: ch, bug: null }; });

  // bug 规格：随机 1~3 个，或调试强制（[{type:'sub',index:2},{type:'ins',index:5},{type:'swap',index:0}]）
  var bugSpecs;
  if (FORCE_BUGS) {
    bugSpecs = FORCE_BUGS;
  } else {
    bugSpecs = shuffled(['sub', 'ins', 'swap']).slice(0, 1 + Math.floor(Math.random() * 3))
      .map(function (t) { return { type: t }; });
  }
  var used = {};
  function freeIndex(max) {
    var i;
    do { i = Math.floor(Math.random() * max); } while (used[i]);
    used[i] = 1;
    return i;
  }

  // 先替换（不改长度）
  bugSpecs.filter(function (b) { return b.type === 'sub'; }).forEach(function (b) {
    var si = b.index != null ? b.index : freeIndex(items.length);
    used[si] = 1;
    items[si].bug = { type: 'sub', correct: items[si].ch, shown: poolChar() };
  });
  // 再插入（长度 +1，位置换算到插入后的数组）
  bugSpecs.filter(function (b) { return b.type === 'ins'; }).forEach(function (b) {
    var ii = b.index != null ? b.index : freeIndex(items.length + 1);
    items.splice(Math.min(ii, items.length), 0, { ch: poolChar(), bug: {type: 'ins'} });
  });
  // 最后颠倒（避开已有 bug 的位置，且伙伴必须相邻无 bug）
  bugSpecs.filter(function (b) { return b.type === 'swap'; }).forEach(function (b) {
    var wi = -1;
    if (b.index != null && b.index < items.length - 1 && !items[b.index].bug && !items[b.index + 1].bug) {
      wi = b.index;
    } else {
      var candidates = [];
      for (var k = 0; k < items.length - 1; k++) {
        if (!items[k].bug && !items[k + 1].bug && !used[k] && !used[k + 1]) candidates.push(k);
      }
      if (candidates.length) wi = candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (wi >= 0) {
      var tmp = items[wi];
      items[wi] = items[wi + 1];
      items[wi + 1] = tmp;
      items[wi].bug = { type: 'swap' };
    }
  });

  // 渲染逐字 span（bug 态）+ 单个选中框元素
  title.textContent = '';
  var spans = items.map(function (it) {
    var sp = document.createElement('span');
    sp.className = 'tg-ch';
    sp.textContent = it.bug && it.bug.shown ? it.bug.shown : it.ch;
    sp._bug = it.bug;
    title.appendChild(sp);
    return sp;
  });
  var sel = document.createElement('span');
  sel.className = 'tg-selbox';
  title.appendChild(sel);

  /* ========== 选中框：4 根弹簧驱动（位置 translate + 尺寸 width/height） ==========
     框是绝对定位的装饰元素，尺寸变化不引起页面重排 */
  var sx = Spring(170, 20, 0), sy = Spring(170, 20, 0);
  var sw = Spring(170, 20, 0), sh = Spring(170, 20, 0);
  var boxRaf = null, boxLast = 0;

  function boxLoop(now) {
    var dt = Math.min((now - boxLast) / 1000, 1 / 30);
    boxLast = now;
    sx.step(dt); sy.step(dt); sw.step(dt); sh.step(dt);
    sel.style.transform = 'translate(' + sx.x.toFixed(1) + 'px,' + sy.x.toFixed(1) + 'px)';
    sel.style.width = Math.max(0, sw.x).toFixed(1) + 'px';
    sel.style.height = Math.max(0, sh.x).toFixed(1) + 'px';
    boxRaf = requestAnimationFrame(boxLoop);
  }

  function boxStart() {
    if (boxRaf == null) {
      boxLast = performance.now();
      boxRaf = requestAnimationFrame(boxLoop);
    }
  }

  function boxStop() {
    if (boxRaf != null) {
      cancelAnimationFrame(boxRaf);
      boxRaf = null;
    }
  }

  // 选中框目标：包裹给定 span 集合的联合矩形（offset 相对 h1）
  function moveBoxTo(list, instant) {
    var first = list[0];
    var l = first.offsetLeft, t = first.offsetTop;
    var r = l + first.offsetWidth, b = t + first.offsetHeight;
    for (var i = 1; i < list.length; i++) {
      var sp = list[i];
      l = Math.min(l, sp.offsetLeft);
      t = Math.min(t, sp.offsetTop);
      r = Math.max(r, sp.offsetLeft + sp.offsetWidth);
      b = Math.max(b, sp.offsetTop + sp.offsetHeight);
    }
    var tx = l - BOX_PAD, ty = t - BOX_PAD;
    var tw = (r - l) + BOX_PAD * 2, th = (b - t) + BOX_PAD * 2;
    if (instant) {
      sx.jump(tx); sy.jump(ty); sw.jump(tw); sh.jump(th);
    } else {
      sx.setTarget(tx); sy.setTarget(ty); sw.setTarget(tw); sh.setTarget(th);
    }
  }

  /* ========== 巡检顺序：按行（offsetTop）从左到右 ========== */
  function scanOrder() {
    return spans.filter(function (sp) { return sp.isConnected; }).sort(function (a, b) {
      var dy = a.offsetTop - b.offsetTop;
      if (Math.abs(dy) > 6) return dy;
      return a.offsetLeft - b.offsetLeft;
    });
  }

  var activeCh = null;
  function setActive(sp) {
    if (activeCh) activeCh.classList.remove('tg-active');
    activeCh = sp;
    if (sp) sp.classList.add('tg-active');
  }

  /* ========== 修复 1：替换乱码 → 竖直滚动刷洗 ========== */
  function repairWash(sp, correct) {
    var h = sp.offsetHeight, w = sp.offsetWidth;
    var mids = 1 + Math.floor(Math.random() * 2); // 中间乱码行 1~2 → 总翻动 2~3 次
    var rows = [sp.textContent];
    for (var r = 0; r < mids; r++) rows.push(poolChar());
    rows.push(correct);

    sp.classList.add('tg-wash');
    sp.style.width = w + 'px';
    sp.style.height = h + 'px';
    var inner = document.createElement('span');
    inner.className = 'tg-wash-inner';
    rows.forEach(function (t) {
      var row = document.createElement('span');
      row.className = 'tg-wash-row';
      row.style.height = h + 'px';
      row.style.lineHeight = h + 'px';
      row.textContent = t;
      inner.appendChild(row);
    });
    sp.textContent = '';
    sp.appendChild(inner);

    var dist = (rows.length - 1) * h;
    return inner.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(' + (-dist) + 'px)' }],
      { duration: (rows.length - 1) * 170 * SPEED, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' }
    ).finished.then(function () {
      sp.classList.remove('tg-wash');
      sp.style.width = '';
      sp.style.height = '';
      sp.textContent = correct;
    });
  }

  /* ========== 修复 2：插入乱码 → 变红 → 收拢删除 ========== */
  function repairDelete(sp) {
    sp.classList.add('tg-del');
    return wait(200).then(function () {
      var w = sp.offsetWidth;
      return sp.animate(
        [{ width: w + 'px', opacity: 1, transform: 'scale(1)' },
         { width: '0px', opacity: 0, transform: 'scale(.2)' }],
        { duration: 260 * SPEED, easing: 'ease-in', fill: 'forwards' }
      ).finished;
    }).then(function () {
      sp.remove();
    });
  }

  /* ========== 修复 3：相邻颠倒 → 框撑宽覆盖两字 → 交换位置 ========== */
  function repairSwap(order, i) {
    var a = order[i], b = order[i + 1];
    moveBoxTo([a, b]); // 选中框连续变形撑宽，覆盖两个字
    return wait(300).then(function () {
      // 严格三段式交换：先竖直分离（a 上 b 下）→ 分离状态水平换位 → 落回基线。
      // 水平移动期间两字全程处于不同高度，结构上不可能重叠。
      // 两字各自移动到对方的最终落位（字宽可能不同，距离必须分别计算）。
      var dx = b.offsetLeft - a.offsetLeft;             // = a 字宽 + 字距
      var aMove = dx + (b.offsetWidth - a.offsetWidth); // a 的落位 = b 的最终位
      var bMove = -dx;                                  // b 的落位 = a 的原位
      // 跨行守卫：a、b 不在同一行时不做弧线位移，直接淡出修正，避免错乱飞行
      if (Math.abs(a.offsetTop - b.offsetTop) > 6) {
        var fadeA = a.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 * SPEED, fill: 'forwards' });
        var fadeB = b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 * SPEED, fill: 'forwards' });
        return Promise.all([fadeA.finished, fadeB.finished]).then(function () {
          fadeA.cancel(); fadeB.cancel();
          a.parentNode.insertBefore(b, a);
          var backA = a.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 * SPEED, fill: 'forwards' });
          var backB = b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 * SPEED, fill: 'forwards' });
          return Promise.all([backA.finished, backB.finished]).then(function () {
            backA.cancel(); backB.cancel();
          });
        });
      }
      var dur = 520 * SPEED;
      var ease = 'cubic-bezier(.45,0,.25,1)';
      // 关键：保留动画句柄。fill:'forwards' 会让位移在动画结束后持续生效，
      // DOM 交换位置后若不 cancel，两个字会带着旧位移叠到邻居字上。
      var animA = a.animate(
        [
          { transform: 'translate(0, 0) scale(1.14)', offset: 0 },
          { transform: 'translate(0, -0.6em) scale(1.14)', offset: 0.28 },
          { transform: 'translate(' + aMove + 'px, -0.6em) scale(1.14)', offset: 0.72 },
          { transform: 'translate(' + aMove + 'px, 0) scale(1.14)', offset: 1 }
        ],
        { duration: dur, easing: ease, fill: 'forwards' }
      );
      var animB = b.animate(
        [
          { transform: 'translate(0, 0)', offset: 0 },
          { transform: 'translate(0, 0.6em)', offset: 0.28 },
          { transform: 'translate(' + bMove + 'px, 0.6em)', offset: 0.72 },
          { transform: 'translate(' + bMove + 'px, 0)', offset: 1 }
        ],
        { duration: dur, easing: ease, fill: 'forwards' }
      );
      return Promise.all([animA.finished, animB.finished]).then(function () {
        animA.cancel();
        animB.cancel();
      });
    }).then(function () {
      // DOM 修正：b 移到 a 前面（此时动画已取消，两字各归其位）
      a.parentNode.insertBefore(b, a);
      a._bug = null;
      // order 同步交换，主循环 i++ 后跳过伙伴
      order[i] = b;
      order[i + 1] = a;
      setActive(b);
      moveBoxTo([b]); // 选中框恢复单字尺寸
      return wait(SCAN_MS);
    });
  }

  /* ========== 主流程 ========== */
  function run() {
    return wait(BUG_SHOW_MS)              // 阶段1：bug 展示
      .then(function () {
        boxStart();
        var order = scanOrder();
        if (order.length) moveBoxTo([order[0]], true);
        sel.classList.add('is-on');
        setActive(order[0]);

        var p = Promise.resolve();
        order.forEach(function (sp, i) {
          p = p.then(function () {
            if (!sp.isConnected) return;
            setActive(sp);
            moveBoxTo([sp]);
            return wait(SCAN_MS).then(function () {
              var bug = sp._bug;
              if (!bug) return;
              if (bug.type === 'sub') return repairWash(sp, bug.correct);
              if (bug.type === 'ins') return repairDelete(sp);
              if (bug.type === 'swap') return repairSwap(order, i);
            });
          });
        });
        return p;
      })
      .then(function () {                 // 收尾：框淡出，恢复纯文本
        setActive(null);
        sel.classList.remove('is-on');
        return wait(260);
      })
      .then(function () {
        boxStop();
        title.textContent = text;
      });
  }

  run().catch(function () {
    boxStop();
    title.textContent = text; // 任何异常都保证标题正确显示
  });
})();
