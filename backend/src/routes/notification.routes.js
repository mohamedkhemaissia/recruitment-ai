import { Router } from 'express';
import { createNotificationController } from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

export function createNotificationRouter(userService, notificationService) {
  const router = Router();
  const controller = createNotificationController(notificationService);

  router.use(requireAuth, requireRole(userService, 'candidate'));
  router.get('/', controller.list);
  router.patch('/read-all', controller.markAllRead);
  router.patch('/:id/read', controller.markRead);

  return router;
}
