/**
 * 首页整屏星网导航 hero（Vanta GLOBE 版）
 *
 * 原理：VANTA.GLOBE 返回的 effect 实例上有 points（网格点，THREE.Object3D）
 * 和 camera。每帧用 point.getWorldPosition().project(camera) 把选中的网格
 * 交点投影成 hero 内的像素坐标，同步给覆盖在 canvas 上的 DOM 节点（<a>）。
 *
 * 调整节点：改下面的 NAV_ITEMS（label/href/tx/ty），tx/ty 是期望位置的
 * 屏幕比例坐标（0~1，注意避开右侧的地球仪）。
 */
(function () {
  'use strict';

  // 只在首页运行
  if (location.pathname !== '/' && location.pathname !== '/index.html') return;

  var header = document.getElementById('page-header');
  if (!header || !header.classList.contains('full_page')) return;

  /* ---------------- 配置区 ---------------- */

  var NAV_ITEMS = [
    { label: '归档',   href: '/archives/',        tx: 0.16, ty: 0.20 },
    { label: '旅行',   href: '/categories/旅行/', tx: 0.40, ty: 0.30 },
    { label: '成长',   href: '/categories/成长/', tx: 0.18, ty: 0.46 },
    { label: '安利',   href: '/categories/安利/', tx: 0.42, ty: 0.58 },
    { label: '想法',   href: '/thoughts/',        tx: 0.15, ty: 0.72 },
    { label: '关于我', href: '/about/',           tx: 0.38, ty: 0.84 }
  ];
  var MIN_SEPARATION = 110; // 节点间最小屏幕距离（px），防止挤在一起

  var VANTA_OPTIONS = {
    color: 0xff3f81,           // 网格颜色（粉）
    backgroundColor: 0x23153c, // 背景色（深紫）
    size: 1.00                 // 地球仪大小
  };

  var CLICK_DELAY = 350; // 点击涟漪播完再跳转（ms）

  /* ---------------- 实现 ---------------- */

  // 整屏 hero，插在 Butterfly 页头 banner（已隐藏）之后、正文之前
  var hero = document.createElement('section');
  hero.id = 'globe-hero';
  header.insertAdjacentElement('afterend', hero);

  var canvasBox = document.createElement('div');
  canvasBox.id = 'globe-hero-canvas';
  hero.appendChild(canvasBox);

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  // 只在首页才加载 three.js + vanta（其他页面零开销）
  loadScript('/vendor/three.r134.min.js')
    .then(function () { return loadScript('/vendor/vanta.globe.min.js'); })
    .then(init)
    .catch(function () {
      hero.remove(); // 加载失败则移除 hero，页面回到纯 Butterfly 布局
    });

  function init() {
    var effect = window.VANTA.GLOBE(Object.assign({
      el: canvasBox,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1.00,
      scaleMobile: 1.00
    }, VANTA_OPTIONS));

    var camera = effect.camera;
    var vec = new window.THREE.Vector3();

    // 网格点 3D 世界坐标 → hero 内像素坐标
    function project(point) {
      point.getWorldPosition(vec); // 含 cont 组的位移/视差
      vec.project(camera);         // → NDC（-1 ~ 1）
      return {
        x: (vec.x * 0.5 + 0.5) * canvasBox.clientWidth,
        y: (-vec.y * 0.5 + 0.5) * canvasBox.clientHeight,
        behind: vec.z > 1          // 在相机背面
      };
    }

    // 贪心选点：每个目标区域按距离升序尝试网格点，
    // 要求未被占用且与已选点保持最小间距
    function pickAnchorPoints() {
      var picked = [];
      NAV_ITEMS.forEach(function (item) {
        var targetX = item.tx * canvasBox.clientWidth;
        var targetY = item.ty * canvasBox.clientHeight;
        var candidates = [];
        effect.points.forEach(function (p) {
          if (picked.some(function (q) { return q.point === p; })) return;
          var s = project(p);
          candidates.push({ point: p, screen: s, d: (s.x - targetX) * (s.x - targetX) + (s.y - targetY) * (s.y - targetY) });
        });
        candidates.sort(function (a, b) { return a.d - b.d; });
        var chosen = null;
        for (var i = 0; i < candidates.length; i++) {
          var c = candidates[i];
          var ok = picked.every(function (q) {
            return Math.hypot(c.screen.x - q.screen.x, c.screen.y - q.screen.y) >= MIN_SEPARATION;
          });
          if (ok) { chosen = c; break; }
        }
        if (chosen) picked.push(chosen);
      });
      return picked.map(function (q) { return q.point; });
    }

    function initNavNodes() {
      if (!effect.points || !effect.points.length || !effect.camera) {
        return setTimeout(initNavNodes, 100); // 等 vanta 初始化完
      }

      var anchors = pickAnchorPoints();

      NAV_ITEMS.forEach(function (item, i) {
        var anchor = anchors[i];
        if (!anchor) return;

        var node = document.createElement('a');
        node.className = 'nav-node';
        node.href = item.href;
        node.innerHTML = '<span class="dot"></span><span class="label">' + item.label + '</span>';
        hero.appendChild(node);

        // 点击：涟漪 → 短延迟后跳转；cmd/ctrl/shift/middle 保持浏览器默认行为
        node.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          var r = document.createElement('span');
          r.className = 'ripple';
          node.appendChild(r);
          setTimeout(function () { r.remove(); }, 700);
          var href = node.href;
          setTimeout(function () { location.href = href; }, CLICK_DELAY);
        });

        item._node = node;
        item._anchor = anchor;
      });

      // 每帧同步：DOM 跟着网格点漂浮（含鼠标视差）
      var running = true;
      document.addEventListener('visibilitychange', function () {
        running = !document.hidden;
        if (running) tick();
      });

      function tick() {
        if (!running) return;
        for (var i = 0; i < NAV_ITEMS.length; i++) {
          var item = NAV_ITEMS[i];
          if (!item._node || !item._anchor) continue;
          var s = project(item._anchor);
          item._node.style.transform = 'translate3d(' + s.x + 'px,' + s.y + 'px,0)';
          item._node.style.opacity = s.behind ? 0 : 1;
        }
        requestAnimationFrame(tick);
      }
      tick();

      // 窗口尺寸变化 → 重新选点（投影区域变了）
      var resizeTimer;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          var newAnchors = pickAnchorPoints();
          NAV_ITEMS.forEach(function (item, i) {
            if (newAnchors[i]) item._anchor = newAnchors[i];
          });
        }, 200);
      });
    }

    initNavNodes();
  }
})();
