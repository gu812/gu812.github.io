/* 分页面三角辉光 banner：复刻 vercel.com 首页三角。
   与原版同一技术路线：WebGL fragment shader 逐像素计算三角形 SDF 距离场，
   分层衰减辉光（near 高幂次贴边亮晕 + far 指数柔光 + 底部光尾），
   曝光/对比调色，hash 抖动颗粒打散色带（对应原版的 radianceJitterPx）。
   随下滑淡出 + 视差，衔接下方文章卡片。无 WebGL 时退回纯黑 banner。 */
(() => {
  const canvas = document.getElementById('prism-canvas')
  if (!canvas) return

  const header = document.getElementById('page-header')
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false })
  if (!gl) { canvas.style.display = 'none'; return }

  const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`

  const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_boost;
uniform vec2 u_v0;
uniform vec2 u_v1;
uniform vec2 u_v2;
uniform float u_R;

// iq 的三角形 SDF：返回像素距离，内部为负
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2) {
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  // 中心原点，y 轴向下
  vec2 p = gl_FragCoord.xy - 0.5 * u_res;
  p.y = -p.y;

  float d = sdTri(p, u_v0, u_v1, u_v2);
  float dn = max(d, 0.0);

  // near falloff：贴边亮晕（高强度、高幂次 -> 紧、亮、衰减快）
  float g = 3.6 * pow(clamp(1.0 - dn / (u_R * 0.6), 0.0, 1.0), 8.0);
  // far falloff：指数衰减的大范围柔光
  g += 0.30 * exp(-dn / (u_R * 0.55));
  // tail：底部边缘向下的光尾
  float tail = exp(-max(p.y - u_v1.y, 0.0) / (u_R * 0.30))
             * exp(-abs(p.x) / (u_R * 0.75));
  g += 0.32 * tail;

  // 内部剪影：1.5px 软边
  g *= smoothstep(-1.5, 1.5, d);

  // 调色：软曝光 rolloff + 轻微对比
  float c = 1.0 - exp(-g * 0.9);
  c = pow(c, 1.1) * u_boost;

  // 抖动颗粒（8fps 跳变）：打散渐变色带，出 LED 颗粒感
  c += (hash(gl_FragCoord.xy + floor(u_time * 8.0)) - 0.5) * (14.0 / 255.0);

  gl_FragColor = vec4(vec3(max(c, 0.0)), 1.0);
}
`

  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    canvas.style.display = 'none'
    return
  }
  gl.useProgram(prog)

  // 全屏三角形
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const locA = gl.getAttribLocation(prog, 'a')
  gl.enableVertexAttribArray(locA)
  gl.vertexAttribPointer(locA, 2, gl.FLOAT, false, 0, 0)

  const U = {}
  for (const n of ['u_res', 'u_time', 'u_boost', 'u_v0', 'u_v1', 'u_v2', 'u_R']) {
    U[n] = gl.getUniformLocation(prog, n)
  }

  let W = 0
  let H = 0
  let visible = true

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = header.getBoundingClientRect()
    W = Math.max(1, Math.round(rect.width))
    H = Math.max(1, Math.round(rect.height))
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    gl.viewport(0, 0, canvas.width, canvas.height)

    const R = Math.min(W * 0.32, H * 0.66)
    gl.uniform2f(U.u_res, canvas.width, canvas.height)
    // 顶点：上 / 左下 / 右下（y 向下，单位：CSS px，中心原点）
    // shader 里用 gl_FragCoord（物理像素），这里乘 dpr
    gl.uniform2f(U.u_v0, 0, -R * 0.62 * dpr)
    gl.uniform2f(U.u_v1, -R * 0.58 * dpr, R * 0.38 * dpr)
    gl.uniform2f(U.u_v2, R * 0.58 * dpr, R * 0.38 * dpr)
    gl.uniform1f(U.u_R, R * dpr)
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const draw = now => {
    const t = now / 1000
    // 呼吸：整体强度缓慢起伏 + 微抖动
    gl.uniform1f(U.u_time, t)
    gl.uniform1f(U.u_boost, 0.9 + 0.08 * Math.sin(t * 0.9) + 0.02 * Math.sin(t * 7.3))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  let rafId = 0
  const loop = now => {
    rafId = 0
    if (!visible) return
    draw(now)
    rafId = requestAnimationFrame(loop)
  }
  const start = () => { if (!rafId && visible) rafId = requestAnimationFrame(loop) }
  const stop = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = 0 } }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      if (visible) start(); else stop()
    }).observe(header)
  }

  // 下滑淡出 + 轻微视差，衔接下方卡片
  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      const h = header.offsetHeight || 1
      const p = Math.min(Math.max(window.scrollY / (h * 0.92), 0), 1)
      canvas.style.opacity = String(1 - p)
      canvas.style.transform = `translateY(${window.scrollY * 0.32}px)`
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })

  resize()
  window.addEventListener('resize', () => { resize(); if (reduced) draw(0); onScroll() })
  if (reduced) {
    draw(0) // 减少动态偏好：只渲一帧静态
  } else {
    start()
  }
})()
