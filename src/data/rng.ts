/**
 * Deterministic pseudo-random source.
 *
 * The whole dataset must be byte-identical on every load and on every machine,
 * otherwise a KPI and the list behind it could disagree. Nothing in the app is
 * allowed to call Math.random().
 */

/** mulberry32 — small, fast, good enough distribution for demo data. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;

  constructor(seed: number) {
    this.next = makeRng(seed);
  }

  /** float in [0, 1) */
  float(): number {
    return this.next();
  }

  /** integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** true with probability p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Pick with integer weights. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = this.next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
  }

  /** Fisher-Yates, returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Round to `dp` decimals — keeps quantities tidy. */
  round(value: number, dp = 0): number {
    const f = 10 ** dp;
    return Math.round(value * f) / f;
  }
}

/** Zero-padded reference builder, e.g. pad(42, 5) -> "00042". */
export function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}
