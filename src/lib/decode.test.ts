import { describe, expect, test } from "vitest";
import { isHeic } from "./decode";

/** 先頭12バイトが `[size][ftyp][brand]` の ISOBMFF ヘッダを持つ Blob を作る */
function isobmff(brand: string): Blob {
  const head = new Uint8Array(16);
  head.set([0, 0, 0, 24], 0);
  head.set(
    [...`ftyp${brand}`].map((c) => c.charCodeAt(0)),
    4,
  );
  return new Blob([head]);
}

describe("isHeic", () => {
  test("HEIF 系ブランドを HEIC と判定する", async () => {
    for (const brand of ["heic", "heix", "mif1", "msf1", "heif"]) {
      await expect(isHeic(isobmff(brand))).resolves.toBe(true);
    }
  });

  test("HEIF 以外の ISOBMFF ブランドは判定しない", async () => {
    // 動画 (MP4) も ftyp を持つため、ブランドまで見ないと誤判定する
    await expect(isHeic(isobmff("mp42"))).resolves.toBe(false);
    await expect(isHeic(isobmff("qt  "))).resolves.toBe(false);
  });

  test("JPEG は HEIC と判定しない", async () => {
    // 拡張子が .HEIC でも実体が JPEG のファイルはネイティブデコードへ回す
    const jpeg = new Blob([
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]),
    ]);
    await expect(isHeic(jpeg)).resolves.toBe(false);
  });

  test("12バイト未満のデータは HEIC と判定しない", async () => {
    await expect(isHeic(new Blob([new Uint8Array(4)]))).resolves.toBe(false);
    await expect(isHeic(new Blob([]))).resolves.toBe(false);
  });
});
