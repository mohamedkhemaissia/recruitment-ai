export function requireAuth(request, response, next) {
  if (!request.session.userId) {
    return response.status(401).json({ message: 'Authentification requise.' });
  }

  return next();
}

