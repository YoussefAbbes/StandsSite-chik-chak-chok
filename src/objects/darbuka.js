import { CircleGeometry, Group, LatheGeometry, Mesh, MeshStandardMaterial, Vector2 } from 'three';
import { createGoldMaterial } from './coin.js';

export function createDarbuka(gold = createGoldMaterial()) {
  const drum = new Group();
  const profile = [[0, -1], [0.49, -1], [0.5, -0.91], [0.32, -0.42],
    [0.29, -0.16], [0.34, 0.08], [0.59, 0.4], [0.67, 0.71], [0.68, 0.82],
    [0.61, 0.82]].map(([r, y]) => new Vector2(r, y));
  drum.add(new Mesh(new LatheGeometry(profile, 24), gold));
  const head = new Mesh(new CircleGeometry(0.62, 24),
    new MeshStandardMaterial({ color: 0x7a0c10, roughness: 0.84 }));
  head.rotation.x = -Math.PI / 2;
  head.position.y = 0.82;
  drum.add(head);
  return drum;
}
