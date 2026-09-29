/* 分页面开屏：粒子从屏幕四周向中心聚合成分页主题文字，
   停留后沿对角线分裂 —— 对角线一侧的粒子飞向左下，另一侧飞向右上。
   只在存在 #page-intro 的分页面运行；点击/滚动/按键可跳过。 */
(() => {
  const overlay = document.getElementById('page-intro')
  if (!overlay) return

  const header = document.getElementById('page-header')
  const canvas = document.getElementById('page-intro-canvas')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const finish = () => {
    if (!overlay.parentNode) return
    overlay.classList.add('intro-done')
    document.documentElement.classList.remove('intro-lock')
    if (header) header.classList.remove('intro-running')
    setTimeout(() => overlay.remove(), 420)
    window.removeEventListener('keydown', onSkip)
    window.removeEventListener('wheel', onSkip)
    overlay.removeEventListener('pointerdown', onSkip)
  }
  const onSkip = () => finish()

  if (reduced) { finish(); return }

  const titleEl = header && header.querySelector('#page-site-info #site-title')
  const text = (titleEl && titleEl.textContent || '').trim() || document.title
  if (header) header.classList.add('intro-running')
  document.documentElement.classList.add('intro-lock')

  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = window.innerWidth
  const H = window.innerHeight
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // 离屏采样文字像素，得到粒子目标点
  const sample = () => {
    const off = document.createElement('canvas')
    const o = off.getContext('2d', { willReadFrequently: true })
    off.width = W
    off.height = H
    let size = Math.min(W * 0.16, 150)
    const font = s => `700 ${s}px "Noto Serif SC", "Songti SC", "SimSun", serif`
    o.font = font(size)
    const tw = o.measureText(text).width
    if (tw > W * 0.72) size = size * (W * 0.72) / tw
    o.font = font(size)
    o.textAlign = 'center'
    o.textBaseline = 'middle'
    o.fillStyle = '#fff'
    o.fillText(text, W / 2, H / 2)
    const data = o.getImageData(0, 0, W, H).data
    const pts = []
    // 根据文字宽度自适应采样间隔，控制粒子总量
    const gap = Math.max(3, Math.round(Math.sqrt((W * H) / 260000)))
    for (let y = 0; y < H; y += gap) {
      for (let x = 0; x < W; x += gap) {
        if (data[(y * W + x) * 4 + 3] > 128) pts.push({ x, y })
      }
    }
    return pts
  }

  const run = () => {
    const targets = sample()
    if (!targets.length) { finish(); return }

    const cx = W / 2
    const cy = H / 2
    const diagK = H / W // 屏幕对角线（左上->右下）的斜率
    const particles = targets.map(p => {
      // 起点：从中心沿随机方向射到屏幕边缘外一点，保证粒子真的从四周边界进来
      const ang = Math.random() * Math.PI * 2
      const dx = Math.cos(ang)
      const dy = Math.sin(ang)
      const rEdge = Math.min(
        dx ? (W / 2) / Math.abs(dx) : Infinity,
        dy ? (H / 2) / Math.abs(dy) : Infinity
      )
      const r = rEdge + 30 + Math.random() * 140
      const side = (p.y - cy) - diagK * (p.x - cx) > 0 ? 1 : -1
      return {
        sx: cx + dx * r,
        sy: cy + dy * r,
        tx: p.x,
        ty: p.y,
        arc: (Math.random() - 0.5) * 110, // 聚合途中的弧线偏移
        delay: Math.random() * 0.3,
        size: 1 + Math.random() * 1.4,
        gold: Math.random() < 0.12,
        side, // 1 = 对角线下方 -> 飞左下；-1 -> 飞右上
        spd: 0.75 + Math.random() * 0.5
      }
    })

    const GATHER = 1350
    const HOLD = 480
    const SPLIT = 850
    const total = GATHER + HOLD + SPLIT
    // 中段接近匀速、两端平滑：飞行过程在屏幕上停留得足够久，聚合才看得出来
    const easeGather = k => k * k * (3 - 2 * k)
    const easeInQuad = k => k * k

    let startTs = 0
    let done = false

    const frame = now => {
      if (done) return
      if (!startTs) startTs = now
      const t = now - startTs
      ctx.clearRect(0, 0, W, H)

      for (const p of particles) {
        let x, y, alpha = 1
        if (t < GATHER) {
          // 聚合：沿弧线从四周飞向目标，带运动拖尾
          const k = easeGather(Math.min(Math.max((t / GATHER - p.delay) / (1 - p.delay), 0), 1))
          const nx = -(p.ty - p.sy)
          const ny = (p.tx - p.sx)
          const nl = Math.hypot(nx, ny) || 1
          const bow = Math.sin(k * Math.PI) * p.arc
          x = p.sx + (p.tx - p.sx) * k + (nx / nl) * bow
          y = p.sy + (p.ty - p.sy) * k + (ny / nl) * bow
          // 拖尾：沿剩余飞行方向回拉，离目标越近越短
          const rx = p.tx - x
          const ry = p.ty - y
          const rl = Math.hypot(rx, ry) || 1
          const tail = Math.min(rl * 0.35, 26) * (1 - k * 0.55)
          if (tail > 1.5) {
            ctx.globalAlpha = alpha * 0.45
            ctx.strokeStyle = p.gold ? '#d8ba78' : '#f2ede3'
            ctx.lineWidth = p.size * 0.8
            ctx.beginPath()
            ctx.moveTo(x - (rx / rl) * tail, y - (ry / rl) * tail)
            ctx.lineTo(x, y)
            ctx.stroke()
          }
        } else if (t < GATHER + HOLD) {
          // 停留：轻微呼吸浮动
          const ht = (t - GATHER) / 1000
          x = p.tx + Math.sin(ht * 5 + p.tx * 0.05) * 0.6
          y = p.ty + Math.cos(ht * 4.4 + p.ty * 0.05) * 0.6
        } else {
          // 分裂：沿对角线两侧分别飞向左下 / 右上
          const k = easeInQuad(Math.min((t - GATHER - HOLD) / SPLIT, 1))
          const dx = 0.7071 * p.side * -1 // side=1 -> x 负（左）
          const dy = 0.7071 * p.side      // side=1 -> y 正（下）
          const dist = Math.max(W, H) * p.spd * k
          x = p.tx + dx * dist
          y = p.ty + dy * dist
          alpha = 1 - k
        }
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.gold ? '#d8ba78' : '#f2ede3'
        ctx.fillRect(x, y, p.size, p.size)
      }
      ctx.globalAlpha = 1

      if (t >= total) { done = true; finish(); return }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  // 等自托管宋体就绪再采样，避免粒子拼出 fallback 字形的字
  let launched = false
  const launch = () => { if (!launched) { launched = true; run() } }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(launch)
    setTimeout(launch, 900) // 字体加载失败也不阻塞
  } else {
    launch()
  }

  window.addEventListener('keydown', onSkip)
  window.addEventListener('wheel', onSkip, { passive: true })
  overlay.addEventListener('pointerdown', onSkip)
  setTimeout(finish, 6000) // 兜底
})()
