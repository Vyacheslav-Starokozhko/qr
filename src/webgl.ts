/**
 * WebGL QR renderer.
 *
 * Rasterises the full QR (every SVG effect baked in) once → GPU texture, then
 * drives animations via WebGL2 uniforms at up to 60 fps.  Static QRs draw a
 * single frame and stop; animated QRs run a RAF loop with zero SVG overhead.
 *
 * Supports all 8 animation types and up to 4 stacked animations per QR.
 * Browser-only — requires WebGL2.
 */

import type {
  Options,
  QrAnimation,
  QrAnimationPulse,
  QrAnimationShimmer,
  QrAnimationDraw,
  QrAnimationGlow,
  QrAnimationRipple,
  QrAnimationSpotlight,
  QrAnimationFloat,
} from "./types";
import { QRCodeGenerate } from "./index";

// ─── GLSL ─────────────────────────────────────────────────────────────────────

const VERT = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// Two-pass separable Gaussian blur (7-tap, sigma ≈ 1.5).
// uDir = (1,0) for H-pass, (0,1) for V-pass.
// uScale = blur kernel spread in pixels.
const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2      uDir;
uniform vec2      uRes;
uniform float     uScale;
in  vec2 vUv;
out vec4 fragColor;
void main(){
  const float W[7] = float[](0.0625,0.125,0.1875,0.25,0.1875,0.125,0.0625);
  vec2 step = uDir * uScale / uRes;
  vec4 c = vec4(0.0);
  for(int i = 0; i < 7; i++){
    c += texture(uTex, vUv + float(i - 3) * step) * W[i];
  }
  fragColor = c;
}`;

// Main compositing shader.
// Supports up to 4 stacked animation slots (uCount = 0..4).
// uType[i]: 0=none 1=pulse 2=shimmer 3=draw 4=glow 5=color-cycle 6=ripple 7=spotlight 8=float
// uT[i]:    current cycle-time in seconds (wraps at uDur[i])
// uDur[i]:  cycle duration in seconds
// uP0/uP1[i]: packed per-type parameters (see getAnimParams() below)
const MAIN_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uBase;
uniform sampler2D uGlow;
uniform int       uCount;
uniform int       uType[4];
uniform float     uT[4];
uniform float     uDur[4];
uniform vec4      uP0[4];
uniform vec4      uP1[4];
uniform vec4      uBg;
in  vec2 vUv;
out vec4 fragColor;

const float PI2 = 6.2831853;

vec3 hueRot(vec3 c, float a){
  float cs = cos(a), sn = sin(a);
  return clamp(mat3(
    0.213+cs*0.787-sn*0.213, 0.213-cs*0.213+sn*0.143, 0.213-cs*0.213-sn*0.787,
    0.715-cs*0.715-sn*0.715, 0.715+cs*0.285+sn*0.140, 0.715-cs*0.715+sn*0.715,
    0.072-cs*0.072+sn*0.928, 0.072-cs*0.072-sn*0.283, 0.072+cs*0.928+sn*0.072
  ) * c, 0.0, 1.0);
}

void main(){
  vec2 uv  = vUv;
  bool clip = false;

  // ── Pass 1: UV-space transforms (float, draw) ────────────────────────────
  for(int i = 0; i < 4; i++){
    if(i >= uCount) break;
    int at = uType[i];
    float t = uT[i], dur = uDur[i];
    vec4 p0 = uP0[i];

    if(at == 8){ // float
      float ph  = t / dur * PI2;
      int   dir = int(p0.z);
      vec2  off = (dir == 0) ? vec2(0.0, sin(ph) * p0.y)
                             : vec2(sin(ph) * p0.x, 0.0);
      uv += off;
      if(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) clip = true;
    }
    if(at == 3){ // draw — clip unrevealed region
      float prog  = p0.x;
      int   dir   = int(p0.y);
      float coord = (dir == 0) ? uv.x
                  : (dir == 1) ? uv.y
                  : (dir == 2) ? (1.0 - uv.x)
                  :               (1.0 - uv.y);
      if(coord > prog) clip = true;
    }
  }
  if(clip){ fragColor = uBg; return; }

  vec4 col = texture(uBase, uv);

  // ── Pass 2: colour / overlay effects ─────────────────────────────────────
  for(int i = 0; i < 4; i++){
    if(i >= uCount) break;
    int at  = uType[i];
    float t = uT[i], dur = uDur[i];
    vec4 p0 = uP0[i];
    vec4 p1 = uP1[i];

    if(at == 1){ // pulse
      float osc = 0.5 - 0.5 * cos(t / dur * PI2);
      float op  = mix(p0.x, p0.y, osc);
      col.rgb  *= op;
      col.a    *= op;
    }
    if(at == 2){ // shimmer
      float band  = mix(-0.15, 1.15, t / dur);
      float coord = (int(p1.x) == 0) ? uv.x : uv.y;
      float s     = smoothstep(0.12, 0.0, abs(coord - band)) * p0.a;
      col.rgb     = mix(col.rgb, p0.rgb, s);
    }
    if(at == 4){ // glow
      float osc  = 0.5 + 0.5 * sin(t / dur * PI2);
      vec4  blur = texture(uGlow, uv);
      vec4  halo = max(blur - col, vec4(0.0));
      col.rgb    = clamp(col.rgb + halo.rgb * p0.x * osc, 0.0, 1.0);
    }
    if(at == 5){ // color-cycle
      col.rgb = hueRot(col.rgb, t / dur * PI2);
    }
    if(at == 6){ // ripple
      float dist = length(uv - vec2(0.5));
      int   cnt  = int(p1.x);
      for(int j = 0; j < 3; j++){
        if(j >= cnt) break;
        float off  = (cnt > 1) ? float(j) / float(cnt) : 0.0;
        float rT   = fract(t / dur + off);
        float ring = smoothstep(0.015, 0.0, abs(dist - rT * 0.65)) * (1.0 - rT) * p0.a;
        col.rgb    = mix(col.rgb, p0.rgb, ring);
      }
    }
    if(at == 7){ // spotlight
      float ph  = t / dur * PI2;
      vec2  sp  = vec2(0.5 + 0.3 * cos(ph), 0.5 + 0.3 * sin(ph));
      float spot = smoothstep(p1.x, 0.0, length(uv - sp)) * p0.a;
      col.rgb    = mix(col.rgb, p0.rgb, spot);
    }
  }
  fragColor = col;
}`;

