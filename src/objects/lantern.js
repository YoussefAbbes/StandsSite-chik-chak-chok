import { CylinderGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial,
  SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { createGoldMaterial } from './coin.js';

export function createLantern(gold = createGoldMaterial()) {
  const lantern = new Group();
  function shell(points) {
    const profile = points.map(([r, y]) => new Vector2(r, y));
    lantern.add(new Mesh(new LatheGeometry(profile, 12), gold));
  }
  shell([[0, -0.87], [0.24, -0.87], [0.31, -0.72], [0.48, -0.62], [0.49, -0.55], [0, -0.55]]);
  shell([[0, 0.48], [0.5, 0.48], [0.52, 0.55], [0.46, 0.63],
    [0.38, 0.78], [0.16, 0.91], [0.07, 1.05], [0, 1.05]]);
  const bar = new CylinderGeometry(0.029, 0.029, 1.04, 5);
  for (let i = 0; i < 6; i++) {
    const upright = new Mesh(bar, gold);
    const angle = i * Math.PI / 3;
    upright.position.set(0.43 * Math.cos(angle), -0.035, 0.43 * Math.sin(angle));
    lantern.add(upright);
  }
  const flame = new Mesh(new SphereGeometry(0.22, 12, 8), new MeshStandardMaterial({
    color: 0xffe3a3, emissive: 0xff9a32, emissiveIntensity: 2,
  }));
  flame.scale.y = 1.4;
  lantern.add(flame);
  const hook = new Mesh(new TorusGeometry(0.13, 0.025, 6, 16), gold);
  hook.position.y = 1.17;
  lantern.add(hook);
  return lantern;
}
