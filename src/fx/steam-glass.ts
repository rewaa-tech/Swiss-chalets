/**
 * v3 §8 — winter "steamed window": WebGL fog + refracting water drops over the hero photo.
 *
 * Layers (one fragment shader):
 *  1. the hero photo, sharp, and a blurred copy (13-tap blur in the shader)
 *  2. fog = blurred photo mixed with warm white + soft noise, denser at the edges,
 *     60% lighter over the text column; a "fog map" holds where the glass was wiped
 *  3. drops: a drop map (RG = refraction normal, B = thickness, A = coverage) drawn on a
 *     small 2D canvas from a pre-computed lens sprite. Each drop shows the photo flipped
 *     and magnified like a real lens, with a dark rim and a specular highlight
 *  4. a warm breathing glow from the chalet windows
 * Big drops grow, slide down along a wobbly path, swallow small ones and leave a clear trail
 * that steams over again in ~8 s. The mouse (or a finger) wipes the glass.
 * No library; WebGL2 with WebGL1 fallback; pauses off-screen; degrades on slow devices.
 */

const VERT = `
attribute vec2 p;
varying vec2 v;
void main() { v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `
precision mediump float;
varying vec2 v;
uniform sampler2D uBg, uDrops, uFog;
uniform vec2 uRes, uImg;
uniform float uTime, uIntro, uOffset, uFocusX, uPosY;
uniform vec2 uGlow;

