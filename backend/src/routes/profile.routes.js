import { Router } from 'express';
import { createProfileController } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/require-auth.js';

export function createProfileRouter(profileService) {
  const router = Router();
  const controller = createProfileController(profileService);

  router.use(requireAuth);
  router.get('/', controller.get);
  router.put('/', controller.update);

  return router;
}

