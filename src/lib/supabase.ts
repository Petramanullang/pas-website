// Klien Supabase super ringan (tanpa library), memanggil REST API langsung.
// Hanya memakai kunci "publishable" yang memang aman untuk browser.
// Keamanan dijaga di database: RLS + fungsi pas_check_code / pas_submit_review.

const BASE = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.PUBLIC_SUPABASE_KEY as string | undefined;

export const isConfigured = Boolean(BASE && KEY);

export type Review = {
  id: string;
  name: string;
  service: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type CodeStatus =
  | { status: 'ok'; client_name: string | null; service: string | null }
  | { status: 'invalid' | 'used' };

export type SubmitResult = { status: 'ok' | 'invalid' | 'used' } | { status: 'error'; message: string };

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 10000): Promise<T> {
  if (!isConfigured) throw new Error('Supabase belum dikonfigurasi (.env).');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/rest/v1/${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { apikey: KEY!, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function getReviews(limit = 100) {
  const q = new URLSearchParams({
    select: 'id,name,service,rating,comment,created_at',
    is_visible: 'eq.true',
    order: 'created_at.desc',
    limit: String(limit),
  });
  return call<Review[]>(`pas_reviews?${q}`);
}

export function checkCode(code: string) {
  return call<CodeStatus>('rpc/pas_check_code', { method: 'POST', body: JSON.stringify({ p_code: code }) });
}

export function submitReview(input: { code: string; name: string; service: string; rating: number; comment: string }) {
  return call<SubmitResult>('rpc/pas_submit_review', {
    method: 'POST',
    body: JSON.stringify({
      p_code: input.code,
      p_name: input.name,
      p_service: input.service,
      p_rating: input.rating,
      p_comment: input.comment,
    }),
  });
}

export type Project = {
  id: string;
  title: string;
  client: string | null;
  category: 'Website' | 'UI/UX' | 'Lainnya';
  year: number | null;
  summary: string | null;
  tech: string[];
  url: string | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
};

export function getProjects(limit = 200) {
  const q = new URLSearchParams({
    select: 'id,title,client,category,year,summary,tech,url,image_url,sort_order,created_at',
    is_published: 'eq.true',
    order: 'sort_order.asc,created_at.desc',
    limit: String(limit),
  });
  return call<Project[]>(`pas_projects?${q}`);
}

// ---------- Promo ----------
export type PromoType = 'percent' | 'amount' | 'fixed_price';
export type PromoRule = { discount_type: PromoType; value: number; max_discount: number | null };
export type PromoCheck =
  | ({ status: 'ok' | 'not_started' | 'expired' | 'quota' | 'service'; code: string; title: string | null; services: string[];
       starts_at: string | null; ends_at: string | null; personal: boolean } & PromoRule)
  | { status: 'invalid' };

export const rupiah = (n: number) =>
  n >= 1000 && n % 1000 === 0 ? `Rp${(n / 1000).toLocaleString('id-ID')}rb` : `Rp${n.toLocaleString('id-ID')}`;

export function promoLabel(p: PromoRule) {
  if (p.discount_type === 'percent') return `Diskon ${p.value}%${p.max_discount ? ` (maks ${rupiah(p.max_discount)})` : ''}`;
  if (p.discount_type === 'amount') return `Potongan ${rupiah(p.value)}`;
  return `Harga spesial ${rupiah(p.value)}`;
}

/** Hitung harga setelah promo dari harga dasar. */
export function applyPromo(p: PromoRule, base: number) {
  let price = base;
  if (p.discount_type === 'percent') {
    let cut = Math.round((base * p.value) / 100);
    if (p.max_discount) cut = Math.min(cut, p.max_discount);
    price = base - cut;
  } else if (p.discount_type === 'amount') price = Math.max(0, base - p.value);
  else price = Math.min(base, p.value);
  return { price, cut: base - price };
}

export function checkPromo(code: string, service: string) {
  return call<PromoCheck>('rpc/pas_check_promo', { method: 'POST', body: JSON.stringify({ p_code: code, p_service: service || null }) });
}

export function usePromo(code: string, service: string, name: string) {
  return call<{ status: string; use_id?: string }>('rpc/pas_use_promo', {
    method: 'POST',
    body: JSON.stringify({ p_code: code, p_service: service, p_name: name }),
  });
}

// ---------- Saran ----------
export function submitFeedback(input: { category: string; ease: number | null; message: string; name: string; contact: string; page: string }) {
  return call<{ status: 'ok' } | { status: 'error'; message: string }>('rpc/pas_submit_feedback', {
    method: 'POST',
    body: JSON.stringify({
      p_category: input.category, p_ease: input.ease, p_message: input.message,
      p_name: input.name || null, p_contact: input.contact || null, p_page: input.page || null,
    }),
  });
}
