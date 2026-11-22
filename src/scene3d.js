import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createCoin, createGoldMaterial } from './objects/coin.js';
import { createLantern } from './objects/lantern.js';
import { createDarbuka } from './objects/darbuka.js';
import { createFan } from './objects/fan.js';

const background = 0x1a0405;
const clamp = THREE.MathUtils.clamp;

function addOrnaments(scene) {
  const gold = createGoldMaterial();
  const models = [createCoin(gold), createLantern(gold), createFan(gold), createDarbuka(gold)];
  const layout = [0, 1, 2, 0, 0, 3, 1, 0, 0, 2, 3, 0, 0, 1];
  return layout.map((type, i) => {
    const mesh = models[type].clone();
    const phase = Math.random() * Math.PI * 2;
    const depth = 6 + Math.random() * 10;
    mesh.position.z = -depth;
    mesh.rotation.set(0.18 + Math.random() * 0.5, Math.sin(phase), Math.cos(phase) * 0.4);
    scene.add(mesh);
    return {
      mesh, phase, depth, size: 0.07 + Math.random() * 0.05,
      x: (i % 2 ? 1 : -1) * (0.5 + Math.random() * 0.42),
      y: ((Math.floor(i / 2) + (i % 2) * 0.45) / 6 - 0.5) * 2.5,
      baseY: 0,
    };
  });
}

function addDust(scene) {
  const positions = new Float32Array(300 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (Math.random() - 0.5) * 30;
    positions[i + 1] = (Math.random() - 0.5) * 20;
    positions[i + 2] = -4 - Math.random() * 17;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xf2c15b, size: 0.025, opacity: 0.46, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  scene.add(dust);
  return dust;
}

function disposeMeshes(scene) {
  const geometries = new Set();
  const materials = new Set();
  scene.traverse(({ geometry, material }) => {
    if (geometry) geometries.add(geometry);
    if (material) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function createEnvironment(renderer) {
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  try {
    return generator.fromScene(room);
  } finally {
    room.dispose();
    generator.dispose();
  }
}

export function initScene(canvas, { reducedMotion } = {}) {
  if (reducedMotion) return null;
  const cleanup = [];
  function dispose() {
    while (cleanup.length) cleanup.pop()();
  }
  try {
    const settings = { antialias: false, alpha: false };
    const context = canvas.getContext('webgl2', settings) || canvas.getContext('webgl', settings);
    if (!context) return null;
    const renderer = new THREE.WebGLRenderer({ canvas, context, ...settings });
    cleanup.push(() => renderer.dispose());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(background);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    cleanup.push(() => disposeMeshes(scene));
    const environment = createEnvironment(renderer);
    cleanup.push(() => environment.dispose());
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.64;
    scene.fog = new THREE.FogExp2(background, 0.066);
    const red = new THREE.DirectionalLight(0xe0261b, 2.4);
    red.position.set(-4, 3, 2);
    scene.add(red, new THREE.HemisphereLight(0xffe3a3, 0x7a0c10, 1.1));
    const ornaments = addOrnaments(scene);
    const dust = addDust(scene);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 32);

    const composer = new EffectComposer(renderer);
    cleanup.push(() => composer.dispose());
    const addPass = (pass) => {
      cleanup.push(() => pass.dispose());
      composer.addPass(pass);
    };
    addPass(new RenderPass(scene, camera));
    addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.6, 0.6));
    addPass(new OutputPass());

    function resize() {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      for (const item of ornaments) {
        const halfHeight = item.depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const halfWidth = halfHeight * camera.aspect;
        item.baseY = item.y * halfHeight;
        item.mesh.position.x = item.x * halfWidth;
        item.mesh.scale.setScalar(item.size * Math.min(halfHeight, halfWidth * 1.7));
      }
    }
    resize();
    let pitch = 0;
    let yaw = 0;
    let neutralPitch;
    function orient({ beta, gamma }) {
      if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;
      neutralPitch ??= beta;
      pitch = clamp((beta - neutralPitch) * 0.003, -0.15, 0.15);
      yaw = clamp(-gamma * 0.003, -0.15, 0.15);
    }
    let frame = null;
    let previous = null;
    let elapsed = 0;
    function render(now) {
      const dt = Math.min((now - (previous ?? now)) / 1000, 0.06);
      previous = now;
      elapsed += dt;
      const ease = 1 - Math.exp(-3 * dt);
      const scroll = clamp(window.scrollY / Math.max(1, window.innerHeight), 0, 7);
      camera.position.y += (-scroll * 0.23 - camera.position.y) * ease;
      camera.rotation.x += (pitch - camera.rotation.x) * ease;
      camera.rotation.y += (yaw - camera.rotation.y) * ease;
      for (const { mesh, baseY, phase } of ornaments) {
        mesh.position.y = baseY + Math.sin(elapsed * 0.38 + phase) * 0.13;
        mesh.rotation.y += dt * (0.14 + 0.07 * Math.cos(phase));
      }
      dust.rotation.z = Math.sin(elapsed * 0.05) * 0.035;
      composer.render(dt);
      frame = window.requestAnimationFrame(render);
    }
    function stop() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      previous = null;
    }
    function visibility() {
      if (document.hidden) stop();
      else if (frame === null) frame = window.requestAnimationFrame(render);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('deviceorientation', orient);
    document.addEventListener('visibilitychange', visibility);
    cleanup.push(() => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('deviceorientation', orient);
      document.removeEventListener('visibilitychange', visibility);
    });
    visibility();
    return { dispose };
  } catch {
    dispose();
    return null;
  }
}
