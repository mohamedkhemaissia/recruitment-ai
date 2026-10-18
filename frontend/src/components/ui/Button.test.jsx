import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button.jsx';

describe('Button', () => {
  it('déclenche l action demandée', () => {
    const onClick = vi.fn();
    render(<Button type="button" onClick={onClick}>Enregistrer</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('bloque l action pendant le chargement', () => {
    render(<Button type="button" loading>Enregistrer</Button>);
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
