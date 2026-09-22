/** 比較内で同じ乱数列を使うための32 bit線形合同法。通常生成は Math.random のまま。 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
