import { Router } from 'express';
import { createInterviewController } from '../controllers/interview.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

export function createInterviewRouter(userService, interviewService, notificationService = null) {
  const router = Router();
  const controller = createInterviewController(interviewService, notificationService);

  router.use(requireAuth, requireRole(userService, 'hr'));
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.patch('/:id/status', controller.updateStatus);
  router.patch('/:id/evaluation', controller.evaluate);

  return router;
}
