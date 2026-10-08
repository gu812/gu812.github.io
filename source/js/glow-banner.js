/* 分页面辉光三角徽章
 * 渲染核心移植自调参完成的 glow.html（开袋即食，参数未动）：
 * 黑底 + 三角纯黑剪影 + 周长银色光带，呼吸、顺时针暗波流转、
 * 鼠标 1.5cm 内聚光、点击三角切彩虹模式。
 * 与全屏版的差异仅为布局：canvas 尺寸跟随页头、三角中心略上移给标题让位。
 * 只在含 #glow-canvas 的页面初始化（归档/分类/标签/普通页）。
 */
(function () {
  'use strict';

  function boot() {
    var canvas = document.getElementById('glow-canvas');
    if (!canvas || canvas.dataset.gbInit) return;
    canvas.dataset.gbInit = '1';
    try {
      init(canvas);
    } catch (e) {
      canvas.remove();
    }
  }

  function init(cv) {
    var header = cv.parentElement;
    var ctx = cv.getContext('2d');
    var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    var TAU = Math.PI * 2;

    // 1.5cm ≈ 57 CSS px：鼠标进入这个距离才触发聚光
    var NEAR_PX = 57;

    var W, H, CX, CY, TRI_H, SIDE, PAD, PAD2, T, TG;
    var bloom, bloomColor, far;   // 远场圆形弱光（整体均匀，不随区域变化）
    var edgeGlow;                 // 近场：整圈光带栈合为一张
    var regionSprites = [];       // 6 个银色区域层：角0 边0 角1 边1 角2 边2（沿周长顺序）
    var regionColors = [];        // 6 个彩虹区域层（hue = 下标 × 60°）
    var HAS_FILTER = typeof ctx.filter === 'string';

    // ---------- 几何 ----------
    // 顶点顺序：顶角 → 左下 → 右下，即 d 增大的方向是逆时针。
    // 所以"顺时针流转"= 波峰沿 d 减小的方向移动。
    function triPoints(scale) {
      scale = scale || 1;
      var h = TRI_H * scale;
      var s = 2 * h / Math.sqrt(3);
      return [
        [CX, CY - 2 * h / 3],
        [CX - s / 2, CY + h / 3],
        [CX + s / 2, CY + h / 3]
      ];
    }
    function perimeterPoint(d) {
      var p = triPoints();
      d = ((d % (3 * SIDE)) + 3 * SIDE) % (3 * SIDE);
      if (d < SIDE) return lerp2(p[0], p[1], d / SIDE);
      if (d < 2 * SIDE) return lerp2(p[1], p[2], (d - SIDE) / SIDE);
      return lerp2(p[2], p[0], (d - 2 * SIDE) / SIDE);
    }
    function lerp2(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    function gauss() {
      var u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    }
    function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function segDist(px, py, a, b) {
      var vx = b[0] - a[0], vy = b[1] - a[1];
      var t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (py - a[1]) * vy) / (vx * vx + vy * vy)));
      return Math.hypot(px - (a[0] + vx * t), py - (a[1] + vy * t));
    }

    // ---------- 光斑 ----------
    function blob(g, x, y, r, a) {
      var grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(240,245,253,' + a.toFixed(3) + ')');
      grad.addColorStop(0.35, 'rgba(240,245,253,' + (a * 0.55).toFixed(3) + ')');
      grad.addColorStop(0.7, 'rgba(240,245,253,' + (a * 0.2).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(240,245,253,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }

    function scatter(g, count, rMin, rMax, aMin, aMax, jitter, outBias, ridgeRatio, bothSide) {
      bothSide = bothSide === undefined ? true : bothSide;
      var corners = [0, SIDE, 2 * SIDE];
      for (var i = 0; i < count; i++) {
        var d, boost = 1;
        if (Math.random() < ridgeRatio) {
          d = Math.random() * 3 * SIDE;
        } else {
          d = Math.random() * 3 * SIDE;
          boost = 0.5 + Math.random();
        }
        var p = perimeterPoint(d);
        for (var ci = 0; ci < corners.length; ci++) {
          var dd = Math.abs(((d - corners[ci] + 1.5 * SIDE) % (3 * SIDE)) - 1.5 * SIDE);
          if (dd < SIDE * 0.06) boost *= 1.35;
        }
        var nx = (p[0] - CX), ny = (p[1] - CY);
        var nl = Math.hypot(nx, ny) || 1;
        var jit = bothSide ? gauss() : Math.abs(gauss());
        var off = jit * jitter + outBias;
        var x = p[0] + nx / nl * off + gauss() * 2;
        var y = p[1] + ny / nl * off + gauss() * 2;

        var r = rMin + Math.pow(Math.random(), 1.5) * (rMax - rMin);
        var a = (aMin + Math.random() * (aMax - aMin)) * boost;
        blob(g, x, y, r, Math.min(a, 0.3));
      }
    }

    function band(g, width, blur, alpha, color) {
      color = color || '#f4f7fd';
      if (HAS_FILTER) g.filter = 'blur(' + blur + 'px)';
      var p = triPoints();
      g.beginPath();
      g.moveTo(p[0][0], p[0][1]);
      g.lineTo(p[1][0], p[1][1]);
      g.lineTo(p[2][0], p[2][1]);
      g.closePath();
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.lineWidth = width;
      g.globalAlpha = alpha;
      g.strokeStyle = color;
      g.stroke();
      g.globalAlpha = 1;
      g.filter = 'none';
    }

    function makeSprite(pad, draw) {
      var c = document.createElement('canvas');
      c.width = W + pad * 2;
      c.height = H + pad * 2;
      var g = c.getContext('2d');
      g.translate(pad, pad);
      draw(g);
      return { c: c, pad: pad };
    }

    // 区域遮罩：某段周长附近的光通过、其余挡掉（两端羽化渐隐）。
    function regionMask(d0, dPS, dPE, d1) {
      var R_MASK = TG * 0.28;
      var mask = document.createElement('canvas');
      mask.width = W + PAD2 * 2;
      mask.height = H + PAD2 * 2;
      var m = mask.getContext('2d');
      m.translate(PAD2, PAD2);
      var step = Math.max(4, TG * 0.05);
      for (var d = d0; d <= d1; d += step) {
        var a = smooth01((d - d0) / (dPS - d0)) * (1 - smooth01((d - dPE) / (d1 - dPE)));
        if (a <= 0.004) continue;
        var p = perimeterPoint(d);
        var grad = m.createRadialGradient(p[0], p[1], R_MASK * 0.35, p[0], p[1], R_MASK);
        grad.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        m.fillStyle = grad;
        m.beginPath();
        m.arc(p[0], p[1], R_MASK, 0, TAU);
        m.fill();
      }
      return mask;
    }

    function maskedSprite(srcCanvas, mask) {
      var c = document.createElement('canvas');
      c.width = mask.width;
      c.height = mask.height;
      var g = c.getContext('2d');
      g.drawImage(srcCanvas, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(mask, 0, 0);
      return { c: c, pad: PAD2 };
    }

    // 整圈光带栈（5 层宽度 ×1.9 递变），可指定颜色
    function buildLight(color, a0) {
      a0 = a0 === undefined ? 0.22 : a0;
      return makeSprite(PAD2, function (g) {
        if (HAS_FILTER) g.filter = 'blur(3px)';
        for (var i = 0; i < 5; i++) {
          var f = Math.pow(1.9, i);
          band(g, TG * 0.012 * f, TG * 0.008 * f, a0 * Math.pow(0.82, i), color);
        }
      });
    }

    // ---------- 构建 ----------
    function build() {
      W = header.clientWidth; H = header.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      CX = W / 2;
      CY = H * 0.42;   // 三角略上移，给下方页标题让位（纯布局调整，不动光效参数）
      // 三角形与光晕尺寸解耦：三角缩小，光晕维持原基准，
      // 同样的光能量聚在更短的周长上 → 光晕更密更浓
      TRI_H = Math.min(W, H) * 0.28;
      SIDE = 2 * TRI_H / Math.sqrt(3);
      T = TRI_H;
      TG = Math.min(W, H) * 0.5;
      PAD = Math.round(TG * 1.3) + 40;  // 远场圆形渐变需要的大画幅
      PAD2 = Math.round(TG * 0.5);      // 近场光带/区域层只需罩住光带触及范围

      edgeGlow = buildLight('#f4f7fd');

      // 6 个区域层 ×（银色 / 彩虹色），角与边交替沿周长排列
      var S = SIDE;
      regionSprites.length = 0;
      regionColors.length = 0;
      for (var i = 0; i < 3; i++) {
        var dc = i * S;
        var spans = [
          [dc - 0.67 * S, dc - 0.35 * S, dc + 0.35 * S, dc + 0.67 * S],
          [i * S - 0.18 * S, i * S + 0.10 * S, (i + 1) * S - 0.10 * S, (i + 1) * S + 0.18 * S]
        ];
        for (var si = 0; si < spans.length; si++) {
          var k = regionSprites.length;
          var mask = regionMask.apply(null, spans[si]);
          regionSprites.push(maskedSprite(edgeGlow.c, mask));
          regionColors.push(maskedSprite(buildLight('hsl(' + k * 60 + ', 90%, 70%)', 0.24).c, mask));
        }
      }

      // 远场：圆形弱光两层（均匀托底，不参与区域调制）
      bloom = makeSprite(PAD, function (g) {
        if (HAS_FILTER) g.filter = 'blur(3px)';
        var R = TG * 1.15;
        var grad = g.createRadialGradient(CX, CY, 0, CX, CY, R);
        grad.addColorStop(0, 'rgba(228,235,249,0.20)');
        grad.addColorStop(0.30, 'rgba(228,235,249,0.185)');
        grad.addColorStop(0.55, 'rgba(228,235,249,0.135)');
        grad.addColorStop(0.80, 'rgba(228,235,249,0.05)');
        grad.addColorStop(1, 'rgba(228,235,249,0)');
        g.fillStyle = grad;
        g.fillRect(CX - R, CY - R, R * 2, R * 2);
        scatter(g, 40, TG * 0.3, TG * 0.6, 0.005, 0.012, 20, 30, 0.9, false);
      });

      bloomColor = makeSprite(PAD, function (g) {
        var R = TG * 1.15;
        var cg = g.createConicGradient(0, CX, CY);
        for (var k = 0; k <= 12; k++) {
          cg.addColorStop(k / 12, 'hsl(' + k * 30 + ', 85%, 68%)');
        }
        g.fillStyle = cg;
        g.fillRect(CX - R, CY - R, R * 2, R * 2);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(bloom.c, -PAD, -PAD);
      });
      far = makeSprite(PAD, function (g) {
        var R = PAD * 0.92;
        var grad = g.createRadialGradient(CX, CY, 0, CX, CY, R);
        grad.addColorStop(0, 'rgba(228,235,249,0.068)');
        grad.addColorStop(0.5, 'rgba(228,235,249,0.028)');
        grad.addColorStop(1, 'rgba(228,235,249,0)');
        g.fillStyle = grad;
        g.fillRect(CX - R, CY - R, R * 2, R * 2);
      });
    }

    // ---------- 交互状态 ----------
    var FRAC = [0, 1 / 6, 1 / 3, 1 / 2, 2 / 3, 5 / 6];
    var wCur = new Float64Array(6).fill(0.17);
    var wTarget = new Float64Array(6);
    var wAmb = new Float64Array(6);
    var wNear = new Float64Array(6);
    var baseCur = 0.42;
    var nearBlend = 0;
    var dimCur = 1, dimTarget = 1;
    var dimUntil = -1, nextDim = 6 + Math.random() * 6;
    var wavePhase = Math.random() * TAU;
    var colorTarget = 0, colorBlend = 0;
    var mouse = { x: -1e4, y: -1e4, in: false };

    function canvasPos(e) {
      var r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    function inTri(x, y) {
      var p = triPoints();
      var sign = 0;
      for (var i = 0; i < 3; i++) {
        var a = p[i], b = p[(i + 1) % 3];
        var cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        if (cr !== 0) {
          var s2 = Math.sign(cr);
          if (sign === 0) sign = s2;
          else if (s2 !== sign) return false;
        }
      }
      return true;
    }

    header.addEventListener('click', function (e) {
      var pos = canvasPos(e);
      if (inTri(pos[0], pos[1])) {
        colorTarget = 1 - colorTarget;
        if (REDUCED) { colorBlend = colorTarget; render(0.72, 0.42, wCur, 1); }
      }
    });
    header.addEventListener('pointermove', function (e) {
      var pos = canvasPos(e);
      mouse.x = pos[0]; mouse.y = pos[1]; mouse.in = true;
      cv.style.cursor = inTri(pos[0], pos[1]) ? 'pointer' : 'default';
    });
    header.addEventListener('pointerleave', function () { mouse.in = false; });
    addEventListener('blur', function () { mouse.in = false; });

    function breathe(t) {
      return 0.72
        + 0.24 * Math.sin(t * TAU / 5.2)
        + 0.09 * Math.sin(t * TAU / 2.1 + 1.3);
    }

    // ---------- 一帧 ----------
    function drawSprite(sp, alpha, s) {
      if (alpha <= 0.004) return;
      var dw = (W + sp.pad * 2) * s, dh = (H + sp.pad * 2) * s;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(sp.c, W / 2 - (W / 2 + sp.pad) * s, H / 2 - (H / 2 + sp.pad) * s, dw, dh);
    }

    function render(breath, base, wArr, dim, near) {
      near = near || 0;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      var s = 1 + 0.006 * (breath - 0.72);
      var m = breath * (1 - (1 - dim) * (1 - near));
      var amb = 1 - 0.4 * near;
      var cb = colorBlend;
      ctx.globalCompositeOperation = 'lighter';
      drawSprite(far, m * amb, s);
      drawSprite(bloom, m * amb * (1 - cb), s);
      drawSprite(bloomColor, m * amb * cb, s);
      drawSprite(edgeGlow, m * base * (1 - cb), s);
      for (var i = 0; i < 6; i++) {
        drawSprite(regionSprites[i], m * wArr[i] * (1 - cb), s);
        drawSprite(regionColors[i], m * (base + wArr[i]) * cb, s);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // 纯黑剪影：路径比光脊内缩约 4px，光看起来"长"在三角边缘上
      var q = triPoints(1 - 4 / TRI_H).map(function (pt) {
        return [CX + (pt[0] - CX) * s, CY + (pt[1] - CY) * s];
      });
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      ctx.lineTo(q[1][0], q[1][1]);
      ctx.lineTo(q[2][0], q[2][1]);
      ctx.closePath();
      ctx.fillStyle = '#000';
      ctx.fill();
    }

    // 下滑时 canvas 渐隐，衔接下方索引列表
    function scrollFade() {
      var p = Math.min(1, Math.max(0, scrollY / (H * 0.92)));
      cv.style.opacity = 1 - p;
    }
    addEventListener('scroll', scrollFade, { passive: true });

    // ---------- 主循环 ----------
    var rafId = 0, t0 = performance.now(), lastT = 0;
    var heroVisible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
      }).observe(cv);
    }

    function loop(now) {
      rafId = requestAnimationFrame(loop);
      if (!heroVisible || document.hidden) { lastT = (now - t0) / 1000; return; }
      var t = (now - t0) / 1000;
      var dt = Math.min(0.05, Math.max(0.001, t - lastT));
      lastT = t;
      var breath = breathe(t);

      // 顺时针流转的暗波：φ 增大 ⇒ 峰值沿 d 减小方向移动 ⇒ 顺时针
      wavePhase += dt * TAU / 5;   // 5 秒绕一圈
      for (var i = 0; i < 6; i++) {
        var w = 0.5 + 0.5 * Math.sin(TAU * FRAC[i] + wavePhase);
        wAmb[i] = 0.68 * Math.pow(w, 1.6);
      }

      // 随机低频整体变暗
      if (t > nextDim) {
        dimTarget = 0.65 + Math.random() * 0.2;
        dimUntil = t + 1.2 + Math.random() * 1.8;
        nextDim = Infinity;
      }
      if (t > dimUntil) {
        dimTarget = 1;
        if (nextDim === Infinity) nextDim = t + 5 + Math.random() * 9;
      }
      dimCur += (dimTarget - dimCur) * (1 - Math.exp(-dt * 1.8));

      // 鼠标聚光判定
      var nearTarget = 0;
      wNear.fill(0);
      if (mouse.in) {
        var p = triPoints();
        var dEdge = [
          segDist(mouse.x, mouse.y, p[0], p[1]),
          segDist(mouse.x, mouse.y, p[1], p[2]),
          segDist(mouse.x, mouse.y, p[2], p[0])
        ];
        var e = 0;
        for (var ei = 1; ei < 3; ei++) if (dEdge[ei] < dEdge[e]) e = ei;
        if (dEdge[e] < NEAR_PX) {
          nearTarget = 1;
          var ci = 0, dcMin = Infinity;
          for (var pi = 0; pi < 3; pi++) {
            var dc = Math.hypot(mouse.x - p[pi][0], mouse.y - p[pi][1]);
            if (dc < dcMin) { dcMin = dc; ci = pi; }
          }
          var c = smooth01(1 - dcMin / (0.28 * SIDE));
          wNear[2 * e + 1] = 0.95 * (1 - c);
          wNear[2 * ci] = Math.max(wNear[2 * ci], 0.95 * c);
        }
      }
      nearBlend += (nearTarget - nearBlend) * (1 - Math.exp(-dt * 3.2));
      colorBlend += (colorTarget - colorBlend) * (1 - Math.exp(-dt * 2.5));

      // 目标权重 = 流转/聚光两模式的连续混合，再低通滤波
      var k = 1 - Math.exp(-dt * 5);
      var baseT = 0.42;
      baseCur += (baseT - baseCur) * k;
      for (var wi = 0; wi < 6; wi++) {
        wTarget[wi] = wAmb[wi] + (wNear[wi] - wAmb[wi]) * nearBlend;
        wCur[wi] += (wTarget[wi] - wCur[wi]) * k;
      }

      var breathEff = 0.72 + (breath - 0.72) * (1 - nearBlend);
      render(breathEff, baseCur, wCur, dimCur, nearBlend);
    }

    var pend = 0;
    addEventListener('resize', function () {
      cancelAnimationFrame(pend);
      pend = requestAnimationFrame(build);
    });

    build();
    if (REDUCED) {
      render(0.72, 0.42, wCur, 1);
    } else {
      rafId = requestAnimationFrame(loop);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
