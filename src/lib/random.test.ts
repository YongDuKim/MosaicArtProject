import { expect, test } from "vitest";
import { seededRandom } from "./random";

test("seed 0 を含め、同じ seed は同じ有界の乱数列を再現する", () => {
  for (const seed of [0, 1, 0xffffffff]) {
    const a = seededRandom(seed),
      b = seededRandom(seed);
    for (let i = 0; i < 100; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  }
  expect(seededRandom(0)()).toBe(1013904223 / 4294967296);
  expect(seededRandom(1)()).not.toBe(seededRandom(2)());
});
