import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HrApplicationList from './HrApplicationList.jsx';

const application = {
  id: 4,
  status: 'submitted',
  cvOriginalName: 'cv.pdf',
  cvExtractionStatus: 'completed',
  cvSkills: ['React', 'TypeScript'],
  aiStatus: 'completed',
  finalScore: 84,
  semanticScore: 79,
  skillScore: 67,
  scoringVersion: 'learned-ranking-v2',
  aiExplanation: {
    factors: [{ name: 'requiredSkillCoverage', label: 'Compétences demandées', value: 0.67, effect: 'positive' }],
    evidence: [{ criterion: 'React', excerpt: 'Développement de plusieurs applications React.' }],
  },
  matchedSkills: ['React', 'TypeScript'],
  missingSkills: ['Docker'],
  offer: { title: 'Développeur frontend', department: 'Tech' },
  candidate: {
    firstName: 'Sami',
    lastName: 'Ben Ali',
    email: 'sami@example.com',
    professionalTitle: 'Développeur',
  },
  interview: null,
};

describe('HrApplicationList — matching appris', () => {
  it('affiche les facteurs orientés et les preuves du modèle V2 sans fausse confiance', () => {
    render(<HrApplicationList
      applications={[application]}
      loading={false}
      error=""
      actionMessage=""
      actionTone="success"
      updatingId={null}
      downloadingId={null}
      interviewUpdatingId={null}
      interviewUpdatingStatus=""
      pagination={{ total: 1, page: 1, totalPages: 1 }}
      offers={[{ id: 8, title: 'Développeur frontend' }]}
      filters={{ search: '', status: '', jobOfferId: '8', sort: 'score' }}
      onFilterChange={vi.fn()}
      onFilterSubmit={vi.fn()}
      onPageChange={vi.fn()}
      onRetry={vi.fn()}
      onStatusChange={vi.fn()}
      onDownloadCv={vi.fn()}
      onScheduleInterview={vi.fn()}
      onInterviewStatusChange={vi.fn()}
      onEvaluateInterview={vi.fn()}
    />);

    expect(screen.getByText(/Ranker appris/)).toBeInTheDocument();
    expect(screen.queryByText(/Confiance du modèle/)).not.toBeInTheDocument();
    expect(screen.getByText(/Compétences demandées : impact favorable/)).toBeInTheDocument();
    expect(screen.getByText('Voir les preuves extraites du CV')).toBeInTheDocument();
    expect(screen.getByText(/Développement de plusieurs applications React/)).toBeInTheDocument();
  });
});
