// Semua teks, harga, dan kontak utama ada di sini, ubah di satu tempat saja.

export const SITE = {
  name: 'PAS',
  fullName: 'Petra All Service',
  tagline: 'Semua urusan, jadi pas.',
  url: 'https://petrajm.tech',
  description:
    'PAS (Petra All Service): bantuan & pendampingan tugas IT dan non-IT, pembuatan website, desain UI/UX, dan kelas coding. Harga ramah mahasiswa, bisa diskusi dulu via WhatsApp.',
  owner: 'Petra',
  ownerNote: 'Dikerjakan langsung oleh Petra, mahasiswa Teknik Informatika.',
};

export const CONTACT = {
  phoneDisplay: '0877-6900-7051',
  waNumber: '6287769007051', // format internasional tanpa "+" dan tanpa "0" di depan
};

export const waLink = (text: string) =>
  `https://wa.me/${CONTACT.waNumber}?text=${encodeURIComponent(text)}`;

export type NavItem = { href: string; label: string; short: string; icon: string; desc: string };

// Urutan ini juga dipakai untuk arah animasi perpindahan halaman & tombol sebelumnya/berikutnya
export const NAV: NavItem[] = [
  { href: '/', label: 'Beranda', short: 'Beranda', icon: 'home', desc: 'Kenalan dengan PAS' },
  { href: '/layanan', label: 'Layanan', short: 'Layanan', icon: 'layers', desc: 'Detail layanan & harga' },
  { href: '/cara-pesan', label: 'Cara Pesan', short: 'Cara pesan', icon: 'route', desc: 'Alur dari tanya sampai selesai' },
  { href: '/karya', label: 'Karya', short: 'Karya', icon: 'folder', desc: 'Arsip proyek yang sudah jadi' },
  { href: '/testimoni', label: 'Testimoni', short: 'Ulasan', icon: 'starline', desc: 'Ulasan pelanggan asli' },
  { href: '/faq', label: 'FAQ', short: 'FAQ', icon: 'help', desc: 'Pertanyaan yang sering ditanya' },
  { href: '/saran', label: 'Saran', short: 'Saran', icon: 'idea', desc: 'Bantu PAS jadi lebih baik' },
  { href: '/pesan', label: 'Pesan', short: 'Pesan', icon: 'send', desc: 'Isi form, lanjut WhatsApp' },
];

// Pilihan cepat di beranda → langsung membuka form pesan dengan layanan terpilih
export const QUICK_NEEDS = [
  { label: 'Laporan praktikum', service: 'tugas' },
  { label: 'Makalah', service: 'tugas' },
  { label: 'Tugas IT', service: 'tugas' },
  { label: 'Tugas non-IT', service: 'tugas' },
  { label: 'Website portofolio', service: 'website' },
  { label: 'Landing page', service: 'website' },
  { label: 'Toko online', service: 'website' },
  { label: 'Desain UI/UX', service: 'uiux' },
  { label: 'Belajar JavaScript', service: 'kelas' },
  { label: 'Belajar Python', service: 'kelas' },
  { label: 'C++ & PHP', service: 'kelas' },
  { label: 'Lainnya', service: 'lainnya' },
];

export const WA_GENERAL = waLink('Halo Kak Petra, saya lihat website PAS dan mau tanya-tanya dulu soal layanannya.');

export type Service = {
  id: string;
  title: string;
  short: string;
  desc: string;
  points: string[];
  price: string;
  priceNote?: string;
  /** harga mulai (angka) untuk estimasi promo; null = fleksibel */
  from: number | null;
  icon: 'doc' | 'web' | 'design' | 'code' | 'chat';
};

export const SERVICES: Service[] = [
  {
    id: 'tugas',
    from: 30000,
    title: 'Bantuan & Pendampingan Tugas',
    short: 'Tugas & laporan',
    desc: 'Laporan praktikum, makalah, dan tugas mata kuliah, baik IT maupun non-IT.',
    points: ['Laporan praktikum & makalah', 'Tugas mata kuliah IT', 'Tugas mata kuliah non-IT'],
    price: 'Laporan mulai Rp30rb',
    priceNote: 'Tugas lain menyesuaikan tingkat kesulitan',
    icon: 'doc',
  },
  {
    id: 'website',
    from: 100000,
    title: 'Pembuatan Website',
    short: 'Website',
    desc: 'Website yang rapi, cepat, dan enak dibuka di HP.',
    points: ['Website portofolio & CV', 'Landing page usaha', 'Website organisasi & toko online'],
    price: 'Mulai Rp100rb',
    icon: 'web',
  },
  {
    id: 'uiux',
    from: 75000,
    title: 'Desain UI/UX',
    short: 'Desain UI/UX',
    desc: 'Desain tampilan aplikasi dan website di Figma, siap dipresentasikan atau dikembangkan.',
    points: ['Desain aplikasi & website', 'Dari wireframe sampai prototype', 'Tampilan rapi & modern'],
    price: 'Mulai Rp75rb',
    icon: 'design',
  },
  {
    id: 'kelas',
    from: 50000,
    title: 'Kelas Coding',
    short: 'Kelas coding',
    desc: 'Belajar dari dasar bareng mentor, tersedia online maupun offline.',
    points: ['JavaScript, TypeScript, Python, C++, PHP', 'Web development', 'Dasar pemrograman'],
    price: 'Online mulai Rp50rb/sesi',
    priceNote: 'Offline mulai Rp80rb/sesi',
    icon: 'code',
  },
  {
    id: 'lainnya',
    from: null,
    title: 'Kebutuhan Lainnya',
    short: 'Lainnya (non-IT)',
    desc: 'Punya kebutuhan di luar daftar ini? Ceritakan dulu, kita diskusikan bareng.',
    points: ['Tugas & kebutuhan non-IT', 'Bisa konsultasi dulu', 'Harga fleksibel'],
    price: 'Harga fleksibel',
    priceNote: 'Sesuai tingkat kesulitan',
    icon: 'chat',
  },
];

