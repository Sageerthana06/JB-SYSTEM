/**
 * In-memory sliding window rate limiter for login & authentication attempts.
 * JB GROUP / Bella Design ERP
 *
 * Includes automatic periodic garbage collection to prevent memory leaks.
 */

const attempts = new Map();

// Periodic sweep every 10 minutes to clean up expired entries
// .unref() ensures this background interval does not block process exit/tests
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attempts.entries()) {
    if (!record || !Array.isArray(record.timestamps)) {
      attempts.delete(key);
      continue;
    }
    // Default window: 15 minutes
    const valid = record.timestamps.filter(t => now - t < 15 * 60 * 1000);
    if (valid.length === 0) {
      attempts.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}, 10 * 60 * 1000);

if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

/**
 * Checks if a client/identifier is rate limited.
 * @param {string} key Unique key (e.g. `login:ip:127.0.0.1` or `login:account:user@jbgroup.com`)
 * @param {number} maxAttempts Maximum failed attempts allowed (default 5)
 * @param {number} windowMs Time window in milliseconds (default 15 minutes)
 * @returns {{ isBlocked: boolean, remainingAttempts: number, retryAfterSeconds: number }}
 */
const checkRateLimit = (key, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || !Array.isArray(record.timestamps)) {
    return { isBlocked: false, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }

  // Purge old attempts outside the sliding window
  const validTimestamps = record.timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length === 0) {
    attempts.delete(key);
    return { isBlocked: false, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }

  record.timestamps = validTimestamps;

  if (validTimestamps.length >= maxAttempts) {
    const oldest = validTimestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return { isBlocked: true, remainingAttempts: 0, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  return {
    isBlocked: false,
    remainingAttempts: maxAttempts - validTimestamps.length,
    retryAfterSeconds: 0
  };
};

/**
 * Records a failed attempt for the given key.
 * @param {string} key
 */
const recordFailedAttempt = (key) => {
  const now = Date.now();
  const record = attempts.get(key) || { timestamps: [] };
  if (!Array.isArray(record.timestamps)) {
    record.timestamps = [];
  }
  record.timestamps.push(now);
  attempts.set(key, record);
};

/**
 * Resets failed attempts after a successful authentication.
 * @param {string} key
 */
const resetRateLimit = (key) => {
  attempts.delete(key);
};

/**
 * Clears all rate limit state (primarily for automated testing).
 */
const resetAllRateLimits = () => {
  attempts.clear();
};

module.exports = {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  resetAllRateLimits
};
