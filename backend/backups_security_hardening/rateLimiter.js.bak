/**
 * In-memory sliding window rate limiter for login & authentication attempts.
 * JB GROUP / Bella Design ERP
 */

const attempts = new Map();

/**
 * Checks if a client/identifier is rate limited.
 * @param {string} key Unique key (e.g. `login:ip:identifier`)
 * @param {number} maxAttempts Maximum failed attempts allowed (default 5)
 * @param {number} windowMs Time window in milliseconds (default 15 minutes)
 * @returns {{ isBlocked: boolean, remainingAttempts: number, retryAfterSeconds: number }}
 */
const checkRateLimit = (key, maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) {
    return { isBlocked: false, remainingAttempts: maxAttempts, retryAfterSeconds: 0 };
  }

  // Purge old attempts outside the window
  const validTimestamps = record.timestamps.filter(t => now - t < windowMs);
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

module.exports = {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit
};
