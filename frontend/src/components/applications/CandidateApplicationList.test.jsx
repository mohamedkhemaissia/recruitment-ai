import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CandidateApplicationList from './CandidateApplicationList.jsx';

const application = {
  id: 9,
  status: 'rejected',
  createdAt: '2026-10-18T10:00:00.000Z',
  offer: {
    title: 'Développeur React',
    department: 'Technologie',
    companyName: 'Bee Coders',
    location: 'Tunis',
    workplaceType: 'hybrid',
  },
  interview: null,
};

describe('CandidateApplicationList', () => {
  it('autorise la suppression d une candidature non retenue', () => {
    const onDelete = vi.fn();
    render(<CandidateApplicationList applications={[application]} loading={false} error="" onRetry={vi.fn()} onBrowseOffers={vi.fn()} onDelete={onDelete} />);
    expect(screen.getByText('Non retenue')).toBeInTheDocument();
    expect(screen.queryByText(/Analyse/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }));
    expect(onDelete).toHaveBeenCalledWith(application);
  });

  it('affiche un état vide utile', () => {
    render(<CandidateApplicationList applications={[]} loading={false} error="" onRetry={vi.fn()} onBrowseOffers={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Aucune candidature' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consulter les offres' })).toBeInTheDocument();
  });
});
