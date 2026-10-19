const pdfSignature = Buffer.from('%PDF-');
const applicationStatuses = new Set(['submitted', 'reviewed', 'shortlisted', 'rejected']);

async function recordAuditSafely(auditService, data) {
  if (!auditService) return;
  try {
    await auditService.record(data);
  } catch (error) {
    console.error('Journalisation impossible :', error.message);
  }
}

async function notifySafely(notificationService, data) {
  if (!notificationService) return;
  try {
    await notificationService.notifyCandidate(data);
  } catch (error) {
    console.error('Création de la notification impossible :', error.message);
  }
}

const applicationNotificationContent = {
  submitted: {
    type: 'application_submitted',
    title: 'Candidature envoyée',
    message: 'Votre candidature a bien été reçue par l’équipe de recrutement.',
  },
  reviewed: {
    type: 'application_reviewed',
    title: 'Candidature en cours d’examen',
    message: 'Votre candidature est actuellement examinée par le responsable RH.',
  },
  shortlisted: {
    type: 'application_shortlisted',
    title: 'Candidature présélectionnée',
    message: 'Bonne nouvelle : votre candidature a été présélectionnée par le responsable RH.',
  },
  rejected: {
    type: 'application_rejected',
    title: 'Mise à jour de votre candidature',
    message: 'Après examen, votre candidature n’a pas été retenue pour cette offre.',
  },
};

function serializeApplication(application) {
  return {
    id: application.id,
    jobOfferId: application.job_offer_id,
    candidateUserId: application.candidate_user_id,
    status: application.status,
    createdAt: application.created_at,
    interview: application.interview_id ? {
      id: application.interview_id,
      scheduledAt: application.interview_scheduled_at,
      durationMinutes: application.interview_duration_minutes,
      meetingType: application.interview_meeting_type,
      details: application.interview_details,
      status: application.interview_status,
    } : null,
    offer: application.title ? {
      title: application.title,
      department: application.department,
      location: application.location,
      employmentType: application.employment_type,
      workplaceType: application.workplace_type,
      companyName: application.company_name || '',
    } : undefined,
  };
}

function serializeHrApplication(application) {
  return {
    id: application.id,
    jobOfferId: application.job_offer_id,
    status: application.status,
    cvOriginalName: application.cv_original_name,
    cvExtractionStatus: application.cv_extraction_status,
    cvSkills: Array.isArray(application.cv_skills) ? application.cv_skills : [],
    aiStatus: application.ai_status,
    semanticScore: application.semantic_component === null || application.semantic_component === undefined
      ? (application.semantic_score === null ? null : Number(application.semantic_score))
      : Number(application.semantic_component),
    finalScore: application.final_score === null || application.final_score === undefined
      ? (application.semantic_score === null ? null : Number(application.semantic_score))
      : Number(application.final_score),
    skillScore: application.skill_component === null || application.skill_component === undefined ? null : Number(application.skill_component),
    scoringVersion: application.scoring_version || '',
    matchedSkills: Array.isArray(application.matched_skills) ? application.matched_skills : [],
    missingSkills: Array.isArray(application.missing_skills) ? application.missing_skills : [],
    createdAt: application.created_at,
    interview: application.interview_id ? {
      id: application.interview_id,
      scheduledAt: application.interview_scheduled_at,
      durationMinutes: application.interview_duration_minutes,
      meetingType: application.interview_meeting_type,
      details: application.interview_details,
      status: application.interview_status,
      evaluationScore: application.interview_evaluation_score,
      evaluationNotes: application.interview_evaluation_notes,
      evaluatedAt: application.interview_evaluated_at,
    } : null,
    offer: {
      title: application.title,
      department: application.department,
    },
    candidate: {
      id: application.candidate_user_id,
      firstName: application.first_name,
      lastName: application.last_name,
      email: application.email,
      professionalTitle: application.professional_title || '',
      location: application.candidate_location || '',
    },
  };
}

