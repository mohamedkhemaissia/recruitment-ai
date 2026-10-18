const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizeOrigin(value) {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

export function createCsrfOriginGuard({ frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173' } = {}) {
  const allowedOrigin = normalizeOrigin(frontendUrl);

  return (request, response, next) => {
    if (process.env.NODE_ENV === 'test' || safeMethods.has(request.method) || !request.session?.userId) {
      return next();
    }

    const requestOrigin = normalizeOrigin(request.get('origin') || request.get('referer')?.replace(/\/[^/]*$/, ''));
    if (process.env.NODE_ENV !== 'production' && !requestOrigin) {
      return next();
    }

    if (!requestOrigin || requestOrigin !== allowedOrigin) {
      return response.status(403).json({ message: 'Origine de requête non autorisée.' });
    }

    return next();
  };
}
