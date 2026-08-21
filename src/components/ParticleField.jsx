import { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uAspect;
  attribute float aSize;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aDrift;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec3 point = position;
    float travel = mod(point.y + uTime * aSpeed + 1.12, 2.24) - 1.12;
    float sway = sin(uTime * (0.12 + aSpeed * 2.0) + aPhase) * aDrift;
    point.y = travel;
    point.x += sway / max(uAspect, 0.7);

    gl_Position = vec4(point, 1.0);
    gl_PointSize = aSize * uPixelRatio * (0.92 + 0.16 * sin(uTime * 0.36 + aPhase));
    vAlpha = aAlpha;
    vColor = aColor;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float halo = 1.0 - smoothstep(0.08, 0.5, distanceToCenter);
    float core = 1.0 - smoothstep(0.0, 0.13, distanceToCenter);
    float alpha = (halo * 0.68 + core * 0.32) * vAlpha;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const palette = [
  new THREE.Color("#ff8c76"),
  new THREE.Color("#ffc88f"),
  new THREE.Color("#fff0d7"),
  new THREE.Color("#e8c9bd"),
];

export function ParticleField({ disabled = false }) {
  const host = useRef(null);

  useEffect(() => {
    const container = host.current;
    if (disabled || !container || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      });
    } catch {
      container.dataset.fallback = "true";
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();
    const count = Math.min(150, Math.max(82, Math.round(window.innerWidth / 9)));
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    const drifts = new Float32Array(count);
    const alphas = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const glow = index < Math.max(12, Math.round(count * 0.14));
      positions.set([
        THREE.MathUtils.randFloatSpread(2.08),
        THREE.MathUtils.randFloatSpread(2.2),
        0,
      ], index * 3);
      palette[Math.floor(Math.random() * palette.length)].toArray(colors, index * 3);
      sizes[index] = glow ? THREE.MathUtils.randFloat(8, 17) : THREE.MathUtils.randFloat(2.1, 5.4);
      speeds[index] = THREE.MathUtils.randFloat(0.012, 0.04);
      phases[index] = Math.random() * Math.PI * 2;
      drifts[index] = glow ? THREE.MathUtils.randFloat(0.025, 0.065) : THREE.MathUtils.randFloat(0.008, 0.034);
      alphas[index] = glow ? THREE.MathUtils.randFloat(0.1, 0.22) : THREE.MathUtils.randFloat(0.24, 0.58);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aDrift", new THREE.BufferAttribute(drifts, 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));

    const uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uAspect: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const particles = new THREE.Points(geometry, material);
    particles.frustumCulled = false;
    scene.add(particles);

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(uniforms.uPixelRatio.value);
    container.appendChild(renderer.domElement);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (!clientWidth || !clientHeight) return;
      renderer.setSize(clientWidth, clientHeight, false);
      uniforms.uAspect.value = clientWidth / clientHeight;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let animation = 0;
    let start = performance.now();
    const tick = (time) => {
      animation = requestAnimationFrame(tick);
      if (document.hidden) {
        start = time - uniforms.uTime.value * 1000;
        return;
      }
      uniforms.uTime.value = (time - start) / 1000;
      renderer.render(scene, camera);
    };
    animation = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [disabled]);

  return <div className="particle-field" ref={host} aria-hidden="true" />;
}
