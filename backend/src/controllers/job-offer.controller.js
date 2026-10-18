const employmentTypes = new Set(['full_time', 'part_time', 'fixed_term', 'internship', 'freelance']);
const workplaceTypes = new Set(['onsite', 'hybrid', 'remote']);
const offerStatuses = new Set(['draft', 'published', 'closed']);

function readField(body, name, { min = 0, max, required = false }) {
  const value = body[name];

  if (typeof value !== 'string') {
    if (required) throw new Error('VALIDATION');
    return '';
  }

  const normalized = value.trim();
  if ((required && normalized.length < min) || normalized.length > max) {
    throw new Error('VALIDATION');
  }

  return normalized;
}

function serializeOffer(offer) {
  return {
    id: offer.id,
    hrUserId: offer.hr_user_id,
    title: offer.title,
    department: offer.department,
    location: offer.location,
    employmentType: offer.employment_type,
    workplaceType: offer.workplace_type,
    description: offer.description,
    requirements: offer.requirements,
    skills: Array.isArray(offer.skills) ? offer.skills : [],
    status: offer.status,
    companyName: offer.company_name || '',
    alreadyApplied: Boolean(offer.already_applied),
    publishedAt: offer.published_at,
    createdAt: offer.created_at,
    updatedAt: offer.updated_at,
  };
}

export function createJobOfferController(userService, jobOfferService, skillExtractor) {
  return {
    list: async (request, response, next) => {
      try {
        const user = await userService.findPublicById(request.session.userId);

        if (!user) {
          return response.status(401).json({ message: 'Session invalide.' });
        }

        const search = typeof request.query.q === 'string' ? request.query.q.trim() : '';
        const employmentType = typeof request.query.employmentType === 'string' ? request.query.employmentType : '';
        const workplaceType = typeof request.query.workplaceType === 'string' ? request.query.workplaceType : '';
        const status = typeof request.query.status === 'string' ? request.query.status : '';

        if (
          search.length > 100
          || (employmentType && !employmentTypes.has(employmentType))
          || (workplaceType && !workplaceTypes.has(workplaceType))
          || (status && !offerStatuses.has(status))
        ) {
          return response.status(400).json({ message: 'Les critères de recherche sont invalides.' });
        }

        const offers = await jobOfferService.listForUser({
          userId: user.id,
          role: user.role,
          search,
          employmentType,
          workplaceType,
          status: user.role === 'hr' ? status : '',
        });

        return response.json({ offers: offers.map(serializeOffer) });
      } catch (error) {
        return next(error);
      }
    },

    create: async (request, response, next) => {
      try {
        const body = request.body || {};
        const data = {
          hrUserId: request.user.id,
          title: readField(body, 'title', { min: 3, max: 150, required: true }),
          department: readField(body, 'department', { max: 120 }),
          location: readField(body, 'location', { max: 120 }),
          employmentType: body.employmentType,
          workplaceType: body.workplaceType,
          description: readField(body, 'description', { min: 20, max: 5000, required: true }),
          requirements: readField(body, 'requirements', { min: 20, max: 5000, required: true }),
        };

        if (!employmentTypes.has(data.employmentType) || !workplaceTypes.has(data.workplaceType)) {
          throw new Error('VALIDATION');
        }

        data.skills = skillExtractor.extract(`${data.title}\n${data.description}\n${data.requirements}`);

        const offer = await jobOfferService.create(data);
        return response.status(201).json({ offer: serializeOffer(offer) });
      } catch (error) {
        if (error.message === 'VALIDATION') {
          return response.status(400).json({ message: 'Les informations de l’offre sont invalides.' });
        }

        return next(error);
      }
    },

    updateStatus: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        const { status } = request.body || {};

        if (!Number.isSafeInteger(id) || id < 1 || !new Set(['draft', 'published', 'closed']).has(status)) {
          return response.status(400).json({ message: 'Le statut demandé est invalide.' });
        }

        const offer = await jobOfferService.updateStatus({
          id,
          hrUserId: request.user.id,
          status,
        });

        if (!offer) {
          return response.status(404).json({ message: 'Offre introuvable.' });
        }

        return response.json({ offer: serializeOffer(offer) });
      } catch (error) {
        return next(error);
      }
    },

    update: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        const body = request.body || {};

        if (!Number.isSafeInteger(id) || id < 1) {
          throw new Error('VALIDATION');
        }

        const data = {
          id,
          hrUserId: request.user.id,
          title: readField(body, 'title', { min: 3, max: 150, required: true }),
          department: readField(body, 'department', { max: 120 }),
          location: readField(body, 'location', { max: 120 }),
          employmentType: body.employmentType,
          workplaceType: body.workplaceType,
          description: readField(body, 'description', { min: 20, max: 5000, required: true }),
          requirements: readField(body, 'requirements', { min: 20, max: 5000, required: true }),
        };

        if (!employmentTypes.has(data.employmentType) || !workplaceTypes.has(data.workplaceType)) {
          throw new Error('VALIDATION');
        }

        data.skills = skillExtractor.extract(`${data.title}\n${data.description}\n${data.requirements}`);

        const offer = await jobOfferService.update(data);
        if (!offer) {
          return response.status(404).json({ message: 'Offre introuvable.' });
        }

        return response.json({ offer: serializeOffer(offer) });
      } catch (error) {
        if (error.message === 'VALIDATION') {
          return response.status(400).json({ message: 'Les informations de l’offre sont invalides.' });
        }

        return next(error);
      }
    },

    remove: async (request, response, next) => {
      try {
        const id = Number(request.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
          return response.status(400).json({ message: 'Identifiant d’offre invalide.' });
        }

        const removed = await jobOfferService.remove({ id, hrUserId: request.user.id });
        if (!removed) {
          return response.status(404).json({ message: 'Offre introuvable.' });
        }

        return response.status(204).end();
      } catch (error) {
        if (error.code === '23503' || error.code === 'OFFER_HAS_APPLICATIONS') {
          return response.status(409).json({ message: 'Une offre ayant reçu des candidatures ne peut pas être supprimée.' });
        }
        return next(error);
      }
    },
  };
}
