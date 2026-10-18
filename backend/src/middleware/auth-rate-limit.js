const windowMs = 15 * 60 * 1000;
const maximumAttempts = 5;

export function createAuthRateLimit({ now = () => Date.now(), limit = maximumAttempts } = {}) {
  const attempts = new Map();

  return (request, response, next) => {
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const currentTime = now();
    const record = attempts.get(key);

    if (!record || currentTime - record.startedAt >= windowMs) {
      attempts.set(key, { startedAt: currentTime, count: 1 });
    } else if (record.count >= limit) {
      const retryAfter = Math.ceil((windowMs - (currentTime - record.startedAt)) / 1000);
      response.set('Retry-After', String(retryAfter));
      return response.status(429).json({
        message: 'Trop de tentatives. Réessayez plus tard.',
      });
    } else {
      record.count += 1;
    }

    response.on('finish', () => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        attempts.delete(key);
      }
    });

    return next();
  };
}
