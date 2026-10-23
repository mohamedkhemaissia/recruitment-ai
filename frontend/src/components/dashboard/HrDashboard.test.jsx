import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HrDashboard from './HrDashboard.jsx';

const dashboard = {
  summary: {
    totalOffers: 3,
    publishedOffers: 2,
    totalApplications: 8,
    submittedApplications: 3,
    reviewedApplications: 2,
    shortlistedApplications: 2,
    rejectedApplications: 1,
    analyzedApplications: 7,
    zeroMatchApplications: 1,
    lowMatchApplications: 2,
    alignedApplications: 4,
    unavailableMatchApplications: 1,
    upcomingInterviews: 1,
    completedInterviews: 2,
  },
  pipeline: [
    { status: 'submitted', count: 3 },
    { status: 'reviewed', count: 2 },
    { status: 'shortlisted', count: 2 },
    { status: 'rejected', count: 1 },
  ],
  offers: [
    { id: 7, title: 'Développeur React', status: 'published', applicationCount: 5, shortlistedCount: 2 },
    { id: 8, title: 'Data Analyst', status: 'published', applicationCount: 3, shortlistedCount: 0 },
  ],
  selectedOfferId: 7,
  ranking: [{ id: 11, score: 92, status: 'shortlisted', candidateName: 'Sami Ben Ali', offerTitle: 'Développeur React' }],
  priorityApplications: [{ id: 12, status: 'submitted', createdAt: '2026-10-19T08:00:00.000Z', aiStatus: 'completed', score: 86, candidateName: 'Amira Test', offerTitle: 'Développeur React' }],
  upcomingInterviews: [{ id: 5, scheduledAt: '2026-10-20T09:00:00.000Z', meetingType: 'video', candidateName: 'Sami Ben Ali', offerTitle: 'Développeur React' }],
};

function renderDashboard(overrides = {}) {
  const props = {
    dashboard,
    loading: false,
    error: '',
    onRetry: vi.fn(),
    onViewOffers: vi.fn(),
    onViewApplications: vi.fn(),
    ...overrides,
  };
  render(<HrDashboard {...props} />);
  return props;
}

describe('HrDashboard', () => {
  it('affiche les priorités opérationnelles et le pipeline', () => {
    renderDashboard();
    expect(screen.getByText('Nouvelles à traiter')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Candidatures à traiter' })).toBeInTheDocument();
    expect(screen.getByText('Amira Test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reçues/ })).toBeInTheDocument();
    expect(screen.queryByText('Score IA moyen')).not.toBeInTheDocument();
  });

  it('ouvre directement la file RH correspondant à l’action choisie', () => {
    const props = renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Examiner' }));
    expect(props.onViewApplications).toHaveBeenCalledWith({ search: 'Amira Test', status: 'submitted' });

    fireEvent.click(screen.getByRole('button', { name: /En examen/ }));
    expect(props.onViewApplications).toHaveBeenCalledWith({ status: 'reviewed' });
  });

  it('ouvre les listes de candidatures signalées par le tri IA', () => {
    const props = renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: /Score 0 %/ }));
    expect(props.onViewApplications).toHaveBeenCalledWith({ matchBand: 'zero' });

    fireEvent.click(screen.getByRole('button', { name: /Faible compatibilité/ }));
    expect(props.onViewApplications).toHaveBeenCalledWith({ matchBand: 'low' });
  });

  it('présente les états de chargement et d’erreur', () => {
    const { rerender } = render(<HrDashboard {...{
      dashboard: null,
      loading: true,
      error: '',
      onRetry: vi.fn(),
      onViewOffers: vi.fn(),
      onViewApplications: vi.fn(),
    }} />);
    expect(screen.getByText('Chargement du tableau de bord…')).toBeInTheDocument();
    rerender(<HrDashboard dashboard={null} loading={false} error="Chargement impossible" onRetry={vi.fn()} onViewOffers={vi.fn()} onViewApplications={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Chargement impossible');
  });
});
