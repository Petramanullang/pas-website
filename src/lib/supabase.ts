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
  /** 'struk' = ulasan dari struk pesanan (pembeli terverifikasi), 'kode' = kode ulasan dari admin. */
  source?: 'kode' | 'struk';
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
    select: 'id,name,service,rating,comment,created_at,source',
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
  | ({ status: 'ok' | 'not_started' | 'expired' | 'quota' | 'service' | 'mode' | 'day' | 'time'; code: string; title: string | null;
       services: string[]; starts_at: string | null; ends_at: string | null; personal: boolean; days: number[];
       time_start: string | null; time_end: string | null; per_person_limit: number | null; class_mode: 'Online' | 'Offline' | null } & PromoRule)
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

export const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Ringkas daftar hari: [1..5] -> "Senin sampai Jumat", [6,7] -> "Sabtu & Minggu". */
export function daysLabel(days: number[] | null | undefined) {
  const d = [...new Set(days ?? [])].filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b);
  if (!d.length || d.length === 7) return '';
  const run = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  if (run && d.length >= 3) return `${DAY_NAMES[d[0] - 1]} sampai ${DAY_NAMES[d[d.length - 1] - 1]}`;
  const names = d.map((n) => DAY_NAMES[n - 1]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5).replace(':', '.') : '');

/** Jam berlaku, misal "19.00 sampai 22.00 WIB". */
export function timeLabel(start: string | null | undefined, end: string | null | undefined) {
  return start && end ? `${hhmm(start)} sampai ${hhmm(end)} WIB` : '';
}

export function checkPromo(code: string, service: string, mode = '') {
  return call<PromoCheck>('rpc/pas_check_promo', {
    method: 'POST',
    body: JSON.stringify({ p_code: code, p_service: service || null, p_mode: mode || null }),
  });
}

export function usePromo(code: string, service: string, name: string, mode = '', phone = '') {
  return call<{ status: string; use_id?: string }>('rpc/pas_use_promo', {
    method: 'POST',
    body: JSON.stringify({ p_code: code, p_service: service, p_name: name, p_mode: mode || null, p_phone: phone || null }),
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

// ---------- Struk pesanan ----------
export type OrderStatus = 'menunggu' | 'dikerjakan' | 'selesai' | 'batal';
export type CreateOrderResult =
  | { status: 'ok'; code: string; created_at: string; duplicated?: boolean }
  | { status: 'promo'; promo_status: string }
  | { status: 'rate_limit' | 'busy' }
  | { status: 'error'; message: string };

export function createOrder(input: {
  name: string; phone: string; service: string; detail: string; extra: Record<string, string>;
  estPrice: number | null; promo: string | null; clientRef: string;
}) {
  return call<CreateOrderResult>('rpc/pas_create_order', {
    method: 'POST',
    body: JSON.stringify({
      p_name: input.name, p_phone: input.phone, p_service: input.service, p_detail: input.detail, p_extra: input.extra,
      p_est_price: input.estPrice, p_promo: input.promo, p_client_ref: input.clientRef,
    }),
  });
}

export type OrderInfo = {
  status: 'ok'; code: string; name: string; phone: string; service: string; detail: string; extra: Record<string, string>;
  est_price: number | null; final_price: number | null; order_status: OrderStatus;
  created_at: string; updated_at: string; finished_at: string | null; reviewed: boolean;
  promo: ({ code: string } & Partial<PromoRule>) | null;
};

export function orderStatus(code: string, phone: string) {
  return call<OrderInfo | { status: 'not_found' }>('rpc/pas_order_status', {
    method: 'POST', body: JSON.stringify({ p_code: code, p_phone: phone }),
  });
}

export function submitOrderReview(input: { code: string; phone: string; name: string; rating: number; comment: string }) {
  return call<{ status: 'ok' | 'not_found' | 'not_finished' | 'used' } | { status: 'error'; message: string }>('rpc/pas_submit_order_review', {
    method: 'POST',
    body: JSON.stringify({ p_code: input.code, p_phone: input.phone, p_name: input.name, p_rating: input.rating, p_comment: input.comment }),
  });
}
