import { fireEvent, render, screen } from '@testing-library/react';
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
  it('affiche le score simplifié et permet de choisir une catégorie IA', () => {
    const onMatchBandChange = vi.fn();
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
      filters={{ search: '', status: '', jobOfferId: '8', sort: 'score', matchBand: '' }}
      matchingSummary={{ all: 6, zero: 2, low: 1, aligned: 3, unavailable: 0 }}
      onFilterChange={vi.fn()}
      onFilterSubmit={vi.fn()}
      onMatchBandChange={onMatchBandChange}
      onPageChange={vi.fn()}
      onRetry={vi.fn()}
      onStatusChange={vi.fn()}
      onDownloadCv={vi.fn()}
      onScheduleInterview={vi.fn()}
      onInterviewStatusChange={vi.fn()}
      onEvaluateInterview={vi.fn()}
    />);

    expect(screen.getByText('84%')).toBeInTheDocument();
    expect(screen.getByText(/Sémantique : 79%/)).toBeInTheDocument();
    expect(screen.queryByText(/Ranker appris/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Score 0 %2/ }));
    expect(onMatchBandChange).toHaveBeenCalledWith('zero');
  });
});
