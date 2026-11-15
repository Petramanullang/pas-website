# PAS, Petra All Service (website)

Website jasa PAS di **petrajm.tech**, dibuat dengan **Astro 7**: statis, tanpa framework UI, dan JavaScript-nya sangat sedikit.
Hasil Lighthouse (mobile): Performance 99, Accessibility 97+, SEO 100.

## Isi website
Urutan menu (juga dipakai untuk arah animasi dan tombol Sebelumnya/Berikutnya):

1. **Beranda** (`/`): satu layar penuh tanpa scroll. Isinya hero dan kartu pintasan ke halaman lain. Footer tidak ditampilkan di sini.
2. **Layanan** (`/layanan`): detail tiap layanan, kelas coding online/offline, dan tabel harga.
3. **Cara Pesan** (`/cara-pesan`): alur 4 langkah bergaya timeline.
4. **Karya** (`/karya`): arsip proyek bergaya laci map. Klik map untuk melihat detail.
5. **Testimoni** (`/testimoni`): rating, sebaran bintang, dan filter per layanan.
6. **FAQ** (`/faq`): pertanyaan per kategori.
7. **Saran** (`/saran`): pengunjung mengirim saran, boleh tanpa nama. Saran hanya bisa dibaca admin.
8. **Pesan** (`/pesan`): form yang diteruskan ke WhatsApp, lengkap dengan kode promo.

Halaman lain:
- **Tulis ulasan** (`/ulasan`)
- **Admin** (`/admin`): Ulasan, Kode, Karya, Promo, dan Saran.

Navigasi:
- **Desktop:** tab pill berikon. Penanda halaman aktif meluncur halus saat berpindah halaman.
- **HP:** bar bawah (Beranda, Layanan, Pesan, Karya) dan tombol **Menu** yang membuka panel berisi semua halaman.
- **Halaman dalam:** header dengan tombol × dan sub-pill, plus tombol Sebelumnya/Berikutnya di bawah.

Perpindahan halaman memakai View Transitions bawaan browser: halaman bergeser maju atau mundur sesuai urutan menu.
Didukung di Chrome, Edge, dan Safari terbaru. Browser lain tetap jalan normal, hanya tanpa animasi.

## Menjalankan di komputer
Butuh **Node.js 22.23.4 atau lebih baru** (syarat Astro 7). Cek dengan `node -v`.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # hasil di folder dist/
npm run preview   # cek hasil build
```

## Mengubah teks, harga, dan kontak
Semuanya ada di **`src/config.ts`**: nomor WA, daftar layanan, harga, langkah order, dan FAQ.
Logo ada di `public/logo.svg`, gambar share (WhatsApp/IG) di `public/og-image.png`.

## Testimoni & kode ulasan (Supabase)
Data disimpan di project Supabase **portfolio**, di tabel berawalan `pas_`, terpisah dari data portofolio.
Kunci yang dipakai website (`.env`) adalah kunci *publishable* yang memang aman dipakai di browser.
Keamanan dijaga oleh RLS dan fungsi database:

- Publik hanya bisa **membaca** ulasan yang tampil. Mereka tidak bisa membaca kode pesanan.
- Ulasan hanya bisa dikirim dengan **kode yang valid dan belum dipakai**. Satu kode berlaku untuk satu ulasan.

### Halaman admin: `petrajm.tech/admin`
Login dengan **akun admin portofolio** (email + password yang sama). Akun lain akan ditolak.
Hak akses diperiksa di database (`is_admin()` + RLS), bukan hanya di browser.

Di dashboard kamu bisa:
- **Buat kode ulasan.** Isi nama klien dan layanan, lalu salin link atau kirim langsung lewat WhatsApp.
- Melihat semua kode beserta statusnya (belum dipakai / sudah dipakai), serta menghapus kode yang belum dipakai.
- Melihat semua ulasan, **menyembunyikan/menampilkan** ulasan, dan menghapus ulasan.
- **Karya:** tambah/edit proyek (judul, kategori Website/UI/UX/Lainnya, tahun, klien, ringkasan, teknologi, link, gambar), atur urutan, sembunyikan, atau hapus. Gambar otomatis dikompres (maks 1600px, WebP) lalu disimpan di bucket `pas-karya`.

### Promo / diskon (tab **Promo** di admin)
Pelanggan memasukkan **kode promo** di halaman Pesan. Website langsung mengecek syaratnya, menampilkan perkiraan harga, dan menuliskan promo di pesan WhatsApp.
Kamu juga bisa membagikan link yang sudah berisi kodenya: `https://petrajm.tech/pesan?promo=KODE`.

Yang bisa diatur untuk tiap promo:
- **Jenis potongan:** persen (bisa diberi batas maksimal potongan), nominal Rp, atau harga spesial.
- **Layanan:** tidak dicentang = berlaku untuk semua layanan.
- **Masa berlaku:** tanggal dan jam mulai serta berakhir (opsional).
- **Kuota pemakaian:** misalnya 10 pemesan pertama. Kosongkan untuk tanpa batas.
- **Khusus 1 orang:** kode personal yang hanya bisa dipakai sekali. Kamu bisa mencatat untuk siapa kode itu dibuat.
- **Aktif / nonaktif** kapan saja.

Pemakaian dicatat saat pelanggan mengirim form. Kalau pesanannya batal, buka "Pemakaian" lalu tekan **Batalkan**, dan kuotanya kembali.
Potongan selalu dihitung dari **harga final** yang kalian sepakati. Angka di website hanya perkiraan dari harga mulai.

### Alternatif tanpa halaman admin: buat kode lewat SQL
Buka Supabase → SQL Editor, lalu jalankan:

```sql
select pas_new_code('Nama Klien', 'Pembuatan Website');
-- hasilnya misalnya: PAS-3F9A1C
```

Kirim link berikut ke klien. Nama dan layanan akan terisi otomatis:

```
https://petrajm.tech/ulasan?kode=PAS-3F9A1C
```

### Menyembunyikan ulasan (misalnya spam atau tidak pantas)
```sql
update pas_reviews set is_visible = false where name = 'Nama';   -- atau pakai id
```
Kamu juga bisa melakukannya lewat Table Editor dengan mengubah kolom `is_visible`.

### Melihat semua kode
```sql
select code, client_name, service, used_at from pas_order_codes order by created_at desc;
```

Skema lengkapnya ada di `supabase/pas_reviews.sql` (sudah diterapkan, file ini hanya arsip).

## Deploy (Vercel / Netlify / Cloudflare Pages)
- Build command: `npm run build`
- Output folder: `dist`
- Environment variables: salin dari `.env.example` (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_KEY`)
- Node version: 22 (minimal 22.23.4)
- Hubungkan domain `petrajm.tech` di pengaturan hosting.
