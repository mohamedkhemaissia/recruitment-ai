import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotificationCenter from './NotificationCenter.jsx';

const notification = {
  id: 1,
  applicationId: 7,
  title: 'Candidature présélectionnée',
  message: 'Votre candidature a été présélectionnée.',
  readAt: null,
  createdAt: '2026-10-19T10:00:00.000Z',
};

function renderCenter(overrides = {}) {
  const props = {
    notifications: [notification],
    unreadCount: 1,
    loading: false,
    error: '',
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    onMarkAllRead: vi.fn(),
    ...overrides,
  };
  render(<NotificationCenter {...props} />);
  return props;
}

describe('NotificationCenter', () => {
  it('affiche le compteur et ouvre les notifications', () => {
    renderCenter();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 non lue' }));
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Candidature présélectionnée')).toBeInTheDocument();
  });

  it('ouvre la candidature et permet de tout marquer comme lu', () => {
    const props = renderCenter();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 non lue' }));
    fireEvent.click(screen.getByRole('button', { name: /Candidature présélectionnée/ }));
    expect(props.onSelect).toHaveBeenCalledWith(notification);

    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 non lue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tout lire' }));
    expect(props.onMarkAllRead).toHaveBeenCalledOnce();
  });

  it('présente un état d’erreur récupérable', () => {
    const props = renderCenter({ notifications: [], unreadCount: 0, error: 'Chargement impossible' });
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Chargement impossible');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(props.onRetry).toHaveBeenCalledOnce();
  });
});
