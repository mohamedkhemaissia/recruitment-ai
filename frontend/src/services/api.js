const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function apiFetch(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const hasBody = options.body !== undefined && options.body !== null;

  return fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(!isFormData && hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
}

async function responseBody(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();

  const text = await response.text();
  return text ? { message: text } : null;
}

export async function apiRequest(path, options = {}) {
  const response = await apiFetch(path, options);
  const data = await responseBody(response);

  if (!response.ok) {
    throw new Error(data?.message || `La requête a échoué (${response.status}).`);
  }

  return data;
}
