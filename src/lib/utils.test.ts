import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { nuevoId } from './utils';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('nuevoId', () => {
  it('genera UUID v4 distintos', () => {
    const a = nuevoId();
    expect(a).toMatch(UUID_V4);
    expect(nuevoId()).not.toBe(a);
  });

  it('funciona sin crypto.randomUUID (http por la IP de la red local, iOS < 15.4)', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => webcrypto.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 50 }, nuevoId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
