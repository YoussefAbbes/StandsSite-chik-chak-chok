import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three';

export function createGoldMaterial() {
  return new MeshStandardMaterial({ color: 0xf2c15b, metalness: 1, roughness: 0.3 });
}

export function createCoin(gold = createGoldMaterial()) {
  const coin = new Group();
  const disc = new Mesh(new CylinderGeometry(1, 1, 0.08, 32), gold);
  disc.rotation.x = Math.PI / 2;
  coin.add(disc);
  const rim = new TorusGeometry(0.83, 0.034, 5, 32);
  for (const z of [-0.04, 0.04]) {
    const ring = new Mesh(rim, gold);
    ring.position.z = z;
    coin.add(ring);
  }
  return coin;
}
