import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { createAuthRateLimit } from '../middleware/auth-rate-limit.js';
import { requireAuth } from '../middleware/require-auth.js';

export function createAuthRouter(userService, authRateLimit = createAuthRateLimit()) {
  const router = Router();
  const controller = createAuthController(userService);

  router.post('/register', authRateLimit, controller.register);
  router.post('/login', authRateLimit, controller.login);
  router.get('/me', requireAuth, controller.me);
  router.post('/logout', requireAuth, controller.logout);

  return router;
}
