import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';

const PgSession = connectPgSimple(session);

export function createSessionMiddleware(databasePool) {
  const isProduction = process.env.NODE_ENV === 'production';
  const sessionSecret = process.env.SESSION_SECRET;

  if (
    isProduction
    && (!sessionSecret || sessionSecret.length < 32 || sessionSecret === 'replace-with-a-long-random-secret')
  ) {
    throw new Error('SESSION_SECRET doit contenir au moins 32 caractères aléatoires en production.');
  }

  return session({
    name: 'recruitment.sid',
    secret: sessionSecret || 'development-only-change-this-secret',
    store: new PgSession({
      pool: databasePool,
      tableName: 'user_sessions',
      createTableIfMissing: true,
    }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    },
  });
}
