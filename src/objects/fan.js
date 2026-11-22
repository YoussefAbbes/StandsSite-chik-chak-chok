import { BoxGeometry, CircleGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three';
import { createGoldMaterial } from './coin.js';

export function createFan(gold = createGoldMaterial()) {
  const fan = new Group();
  const spread = 160 * Math.PI / 180;
  const fabric = new Mesh(new CircleGeometry(1.4, 24, (Math.PI - spread) / 2, spread),
    new MeshStandardMaterial({ color: 0x7a0c10, side: DoubleSide, roughness: 0.8 }));
  fabric.position.y = -0.55;
  fan.add(fabric);
  const rib = new BoxGeometry(0.035, 1.45, 0.035).translate(0, 0.725, 0);
  for (let i = 0; i < 9; i++) {
    const stick = new Mesh(rib, gold);
    stick.position.set(0, -0.55, 0.016);
    stick.rotation.z = spread * (i / 8 - 0.5);
    fan.add(stick);
  }
  return fan;
}
