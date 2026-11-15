// Riwayat struk di perangkat pembeli (localStorage, maks. 30 struk), mirip "Pesananku" di Labkom.
// Daftar dibaca dari perangkat. Server hanya dipanggil untuk memperbarui status satu struk,
// dan selalu dengan kode + nomor WA yang sama dengan pesanan.
import { orderStatus, promoLabel, applyPromo, rupiah, type OrderInfo, type OrderStatus, type PromoRule } from './supabase';
import { SERVICES } from '../config';

export type StoredStruk = {
  code: string;
  phone: string;
  name: string;
  service: string;
  detail: string;
  extra?: Record<string, string>;
  estPrice: number | null;
  finalPrice?: number | null;
  promo?: OrderInfo['promo'];
  status: OrderStatus | 'dihapus';
  reviewed?: boolean;
  createdAt: string;
  updatedAt?: string;
  checkedAt?: number;
};

const KEY = 'pas-struk';
const REF_KEY = 'pas-order-ref';
const MAX = 30;

export const STATUS_LABEL: Record<StoredStruk['status'], string> = {
  menunggu: 'Menunggu konfirmasi',
  dikerjakan: 'Sedang dikerjakan',
  selesai: 'Selesai',
  batal: 'Dibatalkan',
  dihapus: 'Tidak ditemukan',
};

/** Kode struk: PAS-YYMMDD-XXXXXX (beda dengan kode ulasan manual PAS-XXXXXX). */
export const isStrukCode = (v: string) => /^PAS-\d{6}-[A-Z0-9]{6}$/.test(v);
/** 0812… / +62 812… / 812… menjadi 62812… (sama dengan pas_norm_phone di database). */
export function normPhone(v: string) {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}
export const phoneValid = (v: string) => /^628[0-9]{7,12}$/.test(normPhone(v));
/** Tampilan nomor: 62812… menjadi 0812-3456-7890. */
export const showPhone = (p: string) => ('0' + p.replace(/^62/, '')).replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
export const normCode = (v: string) => v.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');

function write(list: StoredStruk[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* penyimpanan penuh / mode privat */ }
}

export function readStruk(): StoredStruk[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list.filter((x) => x && typeof x.code === 'string') : [];
  } catch { return []; }
}

export const findStruk = (code: string) => readStruk().find((x) => x.code === code) ?? null;

export function saveStruk(s: StoredStruk) {
  write([s, ...readStruk().filter((x) => x.code !== s.code)]);
}

export function updateStruk(code: string, patch: Partial<StoredStruk>) {
  let out: StoredStruk | null = null;
  const list = readStruk().map((x) => (x.code === code ? (out = { ...x, ...patch }) : x));
  if (out) write(list);
  return out as StoredStruk | null;
}

export function removeStruk(code: string) {
  write(readStruk().filter((x) => x.code !== code));
}

export function fromInfo(o: OrderInfo): StoredStruk {
  return {
    code: o.code, phone: o.phone, name: o.name, service: o.service, detail: o.detail, extra: o.extra,
    estPrice: o.est_price, finalPrice: o.final_price, promo: o.promo, status: o.order_status, reviewed: o.reviewed,
    createdAt: o.created_at, updatedAt: o.updated_at, checkedAt: Date.now(),
  };
}

/** Ambil status terbaru dari server lalu simpan di perangkat. */
export async function refreshStruk(s: StoredStruk): Promise<StoredStruk> {
  const r = await orderStatus(s.code, s.phone);
  if (r.status !== 'ok') return updateStruk(s.code, { status: 'dihapus', checkedAt: Date.now() }) ?? { ...s, status: 'dihapus' };
  const next = fromInfo(r);
  return updateStruk(s.code, next) ?? next;
}

/** Struk yang statusnya masih mungkin berubah. */
export const needsRefresh = (s: StoredStruk) => s.status !== 'dihapus' && s.status !== 'batal' && !(s.status === 'selesai' && s.reviewed);

/** Kunci idempotensi satu sesi form: klik dua kali / koneksi putus tidak membuat struk ganda. */
export function getOrderRef() {
  try {
    const old = localStorage.getItem(REF_KEY);
    if (old) return old;
    const id = crypto.randomUUID();
    localStorage.setItem(REF_KEY, id);
    return id;
  } catch { return crypto.randomUUID(); }
}
export function resetOrderRef() {
  try { localStorage.removeItem(REF_KEY); } catch { /* abaikan */ }
}

// ---------- tampilan ----------
export const serviceTitle = (id: string) => SERVICES.find((x) => x.id === id)?.title ?? id;

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';

const fmtDay = (v: string) =>
  new Date(v + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Baris rincian pesanan [label, isi]. */
export function detailRows(s: StoredStruk): [string, string][] {
  const e = s.extra ?? {};
  const rows: [string, string][] = [['Nama', s.name], ['Layanan', serviceTitle(s.service)]];
  if (e.course) rows.push(['Mata kuliah', e.course]);
  if (e.lang) rows.push(['Materi', e.lang]);
  if (e.mode) rows.push(['Mode', e.mode]);
  if (e.deadline) rows.push([s.service === 'kelas' ? 'Mulai' : 'Deadline', fmtDay(e.deadline)]);
  if (e.budget) rows.push(['Budget', e.budget]);
  return rows;
}

/** Baris harga [label, isi, tebal?]. */
export function priceRows(s: StoredStruk): [string, string, boolean?][] {
  const rows: [string, string, boolean?][] = [];
  const pr = s.promo && s.promo.discount_type ? (s.promo as PromoRule & { code: string }) : null;
  if (s.estPrice !== null && s.estPrice !== undefined) rows.push(['Perkiraan mulai', rupiah(s.estPrice)]);
  if (pr) rows.push([`Promo ${pr.code}`, promoLabel(pr)]);
  else if (s.promo) rows.push(['Promo', s.promo.code]);
  if (s.finalPrice !== null && s.finalPrice !== undefined) rows.push(['Harga final', rupiah(s.finalPrice), true]);
  else rows.push(['Harga final', s.status === 'batal' ? 'Tidak ada' : 'Menunggu kesepakatan', true]);
  return rows;
}
export { applyPromo };
