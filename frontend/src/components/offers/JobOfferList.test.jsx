import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import JobOfferList from './JobOfferList.jsx';

const filters = { search: '', employmentType: '', workplaceType: '', status: '' };
const handlers = {
  onFilterChange: vi.fn(),
  onFilterSubmit: vi.fn((event) => event.preventDefault()),
  onFilterReset: vi.fn(),
  onRetry: vi.fn(),
  onCreate: vi.fn(),
  onEdit: vi.fn(),
  onStatusChange: vi.fn(),
  onDelete: vi.fn(),
  onApply: vi.fn(),
};
const offer = {
  id: 1,
  title: 'Développeur React',
  department: 'Technologie',
  location: 'Tunis',
  employmentType: 'full_time',
  workplaceType: 'hybrid',
  description: 'Concevoir les interfaces accessibles de la plateforme de recrutement.',
  requirements: 'Maîtrise de React et JavaScript, avec une attention portée à l’accessibilité.',
  companyName: 'Bee Coders',
  skills: ['React', 'JavaScript'],
  status: 'published',
  publishedAt: '2026-10-18T10:00:00.000Z',
};

describe('JobOfferList', () => {
  it('affiche la description et permet au candidat de postuler', () => {
    const onApply = vi.fn();
    render(<JobOfferList user={{ role: 'candidate' }} offers={[offer]} filters={filters} loading={false} error="" {...handlers} onApply={onApply} />);
    expect(screen.getByText(offer.description)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Postuler' }));
    expect(onApply).toHaveBeenCalledWith(offer);
  });

  it('désactive une candidature déjà envoyée', () => {
    render(<JobOfferList user={{ role: 'candidate' }} offers={[{ ...offer, alreadyApplied: true }]} filters={filters} loading={false} error="" {...handlers} />);
    expect(screen.getByRole('button', { name: 'Déjà postulé' })).toBeDisabled();
  });

  it('ouvre le détail complet d’une offre pour le candidat', () => {
    const onApply = vi.fn();
    render(<JobOfferList user={{ role: 'candidate' }} offers={[offer]} filters={filters} loading={false} error="" {...handlers} onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', { name: 'Voir l’offre' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: offer.title })).toBeInTheDocument();
    expect(within(dialog).getByText(offer.requirements)).toBeInTheDocument();
    expect(within(dialog).getAllByText('Bee Coders')).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Voir l’offre' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Postuler à cette offre' }));
    expect(onApply).toHaveBeenCalledWith(offer);
  });

  it('présente un état d erreur récupérable', () => {
    const onRetry = vi.fn();
    render(<JobOfferList user={{ role: 'hr' }} offers={[]} filters={filters} loading={false} error="Chargement impossible" {...handlers} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Chargement impossible');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