vec2 cover(vec2 uv) {
  float ra = uRes.x / uRes.y, ri = uImg.x / uImg.y;
  vec2 s = ra > ri ? vec2(1., ri / ra) : vec2(ra / ri, 1.);
  vec2 o = vec2((1. - s.x) * .5, (1. - s.y) * uPosY);
  vec2 q = vec2(uv.x, 1. - uv.y);
  q.y -= uOffset;
  return o + q * s;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
vec3 blur(vec2 uv) {
  vec3 c = texture2D(uBg, uv).rgb * .2;
  float r = .012;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * .5236;
    float rr = r * (i < 6 ? 1. : 2.1);
    c += texture2D(uBg, uv + vec2(cos(a), sin(a)) * rr * vec2(1., uRes.x / uRes.y)).rgb * (i < 6 ? .08 : .053);
  }
  return c;
}
void main() {
  vec2 uv = v;
  vec2 bu = cover(uv);
  vec3 sharp = texture2D(uBg, bu).rgb;
  vec4 d = texture2D(uDrops, vec2(uv.x, 1. - uv.y));
  float fogMap = texture2D(uFog, vec2(uv.x, 1. - uv.y)).r;

  // Fog: denser at the edges, lighter over the text column (RTL text on the right).
  vec2 c = uv - .5;
  float edge = smoothstep(.15, .75, length(c * vec2(1.1, 1.3)));
  float reveal = smoothstep(1. - uIntro * 1.3, 1.15 - uIntro * 1.3, edge + .25);
  float textZone = smoothstep(uFocusX - .12, uFocusX + .08, uv.x) * smoothstep(.12, .3, uv.y) * smoothstep(.95, .75, uv.y);
  float n = noise(uv * vec2(6., 4.) + uTime * .03) * .5 + noise(uv * 23. - uTime * .02) * .25;
  float fog = clamp((.38 + edge * .42 + n * .18) * (1. - textZone * .6), 0., .92) * fogMap * reveal;
  vec3 fogCol = mix(blur(bu), vec3(.95, .93, .9), .38 + n * .1);
  vec3 col = mix(sharp, fogCol, fog);

  // Drops: refract the photo (flipped, magnified), dark rim, specular highlight.
  float a = d.a * clamp(uIntro * 1.6 - .2, 0., 1.);
  if (a > .01) {
    vec2 nrm = (d.rg - .5) * 2.;
    vec2 ru = cover(uv - nrm * .055 * (.6 + d.b));
    vec3 lens = texture2D(uBg, ru).rgb * 1.18 + .05;
    float rim = smoothstep(.0, .35, d.b);
    lens *= mix(.78, 1., rim);
    float spec = pow(max(0., dot(normalize(vec3(nrm, .7)), normalize(vec3(-.45, .55, .7)))), 28.) * .9;
    col = mix(col, lens + spec, a);
  }

  // Warm breathing glow from the chalet windows.
  float g = exp(-pow(length((uv - uGlow) * vec2(1.4, 1.)) * 2.6, 2.)) * (.22 + .06 * sin(uTime * .785));
  col += vec3(1., .58, .25) * g * (.4 + fog);
  gl_FragColor = vec4(col, 1.);
}`;

interface Drop { x: number; y: number; r: number; vy: number; slide: boolean; wob: number; life: number }

export interface SteamOptions { image: HTMLImageElement; focusX?: number; posY?: number; glow?: [number, number]; intro?: boolean; onFail?: () => void }

export class SteamGlass {
  private gl!: WebGLRenderingContext;
  private prog!: WebGLProgram;
  private tex: Record<"bg" | "drops" | "fog", WebGLTexture> = {} as never;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private dropCv = document.createElement("canvas");
  private fogCv = document.createElement("canvas");
  private microCv = document.createElement("canvas");
  private sprite = document.createElement("canvas");
  private drops: Drop[] = [];
  private raf = 0;
  private t0 = performance.now();
  private last = 0;
  private running = false;
  private visible = true;
  private scale = 0.7;
  private slow = 0;
  private frames: number[] = [];
  private introStart = 0;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private destroyed = false;
  private wipeAt: { x: number; y: number } | null = null;
  private off: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private opts: SteamOptions) {}

  start(): boolean {
    const gl = (this.canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power" }) ??
      this.canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" })) as WebGLRenderingContext | null;
    if (!gl) return false;
    this.gl = gl;
    try { this.prog = this.program(VERT, FRAG); } catch { return false; }
    gl.useProgram(this.prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["uBg", "uDrops", "uFog", "uRes", "uImg", "uTime", "uIntro", "uOffset", "uFocusX", "uGlow", "uPosY"]) this.u[n] = gl.getUniformLocation(this.prog, n);
    (["bg", "drops", "fog"] as const).forEach((k, i) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex[k] = t;
    });
    gl.uniform1i(this.u.uBg, 0); gl.uniform1i(this.u.uDrops, 1); gl.uniform1i(this.u.uFog, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.bg);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.opts.image); } catch { return false; }
    if (gl.getError() !== gl.NO_ERROR) return false;
    this.makeSprite();
    this.resize();
    this.seed();
    this.introStart = this.opts.intro ? performance.now() : performance.now() - 10_000;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.visible ? this.play() : this.stop(); });
    this.io.observe(this.canvas);
    const vis = () => (document.hidden ? this.stop() : this.visible && this.play());
    document.addEventListener("visibilitychange", vis);
    this.off.push(() => document.removeEventListener("visibilitychange", vis));
    // Wipe the steam with the mouse, or a finger without blocking scrolling.
    const host = this.canvas.parentElement!.parentElement ?? this.canvas;
    const move = (x: number, y: number) => {
      const r = this.canvas.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) { this.wipeAt = null; return; }
      const p = { x: ((x - r.left) / r.width) * this.fogCv.width, y: ((y - r.top) / r.height) * this.fogCv.height };
      this.wipe(this.wipeAt ?? p, p);
      this.wipeAt = p;
    };
    const pm = (e: PointerEvent) => { if (e.pointerType === "mouse") move(e.clientX, e.clientY); };
    const tm = (e: TouchEvent) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); };
    const end = () => { this.wipeAt = null; };
    host.addEventListener("pointermove", pm, { passive: true });
    host.addEventListener("pointerleave", end);
    host.addEventListener("touchmove", tm, { passive: true });
    host.addEventListener("touchend", end);
    this.off.push(() => { host.removeEventListener("pointermove", pm); host.removeEventListener("pointerleave", end); host.removeEventListener("touchmove", tm); host.removeEventListener("touchend", end); });
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.fail(); });
    this.play();
    return true;
  }

  private program(vs: string, fs: string) {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link");
    return p;
  }

  /** A 64px lens: RG = surface normal, B = thickness, A = coverage. */
  private makeSprite() {
    const S = 64, c = this.sprite;
    c.width = c.height = S;
    const ctx = c.getContext("2d")!, img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x + .5) / S * 2 - 1, dy = (y + .5) / S * 2 - 1.08, d = Math.hypot(dx, dy * 0.92);
      const i = (y * S + x) * 4;
      if (d >= 1) { img.data[i + 3] = 0; continue; }
      const h = Math.sqrt(1 - d * d);
      img.data[i] = (0.5 + dx * 0.5) * 255;
      img.data[i + 1] = (0.5 - dy * 0.5) * 255;
      img.data[i + 2] = h * 255;
      img.data[i + 3] = Math.min(1, (1 - d) * 6) * 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.min(1600, Math.round(r.width * dpr * this.scale))), h = Math.max(2, Math.round(r.height * dpr * this.scale * (w / Math.max(1, r.width * dpr * this.scale))));
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w; this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    // Simulation canvases stay small: the shader samples them with linear filtering.
    const sw = Math.min(512, w), sh = Math.round(sw * (h / w));
    const newFog = this.fogCv.width !== sw || this.fogCv.height !== sh;
    for (const c of [this.dropCv, this.microCv]) { c.width = sw; c.height = sh; }
    if (newFog) { this.fogCv.width = sw; this.fogCv.height = sh; const f = this.fogCv.getContext("2d")!; f.fillStyle = "#fff"; f.fillRect(0, 0, sw, sh); }
    this.drawMicro();
  }

  private avoid(x: number, y: number) {
    // Keep big drops off the title and buttons (RTL text column).
    const fx = (this.opts.focusX ?? 0.52) * this.dropCv.width;
    return x > fx && y > this.dropCv.height * 0.45 && y < this.dropCv.height * 0.9;
  }

  private seed() {
    const W = this.dropCv.width, H = this.dropCv.height;
    this.drops = [];
    for (let i = 0; i < 120; i++) this.drops.push({ x: Math.random() * W, y: Math.random() * H, r: 1.4 + Math.random() * 3.2, vy: 0, slide: false, wob: Math.random() * 6, life: 0 });
    for (let i = 0; i < 9; i++) {
      let x = 0, y = 0;
      do { x = Math.random() * W; y = Math.random() * H * 0.7; } while (this.avoid(x, y));
      this.drops.push({ x, y, r: 5 + Math.random() * 4, vy: 0, slide: false, wob: Math.random() * 6, life: 0 });
    }
  }

  /** Thousands of tiny condensation dots, drawn once. */
  private drawMicro() {
    const c = this.microCv.getContext("2d")!, W = this.microCv.width, H = this.microCv.height;
    c.clearRect(0, 0, W, H);
    const n = Math.round((W * H) / 90);
    for (let i = 0; i < n; i++) {
      const r = 0.35 + Math.random() * Math.random() * 1.4;
      c.globalAlpha = 0.5 + Math.random() * 0.5;
      c.drawImage(this.sprite, Math.random() * W - r, Math.random() * H - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
  }

  private wipe(a: { x: number; y: number }, b: { x: number; y: number }) {
    const f = this.fogCv.getContext("2d")!;
    f.globalCompositeOperation = "source-over";
    f.strokeStyle = "rgba(0,0,0,.85)";
    f.lineCap = "round"; f.lineJoin = "round";
    f.lineWidth = this.fogCv.width * 0.045;
    f.filter = "blur(4px)";
    f.beginPath(); f.moveTo(a.x, a.y); f.lineTo(b.x, b.y); f.stroke();
    f.filter = "none";
    // Wiping also removes the small drops it passes over.
    const R = this.fogCv.width * 0.03;
    this.drops = this.drops.filter((d) => d.r > 6 || Math.hypot(d.x - b.x, d.y - b.y) > R);
  }

  private step(dt: number) {
    const W = this.dropCv.width, H = this.dropCv.height;
    const fog = this.fogCv.getContext("2d")!;
    // Steam slowly grows back over cleared glass (~8 s).
    fog.globalCompositeOperation = "source-over";
    fog.fillStyle = `rgba(255,255,255,${Math.min(0.05, dt * 0.006)})`;
    fog.fillRect(0, 0, W, H);

    const intro = Math.min(1, (performance.now() - this.introStart) / 2500);
    for (const d of this.drops) {
      d.life += dt;
      if (!d.slide) {
        if (d.r > 4.5) d.r += dt * 0.12 * Math.random();           // big drops gather water
        if (d.r > 9.5 && intro >= 1 && !this.avoid(d.x, d.y)) { d.slide = true; d.vy = 0; }
      } else {
        d.vy = Math.min(d.vy + dt * (6 + d.r), 18 + d.r * 2.5);
        const dx = Math.sin(d.life * 2.2 + d.wob) * 0.25;
        const ny = d.y + d.vy * dt;
        // Clear trail behind the drop.
        fog.globalCompositeOperation = "destination-out";
        fog.fillStyle = "rgba(0,0,0,.9)";
        fog.beginPath(); fog.ellipse(d.x, (d.y + ny) / 2, d.r * 0.55, Math.abs(ny - d.y) / 2 + d.r * 0.5, 0, 0, Math.PI * 2); fog.fill();
        fog.globalCompositeOperation = "source-over";
        fog.fillStyle = "#000";
        fog.globalAlpha = 0.85;
        fog.beginPath(); fog.arc(d.x, ny, d.r * 0.7, 0, Math.PI * 2); fog.fill();
        fog.globalAlpha = 1;
        d.x += dx; d.y = ny; d.r = Math.max(4, d.r - dt * 0.35);
      }
    }
    // Sliding drops swallow the small ones they touch.
    for (const s of this.drops) if (s.slide) for (const o of this.drops) if (o !== s && !o.slide && o.r < s.r && Math.hypot(o.x - s.x, o.y - s.y) < s.r + o.r * 0.6) { s.r = Math.min(13, Math.sqrt(s.r * s.r + o.r * o.r * 0.5)); o.r = 0; }
    this.drops = this.drops.filter((d) => d.r > 0 && d.y - d.r < H);
    // Keep the glass populated.
    while (this.drops.filter((d) => d.r > 4.5).length < 9) {
      let x = 0, y = 0;
      do { x = Math.random() * W; y = Math.random() * H * 0.6; } while (this.avoid(x, y));
      this.drops.push({ x, y, r: 4.6 + Math.random() * 2, vy: 0, slide: false, wob: Math.random() * 6, life: 0 });
    }
    while (this.drops.length < 125) this.drops.push({ x: Math.random() * W, y: Math.random() * H, r: 1.4 + Math.random() * 3, vy: 0, slide: false, wob: 0, life: 0 });

    const c = this.dropCv.getContext("2d")!;
    c.clearRect(0, 0, W, H);
    c.globalAlpha = intro;
    c.drawImage(this.microCv, 0, 0);
    c.globalAlpha = 1;
    for (const d of this.drops) {
      const sx = d.slide ? d.r * 1.7 : d.r * 2, sy = d.slide ? d.r * 2.3 : d.r * 2.1;
      c.drawImage(this.sprite, d.x - sx / 2, d.y - sy / 2, sx, sy);
    }
  }

  private frame = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.monitor(dt);
    this.step(dt);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tex.drops);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.dropCv);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tex.fog);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.fogCv);
    const r = this.canvas.getBoundingClientRect();
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.uImg, this.opts.image.naturalWidth, this.opts.image.naturalHeight);
    gl.uniform1f(this.u.uTime, (now - this.t0) / 1000);
    gl.uniform1f(this.u.uIntro, Math.min(1, (now - this.introStart) / 2500));
    gl.uniform1f(this.u.uOffset, Math.max(0, -r.top * 0.15) / Math.max(1, r.height) * 0.6);
    gl.uniform1f(this.u.uFocusX, this.opts.focusX ?? 0.52);
    gl.uniform1f(this.u.uPosY, this.opts.posY ?? 0.4);
    gl.uniform2f(this.u.uGlow, ...(this.opts.glow ?? [0.4, 0.45]));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  /** Below 40 fps for 2 s: lower the resolution, then fewer drops, then give up (static fallback). */
  private monitor(dt: number) {
    if (dt <= 0) return;
    this.frames.push(dt);
    if (this.frames.length < 60) return;
    const fps = this.frames.length / this.frames.reduce((a, b) => a + b, 0);
    this.frames = [];
    if (fps >= 40) { this.slow = 0; return; }
    this.slow++;
    if (this.slow < 2) return;
    this.slow = 0;
    if (this.scale > 0.45) { this.scale = 0.45; this.resize(); }
    else if (this.drops.length > 60) this.drops = this.drops.filter((_, i) => i % 2 === 0);
    else this.fail();
  }

  private fail() { this.destroy(); this.opts.onFail?.(); }
  play() { if (this.running || this.destroyed || document.hidden) return; this.running = true; this.last = 0; this.raf = requestAnimationFrame(this.frame); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stop(); this.io?.disconnect(); this.ro?.disconnect(); this.off.forEach((f) => f());
    (this.gl?.getExtension("WEBGL_lose_context"))?.loseContext();
  }
}
