// MUD VALLEY RP: the graphics levels (Settings → Graphics) and the ULTRA look.
// Ultra draws the world into a bright "HDR" picture first, then adds: glow around bright things (the sun, headlights,
// neon), sun rays through the trees, film-style colors, and a soft dark edge around the screen.
import * as THREE from "/create/vendor/three.module.js";

// what each level changes
export const GFX = [
  { name: "Low", note: "Fastest. No shadows, short grass circle.", dpr: 0.75, shadow: 0, box: 0, grassR: 18, blades: 3 },
  { name: "Medium", note: "Shadows on, a little sharper.", dpr: 1, shadow: 1024, box: 55, grassR: 26, blades: 3 },
  { name: "Good", note: "Soft shadows, grass all around you.", dpr: 1.5, shadow: 2048, box: 70, grassR: 34, blades: 3 },
  { name: "Ultra", note: "Glow, sun rays, film colors, extra sharp shadows, thick grass. Needs a strong computer!", dpr: 2, shadow: 4096, box: 100, grassR: 52, blades: 5 },
];

// (a broken "not a number" pixel would get smeared into a black box by the glow, so those become plain black dots first)
const SAFE = "vec3 safe(vec3 c){ return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : clamp(c, 0.0, 64.0); }";
const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const rt = (w, h, samples = 0) => new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE.HalfFloatType, depthBuffer: samples > 0, samples, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

