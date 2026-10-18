import { Router } from 'express';
import { createJobOfferController } from '../controllers/job-offer.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

export function createJobOfferRouter(userService, jobOfferService, skillExtractor) {
  const router = Router();
  const controller = createJobOfferController(userService, jobOfferService, skillExtractor);

  router.use(requireAuth);
  router.get('/', controller.list);
  router.post('/', requireRole(userService, 'hr'), controller.create);
  router.put('/:id', requireRole(userService, 'hr'), controller.update);
  router.delete('/:id', requireRole(userService, 'hr'), controller.remove);
  router.patch('/:id/status', requireRole(userService, 'hr'), controller.updateStatus);

  return router;
}
