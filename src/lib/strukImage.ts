// Gambar struk (PNG) digambar langsung di canvas, tanpa library.
import { CONTACT, SITE } from '../config';
import { detailRows, priceRows, fmtDateTime, STATUS_LABEL, type StoredStruk } from './struk';

const W = 720, PAD = 52, SCALE = 2;
const HEAD = "'Urbanist Variable', 'Inter Variable', system-ui, sans-serif";
const BODY = "'Inter Variable', system-ui, sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Consolas, monospace";
const STATUS_COLOR: Record<string, [string, string]> = {
  menunggu: ['#fff3d1', '#8a6400'], dikerjakan: ['#e3ecff', '#2747a8'], selesai: ['#dff5ec', '#0e7a40'],
  batal: ['#eeeae4', '#6b675f'], dihapus: ['#eeeae4', '#6b675f'],
};

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > max && line) { out.push(line); line = word; } else line = test;
    }
    if (line) out.push(line);
  }
  return out;
}

function draw(ctx: CanvasRenderingContext2D | null, s: StoredStruk, measure: CanvasRenderingContext2D) {
  const c = ctx ?? measure;
  let y = PAD + 30;
  const inner = W - PAD * 2 - 40, x0 = PAD + 20, x1 = W - PAD - 20;
  const text = (t: string, x: number, yy: number, font: string, color = '#151515', align: CanvasTextAlign = 'left') => {
    if (!ctx) return;
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(t, x, yy);
  };
  const dash = () => {
    y += 18;
    if (ctx) { ctx.save(); ctx.strokeStyle = '#d9d5cc'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.restore(); }
    y += 30;
  };

  // kepala
  text('PAS', x0, y + 6, `800 34px ${HEAD}`);
  text('Petra All Service', x0 + 76, y, `500 15px ${BODY}`, '#6b675f');
  text(SITE.tagline, x0 + 76, y + 20, `500 13px ${BODY}`, '#9a968d');
  const label = STATUS_LABEL[s.status] ?? s.status;
  c.font = `700 14px ${BODY}`;
  const pw = c.measureText(label).width + 28;
  if (ctx) {
    const [bg, fg] = STATUS_COLOR[s.status] ?? STATUS_COLOR.menunggu;
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x1 - pw, y - 18, pw, 32, 16); ctx.fill();
    text(label, x1 - pw / 2, y + 3, `700 14px ${BODY}`, fg, 'center');
  }
  y += 44;
  dash();
  text('STRUK PESANAN', x0, y, `700 13px ${BODY}`, '#6b675f');
  y += 38;
  text(s.code, x0, y, `800 32px ${MONO}`);
  y += 28;
  text(fmtDateTime(s.createdAt), x0, y, `500 15px ${BODY}`, '#6b675f');
  dash();

  const row = (k: string, v: string, bold = false) => {
    c.font = `${bold ? 700 : 500} ${bold ? 19 : 16}px ${BODY}`;
    const lines = wrap(c, v, inner * 0.62);
    text(k, x0, y, `500 15px ${BODY}`, '#6b675f');
    lines.forEach((l, i) => text(l, x1, y + i * 24, `${bold ? 700 : 600} ${bold ? 19 : 16}px ${bold ? HEAD : BODY}`, '#151515', 'right'));
    y += Math.max(1, lines.length) * 24 + 12;
  };
  detailRows(s).forEach(([k, v]) => row(k, v));
  text('Detail', x0, y, `500 15px ${BODY}`, '#6b675f');
  y += 24;
  c.font = `500 15px ${BODY}`;
  const det = wrap(c, s.detail, inner).slice(0, 8);
  det.forEach((l, i) => text(l, x0, y + i * 22, `500 15px ${BODY}`, '#2b2b2b'));
  y += det.length * 22 - 4;
  dash();
  priceRows(s).forEach(([k, v, b]) => row(k, v, !!b));
  y -= 12;
  dash();
  text(`Cek status: ${SITE.url.replace(/^https?:\/\//, '')}/pesananku`, x0, y, `600 14px ${BODY}`, '#151515');
  text(`WhatsApp ${CONTACT.phoneDisplay}`, x1, y, `600 14px ${BODY}`, '#151515', 'right');
  y += 24;
  text('Simpan struk ini. Kode + nomor WA dipakai untuk membuka status dan menulis ulasan.', x0, y, `500 12.5px ${BODY}`, '#9a968d');
  return y + PAD + 10;
}

export async function strukPng(s: StoredStruk): Promise<Blob> {
  await document.fonts?.ready;
  const measure = document.createElement('canvas').getContext('2d')!;
  const h = draw(null, s, measure);
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE; canvas.height = (h + 24) * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#e8e6e1'; ctx.fillRect(0, 0, W, h + 24);
  // kertas dengan tepi bawah bergerigi
  const top = PAD - 24, bottom = h - PAD + 34, l = PAD - 20, r = W - PAD + 20;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(l + 18, top); ctx.lineTo(r - 18, top); ctx.quadraticCurveTo(r, top, r, top + 18); ctx.lineTo(r, bottom);
  const teeth = 24, tw = (r - l) / teeth;
  for (let i = teeth; i > 0; i--) { ctx.lineTo(l + (i - 0.5) * tw, bottom + 10); ctx.lineTo(l + (i - 1) * tw, bottom); }
  ctx.lineTo(l, top + 18); ctx.quadraticCurveTo(l, top, l + 18, top); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffc83d'; ctx.fillRect(l + 18, top, r - l - 36, 6);
  draw(ctx, s, measure);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat gambar'))), 'image/png'));
}

export async function downloadStrukPng(s: StoredStruk) {
  const blob = await strukPng(s);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `struk-${s.code}.png`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
