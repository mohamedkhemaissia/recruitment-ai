import { Router } from 'express';
import multer from 'multer';
import { createApplicationController } from '../controllers/application.controller.js';
import { requireAuth } from '../middleware/require-auth.js';
import { requireRole } from '../middleware/require-role.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function receiveCv(request, response, next) {
  upload.single('cv')(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Le CV ne doit pas dépasser 5 Mo.'
        : 'Le fichier envoyé est invalide.';
      return response.status(400).json({ message });
    }
    return error ? next(error) : next();
  });
}

export function createApplicationRouter(userService, applicationService, cvStorage, pdfTextExtractor, skillExtractor, semanticMatcher, analysisJobService = null, auditService = null, notificationService = null) {
  const router = Router();
  const controller = createApplicationController(
    applicationService,
    cvStorage,
    pdfTextExtractor,
    skillExtractor,
    semanticMatcher,
    analysisJobService,
    auditService,
    notificationService,
  );

  router.use(requireAuth);
  router.get('/', requireRole(userService, 'candidate'), controller.list);
  router.get('/hr', requireRole(userService, 'hr'), controller.listForHr);
  router.get('/:id/analysis-status', requireRole(userService, 'hr'), controller.analysisStatus);
  router.get('/:id/cv', requireRole(userService, 'hr'), controller.downloadCv);
  router.patch('/:id/status', requireRole(userService, 'hr'), controller.updateStatus);
  router.delete('/:id', requireRole(userService, 'candidate'), controller.remove);
  router.post('/', requireRole(userService, 'candidate'), receiveCv, controller.create);

  return router;
}