export const PRICE_TABLE = [
  { item: 'Laporan praktikum / makalah', price: 'Mulai Rp30rb' },
  { item: 'Tugas mata kuliah IT & non-IT', price: 'Sesuai tingkat kesulitan' },
  { item: 'Website (portofolio, landing page, dll.)', price: 'Mulai Rp100rb' },
  { item: 'Desain UI/UX', price: 'Mulai Rp75rb' },
  { item: 'Kelas coding online', price: 'Mulai Rp50rb / sesi' },
  { item: 'Kelas coding offline', price: 'Mulai Rp80rb / sesi' },
  { item: 'Kebutuhan lain (non-IT)', price: 'Fleksibel, diskusi dulu' },
];

export const LANGUAGES = ['JavaScript', 'TypeScript', 'Python', 'C++', 'PHP', 'Web Development', 'Dasar Pemrograman'];

export const STEPS = [
  { title: 'Pilih layanan', desc: 'Isi form singkat di halaman Pesan. Pesanmu langsung tersusun rapi.' },
  { title: 'Diskusi via WhatsApp', desc: 'Kita bahas detail, harga final, dan deadline sebelum mulai.' },
  { title: 'Dikerjakan', desc: 'Pengerjaan berjalan sesuai yang sudah disepakati bersama.' },
  { title: 'Selesai & beri ulasan', desc: 'Kamu menerima kode ulasan untuk berbagi pengalaman.' },
];

export const FAQ_CATS = ['Pemesanan', 'Harga & promo', 'Kelas coding', 'Ulasan'] as const;

export const FAQ: { q: string; a: string; cat: (typeof FAQ_CATS)[number] }[] = [
  {
    cat: 'Pemesanan',
    q: 'Bagaimana cara memesan?',
    a: 'Buka halaman Pesan, isi form singkat, lalu tekan tombol kirim. WhatsApp akan terbuka dengan pesan yang sudah terisi. Kamu juga bisa langsung chat ke ' +
      CONTACT.phoneDisplay +
      '.',
  },
  {
    cat: 'Pemesanan',
    q: 'Berapa lama pengerjaannya?',
    a: 'Tergantung jenis dan tingkat kesulitan. Perkiraan waktu disampaikan saat diskusi, jadi pastikan kamu menyebutkan deadline-nya.',
  },
  {
    cat: 'Pemesanan',
    q: 'Apakah bisa untuk tugas non-IT?',
    a: 'Bisa. Ceritakan kebutuhanmu lewat form atau WhatsApp, nanti kita diskusikan apakah bisa dibantu dan berapa harganya.',
  },
  {
    cat: 'Pemesanan',
    q: 'Apakah isi form pesanan disimpan?',
    a: 'Tidak. Isi form hanya disusun menjadi pesan WhatsApp di perangkatmu. Yang dicatat hanya pemakaian kode promo (nama dan layanan) jika kamu memakai kode promo.',
  },
  {
    cat: 'Harga & promo',
    q: 'Harga final ditentukan bagaimana?',
    a: 'Harga di website adalah harga mulai. Harga final menyesuaikan tingkat kesulitan dan deadline, dan selalu disepakati dulu sebelum pengerjaan dimulai.',
  },
  {
    cat: 'Harga & promo',
    q: 'Bagaimana cara memakai kode promo?',
    a: 'Masukkan kode di kolom "Kode promo" pada halaman Pesan, lalu tekan Pakai. Website langsung mengecek syaratnya. Potongan dihitung dari harga final yang disepakati.',
  },
  {
    cat: 'Kelas coding',
    q: 'Apa bedanya kelas coding online dan offline?',
    a: 'Kelas online dilakukan lewat panggilan video, sedangkan offline bertatap muka langsung. Jadwal dan lokasi disepakati bersama.',
  },
  {
    cat: 'Kelas coding',
    q: 'Materi apa saja yang bisa dipelajari?',
    a: 'JavaScript, TypeScript, Python, C++, PHP, web development, dan dasar pemrograman. Belum tahu mau mulai dari mana? Pilih "Belum tahu, minta saran" di form.',
  },
  {
    cat: 'Ulasan',
    q: 'Bagaimana cara memberi ulasan?',
    a: 'Setelah pesanan selesai, kamu akan menerima link berisi kode ulasan. Satu kode untuk satu ulasan, supaya semua testimoni berasal dari pelanggan asli.',
  },
];
