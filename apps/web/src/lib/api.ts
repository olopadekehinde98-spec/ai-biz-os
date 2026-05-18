import { createClient } from './supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

async function getHeaders(businessId?: string): Promise<HeadersInit> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  if (businessId) headers['x-business-id'] = businessId;
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  businessId?: string,
): Promise<T> {
  const headers = await getHeaders(businessId);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, businessId?: string) =>
    request<T>(path, { method: 'GET' }, businessId),

  post: <T>(path: string, body: unknown, businessId?: string) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, businessId),

  put: <T>(path: string, body: unknown, businessId?: string) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }, businessId),

  patch: <T>(path: string, body: unknown, businessId?: string) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, businessId),

  delete: <T>(path: string, businessId?: string) =>
    request<T>(path, { method: 'DELETE' }, businessId),
};
