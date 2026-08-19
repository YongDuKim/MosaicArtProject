import { describe, expect, test } from "vitest";
import { halvingSteps } from "./resize";

describe("halvingSteps", () => {
  test("縮小率が2倍以内なら中間段階を作らない", () => {
    expect(halvingSteps(40, 40, 25, 25)).toEqual([]);
    expect(halvingSteps(50, 50, 25, 25)).toEqual([]);
  });

  test("目標の2倍を超える間は半分ずつ刻む", () => {
    // 256 → 25 は約1/10。一度に縮小するとエイリアシングが出る
    expect(halvingSteps(256, 256, 25, 25)).toEqual([
      { width: 128, height: 128 },
      { width: 64, height: 64 },
      { width: 32, height: 32 },
    ]);
  });

  test("最終サイズは列に含めない", () => {
    const steps = halvingSteps(256, 256, 25, 25);
    expect(steps.at(-1)).not.toEqual({ width: 25, height: 25 });
  });

  test("縦横比を保ったまま両辺を刻む", () => {
    expect(halvingSteps(16384, 8192, 2048, 1024)).toEqual([
      { width: 8192, height: 4096 },
      { width: 4096, height: 2048 },
    ]);
  });

  test("奇数サイズでも0にならない", () => {
    const steps = halvingSteps(101, 101, 1, 1);
    expect(steps.every((s) => s.width >= 1 && s.height >= 1)).toBe(true);
  });

  test("拡大方向では中間段階を作らない", () => {
    expect(halvingSteps(25, 25, 256, 256)).toEqual([]);
  });

  test("片方の辺だけ縮小率が大きい場合は刻まない", () => {
    // 一方の辺が目標の2倍以内なら、そこで刻むと縦横比が崩れる
    expect(halvingSteps(256, 30, 25, 25)).toEqual([]);
  });
});