export class Ultra {
  constructor(renderer) {
    this.r = renderer;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false;
    this.qs = new THREE.Scene(); this.qs.add(this.quad);
    const M = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    // 1) only the bright bits (a soft cut-off, so it doesn't pop)
    this.mBright = M(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv; ${SAFE}
      void main(){ vec3 c = 0.25 * (safe(texture2D(t, vUv + px * vec2(-0.5,-0.5)).rgb) + safe(texture2D(t, vUv + px * vec2(0.5,-0.5)).rgb) + safe(texture2D(t, vUv + px * vec2(-0.5,0.5)).rgb) + safe(texture2D(t, vUv + px * vec2(0.5,0.5)).rgb));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float k = smoothstep(0.85, 1.7, l); gl_FragColor = vec4(c * k, 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() } });
    // 2) blur (one direction at a time)
    this.mBlur = M(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(t, vUv).rgb * 0.2270270;
      c += texture2D(t, vUv + dir * 1.3846153).rgb * 0.3162162; c += texture2D(t, vUv - dir * 1.3846153).rgb * 0.3162162;
      c += texture2D(t, vUv + dir * 3.2307692).rgb * 0.0702703; c += texture2D(t, vUv - dir * 3.2307692).rgb * 0.0702703;
      gl_FragColor = vec4(c, 1.0); }`, { t: { value: null }, dir: { value: new THREE.Vector2() } });
    this.mCopy = M(`uniform sampler2D t; uniform vec2 px; varying vec2 vUv;
      void main(){ gl_FragColor = vec4(0.25 * (texture2D(t, vUv + px * vec2(-1.0,-1.0)).rgb + texture2D(t, vUv + px * vec2(1.0,-1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0,1.0)).rgb + texture2D(t, vUv + px * vec2(1.0,1.0)).rgb), 1.0); }`, { t: { value: null }, px: { value: new THREE.Vector2() } });
    // 3) sun rays: streak the super-bright sun toward the edges of the screen (trees in front of it block it = rays)
    this.mRays = M(`uniform sampler2D t; uniform vec2 sun; uniform float aspect; varying vec2 vUv;
      void main(){ vec2 uv = vUv, d = (vUv - sun) * (0.9 / 48.0); float w = 1.0; vec3 acc = vec3(0.0);
        for (int i = 0; i < 48; i++) { uv -= d; vec3 c = texture2D(t, clamp(uv, 0.0, 1.0)).rgb; acc += max(c - 1.6, 0.0) * w; w *= 0.955; }
        vec2 o = (vUv - sun) * vec2(aspect, 1.0); float near = exp(-dot(o, o) * 1.6);
        gl_FragColor = vec4(acc * 0.03 * near, 1.0); }`, { t: { value: null }, sun: { value: new THREE.Vector2(0.5, 0.5) }, aspect: { value: 1 } });
    // 4) put it all together: glow + rays, film colors (ACES), a little extra color + contrast, dark edges
    this.mFinal = M(`uniform sampler2D t, b0, b1, b2, b3, b4, rays; uniform float glow, rayK, expo, night; varying vec2 vUv; ${SAFE}
      vec3 aces(vec3 c){ c *= expo / 0.6;
        const mat3 A = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
        const mat3 B = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
        c = A * c; vec3 a = c * (c + 0.0245786) - 0.000090537; vec3 b = c * (0.983729 * c + 0.4329510) + 0.238081; c = B * (a / b); return clamp(c, 0.0, 1.0); }
      vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
      void main(){
        vec3 c = safe(texture2D(t, vUv).rgb);
        vec3 bl = texture2D(b0, vUv).rgb * 0.9 + texture2D(b1, vUv).rgb * 0.75 + texture2D(b2, vUv).rgb * 0.55 + texture2D(b3, vUv).rgb * 0.4 + texture2D(b4, vUv).rgb * 0.3;
        c += bl * glow + texture2D(rays, vUv).rgb * rayK * vec3(1.0, 0.92, 0.78);
        c = aces(c);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, 1.32 - night * 0.35); // richer colors
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.3); // a touch of contrast
        c *= mix(vec3(1.0), vec3(1.03, 1.0, 0.95), smoothstep(0.4, 1.0, l)) * mix(vec3(1.0), vec3(0.94, 0.98, 1.06), 1.0 - smoothstep(0.0, 0.35, l)); // warm lights, cool shadows
        vec2 v = vUv - 0.5; c *= 1.0 - dot(v, v) * 0.55; // dark edges
        gl_FragColor = vec4(srgb(clamp(c, 0.0, 1.0)), 1.0);
      }`, { t: { value: null }, b0: { value: null }, b1: { value: null }, b2: { value: null }, b3: { value: null }, b4: { value: null }, rays: { value: null }, glow: { value: 0.32 }, rayK: { value: 1 }, expo: { value: 1.0 }, night: { value: 0 } });
    this.levels = []; this.w = 0; this.h = 0;
    this.sunW = new THREE.Vector3(); this.size = new THREE.Vector2(); this.tmp = new THREE.Vector3();
  }
  setSize(w, h) {
    if (w === this.w && h === this.h) return; this.w = w; this.h = h; this.dispose();
    this.main = rt(w, h, 4);
    const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);
    this.bright = rt(hw, hh); this.rays = rt(Math.ceil(w / 4), Math.ceil(h / 4));
    this.levels = []; for (let i = 0; i < 5; i++) { const lw = Math.ceil(hw / 2 ** i), lh = Math.ceil(hh / 2 ** i); this.levels.push([rt(lw, lh), rt(lw, lh)]); }
  }
  dispose() { for (const t of [this.main, this.bright, this.rays, ...this.levels.flat()]) if (t) t.dispose(); this.levels = []; }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.r.render(this.qs, this.cam); }
  // sun: the sun's spot in the world (or null when it's down); dark: 0 = day, 1 = night
  render(scene, camera, sun, dark) {
    const r = this.r; r.getDrawingBufferSize(this.size); this.setSize(this.size.x, this.size.y);
    const w = this.w, h = this.h;
    r.setRenderTarget(this.main); r.render(scene, camera);
    // glow
    this.mBright.uniforms.t.value = this.main.texture; this.mBright.uniforms.px.value.set(1 / w, 1 / h); this.pass(this.mBright, this.bright);
    let src = this.bright;
    this.levels.forEach(([a, b], i) => {
      if (i > 0) { this.mCopy.uniforms.t.value = src.texture; this.mCopy.uniforms.px.value.set(0.5 / src.width, 0.5 / src.height); this.pass(this.mCopy, a); }
      else { this.mCopy.uniforms.t.value = src.texture; this.mCopy.uniforms.px.value.set(0.25 / src.width, 0.25 / src.height); this.pass(this.mCopy, a); }
      this.mBlur.uniforms.t.value = a.texture; this.mBlur.uniforms.dir.value.set(1 / a.width, 0); this.pass(this.mBlur, b);
      this.mBlur.uniforms.t.value = b.texture; this.mBlur.uniforms.dir.value.set(0, 1 / a.height); this.pass(this.mBlur, a);
      src = a;
    });
    // sun rays (only when the sun is up and somewhere near the screen)
    let rayK = 0;
    if (sun) {
      const facing = this.sunW.copy(sun).sub(camera.position).normalize().dot(camera.getWorldDirection(this.tmp));
      this.tmp.copy(sun).project(camera);
      if (facing > 0.1) {
        rayK = Math.min(1, (facing - 0.1) * 3) * (1 - dark);
        this.mRays.uniforms.t.value = this.bright.texture; this.mRays.uniforms.sun.value.set(this.tmp.x * 0.5 + 0.5, this.tmp.y * 0.5 + 0.5); this.mRays.uniforms.aspect.value = w / h;
        this.pass(this.mRays, this.rays);
      }
    }
    const F = this.mFinal.uniforms;
    F.t.value = this.main.texture; this.levels.forEach(([a], i) => { F["b" + i].value = a.texture; });
    F.rays.value = this.rays.texture; F.rayK.value = rayK; F.night.value = dark; F.glow.value = 0.32 - dark * 0.22; F.expo.value = 0.78 + dark * 0.12;
    this.pass(this.mFinal, null);
  }
}
