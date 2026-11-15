// Klien admin: login Supabase Auth (email + password) dan akses tabel pas_* via REST.
// Hak akses dijaga di database (RLS + is_admin()), bukan di browser.

const BASE = import.meta.env.PUBLIC_SUPABASE_URL as string;
const KEY = import.meta.env.PUBLIC_SUPABASE_KEY as string;
const LS = 'pas-admin-session';

export type Session = { access_token: string; refresh_token: string; expires_at: number; email: string };
export type Code = { code: string; client_name: string | null; service: string | null; note: string | null; created_at: string; used_at: string | null };
export type AdminReview = { id: string; code: string; name: string; service: string; rating: number; comment: string; is_visible: boolean; created_at: string };

export class AuthError extends Error {}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(LS);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function saveSession(s: Session) { localStorage.setItem(LS, JSON.stringify(s)); }
export function clearSession() { localStorage.removeItem(LS); }

async function authRequest(grant: 'password' | 'refresh_token', body: object): Promise<Session> {
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data.error_description || data.msg || data.message || '');
    if (/invalid login|invalid_grant|credentials/i.test(msg)) throw new AuthError('Email atau password salah.');
    if (/not confirmed/i.test(msg)) throw new AuthError('Email belum dikonfirmasi.');
    throw new AuthError(msg || `Gagal masuk (HTTP ${res.status}).`);
  }
  const s: Session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    email: data.user?.email ?? '',
  };
  saveSession(s);
  return s;
}

export const login = (email: string, password: string) => authRequest('password', { email, password });

export async function logout() {
  const s = getSession();
  clearSession();
  if (s) {
    fetch(`${BASE}/auth/v1/logout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
  }
}

async function freshSession(force = false): Promise<Session> {
  const s = getSession();
  if (!s) throw new AuthError('Sesi berakhir. Silakan masuk lagi.');
  if (!force && s.expires_at - 60 > Date.now() / 1000) return s;
  try {
    const n = await authRequest('refresh_token', { refresh_token: s.refresh_token });
    return { ...n, email: n.email || s.email };
  } catch {
    clearSession();
    throw new AuthError('Sesi berakhir. Silakan masuk lagi.');
  }
}

async function rest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const s = await freshSession();
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${s.access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && retry) {
    await freshSession(true);
    return rest<T>(path, init, false);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const rpc = <T>(fn: string, args: object = {}) => rest<T>(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

export const api = {
  isAdmin: () => rpc<boolean>('is_admin'),
  listCodes: () =>
    rest<Code[]>('pas_order_codes?select=code,client_name,service,note,created_at,used_at&order=created_at.desc&limit=500'),
  newCode: (client_name: string, service: string, note: string) =>
    rpc<string>('pas_admin_new_code', { p_client_name: client_name, p_service: service, p_note: note }),
  deleteCode: (code: string) => rest<void>(`pas_order_codes?code=eq.${encodeURIComponent(code)}`, { method: 'DELETE' }),
  listReviews: () =>
    rest<AdminReview[]>('pas_reviews?select=id,code,name,service,rating,comment,is_visible,created_at&order=created_at.desc&limit=500'),
  setVisible: (id: string, is_visible: boolean) =>
    rest<void>(`pas_reviews?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_visible }), headers: { Prefer: 'return=minimal' } }),
  deleteReview: (id: string) => rest<void>(`pas_reviews?id=eq.${id}`, { method: 'DELETE' }),
};

// ---------- Karya ----------
export type AdminProject = {
  id: string;
  title: string;
  client: string | null;
  category: 'Website' | 'UI/UX' | 'Lainnya';
  year: number | null;
  summary: string | null;
  tech: string[];
  url: string | null;
  image_url: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
};
export type ProjectInput = Omit<AdminProject, 'id' | 'created_at'>;

export const projects = {
  list: () =>
    rest<AdminProject[]>('pas_projects?select=*&order=sort_order.asc,created_at.desc&limit=500'),
  create: (p: ProjectInput) =>
    rest<AdminProject[]>('pas_projects', { method: 'POST', body: JSON.stringify(p), headers: { Prefer: 'return=representation' } }),
  update: (id: string, p: Partial<ProjectInput>) =>
    rest<AdminProject[]>(`pas_projects?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(p), headers: { Prefer: 'return=representation' } }),
  remove: (id: string) => rest<void>(`pas_projects?id=eq.${id}`, { method: 'DELETE' }),
};

/** Perkecil gambar di browser (maks 1600px, WebP) lalu unggah ke bucket "pas-karya". */
export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Format gambar harus JPG, PNG, atau WebP.');
  const blob = await shrink(file, 1600, 0.82);
  if (blob.size > 3 * 1024 * 1024) throw new Error('Gambar terlalu besar (maks 3 MB setelah dikompres).');
  const s = await freshSession();
  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.webp`;
  const res = await fetch(`${BASE}/storage/v1/object/pas-karya/${name}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'image/webp', 'x-upsert': 'false' },
    body: blob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Upload gagal (HTTP ${res.status}).`);
  }
  return `${BASE}/storage/v1/object/public/pas-karya/${name}`;
}

async function shrink(file: File, max: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses gambar.'))), 'image/webp', quality),
  );
}

// ---------- Promo ----------
export type AdminPromo = {
  code: string;
  title: string | null;
  discount_type: 'percent' | 'amount' | 'fixed_price';
  value: number;
  max_discount: number | null;
  services: string[];
  starts_at: string | null;
  ends_at: string | null;
  quota: number | null;
  personal_for: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
};
export type PromoUse = { id: string; code: string; name: string | null; service: string | null; status: 'used' | 'cancelled'; created_at: string };
export type PromoInput = Omit<AdminPromo, 'created_at'>;

export const promos = {
  list: () => rest<AdminPromo[]>('pas_promos?select=*&order=created_at.desc&limit=500'),
  uses: () => rest<PromoUse[]>('pas_promo_uses?select=*&order=created_at.desc&limit=2000'),
  create: (p: PromoInput) =>
    rest<AdminPromo[]>('pas_promos', { method: 'POST', body: JSON.stringify(p), headers: { Prefer: 'return=representation' } }),
  update: (code: string, p: Partial<PromoInput>) =>
    rest<AdminPromo[]>(`pas_promos?code=eq.${encodeURIComponent(code)}`, { method: 'PATCH', body: JSON.stringify(p), headers: { Prefer: 'return=representation' } }),
  remove: (code: string) => rest<void>(`pas_promos?code=eq.${encodeURIComponent(code)}`, { method: 'DELETE' }),
  setUse: (id: string, status: 'used' | 'cancelled') =>
    rest<void>(`pas_promo_uses?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status }), headers: { Prefer: 'return=minimal' } }),
};

// ---------- Saran ----------
export type Feedback = { id: string; category: string; ease: number | null; message: string; name: string | null; contact: string | null; page: string | null; status: 'baru' | 'dibaca' | 'selesai'; created_at: string };
export const feedback = {
  list: () => rest<Feedback[]>('pas_feedback?select=*&order=created_at.desc&limit=1000'),
  setStatus: (id: string, status: Feedback['status']) =>
    rest<void>(`pas_feedback?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status }), headers: { Prefer: 'return=minimal' } }),
  remove: (id: string) => rest<void>(`pas_feedback?id=eq.${id}`, { method: 'DELETE' }),
};
