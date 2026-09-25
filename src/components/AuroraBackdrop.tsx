import { useEffect, useRef } from "react";

type Phase = "menu" | "tutorial" | "countdown" | "playing" | "result" | "gameover" | "leaderboard" | "settings";

const vertex = "attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}";
const fragment = `precision mediump float;
uniform vec2 r; uniform float t; uniform vec3 c;
float n(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float f(vec2 p){vec2 i=floor(p),q=fract(p);q=q*q*(3.-2.*q);return mix(mix(n(i),n(i+vec2(1.,0.)),q.x),mix(n(i+vec2(0.,1.)),n(i+1.),q.x),q.y);}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=(gl_FragCoord.xy*2.-r)/min(r.x,r.y);float w=sin(p.x*1.7+t*.12)*.15+sin(p.y*2.4-t*.15)*.11;float a=smoothstep(.34,1.1,f(p*1.45+vec2(t*.08,-t*.06))+w);float h=.2/(length(p-vec2(-.58,.34))+.34)+.16/(length(p-vec2(.62,-.26))+.36);vec3 col=vec3(.012,.018,.06)+c*a*.48+c*h*.38;col*=.55+smoothstep(1.5,.18,length(p))*.45;gl_FragColor=vec4(col,1.);}`;

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const value = gl.createShader(type);
  if (!value) return null;
  gl.shaderSource(value, source); gl.compileShader(value);
  return gl.getShaderParameter(value, gl.COMPILE_STATUS) ? value : null;
}

function tint(phase: Phase): [number, number, number] {
  if (phase === "gameover") return [0.95, 0.14, 0.3];
  if (phase === "playing") return [0.12, 0.93, 0.77];
  if (phase === "result") return [0.97, 0.73, 0.23];
  if (phase === "settings") return [0.35, 0.55, 1];
  return [0.72, 0.3, 0.96];
}

export default function AuroraBackdrop({ phase, reducedMotion }: { phase: Phase; reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const reducedRef = useRef(reducedMotion);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { reducedRef.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false, powerPreference: "low-power" });
    if (!canvas || !gl) return;
    const vs = shader(gl, gl.VERTEX_SHADER, vertex), fs = shader(gl, gl.FRAGMENT_SHADER, fragment), program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p"), resolution = gl.getUniformLocation(program, "r"), time = gl.getUniformLocation(program, "t"), color = gl.getUniformLocation(program, "c");
    gl.useProgram(program); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    let frame = 0; const origin = performance.now();
    const draw = (now: number) => {
      frame = 0;
      const dpr = Math.min(devicePixelRatio || 1, 1.5), width = Math.max(1, innerWidth * dpr), height = Math.max(1, innerHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
      const active = tint(phaseRef.current); gl.uniform2f(resolution, width, height); gl.uniform1f(time, reducedRef.current ? 8 : (now - origin) / 1000); gl.uniform3f(color, ...active); gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reducedRef.current && document.visibilityState === "visible") frame = requestAnimationFrame(draw);
    };
    const resume = () => { if (document.visibilityState === "visible" && !frame && !reducedRef.current) frame = requestAnimationFrame(draw); };
    const onResize = () => draw(performance.now());
    addEventListener("resize", onResize); document.addEventListener("visibilitychange", resume); draw(performance.now());
    return () => { cancelAnimationFrame(frame); removeEventListener("resize", onResize); document.removeEventListener("visibilitychange", resume); gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); };
  }, [phase, reducedMotion]);
  return <canvas ref={canvasRef} className="webgl-aurora" aria-hidden="true" />;
}
