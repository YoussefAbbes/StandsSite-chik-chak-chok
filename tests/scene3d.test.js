// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Object3D } from 'three';
import { initScene } from '../src/scene3d.js';
import { createLantern } from '../src/objects/lantern.js';
import { createCoin } from '../src/objects/coin.js';
import { createFan } from '../src/objects/fan.js';
import { createDarbuka } from '../src/objects/darbuka.js';

describe('scene background', () => {
  it('initScene returns null without WebGL', () => {
    const canvas = document.createElement('canvas');
    expect(initScene(canvas, { reducedMotion: false })).toBeNull();
  });

  it('initScene returns null when reducedMotion', () => {
    const canvas = document.createElement('canvas');
    const getContext = vi.spyOn(canvas, 'getContext');
    expect(initScene(canvas, { reducedMotion: true })).toBeNull();
    expect(getContext).not.toHaveBeenCalled();
  });

  it.each([
    ['createLantern', createLantern],
    ['createCoin', createCoin],
    ['createFan', createFan],
    ['createDarbuka', createDarbuka],
  ])('%s returns an Object3D containing a mesh', (_, create) => {
    const obj = create();
    expect(obj).toBeInstanceOf(Object3D);
    expect(obj.getObjectsByProperty('isMesh', true).length).toBeGreaterThanOrEqual(1);
  });
});
