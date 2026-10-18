import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthPanel from './AuthPanel.jsx';

const form = { firstName: '', lastName: '', email: '', password: '' };

describe('AuthPanel', () => {
  it('présente une inscription candidat sans choix de type de compte', () => {
    render(<AuthPanel mode="register" setMode={vi.fn()} form={form} onChange={vi.fn()} onSubmit={vi.fn()} loading={false} message="" />);
    expect(screen.getByRole('heading', { name: 'Créer un compte candidat' })).toBeInTheDocument();
    expect(screen.getByLabelText('Prénom')).toBeRequired();
    expect(screen.queryByLabelText(/type de compte/i)).not.toBeInTheDocument();
  });

  it('permet de revenir à la connexion', () => {
    const setMode = vi.fn();
    render(<AuthPanel mode="register" setMode={setMode} form={form} onChange={vi.fn()} onSubmit={vi.fn()} loading={false} message="" />);
    fireEvent.click(screen.getByRole('button', { name: 'Connexion' }));
    expect(setMode).toHaveBeenCalledWith('login');
  });
});
