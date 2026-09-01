import { useEffect, useRef } from "react";

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

const palette = [[1, 0.549, 0.463], [1, 0.784, 0.561], [1, 0.941, 0.843], [0.91, 0.788, 0.741]];

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(error || "Particle shader compilation failed.");
  }
  return shader;
}

function createProgram(gl) {
  const program = gl.createProgram();
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(error || "Particle shader linking failed.");
  }
  return program;
}

function bindAttribute(gl, program, name, values, size, buffers) {
  const buffer = gl.createBuffer();
  buffers.push(buffer);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
  const location = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function ParticleField({ disabled = false }) {
  const host = useRef(null);

  useEffect(() => {
    const container = host.current;
    if (disabled || !container || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    let gl;
    let program;
    try {
      gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
      if (!gl) throw new Error("WebGL is unavailable.");
      program = createProgram(gl);
    } catch {
      container.dataset.fallback = "true";
      return;
    }

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
        randomBetween(-1.04, 1.04),
        randomBetween(-1.1, 1.1),
        0,
      ], index * 3);
      colors.set(palette[Math.floor(Math.random() * palette.length)], index * 3);
      sizes[index] = glow ? randomBetween(8, 17) : randomBetween(2.1, 5.4);
      speeds[index] = randomBetween(0.012, 0.04);
      phases[index] = Math.random() * Math.PI * 2;
      drifts[index] = glow ? randomBetween(0.025, 0.065) : randomBetween(0.008, 0.034);
      alphas[index] = glow ? randomBetween(0.1, 0.22) : randomBetween(0.24, 0.58);
    }

    gl.useProgram(program);
    const buffers = [];
    bindAttribute(gl, program, "position", positions, 3, buffers);
    bindAttribute(gl, program, "aColor", colors, 3, buffers);
    bindAttribute(gl, program, "aSize", sizes, 1, buffers);
    bindAttribute(gl, program, "aSpeed", speeds, 1, buffers);
    bindAttribute(gl, program, "aPhase", phases, 1, buffers);
    bindAttribute(gl, program, "aDrift", drifts, 1, buffers);
    bindAttribute(gl, program, "aAlpha", alphas, 1, buffers);
    const uTime = gl.getUniformLocation(program, "uTime");
    const uPixelRatio = gl.getUniformLocation(program, "uPixelRatio");
    const uAspect = gl.getUniformLocation(program, "uAspect");
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    gl.uniform1f(uPixelRatio, pixelRatio);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    container.appendChild(canvas);

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      if (!clientWidth || !clientHeight) return;
      canvas.width = Math.round(clientWidth * pixelRatio);
      canvas.height = Math.round(clientHeight * pixelRatio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uAspect, clientWidth / clientHeight);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    let animation = 0;
    let start = performance.now();
    let elapsed = 0;
    const tick = (time) => {
      animation = requestAnimationFrame(tick);
      if (document.hidden) {
        start = time - elapsed * 1000;
        return;
      }
      elapsed = (time - start) / 1000;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, elapsed);
      gl.drawArrays(gl.POINTS, 0, count);
    };
    animation = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animation);
      resizeObserver.disconnect();
      buffers.forEach((buffer) => gl.deleteBuffer(buffer));
      gl.deleteProgram(program);
      canvas.remove();
    };
  }, [disabled]);

  return <div className="particle-field" ref={host} aria-hidden="true" />;
}
