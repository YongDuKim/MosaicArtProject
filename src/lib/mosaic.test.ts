import { afterEach, describe, expect, test, vi } from "vitest";
import {
  MAX_OUTPUT_DIM,
  MOBILE_MAX_OUTPUT_DIM,
  computePlan,
  deviceMaxOutputDim,
} from "./mosaic";

describe("computePlan", () => {
  test("グリッド数は入力サイズ / x の切り捨て", () => {
    const plan = computePlan(1000, 800, 5, 25, MAX_OUTPUT_DIM);
    expect(plan.gridWidth).toBe(200);
    expect(plan.gridHeight).toBe(160);
  });

  test("上限内なら n をそのまま使う", () => {
    const plan = computePlan(1000, 800, 5, 25, MAX_OUTPUT_DIM);
    expect(plan.effectiveN).toBe(25);
    expect(plan.capped).toBe(false);
    expect(plan.outputWidth).toBe(200 * 25);
    expect(plan.outputHeight).toBe(160 * 25);
  });

  test("出力1辺が上限を超えると n を縮小する", () => {
    // 長辺グリッド 800 × n=25 = 20,000px は上限 16,384px を超える
    const plan = computePlan(4000, 2000, 5, 25, MAX_OUTPUT_DIM);
    expect(plan.capped).toBe(true);
    expect(plan.effectiveN).toBe(Math.floor(MAX_OUTPUT_DIM / 800));
    expect(Math.max(plan.outputWidth, plan.outputHeight)).toBeLessThanOrEqual(
      MAX_OUTPUT_DIM,
    );
  });

  test("縮小後も n は 1 を下回らない", () => {
    const plan = computePlan(100000, 100, 1, 25, MOBILE_MAX_OUTPUT_DIM);
    expect(plan.effectiveN).toBe(1);
  });

  test("x が入力サイズより大きくてもグリッドは1以上", () => {
    const plan = computePlan(10, 10, 100, 25, MAX_OUTPUT_DIM);
    expect(plan.gridWidth).toBe(1);
    expect(plan.gridHeight).toBe(1);
  });

  test("計算に使った上限を返す", () => {
    expect(computePlan(1000, 800, 5, 25, MOBILE_MAX_OUTPUT_DIM).maxDim).toBe(
      MOBILE_MAX_OUTPUT_DIM,
    );
  });
});

describe("deviceMaxOutputDim", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubNavigator = (userAgent: string, maxTouchPoints: number) => {
    vi.stubGlobal("navigator", { userAgent, maxTouchPoints });
  };

  test("iPhone はモバイル上限", () => {
    stubNavigator(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      5,
    );
    expect(deviceMaxOutputDim()).toBe(MOBILE_MAX_OUTPUT_DIM);
  });

  test("Android はモバイル上限", () => {
    stubNavigator("Mozilla/5.0 (Linux; Android 14) Mobile Safari/537.36", 5);
    expect(deviceMaxOutputDim()).toBe(MOBILE_MAX_OUTPUT_DIM);
  });

  test("Mac を偽装する iPadOS はタッチ数を併用してモバイル上限", () => {
    stubNavigator(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      5,
    );
    expect(deviceMaxOutputDim()).toBe(MOBILE_MAX_OUTPUT_DIM);
  });

  test("タッチ対応のデスクトップはデスクトップ上限", () => {
    // タッチ数だけで判定すると Windows のタッチノートがモバイル扱いになる
    stubNavigator(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36",
      10,
    );
    expect(deviceMaxOutputDim()).toBe(MAX_OUTPUT_DIM);
  });

  test("タッチ非対応の Mac はデスクトップ上限", () => {
    stubNavigator(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0.0.0 Safari/537.36",
      0,
    );
    expect(deviceMaxOutputDim()).toBe(MAX_OUTPUT_DIM);
  });

  test("navigator がなければデスクトップ上限", () => {
    vi.stubGlobal("navigator", undefined);
    expect(deviceMaxOutputDim()).toBe(MAX_OUTPUT_DIM);
  });
});
