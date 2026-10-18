import bcrypt from 'bcryptjs';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
    createdAt: user.created_at,
  };
}

function saveSession(request) {
  return new Promise((resolve, reject) => {
    request.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function regenerateSession(request) {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

export function createAuthController(userService) {
  return {
    register: async (request, response, next) => {
      try {
        const body = request.body || {};
        const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
        const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const { password } = body;

        if (!firstName || !lastName || !email || typeof password !== 'string') {
          return response.status(400).json({ message: 'Tous les champs sont obligatoires.' });
        }

        if (firstName.length > 80 || lastName.length > 80 || !emailPattern.test(email) || email.length > 254) {
          return response.status(400).json({ message: 'Les informations fournies sont invalides.' });
        }

        if (password.length < 8 || password.length > 128) {
          return response.status(400).json({ message: 'Le mot de passe doit contenir entre 8 et 128 caractères.' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await userService.create({
          firstName,
          lastName,
          email,
          passwordHash,
          role: 'candidate',
        });

        await regenerateSession(request);
        request.session.userId = user.id;
        await saveSession(request);

        return response.status(201).json({ user: publicUser(user) });
      } catch (error) {
        if (error.code === '23505') {
          return response.status(409).json({ message: 'Cette adresse e-mail est déjà utilisée.' });
        }

        return next(error);
      }
    },

    login: async (request, response, next) => {
      try {
        const body = request.body || {};
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const { password } = body;

        if (!email || typeof password !== 'string' || !password) {
          return response.status(400).json({ message: 'E-mail et mot de passe obligatoires.' });
        }

        const user = await userService.findByEmail(email);
        const passwordIsValid = user
          ? await bcrypt.compare(password, user.password_hash)
          : false;

        if (!user || !passwordIsValid) {
          return response.status(401).json({ message: 'E-mail ou mot de passe incorrect.' });
        }

        await regenerateSession(request);
        request.session.userId = user.id;
        await saveSession(request);

        return response.json({ user: publicUser(user) });
      } catch (error) {
        return next(error);
      }
    },

    me: async (request, response, next) => {
      try {
        const user = await userService.findPublicById(request.session.userId);

        if (!user) {
          return response.status(401).json({ message: 'Session invalide.' });
        }

        return response.json({ user: publicUser(user) });
      } catch (error) {
        return next(error);
      }
    },

    logout: (request, response, next) => {
      request.session.destroy((error) => {
        if (error) {
          return next(error);
        }

        response.clearCookie('recruitment.sid');
        return response.status(204).end();
      });
    },
  };
}
