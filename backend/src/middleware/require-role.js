export function requireRole(userService, expectedRole) {
  return async (request, response, next) => {
    try {
      const user = await userService.findPublicById(request.session.userId);

      if (!user) {
        return response.status(401).json({ message: 'Session invalide.' });
      }

      if (user.role !== expectedRole) {
        return response.status(403).json({ message: 'Vous n’êtes pas autorisé à effectuer cette action.' });
      }

      request.user = user;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

