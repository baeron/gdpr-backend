/**
 * Runtime-configurable scanner constants.
 *
 * These are read from `process.env` ONCE at module-load time because
 * the values are used in decorator metadata (`@Throttle({...})`) which
 * cannot reference Nest's DI container — decorators run before the
 * application context exists. Re-reading per-request would also be
 * pointless since `@Throttle` arguments are evaluated only once.
 *
 * Defaults match the previously hardcoded values so behaviour is
 * identical when no env override is set.
 */

const num = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const SCAN_TIMEOUT_MS = num(process.env.SCAN_TIMEOUT_MS, 120_000);

// Per-route abuse limits for the public scanner endpoints.
// Two windows per route: a short burst window and a medium hourly cap.
export const SCAN_RATE_LIMITS = {
  // POST /scanner/scan — synchronous scan, expensive, tighter limit.
  scan: {
    shortTtl: num(process.env.SCAN_RATE_SHORT_TTL_MS, 60_000),
    shortLimit: num(process.env.SCAN_RATE_SHORT_LIMIT, 3),
    mediumTtl: num(process.env.SCAN_RATE_MEDIUM_TTL_MS, 3_600_000),
    mediumLimit: num(process.env.SCAN_RATE_MEDIUM_LIMIT, 20),
  },
  // POST /scanner/queue — enqueue a job, cheaper, slightly higher limit.
  queue: {
    shortTtl: num(process.env.SCAN_QUEUE_SHORT_TTL_MS, 60_000),
    shortLimit: num(process.env.SCAN_QUEUE_SHORT_LIMIT, 5),
    mediumTtl: num(process.env.SCAN_QUEUE_MEDIUM_TTL_MS, 3_600_000),
    mediumLimit: num(process.env.SCAN_QUEUE_MEDIUM_LIMIT, 30),
  },
} as const;
