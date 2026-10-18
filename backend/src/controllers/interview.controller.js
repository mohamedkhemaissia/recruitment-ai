const meetingTypes = new Set(['video', 'onsite', 'phone']);
const durations = new Set([15, 30, 45, 60, 90, 120]);
const terminalStatuses = new Set(['completed', 'cancelled']);

function serializeInterview(interview) {
  return {
    id: interview.id,
    applicationId: interview.application_id,
    scheduledAt: interview.scheduled_at,
    durationMinutes: interview.duration_minutes,
    meetingType: interview.meeting_type,
    details: interview.details,
    status: interview.status,
    evaluationScore: interview.evaluation_score,
    evaluationNotes: interview.evaluation_notes,
    evaluatedAt: interview.evaluated_at,
    createdAt: interview.created_at,
    updatedAt: interview.updated_at,
  };
}

function readSchedule(body = {}) {
  const durationMinutes = Number(body.durationMinutes);
  const meetingType = body.meetingType;
  const details = typeof body.details === 'string' ? body.details.trim() : '';
  const scheduledAt = new Date(body.scheduledAt);

  if (
    !durations.has(durationMinutes)
    || !meetingTypes.has(meetingType)
    || details.length < 3
    || details.length > 500
    || Number.isNaN(scheduledAt.getTime())
    || scheduledAt.getTime() <= Date.now()
  ) {
    throw new Error('VALIDATION');
  }

  return { scheduledAt: scheduledAt.toISOString(), durationMinutes, meetingType, details };
}

export function createInterviewController(interviewService) {
  return {
    create: async (request, response, next) => {
      try {
        const applicationId = Number(request.body?.applicationId);
        if (!Number.isSafeInteger(applicationId) || applicationId < 1) throw new Error('VALIDATION');

        const interview = await interviewService.create({
          applicationId,
          hrUserId: request.user.id,
          ...readSchedule(request.body),
        });
        if (!interview) {
          return response.status(404).json({ message: 'Candidature introuvable ou non planifiable.' });
        }

        return response.status(201).json({
          interview: serializeInterview(interview),
          message: 'L’entretien a été planifié.',
        });
      } catch (error) {
        if (error.message === 'VALIDATION') {
          return response.status(400).json({ message: 'Les informations de l’entretien sont invalides.' });
        }
        if (error.code === '23505') {
          return response.status(409).json({ message: 'Un entretien est déjà planifié pour cette candidature.' });
        }
        return next(error);
      }
    },

    update: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) throw new Error('VALIDATION');

        const interview = await interviewService.update({
          id,
          hrUserId: request.user.id,
          ...readSchedule(request.body),
        });
        if (!interview) {
          return response.status(404).json({ message: 'Entretien programmé introuvable.' });
        }

        return response.json({
          interview: serializeInterview(interview),
          message: 'L’entretien a été modifié.',
        });
      } catch (error) {
        if (error.message === 'VALIDATION') {
          return response.status(400).json({ message: 'Les informations de l’entretien sont invalides.' });
        }
        return next(error);
      }
    },

    updateStatus: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        const status = request.body?.status;
        if (!Number.isSafeInteger(id) || id < 1 || !terminalStatuses.has(status)) {
          return response.status(400).json({ message: 'Le statut demandé est invalide.' });
        }

        const interview = await interviewService.updateStatus({ id, hrUserId: request.user.id, status });
        if (!interview) {
          return response.status(404).json({ message: 'Entretien programmé introuvable.' });
        }

        return response.json({
          interview: serializeInterview(interview),
          message: status === 'completed' ? 'L’entretien est marqué comme réalisé.' : 'L’entretien a été annulé.',
        });
      } catch (error) {
        return next(error);
      }
    },

    evaluate: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        const score = Number(request.body?.score);
        const notes = typeof request.body?.notes === 'string' ? request.body.notes.trim() : '';
        if (!Number.isSafeInteger(id) || id < 1 || !Number.isInteger(score) || score < 1 || score > 5 || notes.length < 3 || notes.length > 2000) {
          return response.status(400).json({ message: 'L’évaluation est invalide.' });
        }

        const interview = await interviewService.evaluate({ id, hrUserId: request.user.id, score, notes });
        if (!interview) {
          return response.status(404).json({ message: 'Entretien réalisé introuvable.' });
        }

        return response.json({
          interview: serializeInterview(interview),
          message: 'L’évaluation a été enregistrée.',
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}
