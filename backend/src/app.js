import cors from 'cors';
import express from 'express';
import pool from './config/database.js';
import { createSessionMiddleware } from './config/session.js';
import { createCsrfOriginGuard } from './middleware/csrf-origin.js';
import { createApplicationRouter } from './routes/application.routes.js';
import { createDashboardRouter } from './routes/dashboard.routes.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { createJobOfferRouter } from './routes/job-offer.routes.js';
import { createInterviewRouter } from './routes/interview.routes.js';
import { createNotificationRouter } from './routes/notification.routes.js';
import { createProfileRouter } from './routes/profile.routes.js';
import { createJobOfferService } from './services/job-offer.service.js';
import { createInterviewService } from './services/interview.service.js';
import { createApplicationService } from './services/application.service.js';
import { createDashboardService } from './services/dashboard.service.js';
import { createCvStorage } from './services/cv-storage.service.js';
import { createProfileService } from './services/profile.service.js';
import { createPdfTextExtractor } from './services/pdf-text-extractor.service.js';
import { createSkillExtractor } from './services/skill-extractor.service.js';
import { createRecruitmentMatcher } from './services/recruitment-matcher.service.js';
import { createUserService } from './services/user.service.js';
import { createAuditService } from './services/audit.service.js';
import { createNotificationService } from './services/notification.service.js';

export function createApp({
  databasePool = pool,
  sessionMiddleware = createSessionMiddleware(databasePool),
  userService = createUserService(databasePool),
  profileService = createProfileService(databasePool),
  jobOfferService = createJobOfferService(databasePool),
  interviewService = createInterviewService(databasePool),
  applicationService = createApplicationService(databasePool),
  dashboardService = createDashboardService(databasePool),
  cvStorage = createCvStorage(),
  pdfTextExtractor = createPdfTextExtractor(),
  skillExtractor = createSkillExtractor(),
  semanticMatcher = createRecruitmentMatcher(),
  analysisJobService = null,
  auditService = createAuditService(databasePool),
  notificationService = typeof databasePool.connect === 'function'
    ? createNotificationService(databasePool)
    : null,
} = {}) {
  const app = express();
  app.disable('x-powered-by');

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use((_request, response, next) => {
    const securityHeaders = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    };
    if (process.env.NODE_ENV === 'production') {
      securityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }
    response.set(securityHeaders);
    next();
  });

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(sessionMiddleware);
  app.use(createCsrfOriginGuard());

  app.get('/api/health', async (_request, response) => {
    try {
      const result = await databasePool.query('SELECT NOW() AS database_time');

      response.json({
        status: 'ok',
        backend: 'connected',
        database: 'connected',
        databaseTime: result.rows[0].database_time,
      });
    } catch (error) {
      response.status(503).json({
        status: 'error',
        backend: 'connected',
        database: 'disconnected',
        message: 'Connexion à PostgreSQL impossible.',
      });
    }
  });

  app.use('/api/auth', createAuthRouter(userService));
  app.use('/api/profile', createProfileRouter(profileService));
  app.use('/api/dashboard', createDashboardRouter(userService, dashboardService));
  app.use('/api/job-offers', createJobOfferRouter(userService, jobOfferService, skillExtractor));
  app.use('/api/interviews', createInterviewRouter(userService, interviewService, notificationService));
  if (notificationService) {
    app.use('/api/notifications', createNotificationRouter(userService, notificationService));
  }
  app.use('/api/applications', createApplicationRouter(
    userService,
    applicationService,
    cvStorage,
    pdfTextExtractor,
    skillExtractor,
    semanticMatcher,
    analysisJobService,
    auditService,
    notificationService,
  ));

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ message: 'Une erreur interne est survenue.' });
  });

  return app;
}

export default createApp;
