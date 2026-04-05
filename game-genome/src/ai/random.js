export function createRandomNumberGenerator(seed = null) {
  if (!Number.isInteger(seed)) {
    return Math.random;
  }

  let state = seed >>> 0;
  return function random() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
