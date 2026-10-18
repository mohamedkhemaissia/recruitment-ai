import { Router } from 'express';
import { createDashboardController } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

export function createDashboardRouter(userService, dashboardService) {
  const router = Router();
  const controller = createDashboardController(dashboardService);

  router.get('/', requireAuth, requireRole(userService, 'hr'), controller.get);
  return router;
}
