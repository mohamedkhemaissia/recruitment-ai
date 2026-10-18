import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const password = argument('password');
const offers = [
  {
    title: 'Développeur React',
    department: 'Technologie',
    location: 'Tunis',
    employmentType: 'full_time',
    workplaceType: 'hybrid',
    description: 'Concevoir et maintenir les interfaces accessibles de notre plateforme de recrutement.',
    requirements: 'Expérience avec React, JavaScript, HTML, CSS, Git et intégration d API REST.',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'API REST', 'Git'],
  },
  {
    title: 'Data Analyst',
    department: 'Data',
    location: 'Ariana',
    employmentType: 'full_time',
    workplaceType: 'hybrid',
    description: 'Analyser les données métier et produire des tableaux de bord utiles à la décision.',
    requirements: 'Maîtrise de Python, SQL, PostgreSQL, Power BI, Excel et communication.',
    skills: ['Python', 'SQL', 'PostgreSQL', 'Power BI', 'Excel', 'Communication'],
  },
  {
    title: 'Stage ingénieur backend Node.js',
    department: 'Technologie',
    location: 'Tunis',
    employmentType: 'internship',
    workplaceType: 'onsite',
    description: 'Participer au développement d API sécurisées pour une application web moderne.',
    requirements: 'Bonnes bases en Node.js, Express, PostgreSQL, API REST, JavaScript et Git.',
    skills: ['Node.js', 'Express', 'PostgreSQL', 'API REST', 'JavaScript', 'Git'],
  },
];

const client = await pool.connect();

try {
  if (!password || password.length < 8) {
    throw new Error('Utilisez --password avec au moins 8 caractères.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await client.query('BEGIN');

  const hrResult = await client.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role)
     VALUES ('Responsable', 'Démo', 'rh.demo@beecoders.tn', $1, 'hr')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
     RETURNING id`,
    [passwordHash],
  );
  const candidateResult = await client.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role)
     VALUES ('Candidat', 'Démo', 'candidat.demo@beecoders.tn', $1, 'candidate')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
     RETURNING id`,
    [passwordHash],
  );
  const hrUserId = hrResult.rows[0].id;
  const candidateUserId = candidateResult.rows[0].id;

  await client.query(
    `INSERT INTO hr_profiles (user_id, company_name, job_title, phone, bio)
     VALUES ($1, 'Bee Coders', 'Responsable recrutement', '', 'Équipe chargée du recrutement et du suivi des candidats.')
     ON CONFLICT (user_id) DO UPDATE SET company_name = EXCLUDED.company_name,
       job_title = EXCLUDED.job_title, bio = EXCLUDED.bio, updated_at = NOW()`,
    [hrUserId],
  );
  await client.query(
    `INSERT INTO candidate_profiles (user_id, location, professional_title, phone, bio)
     VALUES ($1, 'Tunis', 'Ingénieur logiciel', '', 'Profil candidat utilisé pour la démonstration locale.')
     ON CONFLICT (user_id) DO UPDATE SET location = EXCLUDED.location,
       professional_title = EXCLUDED.professional_title, bio = EXCLUDED.bio, updated_at = NOW()`,
    [candidateUserId],
  );

  for (const offer of offers) {
    const existingOffer = await client.query(
      'SELECT id FROM job_offers WHERE hr_user_id = $1 AND title = $2',
      [hrUserId, offer.title],
    );
    if (existingOffer.rowCount > 0) continue;
    await client.query(
      `INSERT INTO job_offers (
         hr_user_id, title, department, location, employment_type,
         workplace_type, description, requirements, skills, status, published_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'published', NOW())`,
      [
        hrUserId,
        offer.title,
        offer.department,
        offer.location,
        offer.employmentType,
        offer.workplaceType,
        offer.description,
        offer.requirements,
        JSON.stringify(offer.skills),
      ],
    );
  }

  await client.query('COMMIT');
  console.log('Données de démonstration prêtes.');
  console.log('RH : rh.demo@beecoders.tn');
  console.log('Candidat : candidat.demo@beecoders.tn');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Préparation impossible :', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
