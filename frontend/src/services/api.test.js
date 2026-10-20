import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, apiRequest } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('client API', () => {
  it('envoie les cookies et décode une réponse JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ status: 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/api/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/health'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('conserve le message d une erreur non JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      'Service temporairement indisponible',
      { status: 502, headers: { 'Content-Type': 'text/plain' } },
    )));

    await expect(apiRequest('/api/health')).rejects.toThrow('Service temporairement indisponible');
  });

  it('ne force pas un type JSON pour un téléchargement', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('pdf'));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/applications/4/cv');
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
  });
});