export function createApplicationController(applicationService, cvStorage, pdfTextExtractor, skillExtractor, semanticMatcher, analysisJobService = null, auditService = null, notificationService = null) {
  return {
    listForHr: async (request, response, next) => {
      try {
        const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(request.query.limit, 10) || 20));
        const status = typeof request.query.status === 'string' ? request.query.status : '';
        const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 100) : '';
        const sort = request.query.sort === 'date' ? 'date' : 'score';
        const result = await applicationService.listForHr(request.user.id, {
          page,
          limit,
          status,
          search,
          sort,
        });
        const applications = Array.isArray(result) ? result : result.rows;
        const pagination = Array.isArray(result)
          ? { page, limit, total: applications.length, totalPages: applications.length ? 1 : 0 }
          : {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.total ? Math.ceil(result.total / result.limit) : 0,
          };
        return response.json({ applications: applications.map(serializeHrApplication), pagination });
      } catch (error) {
        return next(error);
      }
    },

    list: async (request, response, next) => {
      try {
        const applications = await applicationService.listForCandidate(request.user.id);
        return response.json({ applications: applications.map(serializeApplication) });
      } catch (error) {
        return next(error);
      }
    },

    analysisStatus: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
          return response.status(400).json({ message: 'Candidature invalide.' });
        }

        const status = await applicationService.findAnalysisStatus({
          id,
          userId: request.user.id,
          role: request.user.role,
        });
        if (!status) {
          return response.status(404).json({ message: 'Candidature introuvable.' });
        }

        return response.json({
          analysis: {
            applicationId: status.application_id,
            applicationStatus: status.ai_status,
            jobId: status.job_id,
            status: status.job_status || (
              status.ai_status === 'completed'
                ? 'completed'
                : status.ai_status === 'unavailable' ? 'unavailable' : 'pending'
            ),
            attempts: status.attempts || 0,
            errorMessage: status.job_status === 'failed' ? status.error_message : '',
            startedAt: status.started_at,
            completedAt: status.completed_at,
            createdAt: status.job_created_at,
            updatedAt: status.job_updated_at,
          },
        });
      } catch (error) {
        return next(error);
      }
    },

    create: async (request, response, next) => {
      let storedFileName = '';
      let applicationCreated = false;

      try {
        const jobOfferId = Number(request.body?.jobOfferId);
        if (!Number.isSafeInteger(jobOfferId) || jobOfferId < 1) {
          return response.status(400).json({ message: 'Offre invalide.' });
        }

        if (!request.file) {
          return response.status(400).json({ message: 'Le CV PDF est obligatoire.' });
        }
        if (request.body?.consent !== 'true') {
          return response.status(400).json({ message: 'Votre consentement au traitement du CV est obligatoire.' });
        }

        const isPdf = request.file.mimetype === 'application/pdf'
          && request.file.buffer.subarray(0, pdfSignature.length).equals(pdfSignature);
        if (!isPdf) {
          return response.status(400).json({ message: 'Le fichier doit être un PDF valide.' });
        }

        const offer = await applicationService.findPublishedOffer(jobOfferId);
        if (!offer) {
          return response.status(404).json({ message: 'Cette offre n’est plus disponible.' });
        }

        let cvText = '';
        let cvSkills = [];
        let extractionStatus = 'failed';
        try {
          cvText = await pdfTextExtractor.extract(request.file.buffer);
          extractionStatus = cvText ? 'completed' : 'no_text';
          cvSkills = cvText ? skillExtractor.extract(cvText) : [];
        } catch {
          // Une extraction impossible ne doit jamais bloquer la candidature.
        }

        storedFileName = await cvStorage.store(request.file.buffer);
        let application = await applicationService.create({
          candidateUserId: request.user.id,
          jobOfferId,
          originalFileName: request.file.originalname.slice(0, 255),
          storedFileName,
          fileSize: request.file.size,
          cvText,
          extractionStatus,
          cvSkills,
          aiStatus: extractionStatus === 'completed' ? 'pending' : 'unavailable',
          consentGivenAt: new Date(),
        });

        if (!application) {
          await cvStorage.remove(storedFileName);
          return response.status(404).json({ message: 'Cette offre n’est plus disponible.' });
        }

        applicationCreated = true;
        await recordAuditSafely(auditService, {
          userId: request.user.id,
          action: 'application.created',
          resourceType: 'application',
          resourceId: application.id,
          newValue: { jobOfferId, status: application.status },
          ipAddress: request.ip,
        });
        await notifySafely(notificationService, {
          applicationId: application.id,
          ...applicationNotificationContent.submitted,
          eventKey: `application:${application.id}:submitted`,
        });
        if (extractionStatus === 'completed' && analysisJobService) {
          try {
            await analysisJobService.enqueue(application.id);
          } catch (error) {
            console.error('Mise en attente de l’analyse IA impossible :', error.message);
          }
        } else if (extractionStatus === 'completed') {
          try {
            const analysis = await semanticMatcher.compare({ cvText, cvSkills, offer });
            application = await applicationService.saveAnalysis({
              id: application.id,
              aiStatus: 'completed',
              score: analysis.score,
              semanticScore: analysis.semanticScore,
              skillScore: analysis.skillScore,
              matchedSkills: analysis.matchedSkills,
              missingSkills: analysis.missingSkills,
              model: analysis.model,
              scoringVersion: analysis.scoringVersion,
            }) || application;
          } catch {
            application = await applicationService.saveAnalysis({
              id: application.id,
              aiStatus: 'failed',
            }).catch(() => ({ ...application, ai_status: 'failed' })) || application;
          }
        }

        return response.status(201).json({
          application: serializeApplication(application),
          message: `Votre candidature à l’offre « ${offer.title} » a été envoyée.`,
        });
      } catch (error) {
        if (storedFileName && !applicationCreated) {
          await cvStorage.remove(storedFileName).catch(() => {});
        }
        if (error.code === '23505') {
          return response.status(409).json({ message: 'Vous avez déjà postulé à cette offre.' });
        }
        return next(error);
      }
    },

    updateStatus: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        const { status } = request.body || {};
        if (!Number.isSafeInteger(id) || id < 1 || !applicationStatuses.has(status)) {
          return response.status(400).json({ message: 'Le statut demandé est invalide.' });
        }

        const application = await applicationService.updateStatus({
          id,
          hrUserId: request.user.id,
          status,
        });
        if (!application) {
          return response.status(404).json({ message: 'Candidature introuvable.' });
        }
        await recordAuditSafely(auditService, {
          userId: request.user.id,
          action: 'application.status_changed',
          resourceType: 'application',
          resourceId: id,
          newValue: { status },
          ipAddress: request.ip,
        });
        await notifySafely(notificationService, {
          applicationId: application.id,
          ...applicationNotificationContent[status],
          eventKey: `application:${application.id}:${status}`,
        });

        return response.json({ application: serializeApplication(application) });
      } catch (error) {
        return next(error);
      }
    },

    downloadCv: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
          return response.status(400).json({ message: 'Candidature invalide.' });
        }

        const cv = await applicationService.findCvForHr({ id, hrUserId: request.user.id });
        if (!cv) {
          return response.status(404).json({ message: 'CV introuvable.' });
        }

        const file = await cvStorage.read(cv.cv_stored_name);
        await recordAuditSafely(auditService, {
          userId: request.user.id,
          action: 'application.cv_downloaded',
          resourceType: 'application',
          resourceId: id,
          ipAddress: request.ip,
        });
        const encodedName = encodeURIComponent(cv.cv_original_name).replace(/'/g, '%27');
        response.set({
          'Content-Type': cv.cv_mime_type,
          'Content-Disposition': `attachment; filename="cv.pdf"; filename*=UTF-8''${encodedName}`,
          'Content-Length': file.length,
          'Cache-Control': 'private, no-store',
        });
        return response.send(file);
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'INVALID_CV_FILE') {
          return response.status(404).json({ message: 'Le fichier du CV est introuvable.' });
        }
        return next(error);
      }
    },

    remove: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
          return response.status(400).json({ message: 'Candidature invalide.' });
        }

        const application = await applicationService.findForCandidate({
          id,
          candidateUserId: request.user.id,
        });
        if (!application) {
          return response.status(404).json({ message: 'Candidature introuvable.' });
        }

        const stagedRemoval = await cvStorage.stageRemoval(application.cv_stored_name);
        try {
          const removed = await applicationService.remove({
            id,
            candidateUserId: request.user.id,
          });
          if (!removed) {
            await stagedRemoval.rollback();
            return response.status(404).json({ message: 'Candidature introuvable.' });
          }
        } catch (error) {
          await stagedRemoval.rollback().catch(() => {});
          throw error;
        }
        await stagedRemoval.commit().catch((error) => {
          console.error('Suppression définitive du CV impossible :', error.message);
        });
        await recordAuditSafely(auditService, {
          userId: request.user.id,
          action: 'application.deleted',
          resourceType: 'application',
          resourceId: id,
          previousValue: { status: application.status },
          ipAddress: request.ip,
        });
        return response.json({ message: 'Votre candidature et votre CV ont été supprimés.' });
      } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'INVALID_CV_FILE') {
          return response.status(404).json({ message: 'Le fichier du CV est introuvable.' });
        }
        return next(error);
      }
    },
  };
}
