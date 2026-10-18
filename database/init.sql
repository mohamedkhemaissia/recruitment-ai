CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('candidate', 'hr')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS candidate_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  location VARCHAR(120) NOT NULL DEFAULT '',
  professional_title VARCHAR(120) NOT NULL DEFAULT '',
  bio VARCHAR(1000) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL DEFAULT '',
  company_name VARCHAR(120) NOT NULL DEFAULT '',
  job_title VARCHAR(120) NOT NULL DEFAULT '',
  bio VARCHAR(1000) NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_offers (
  id BIGSERIAL PRIMARY KEY,
  hr_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(150) NOT NULL,
  department VARCHAR(120) NOT NULL DEFAULT '',
  location VARCHAR(120) NOT NULL DEFAULT '',
  employment_type VARCHAR(30) NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'fixed_term', 'internship', 'freelance')),
  workplace_type VARCHAR(20) NOT NULL CHECK (workplace_type IN ('onsite', 'hybrid', 'remote')),
  description TEXT NOT NULL CHECK (CHAR_LENGTH(description) <= 5000),
  requirements TEXT NOT NULL CHECK (CHAR_LENGTH(requirements) <= 5000),
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_offers_hr_user_id_idx ON job_offers(hr_user_id);

ALTER TABLE job_offers ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS applications (
  id BIGSERIAL PRIMARY KEY,
  job_offer_id BIGINT NOT NULL REFERENCES job_offers(id) ON DELETE RESTRICT,
  candidate_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cv_original_name VARCHAR(255) NOT NULL,
  cv_stored_name VARCHAR(100) NOT NULL UNIQUE,
  cv_mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  cv_size INTEGER NOT NULL CHECK (cv_size > 0 AND cv_size <= 5242880),
  cv_text TEXT NOT NULL DEFAULT '',
  cv_extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (cv_extraction_status IN ('pending', 'completed', 'no_text', 'failed')),
  cv_extracted_at TIMESTAMPTZ,
  cv_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending', 'completed', 'failed', 'unavailable')),
  semantic_score NUMERIC(5,2) CHECK (semantic_score >= 0 AND semantic_score <= 100),
  matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_model VARCHAR(200) NOT NULL DEFAULT '',
  analyzed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed', 'shortlisted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_offer_id, candidate_user_id)
);

ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_text TEXT NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (cv_extraction_status IN ('pending', 'completed', 'no_text', 'failed'));
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_extracted_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending', 'completed', 'failed', 'unavailable'));
ALTER TABLE applications ADD COLUMN IF NOT EXISTS semantic_score NUMERIC(5,2) CHECK (semantic_score >= 0 AND semantic_score <= 100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS missing_skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ai_model VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS final_score NUMERIC(5,2) CHECK (final_score >= 0 AND final_score <= 100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS semantic_component NUMERIC(5,2) CHECK (semantic_component >= 0 AND semantic_component <= 100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS skill_component NUMERIC(5,2) CHECK (skill_component >= 0 AND skill_component <= 100);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS scoring_version VARCHAR(40) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS applications_job_offer_id_idx ON applications(job_offer_id);
CREATE INDEX IF NOT EXISTS applications_candidate_user_id_idx ON applications(candidate_user_id);

CREATE TABLE IF NOT EXISTS interviews (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 240),
  meeting_type VARCHAR(20) NOT NULL CHECK (meeting_type IN ('video', 'onsite', 'phone')),
  details VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  evaluation_score SMALLINT CHECK (evaluation_score BETWEEN 1 AND 5),
  evaluation_notes VARCHAR(2000) NOT NULL DEFAULT '',
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS evaluation_score SMALLINT CHECK (evaluation_score BETWEEN 1 AND 5);
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS evaluation_notes VARCHAR(2000) NOT NULL DEFAULT '';
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS evaluated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS interviews_scheduled_at_idx ON interviews(scheduled_at);

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_message VARCHAR(1000) NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_jobs_status_created_at_idx
  ON analysis_jobs(status, created_at);
