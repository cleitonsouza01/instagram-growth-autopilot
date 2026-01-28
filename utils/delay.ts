/**
 * Wait for a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a random duration between min and max milliseconds.
 */
export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return delay(ms);
}

/**
 * Generate a random delay value (in ms) using Gaussian distribution
 * centered at the midpoint of min/max, for more human-like timing.
 */
export function gaussianDelay(minMs: number, maxMs: number): number {
  const mean = (minMs + maxMs) / 2;
  const stdDev = (maxMs - minMs) / 6; // 99.7% within range

  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  const value = mean + z * stdDev;
  return Math.max(minMs, Math.min(maxMs, Math.round(value)));
}
