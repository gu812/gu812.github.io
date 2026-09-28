/**
 * 文章卡片变形交互（.morph-* 命名空间）
 * 作用于页面上所有 .post-card（归档/分类页卡片网格），每卡独立弹簧实例组。
 *
 * 三个交互时刻：
 *  1. 悬停进入：封面左下角的日期/分类 pill 拉伸变形为「阅读全文 →」（同一元素变形，文字错时切换）
 *  2. 点击封面连续扩展为文章页头图 —— 骨架，无封面时静默
 *  3. 封面加载占位呼吸变形 —— 骨架，无封面时静默
 *
 * 原则：动效只动 transform/opacity；解析弹簧积分、速度继承；不动宽高、零重排；
 * prefers-reduced-motion 全部瞬切；触屏无悬停时 pill 常显默认态；
 * rAF 循环按需唤醒，只步进有未静止弹簧的卡片。
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var cards = Array.prototype.slice.call(document.querySelectorAll('.post-card'));
  if (!cards.length) return;

  /* ================= 解析弹簧 =================
     mass=1 的阻尼谐振子：x'' = -k(x - target) - c·x'
     每帧解析求值（欠阻尼用闭式解，临界/过阻尼用半隐式 Euler 子步保底）。
     目标随时可变，当前值与速度天然保留 → 平滑接管，无卡顿。 */
  function Spring(stiffness, damping, initial) {
    var s = {
      k: stiffness, c: damping,
      x: initial, v: 0, t: initial,
      setTarget: function (nt) { s.t = nt; },
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
        return Math.abs(s.x - s.t) < 1e-4 && Math.abs(s.v) < 1e-4;
      }
    };
    return s;
  }

  /* ================= 全局 rAF 主循环（按需唤醒） ================= */
  var states = [];
  var rafId = null, lastT = 0;

  function wake() {
    if (rafId == null) {
      lastT = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  function loop(now) {
    var dt = Math.min((now - lastT) / 1000, 1 / 30);
    lastT = now;
    var active = false;
    for (var i = 0; i < states.length; i++) {
      var st = states[i];
      if (st.resting()) continue;      // 静止卡片不步进、不重绘
      for (var j = 0; j < st.springs.length; j++) st.springs[j].step(dt);
      st.render();
      if (!st.resting()) active = true;
    }
    rafId = active ? requestAnimationFrame(loop) : null;
  }

  /* ================= 逐卡增强 ================= */
  cards.forEach(function (card) {
    if (card.offsetParent === null) return; // 隐藏的卡片不挂载

    var href = card.getAttribute('data-href');
    if (!href) return;
    var cover = card.querySelector('.post-card-cover');
    if (!cover) return;

    var dateText = card.getAttribute('data-date') || '';
    var catText = card.getAttribute('data-cat') || '';
    var metaText = dateText + (catText ? ' · ' + catText : '');

    card.classList.add('morph-card');

    /* ---------- 时刻 1：pill（日期·分类 → 阅读全文 →） ---------- */
    var pill = document.createElement('a');
    pill.className = 'morph-pill';
    pill.href = href;
    pill.setAttribute('aria-label', '阅读全文');
    pill.innerHTML =
      '<span class="morph-pill-bg"></span>' +
      '<span class="morph-pill-text morph-meta"></span>' +
      '<span class="morph-pill-text morph-cta">阅读全文 →</span>';
    cover.appendChild(pill);

    var pillBg = pill.querySelector('.morph-pill-bg');
    var metaSpan = pill.querySelector('.morph-meta');
    var ctaSpan = pill.querySelector('.morph-cta');
    metaSpan.textContent = metaText || '阅读';

    // 量出两个状态的宽度，bg 层用 transform: scaleX 变形（容器不动，零重排）
    var metaW = metaSpan.offsetWidth;
    var ctaW = ctaSpan.offsetWidth;
    var scaleTarget = ctaW > 0 && metaW > 0 ? ctaW / metaW : 1;

    var state = {
      el: card,
      springs: [],
      render: null,
      resting: function () {
        return this.springs.every(function (s) { return s.resting(); });
      }
    };

    // pill 拉伸弹簧（稍软，允许轻微超调）+ 文本透明度弹簧（快而硬）
    var spScaleX = Spring(180, 16, 1);
    var spScaleY = Spring(180, 16, 1);
    var spMetaO = Spring(500, 45, 1);
    var spCtaO = Spring(380, 38, 0);
    state.springs.push(spScaleX, spScaleY, spMetaO, spCtaO);

    if (REDUCED) {
      state.springs.forEach(function (s) {
        s.step = function () { s.x = s.t; s.v = 0; return s.x; };
        s.resting = function () { return true; };
      });
    }

    /* ---------- 渲染（只动 transform / opacity） ---------- */
    state.render = function () {
      pillBg.style.transform = 'scale(' + spScaleX.x.toFixed(4) + ',' + spScaleY.x.toFixed(4) + ')';
      metaSpan.style.opacity = Math.max(0, Math.min(1, spMetaO.x)).toFixed(3);
      ctaSpan.style.opacity = Math.max(0, Math.min(1, spCtaO.x)).toFixed(3);
    };

    /* ---------- 状态与事件 ---------- */
    var staggerTimer = null;

    function setHover(on) {
      clearTimeout(staggerTimer);
      if (on) {
        // pill → CTA：meta 先淡出，CTA 错后淡入（时机错开不重叠）
        spScaleX.setTarget(scaleTarget);
        spScaleY.setTarget(1.04);
        spMetaO.setTarget(0);
        staggerTimer = setTimeout(function () {
          spCtaO.setTarget(1);
          pill.classList.add('is-cta'); // 颜色/圆角在文本切换点瞬时翻转（无渐变）
        }, REDUCED ? 0 : 140);
      } else {
        spScaleX.setTarget(1);
        spScaleY.setTarget(1);
        spCtaO.setTarget(0);
        staggerTimer = setTimeout(function () {
          spMetaO.setTarget(1);
          pill.classList.remove('is-cta');
        }, REDUCED ? 0 : 140);
      }
      wake();
    }

    if (CAN_HOVER) {
      card.addEventListener('mouseenter', function () { setHover(true); });
      card.addEventListener('mouseleave', function () { setHover(false); });
    }
    // 触屏：pill 常显默认态（日期·分类），本身是可点的链接，触摸直接跳转

    /* ---------- 时刻 2 骨架：封面点击 → 文章页头图 ----------
       跨页 View Transitions：旧页给封面命名，新页同名元素自动连续变形。
       当前文章都没有封面 → 静默；文章配 cover 后此骨架自动生效。
       任何异常都只降级为普通跳转，绝不阻塞导航。 */
    (function armCoverTransition() {
      var coverImg = card.querySelector('.post-card-cover img');
      if (!coverImg) return; // 无封面：静默
      try {
        card.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 新标签行为不干预
          coverImg.style.viewTransitionName = 'morph-cover';
          // 文章页侧配对：目标页头图设置 view-transition-name: morph-cover
          // （上线前按 document.referrer 匹配后赋值）
        }, true);
      } catch (err) { /* 静默降级 */ }
    })();

    /* ---------- 时刻 3 骨架：封面加载占位 → 就绪变形 ----------
       占位形状呼吸变形（纯 transform/opacity），img 就绪后同一形状变形为封面。
       无封面 → 静默。 */
    (function coverLoadingMorph() {
      var coverImg = card.querySelector('.post-card-cover img');
      if (!coverImg) return; // 无封面：静默
      var ph = document.createElement('span');
      ph.className = 'morph-cover-ph';
      cover.appendChild(ph);
      var reveal = function () {
        if (REDUCED) { ph.remove(); return; }
        // 同一形状从占位尺寸变形到满幅，同时图片淡入，不闪切
        ph.animate(
          [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.08)', opacity: 0 }],
          { duration: 380, easing: 'ease-out', fill: 'forwards' }
        ).onfinish = function () { ph.remove(); };
        coverImg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, fill: 'forwards' });
      };
      if (coverImg.complete && coverImg.naturalWidth) reveal();
      else coverImg.addEventListener('load', reveal, { once: true });
    })();

    states.push(state);
  });
})();
