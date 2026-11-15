const BASE = (import.meta.env.VITE_API_URL || 'https://login-management-5.onrender.com') + '/api';
export async function api(path, options = {}) {
  const token = localStorage.getItem('orbit_token');
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || 'Request failed'); error.status = response.status; error.code = data.code; throw error; }
  return data;
}
