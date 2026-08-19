import { describe, expect, test } from "vitest";
import { tileKey } from "./tiles";

const file = (name: string, size: number, lastModified: number) =>
  new File([new Uint8Array(size)], name, { lastModified });

describe("tileKey", () => {
  test("ファイル名とサイズからキーを作る", () => {
    expect(tileKey(file("photo.jpg", 3, 1000))).toBe("photo.jpg:3");
  });

  test("lastModified が変わっても同じキーになる", () => {
    // iOS のピッカーは再選択のたびに再変換して lastModified を書き換えるため、
    // これを含めると同じ写真の重複を検出できない
    expect(tileKey(file("photo.jpg", 3, 1000))).toBe(
      tileKey(file("photo.jpg", 3, 2000)),
    );
  });

  test("名前かサイズが違えば別のキーになる", () => {
    expect(tileKey(file("a.jpg", 3, 1000))).not.toBe(
      tileKey(file("b.jpg", 3, 1000)),
    );
    expect(tileKey(file("a.jpg", 3, 1000))).not.toBe(
      tileKey(file("a.jpg", 4, 1000)),
    );
  });
});
