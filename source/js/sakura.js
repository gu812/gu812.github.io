/**
 * 樱花花瓣飘落特效 🌸（canvas 实现，零依赖）
 * 想调整效果：改下面的配置项即可
 */
(function () {
  'use strict';

  var CONFIG = {
    count: 25,            // 花瓣数量（手机端自动减半）
    minSize: 8,           // 花瓣最小尺寸(px)
    maxSize: 16,          // 花瓣最大尺寸(px)
    minSpeed: 0.6,        // 最小下落速度
    maxSpeed: 1.8,        // 最大下落速度
    colors: ['#ffc0cb', '#ffb7c5', '#ffd1dc', '#ffe4e9'], // 粉色系
    opacity: 0.85
  };

  // 移动端减半花瓣，省电
  var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  var COUNT = isMobile ? Math.ceil(CONFIG.count / 2) : CONFIG.count;

  var canvas = document.createElement('canvas');
  canvas.id = 'sakura-canvas';
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;' +
    'pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var W, H, petals = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function createPetal(fromTop) {
    var size = rand(CONFIG.minSize, CONFIG.maxSize);
    return {
      x: rand(0, W),
      y: fromTop ? rand(-H, -size) : rand(0, H),
      size: size,
      speedY: rand(CONFIG.minSpeed, CONFIG.maxSpeed),
      speedX: rand(-0.5, 0.5),
      angle: rand(0, Math.PI * 2),
      spin: rand(-0.02, 0.02),
      swing: rand(0.5, 1.5),       // 左右摇摆幅度
      swingSpeed: rand(0.01, 0.03),
      swingOffset: rand(0, Math.PI * 2),
      color: CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)]
    };
  }

  for (var i = 0; i < COUNT; i++) {
    petals.push(createPetal(false));
  }

  var t = 0;

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = CONFIG.opacity;
    ctx.fillStyle = p.color;
    // 画一片花瓣：两个贝塞尔曲线拼成的水滴形
    var s = p.size;
    ctx.beginPath();
    ctx.moveTo(0, -s / 2);
    ctx.bezierCurveTo(s / 2, -s / 2, s / 2, s / 3, 0, s / 2);
    ctx.bezierCurveTo(-s / 2, s / 3, -s / 2, -s / 2, 0, -s / 2);
    ctx.fill();
    ctx.restore();
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);
    t++;
    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      p.y += p.speedY;
      p.x += p.speedX + Math.sin(t * p.swingSpeed + p.swingOffset) * p.swing;
      p.angle += p.spin;
      if (p.y > H + p.size || p.x < -p.size * 2 || p.x > W + p.size * 2) {
        petals[i] = createPetal(true);
        petals[i].y = -p.size;
      }
      drawPetal(p);
    }
    requestAnimationFrame(tick);
  }

  // requestAnimationFrame 在标签页隐藏时会自动暂停，无需手动处理
  tick();
})();