// ─── GL helpers ───────────────────────────────────────────────────────────────

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`QRCodeWebGL — shader compile error:\n${log}`);
  }
  return sh;
}

function createProg(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`QRCodeWebGL — program link error:\n${log}`);
  }
  return prog;
}

function uploadTex(
  gl: WebGL2RenderingContext,
  src: HTMLCanvasElement,
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function createFbo(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
): { fbo: WebGLFramebuffer; tex: WebGLTexture } {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex };
}

// ─── Animation helpers ────────────────────────────────────────────────────────

const ANIM_DEFAULTS: Record<string, number> = {
  pulse: 2, shimmer: 2.5, draw: 1.5, glow: 2,
  "color-cycle": 4, ripple: 2, spotlight: 3, float: 3,
};

function animDuration(a: QrAnimation): number {
  return a.duration ?? ANIM_DEFAULTS[a.type] ?? 2;
}

function animDefaultRepeat(type: string): boolean {
  return type !== "draw";
}

const ANIM_TYPE_NUM: Record<string, number> = {
  pulse: 1, shimmer: 2, draw: 3, glow: 4,
  "color-cycle": 5, ripple: 6, spotlight: 7, float: 8,
};

function hexColor(s: string): [number, number, number] {
  const m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return [0, 0, 0];
  const h = m[1].length === 3
    ? m[1].split("").map((c) => c + c).join("")
    : m[1];
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

type Vec4 = [number, number, number, number];

function getAnimParams(
  anim: QrAnimation,
  cycleT: number,
  dur: number,
  matrixSize: number,
): { p0: Vec4; p1: Vec4 } {
  switch (anim.type) {
    case "pulse": {
      const a = anim as QrAnimationPulse;
      return { p0: [a.from ?? 0.4, a.to ?? 1.0, 0, 0], p1: [0, 0, 0, 0] };
    }
    case "shimmer": {
      const a = anim as QrAnimationShimmer;
      const [r, g, b] = hexColor(a.color ?? "#ffffff");
      return {
        p0: [r, g, b, a.opacity ?? 0.35],
        p1: [a.direction === "ttb" ? 1 : 0, 0, 0, 0],
      };
    }
    case "draw": {
      const a = anim as QrAnimationDraw;
      const progress = dur > 0 ? Math.min(1, cycleT / dur) : 1;
      const dirMap: Record<string, number> = { ltr: 0, ttb: 1, rtl: 2, btt: 3 };
      return {
        p0: [progress, dirMap[a.direction ?? "ltr"] ?? 0, 0, 0],
        p1: [0, 0, 0, 0],
      };
    }
    case "glow": {
      const a = anim as QrAnimationGlow;
      return { p0: [a.intensity ?? 3, 0, 0, 0], p1: [0, 0, 0, 0] };
    }
    case "color-cycle": {
      return { p0: [0, 0, 0, 0], p1: [0, 0, 0, 0] };
    }
    case "ripple": {
      const a = anim as QrAnimationRipple;
      const [r, g, b] = hexColor(a.color ?? "#4488ff");
      return {
        p0: [r, g, b, a.opacity ?? 0.55],
        p1: [Math.min(3, Math.max(1, a.count ?? 1)), 0, 0, 0],
      };
    }
    case "spotlight": {
      const a = anim as QrAnimationSpotlight;
      const [r, g, b] = hexColor(a.color ?? "#ffffff");
      return {
        p0: [r, g, b, a.opacity ?? 0.35],
        p1: [(a.radius ?? 40) / 100, 0, 0, 0],
      };
    }
    case "float": {
      const a = anim as QrAnimationFloat;
      // Convert module-unit amplitude to UV fraction
      const fullSize = matrixSize * 1.2; // approximate (10 % margin each side)
      const uvAmp = (a.amplitude ?? 1.2) / fullSize;
      return {
        p0: [uvAmp, uvAmp, a.direction === "horizontal" ? 1 : 0, 0],
        p1: [0, 0, 0, 0],
      };
    }
    default:
      return { p0: [0, 0, 0, 0], p1: [0, 0, 0, 0] };
  }
}

// ─── WebGLRenderer ────────────────────────────────────────────────────────────

class WebGLRenderer {
  private gl: WebGL2RenderingContext;
  private w: number;
  private h: number;
  private mainProg: WebGLProgram;
  private blurProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private quadBuf: WebGLBuffer;
  private baseTex: WebGLTexture | null = null;
  private glowTex: WebGLTexture | null = null;
  private blurFbos: Array<{ fbo: WebGLFramebuffer; tex: WebGLTexture }> = [];
  private rafId = 0;
  private startTime = 0;
  private anims: QrAnimation[] = [];
  private matrixSize = 25;
  private bgColor: Vec4 = [1, 1, 1, 1];
  private isStatic = true;

  // Cached uniform locations for the main program
  private ulocs: Record<string, WebGLUniformLocation | null> = {};

  constructor(
    private canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    w: number,
    h: number,
  ) {
    this.gl = gl;
    this.w = w;
    this.h = h;

    this.mainProg = createProg(gl, VERT, MAIN_FRAG);
    this.blurProg = createProg(gl, VERT, BLUR_FRAG);

    // Full-screen quad shared by both programs
    this.quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  // Pre-fetch and cache all uniform locations for the main shader
  private _cacheUniforms() {
    const gl = this.gl;
    const p = this.mainProg;
    for (const name of [
      "uBase", "uGlow", "uCount", "uBg",
      "uType", "uT", "uDur", "uP0", "uP1",
    ]) {
      this.ulocs[name] = gl.getUniformLocation(p, name);
    }
  }

  private _loc(name: string) {
    return this.ulocs[name] ?? null;
  }

  load(
    baseCanvas: HTMLCanvasElement,
    anims: QrAnimation[],
    matrixSize: number,
    bgColor: Vec4,
  ) {
    const gl = this.gl;

    // Release old GPU resources
    if (this.baseTex) { gl.deleteTexture(this.baseTex); this.baseTex = null; }
    if (this.glowTex) { this.glowTex = null; }
    for (const { fbo, tex } of this.blurFbos) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);
    }
    this.blurFbos = [];

    this.baseTex = uploadTex(gl, baseCanvas);
    this.anims = anims.slice(0, 4);
    this.matrixSize = matrixSize;
    this.bgColor = bgColor;
    this.isStatic = this.anims.length === 0;

    this._cacheUniforms();

    // Pre-compute blur texture for glow animation
    const glowAnim = anims.find((a) => a.type === "glow") as QrAnimationGlow | undefined;
    if (glowAnim) {
      const fboH = createFbo(gl, this.w, this.h);
      const fboV = createFbo(gl, this.w, this.h);
      this.blurFbos = [fboH, fboV];
      const modulePixels = this.w / this.matrixSize;
      const blurScale = (glowAnim.intensity ?? 3) * modulePixels * 0.5;
      this._blurPass(this.baseTex!, fboH, 1, 0, blurScale);
      this._blurPass(fboH.tex, fboV, 0, 1, blurScale);
      this.glowTex = fboV.tex;
    }
  }

  private _blurPass(
    srcTex: WebGLTexture,
    dst: { fbo: WebGLFramebuffer; tex: WebGLTexture },
    dx: number,
    dy: number,
    scale: number,
  ) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.blurProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    const loc = (n: string) => gl.getUniformLocation(this.blurProg, n);
    gl.uniform1i(loc("uTex"), 0);
    gl.uniform2f(loc("uDir"), dx, dy);
    gl.uniform2f(loc("uRes"), this.w, this.h);
    gl.uniform1f(loc("uScale"), scale);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  start() {
    this.startTime = performance.now();
    if (this.isStatic) {
      // One-shot render, no loop needed
      this._render(0);
    } else {
      this._tick();
    }
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  destroy() {
    this.stop();
    const gl = this.gl;
    if (this.baseTex) gl.deleteTexture(this.baseTex);
    for (const { fbo, tex } of this.blurFbos) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(tex);
    }
    gl.deleteProgram(this.mainProg);
    gl.deleteProgram(this.blurProg);
    gl.deleteVertexArray(this.vao);
    gl.deleteBuffer(this.quadBuf);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private _tick = () => {
    this.rafId = requestAnimationFrame(this._tick);
    const elapsed = (performance.now() - this.startTime) / 1000;
    this._render(elapsed);
  };

  private _render(elapsed: number) {
    const gl = this.gl;
    if (!this.baseTex) return;

    // Build per-slot animation uniforms
    const count = this.anims.length;
    const types = new Int32Array(4);
    const times = new Float32Array(4);
    const durs  = new Float32Array(4).fill(1);
    const p0Flat = new Float32Array(16); // 4 slots × vec4
    const p1Flat = new Float32Array(16);

    let anyRunning = false;

    for (let i = 0; i < count; i++) {
      const anim  = this.anims[i];
      const delay = anim.delay ?? 0;
      const dur   = animDuration(anim);
      const t     = elapsed - delay;

      durs[i] = dur;

      if (t < 0) {
        // Still in pre-animation delay — keep type 0 (none)
        anyRunning = true;
        continue;
      }

      const repeatVal = anim.repeat ?? animDefaultRepeat(anim.type);
      const maxCycles =
        repeatVal === true   ? Infinity
        : repeatVal === false ? 1
        : (repeatVal as number);

      const cycleCount = t / dur;
      let cycleT: number;

      if (cycleCount >= maxCycles) {
        // Frozen at end of last cycle
        cycleT = dur; // e.g. draw stays fully revealed
      } else {
        cycleT = t % dur;
        anyRunning = true;
      }

      types[i] = ANIM_TYPE_NUM[anim.type] ?? 0;
      times[i] = cycleT;

      const { p0, p1 } = getAnimParams(anim, cycleT, dur, this.matrixSize);
      p0Flat.set(p0, i * 4);
      p1Flat.set(p1, i * 4);
    }

    // If all animations have completed and none loop, stop the RAF
    if (count > 0 && !anyRunning) {
      this.stop();
    }

    // ── Draw ──────────────────────────────────────────────────────────────
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,       gl.ONE_MINUS_SRC_ALPHA,
    );

    gl.useProgram(this.mainProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
    gl.uniform1i(this._loc("uBase"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.glowTex ?? this.baseTex);
    gl.uniform1i(this._loc("uGlow"), 1);

    gl.uniform1i(this._loc("uCount"), count);
    gl.uniform1iv(this._loc("uType"), types);
    gl.uniform1fv(this._loc("uT"),    times);
    gl.uniform1fv(this._loc("uDur"),  durs);
    gl.uniform4fv(this._loc("uP0"),   p0Flat);
    gl.uniform4fv(this._loc("uP1"),   p1Flat);
    gl.uniform4fv(this._loc("uBg"),   this.bgColor);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Handle returned by {@link QRCodeWebGL}. */
export interface QRWebGLHandle {
  /** The canvas being rendered to (same reference as passed in). */
  readonly canvas: HTMLCanvasElement;
  /**
   * Re-render with new options.  The QR matrix, effects, and animations are
   * fully replaced.  The WebGL context is reused — no flicker.
   */
  update(options: Options): Promise<void>;
  /**
   * Cancel the animation loop and release all GPU resources.
   * The canvas content is frozen at the last rendered frame.
   */
  destroy(): void;
}

/**
 * Render a QR code onto a `<canvas>` element using WebGL2.
 *
 * All SVG effects (liquid, neon glow, emboss, convex, …) are rasterised once
 * into a GPU texture.  Animations (pulse, shimmer, draw, glow, color-cycle,
 * ripple, spotlight, float) are driven by GLSL uniforms at up to 60 fps —
 * no SVG SMIL or CSS animations remain in the DOM.
 *
 * Supports up to 4 stacked animations per QR.
 *
 * @example
 * ```ts
 * const canvas = document.getElementById("qr") as HTMLCanvasElement;
 * const handle = await QRCodeWebGL(canvas, {
 *   data: "https://example.com",
 *   animation: [{ type: "pulse" }],
 * });
 * // later:
 * handle.destroy();
 * ```
 *
 * @throws If WebGL2 is unavailable or if the environment is not a browser.
 */
export async function QRCodeWebGL(
  canvas: HTMLCanvasElement,
  options: Options,
): Promise<QRWebGLHandle> {
  const gl = canvas.getContext("webgl2") as WebGL2RenderingContext | null;
  if (!gl) {
    throw new Error(
      "QRCodeWebGL requires WebGL2, which is not available in this browser or environment.",
    );
  }

  const w = options.width  ?? 1000;
  const h = options.height ?? 1000;
  canvas.width  = w;
  canvas.height = h;

  // Compile shaders once; reuse across update() calls
  const renderer = new WebGLRenderer(canvas, gl, w, h);

  async function applyOptions(opts: Options) {
    const rW = opts.width  ?? 1000;
    const rH = opts.height ?? 1000;
    canvas.width  = rW;
    canvas.height = rH;
    renderer.resize(rW, rH);

    // Rasterise the QR without animations (effects are baked in)
    const staticOpts: Options = { ...opts, animation: undefined };
    const result = await QRCodeGenerate(staticOpts);
    if (!result.canvas) {
      throw new Error("QRCodeWebGL requires a browser environment (canvas is null).");
    }

    const anims    = opts.animation ?? [];
    const bgEnable = opts.backgroundEnable !== false;
    const bgHex    = opts.backgroundOptions?.color;
    const bgColor: Vec4 = bgEnable
      ? bgHex ? [...hexColor(bgHex), 1] as Vec4 : [1, 1, 1, 1]
      : [0, 0, 0, 0];

    renderer.load(result.canvas, anims, result.matrixSize, bgColor);
    renderer.start();
  }

  await applyOptions(options);

  return {
    canvas,
    async update(newOptions: Options) {
      renderer.stop();
      await applyOptions(newOptions);
    },
    destroy() {
      renderer.destroy();
    },
  };
}
