function serializeProfile(profile) {
  const common = {
    id: profile.id,
    firstName: profile.first_name,
    lastName: profile.last_name,
    email: profile.email,
    role: profile.role,
    phone: profile.phone,
    bio: profile.bio,
  };

  if (profile.role === 'hr') {
    return {
      ...common,
      companyName: profile.company_name,
      jobTitle: profile.job_title,
    };
  }

  return {
    ...common,
    location: profile.location,
    professionalTitle: profile.professional_title,
  };
}

function readField(body, name, maxLength, required = false) {
  const value = body[name];

  if (typeof value !== 'string') {
    if (required) {
      throw new Error('VALIDATION');
    }
    return '';
  }

  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength) {
    throw new Error('VALIDATION');
  }

  return normalized;
}

export function createProfileController(profileService) {
  return {
    get: async (request, response, next) => {
      try {
        const profile = await profileService.getByUserId(request.session.userId);

        if (!profile) {
          return response.status(404).json({ message: 'Profil introuvable.' });
        }

        return response.json({ profile: serializeProfile(profile) });
      } catch (error) {
        return next(error);
      }
    },

    update: async (request, response, next) => {
      try {
        const current = await profileService.getByUserId(request.session.userId);
        if (!current) {
          return response.status(404).json({ message: 'Profil introuvable.' });
        }

        const body = request.body || {};
        const data = {
          firstName: readField(body, 'firstName', 80, true),
          lastName: readField(body, 'lastName', 80, true),
          phone: readField(body, 'phone', 30),
          bio: readField(body, 'bio', 1000),
        };

        if (current.role === 'hr') {
          data.companyName = readField(body, 'companyName', 120);
          data.jobTitle = readField(body, 'jobTitle', 120);
        } else {
          data.location = readField(body, 'location', 120);
          data.professionalTitle = readField(body, 'professionalTitle', 120);
        }

        const profile = await profileService.update(request.session.userId, data);
        return response.json({ profile: serializeProfile(profile) });
      } catch (error) {
        if (error.message === 'VALIDATION') {
          return response.status(400).json({ message: 'Les informations du profil sont invalides.' });
        }

        return next(error);
      }
    },
  };
}

