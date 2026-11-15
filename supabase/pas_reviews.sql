-- PAS (Petra All Service), skema ulasan pelanggan
-- Sudah DITERAPKAN ke project Supabase "portfolio" (ljipeveateprslvwycqi).
-- File ini hanya arsip/cadangan, jalankan ulang hanya jika memindahkan ke project baru.

create table if not exists public.pas_order_codes (
  code        text primary key check (code ~ '^[A-Z0-9-]{4,24}$'),
  client_name text,
  service     text,
  note        text,
  created_at  timestamptz not null default now(),
  used_at     timestamptz
);

create table if not exists public.pas_reviews (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique references public.pas_order_codes(code) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  service     text not null check (char_length(service) between 2 and 60),
  rating      smallint not null check (rating between 1 and 5),
  comment     text not null check (char_length(comment) between 10 and 600),
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists pas_reviews_visible_created_idx on public.pas_reviews (is_visible, created_at desc);

alter table public.pas_order_codes enable row level security;
alter table public.pas_reviews enable row level security;

drop policy if exists "pas_reviews_public_read" on public.pas_reviews;
create policy "pas_reviews_public_read" on public.pas_reviews
  for select to anon, authenticated using (is_visible = true);

revoke all on public.pas_order_codes from anon, authenticated;
revoke insert, update, delete on public.pas_reviews from anon, authenticated;
revoke select on public.pas_reviews from anon, authenticated;
grant select (id, name, service, rating, comment, created_at, is_visible) on public.pas_reviews to anon, authenticated;

create or replace function public.pas_check_code(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.pas_order_codes;
begin
  select * into r from public.pas_order_codes where code = upper(trim(p_code));
  if not found then return json_build_object('status', 'invalid'); end if;
  if r.used_at is not null then return json_build_object('status', 'used'); end if;
  return json_build_object('status', 'ok', 'client_name', r.client_name, 'service', r.service);
end $$;

create or replace function public.pas_submit_review(p_code text, p_name text, p_service text, p_rating int, p_comment text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(p_code)); r public.pas_order_codes;
begin
  select * into r from public.pas_order_codes where code = v_code for update;
  if not found then return json_build_object('status', 'invalid'); end if;
  if r.used_at is not null then return json_build_object('status', 'used'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    return json_build_object('status', 'error', 'message', 'Rating harus 1 sampai 5.'); end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then
    return json_build_object('status', 'error', 'message', 'Nama minimal 2 karakter.'); end if;
  if char_length(trim(coalesce(p_comment, ''))) < 10 then
    return json_build_object('status', 'error', 'message', 'Komentar minimal 10 karakter.'); end if;
  insert into public.pas_reviews (code, name, service, rating, comment)
  values (v_code, left(trim(p_name), 60), left(trim(coalesce(nullif(p_service, ''), r.service, 'Lainnya')), 60),
          p_rating, left(trim(p_comment), 600));
  update public.pas_order_codes set used_at = now() where code = v_code;
  return json_build_object('status', 'ok');
end $$;

revoke all on function public.pas_check_code(text) from public;
revoke all on function public.pas_submit_review(text, text, text, int, text) from public;
grant execute on function public.pas_check_code(text) to anon, authenticated;
grant execute on function public.pas_submit_review(text, text, text, int, text) to anon, authenticated;

-- Hanya untuk Petra (SQL Editor): buat kode ulasan baru
create or replace function public.pas_new_code(p_client_name text default null, p_service text default null, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  loop
    v := 'PAS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.pas_order_codes where code = v);
  end loop;
  insert into public.pas_order_codes (code, client_name, service, note) values (v, p_client_name, p_service, p_note);
  return v;
end $$;
revoke all on function public.pas_new_code(text, text, text) from public, anon, authenticated;

-- ===================== Akses admin (halaman /admin) =====================
-- Memakai akun admin portofolio (tabel admin_users + fungsi is_admin()).
grant select, update, delete on public.pas_order_codes to authenticated;
drop policy if exists "pas_codes_admin_select" on public.pas_order_codes;
create policy "pas_codes_admin_select" on public.pas_order_codes for select to authenticated using (public.is_admin());
drop policy if exists "pas_codes_admin_update" on public.pas_order_codes;
create policy "pas_codes_admin_update" on public.pas_order_codes for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "pas_codes_admin_delete" on public.pas_order_codes;
create policy "pas_codes_admin_delete" on public.pas_order_codes for delete to authenticated using (public.is_admin());

grant select (code) on public.pas_reviews to authenticated;
grant update (is_visible) on public.pas_reviews to authenticated;
grant delete on public.pas_reviews to authenticated;
drop policy if exists "pas_reviews_admin_select" on public.pas_reviews;
create policy "pas_reviews_admin_select" on public.pas_reviews for select to authenticated using (public.is_admin());
drop policy if exists "pas_reviews_admin_update" on public.pas_reviews;
create policy "pas_reviews_admin_update" on public.pas_reviews for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "pas_reviews_admin_delete" on public.pas_reviews;
create policy "pas_reviews_admin_delete" on public.pas_reviews for delete to authenticated using (public.is_admin());

create or replace function public.pas_admin_new_code(p_client_name text default null, p_service text default null, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang boleh membuat kode.' using errcode = '42501';
  end if;
  return public.pas_new_code(nullif(trim(p_client_name), ''), nullif(trim(p_service), ''), nullif(trim(p_note), ''));
end $$;
revoke all on function public.pas_admin_new_code(text, text, text) from public, anon;
grant execute on function public.pas_admin_new_code(text, text, text) to authenticated;

-- ===================== Karya (halaman /karya) =====================
create table if not exists public.pas_projects (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 2 and 80),
  client       text check (char_length(client) <= 80),
  category     text not null default 'Website' check (category in ('Website', 'UI/UX', 'Lainnya')),
  year         smallint check (year between 2015 and 2100),
  summary      text check (char_length(summary) <= 600),
  tech         text[] not null default '{}',
  url          text check (url is null or url ~* '^https?://'),
  image_url    text check (image_url is null or image_url ~* '^https?://'),
  is_published boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.pas_projects enable row level security;
create policy "pas_projects_public_read" on public.pas_projects for select to anon, authenticated using (is_published = true);
create policy "pas_projects_admin_select" on public.pas_projects for select to authenticated using (public.is_admin());
create policy "pas_projects_admin_insert" on public.pas_projects for insert to authenticated with check (public.is_admin());
create policy "pas_projects_admin_update" on public.pas_projects for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pas_projects_admin_delete" on public.pas_projects for delete to authenticated using (public.is_admin());
grant select on public.pas_projects to anon;
grant select, insert, update, delete on public.pas_projects to authenticated;

-- Bucket gambar karya: publik dibaca, hanya admin yang menulis (maks 3 MB, JPG/PNG/WebP)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pas-karya', 'pas-karya', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "pas_karya_admin_select" on storage.objects for select to authenticated using (bucket_id = 'pas-karya' and public.is_admin());
create policy "pas_karya_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'pas-karya' and public.is_admin());
create policy "pas_karya_admin_update" on storage.objects for update to authenticated using (bucket_id = 'pas-karya' and public.is_admin());
create policy "pas_karya_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'pas-karya' and public.is_admin());

-- ===================== Promo / diskon =====================
create table if not exists public.pas_promos (
  code          text primary key check (code ~ '^[A-Z0-9-]{3,24}$'),
  title         text check (char_length(title) <= 80),
  discount_type text not null check (discount_type in ('percent', 'amount', 'fixed_price')),
  value         integer not null check (value > 0),
  max_discount  integer check (max_discount is null or max_discount > 0),
  services      text[] not null default '{}',
  starts_at     timestamptz,
  ends_at       timestamptz,
  quota         integer check (quota is null or quota > 0),
  personal_for  text check (char_length(personal_for) <= 80),
  note          text check (char_length(note) <= 200),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint pas_promos_percent_range check (discount_type <> 'percent' or value between 1 and 100),
  constraint pas_promos_dates check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create table if not exists public.pas_promo_uses (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references public.pas_promos(code) on delete cascade on update cascade,
  name        text,
  service     text,
  status      text not null default 'used' check (status in ('used', 'cancelled')),
  created_at  timestamptz not null default now()
);
create index if not exists pas_promo_uses_code_idx on public.pas_promo_uses (code, status);
alter table public.pas_promos enable row level security;
alter table public.pas_promo_uses enable row level security;
revoke all on public.pas_promos from anon;
revoke all on public.pas_promo_uses from anon;
grant select, insert, update, delete on public.pas_promos to authenticated;
grant select, update, delete on public.pas_promo_uses to authenticated;
create policy "pas_promos_admin_all" on public.pas_promos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pas_promo_uses_admin_select" on public.pas_promo_uses for select to authenticated using (public.is_admin());
create policy "pas_promo_uses_admin_update" on public.pas_promo_uses for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pas_promo_uses_admin_delete" on public.pas_promo_uses for delete to authenticated using (public.is_admin());

create or replace function public.pas_promo_eval(r public.pas_promos, p_service text)
returns text language plpgsql stable set search_path = public as $$
declare used int;
begin
  if not r.is_active then return 'inactive'; end if;
  if r.starts_at is not null and now() < r.starts_at then return 'not_started'; end if;
  if r.ends_at is not null and now() > r.ends_at then return 'expired'; end if;
  if coalesce(array_length(r.services, 1), 0) > 0 and (p_service is null or not (p_service = any (r.services))) then return 'service'; end if;
  if r.quota is not null then
    select count(*) into used from public.pas_promo_uses u where u.code = r.code and u.status = 'used';
    if used >= r.quota then return 'quota'; end if;
  end if;
  return 'ok';
end $$;

create or replace function public.pas_check_promo(p_code text, p_service text default null)
returns json language plpgsql security definer set search_path = public as $$
declare r public.pas_promos; st text;
begin
  select * into r from public.pas_promos where code = upper(trim(p_code));
  if not found then return json_build_object('status', 'invalid'); end if;
  st := public.pas_promo_eval(r, nullif(trim(p_service), ''));
  if st in ('inactive') then return json_build_object('status', 'invalid'); end if;
  return json_build_object('status', st, 'code', r.code, 'title', r.title, 'discount_type', r.discount_type, 'value', r.value,
    'max_discount', r.max_discount, 'services', r.services, 'starts_at', r.starts_at, 'ends_at', r.ends_at, 'personal', r.personal_for is not null);
end $$;

create or replace function public.pas_use_promo(p_code text, p_service text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.pas_promos; st text; v_id uuid;
begin
  select * into r from public.pas_promos where code = upper(trim(p_code)) for update;
  if not found or not r.is_active then return json_build_object('status', 'invalid'); end if;
  st := public.pas_promo_eval(r, nullif(trim(p_service), ''));
  if st <> 'ok' then return json_build_object('status', st); end if;
  insert into public.pas_promo_uses (code, name, service)
  values (r.code, left(nullif(trim(p_name), ''), 60), left(nullif(trim(p_service), ''), 40)) returning id into v_id;
  return json_build_object('status', 'ok', 'use_id', v_id);
end $$;

revoke all on function public.pas_promo_eval(public.pas_promos, text) from public, anon, authenticated;
revoke all on function public.pas_check_promo(text, text) from public;
revoke all on function public.pas_use_promo(text, text, text) from public;
grant execute on function public.pas_check_promo(text, text) to anon, authenticated;
grant execute on function public.pas_use_promo(text, text, text) to anon, authenticated;

-- ===================== Saran (halaman /saran) =====================
create table if not exists public.pas_feedback (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('Tampilan', 'Kemudahan', 'Layanan', 'Harga', 'Lainnya')),
  ease       smallint check (ease between 1 and 5),
  message    text not null check (char_length(message) between 5 and 1000),
  name       text check (char_length(name) <= 60),
  contact    text check (char_length(contact) <= 80),
  page       text check (char_length(page) <= 80),
  status     text not null default 'baru' check (status in ('baru', 'dibaca', 'selesai')),
  created_at timestamptz not null default now()
);
alter table public.pas_feedback enable row level security;
revoke all on public.pas_feedback from anon;
grant select, update, delete on public.pas_feedback to authenticated;
create policy "pas_feedback_admin_select" on public.pas_feedback for select to authenticated using (public.is_admin());
create policy "pas_feedback_admin_update" on public.pas_feedback for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pas_feedback_admin_delete" on public.pas_feedback for delete to authenticated using (public.is_admin());
-- Kirim saran: rpc/pas_submit_feedback(p_category, p_ease, p_message, p_name, p_contact, p_page)
-- (validasi kategori & panjang pesan, maksimal 30 kiriman per 10 menit). Lihat migrasi "pas_feedback_init".

-- =====================================================================
-- Kondisi promo tambahan (November 2026): hari, jam WIB, batas per nomor WA, mode kelas.
-- Menggantikan pas_promo_eval / pas_check_promo / pas_use_promo di atas.
-- =====================================================================
alter table public.pas_promos
  add column if not exists days smallint[] not null default '{}',          -- 1 = Senin ... 7 = Minggu, kosong = semua hari
  add column if not exists time_start time,                                -- jam mulai berlaku (WIB), null = sepanjang hari
  add column if not exists time_end time,
  add column if not exists per_person_limit integer check (per_person_limit is null or per_person_limit > 0),
  add column if not exists class_mode text check (class_mode is null or class_mode in ('Online', 'Offline'));

alter table public.pas_promos drop constraint if exists pas_promos_days_valid;
alter table public.pas_promos add constraint pas_promos_days_valid check (days <@ array[1,2,3,4,5,6,7]::smallint[]);
alter table public.pas_promos drop constraint if exists pas_promos_time_pair;
alter table public.pas_promos add constraint pas_promos_time_pair check ((time_start is null) = (time_end is null) and (time_start is null or time_start <> time_end));

alter table public.pas_promo_uses add column if not exists phone text check (phone is null or phone ~ '^[0-9]{9,15}$');
alter table public.pas_promo_uses add column if not exists class_mode text;
create index if not exists pas_promo_uses_phone_idx on public.pas_promo_uses (code, phone) where status = 'used';

-- Normalisasi nomor WA: 0812... / +62812... / 62 812... -> 62812...
create or replace function public.pas_norm_phone(p text)
returns text language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d = '' then return null; end if;
  if left(d, 1) = '0' then d := '62' || substr(d, 2); end if;
  if left(d, 1) = '8' then d := '62' || d; end if;
  if d !~ '^[0-9]{9,15}$' then return null; end if;
  return d;
end $$;

drop function if exists public.pas_check_promo(text, text);
drop function if exists public.pas_use_promo(text, text, text);
drop function if exists public.pas_promo_eval(public.pas_promos, text);

create or replace function public.pas_promo_eval(r public.pas_promos, p_service text, p_mode text)
returns text language plpgsql stable set search_path = public as $$
declare used int; jkt timestamp := now() at time zone 'Asia/Jakarta'; t time := jkt::time;
begin
  if not r.is_active then return 'inactive'; end if;
  if r.starts_at is not null and now() < r.starts_at then return 'not_started'; end if;
  if r.ends_at is not null and now() > r.ends_at then return 'expired'; end if;
  if coalesce(array_length(r.services, 1), 0) > 0 and (p_service is null or not (p_service = any (r.services))) then return 'service'; end if;
  if r.class_mode is not null and p_service = 'kelas' and coalesce(p_mode, '') <> r.class_mode then return 'mode'; end if;
  if coalesce(array_length(r.days, 1), 0) > 0 and not (extract(isodow from jkt)::smallint = any (r.days)) then return 'day'; end if;
  if r.time_start is not null then
    if r.time_start < r.time_end then
      if not (t >= r.time_start and t < r.time_end) then return 'time'; end if;
    else
      if not (t >= r.time_start or t < r.time_end) then return 'time'; end if;
    end if;
  end if;
  if r.quota is not null then
    select count(*) into used from public.pas_promo_uses u where u.code = r.code and u.status = 'used';
    if used >= r.quota then return 'quota'; end if;
  end if;
  return 'ok';
end $$;

create or replace function public.pas_check_promo(p_code text, p_service text default null, p_mode text default null)
returns json language plpgsql security definer set search_path = public as $$
declare r public.pas_promos; st text;
begin
  select * into r from public.pas_promos where code = upper(trim(p_code));
  if not found then return json_build_object('status', 'invalid'); end if;
  st := public.pas_promo_eval(r, nullif(trim(p_service), ''), nullif(trim(p_mode), ''));
  if st = 'inactive' then return json_build_object('status', 'invalid'); end if;
  return json_build_object(
    'status', st, 'code', r.code, 'title', r.title, 'discount_type', r.discount_type, 'value', r.value,
    'max_discount', r.max_discount, 'services', r.services, 'starts_at', r.starts_at, 'ends_at', r.ends_at,
    'personal', r.personal_for is not null, 'days', r.days,
    'time_start', to_char(r.time_start, 'HH24:MI'), 'time_end', to_char(r.time_end, 'HH24:MI'),
    'per_person_limit', r.per_person_limit, 'class_mode', r.class_mode
  );
end $$;

create or replace function public.pas_use_promo(p_code text, p_service text, p_name text, p_mode text default null, p_phone text default null)
returns json language plpgsql security definer set search_path = public as $$
declare r public.pas_promos; st text; v_id uuid; ph text := public.pas_norm_phone(p_phone); mine int;
begin
  select * into r from public.pas_promos where code = upper(trim(p_code)) for update;
  if not found or not r.is_active then return json_build_object('status', 'invalid'); end if;
  st := public.pas_promo_eval(r, nullif(trim(p_service), ''), nullif(trim(p_mode), ''));
  if st <> 'ok' then return json_build_object('status', st); end if;
  if r.per_person_limit is not null then
    if ph is null then return json_build_object('status', 'need_phone'); end if;
    select count(*) into mine from public.pas_promo_uses u where u.code = r.code and u.status = 'used' and u.phone = ph;
    if mine >= r.per_person_limit then return json_build_object('status', 'person_limit'); end if;
  end if;
  insert into public.pas_promo_uses (code, name, service, phone, class_mode)
  values (r.code, left(nullif(trim(p_name), ''), 60), left(nullif(trim(p_service), ''), 40), ph, nullif(trim(p_mode), ''))
  returning id into v_id;
  return json_build_object('status', 'ok', 'use_id', v_id);
end $$;

revoke all on function public.pas_promo_eval(public.pas_promos, text, text) from public, anon, authenticated;
revoke all on function public.pas_norm_phone(text) from public, anon, authenticated;
revoke all on function public.pas_check_promo(text, text, text) from public;
revoke all on function public.pas_use_promo(text, text, text, text, text) from public;
grant execute on function public.pas_check_promo(text, text, text) to anon, authenticated;
grant execute on function public.pas_use_promo(text, text, text, text, text) to anon, authenticated;

-- =====================================================================
-- Struk pesanan & ulasan dari pembeli (November 2026)
-- Form Pesan mencatat pesanan + membuat struk (kode PAS-YYMMDD-XXXXXX).
-- Struk dibuka dengan kode + nomor WA yang sama. Ulasan dari struk hanya bisa
-- ditulis setelah admin menandai pesanan Selesai, 1 struk = 1 ulasan.
-- Semua ulasan baru ditahan sampai disetujui admin.
-- =====================================================================
create table if not exists public.pas_orders (
  code text primary key,
  client_ref text unique,
  phone text not null check (phone ~ '^[0-9]{9,15}$'),
  name text not null check (char_length(name) between 2 and 60),
  service text not null check (service in ('tugas','website','uiux','kelas','lainnya')),
  detail text not null check (char_length(detail) between 10 and 800),
  extra jsonb not null default '{}'::jsonb,
  est_price integer check (est_price is null or est_price >= 0),
  promo_code text,
  final_price integer check (final_price is null or final_price >= 0),
  status text not null default 'menunggu' check (status in ('menunggu','dikerjakan','selesai','batal')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  reviewed_at timestamptz
);
create index if not exists pas_orders_phone_idx on public.pas_orders (phone, created_at desc);
create index if not exists pas_orders_created_idx on public.pas_orders (created_at desc);

alter table public.pas_orders enable row level security;
revoke all on public.pas_orders from anon, authenticated;
grant select, update, delete on public.pas_orders to authenticated;
drop policy if exists pas_orders_admin_select on public.pas_orders;
drop policy if exists pas_orders_admin_update on public.pas_orders;
drop policy if exists pas_orders_admin_delete on public.pas_orders;
create policy pas_orders_admin_select on public.pas_orders for select to authenticated using (public.is_admin());
create policy pas_orders_admin_update on public.pas_orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pas_orders_admin_delete on public.pas_orders for delete to authenticated using (public.is_admin());

-- updated_at / finished_at otomatis
create or replace function public.pas_orders_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if new.status = 'selesai' and old.status is distinct from 'selesai' then new.finished_at := now(); end if;
  if new.status <> 'selesai' then new.finished_at := null; end if;
  return new;
end $$;
drop trigger if exists pas_orders_touch on public.pas_orders;
create trigger pas_orders_touch before update on public.pas_orders for each row execute function public.pas_orders_touch();

-- Ulasan: sumber (kode manual / struk), tautan ke struk, persetujuan admin
alter table public.pas_reviews
  add column if not exists source text not null default 'kode' check (source in ('kode','struk')),
  add column if not exists order_code text unique references public.pas_orders(code) on delete set null,
  add column if not exists approved_at timestamptz;
update public.pas_reviews set approved_at = created_at where approved_at is null; -- ulasan lama dianggap sudah ditinjau
alter table public.pas_reviews alter column is_visible set default false;
alter table public.pas_reviews alter column code drop not null; -- ulasan dari struk tidak punya kode manual

alter table public.pas_promo_uses add column if not exists order_code text references public.pas_orders(code) on delete set null;

-- ---------- izin: cabut yang tidak dipakai ----------
revoke all on public.pas_reviews, public.pas_order_codes, public.pas_projects, public.pas_promos,
  public.pas_promo_uses, public.pas_feedback, public.pas_orders from anon;
revoke truncate, references, trigger on public.pas_reviews, public.pas_order_codes, public.pas_projects, public.pas_promos,
  public.pas_promo_uses, public.pas_feedback, public.pas_orders from authenticated;
grant select (id, name, service, rating, comment, is_visible, created_at, source) on public.pas_reviews to anon;
grant select (id, title, client, category, year, summary, tech, url, image_url, sort_order, is_published, created_at) on public.pas_projects to anon;

-- ---------- helper ----------
create or replace function public.pas_service_title(p text)
returns text language sql immutable set search_path = public as $$
  select case p when 'tugas' then 'Bantuan & Pendampingan Tugas' when 'website' then 'Pembuatan Website'
    when 'uiux' then 'Desain UI/UX' when 'kelas' then 'Kelas Coding' when 'lainnya' then 'Kebutuhan Lainnya' else 'Lainnya' end
$$;

create or replace function public.pas_new_order_code()
returns text language plpgsql volatile set search_path = public as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; h text; s text := ''; i int;
begin
  h := replace(gen_random_uuid()::text, '-', '');
  for i in 0..5 loop
    s := s || substr(a, (('x' || substr(h, i * 2 + 1, 2))::bit(8)::int % 32) + 1, 1);
  end loop;
  return 'PAS-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' || s;
end $$;

-- ---------- buat pesanan (dipanggil form Pesan) ----------
create or replace function public.pas_create_order(
  p_name text, p_phone text, p_service text, p_detail text, p_extra jsonb default '{}'::jsonb,
  p_est_price integer default null, p_promo text default null, p_client_ref text default null
) returns json language plpgsql security definer set search_path = public as $$
declare ph text := public.pas_norm_phone(p_phone); v_code text; r public.pas_orders; pr json; n int;
        v_mode text := nullif(trim(coalesce(p_extra->>'mode', '')), ''); v_promo text := nullif(upper(trim(coalesce(p_promo, ''))), '');
begin
  if p_client_ref is not null then
    select * into r from public.pas_orders where client_ref = left(p_client_ref, 64);
    if found then return json_build_object('status', 'ok', 'code', r.code, 'created_at', r.created_at, 'duplicated', true); end if;
  end if;
  if ph is null then return json_build_object('status', 'error', 'message', 'Nomor WhatsApp tidak valid.'); end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then return json_build_object('status', 'error', 'message', 'Nama minimal 2 karakter.'); end if;
  if p_service not in ('tugas','website','uiux','kelas','lainnya') then return json_build_object('status', 'error', 'message', 'Layanan tidak dikenal.'); end if;
  if char_length(trim(coalesce(p_detail, ''))) < 10 then return json_build_object('status', 'error', 'message', 'Detail minimal 10 karakter.'); end if;
  if jsonb_typeof(coalesce(p_extra, '{}'::jsonb)) <> 'object' or length(p_extra::text) > 1000 then
    return json_build_object('status', 'error', 'message', 'Data tambahan tidak valid.');
  end if;

  -- batas kiriman: 5 struk per nomor per jam, 40 struk per 10 menit untuk semua
  select count(*) into n from public.pas_orders where phone = ph and created_at > now() - interval '1 hour';
  if n >= 5 then return json_build_object('status', 'rate_limit'); end if;
  select count(*) into n from public.pas_orders where created_at > now() - interval '10 minutes';
  if n >= 40 then return json_build_object('status', 'busy'); end if;

  if v_promo is not null then
    pr := public.pas_use_promo(v_promo, p_service, p_name, v_mode, ph);
    if pr->>'status' <> 'ok' then return json_build_object('status', 'promo', 'promo_status', pr->>'status'); end if;
  end if;

  loop
    v_code := public.pas_new_order_code();
    exit when not exists (select 1 from public.pas_orders where code = v_code);
  end loop;

  insert into public.pas_orders (code, client_ref, phone, name, service, detail, extra, est_price, promo_code)
  values (v_code, left(p_client_ref, 64), ph, left(trim(p_name), 60), p_service, left(trim(p_detail), 800),
          coalesce(p_extra, '{}'::jsonb), case when p_est_price between 0 and 100000000 then p_est_price end, v_promo)
  returning * into r;

  if pr is not null then
    update public.pas_promo_uses set order_code = r.code where id = (pr->>'use_id')::uuid;
  end if;
  return json_build_object('status', 'ok', 'code', r.code, 'created_at', r.created_at);
end $$;

-- ---------- buka struk (kode + nomor WA) ----------
create or replace function public.pas_order_status(p_code text, p_phone text)
returns json language plpgsql stable security definer set search_path = public as $$
declare r public.pas_orders; p public.pas_promos; ph text := public.pas_norm_phone(p_phone);
begin
  select * into r from public.pas_orders where code = upper(trim(coalesce(p_code, ''))) and phone = ph;
  if not found then return json_build_object('status', 'not_found'); end if;
  if r.promo_code is not null then select * into p from public.pas_promos where code = r.promo_code; end if;
  return json_build_object(
    'status', 'ok', 'code', r.code, 'name', r.name, 'phone', r.phone, 'service', r.service, 'detail', r.detail, 'extra', r.extra,
    'est_price', r.est_price, 'final_price', r.final_price, 'order_status', r.status,
    'created_at', r.created_at, 'updated_at', r.updated_at, 'finished_at', r.finished_at, 'reviewed', r.reviewed_at is not null,
    'promo', case when r.promo_code is null then null else json_build_object(
      'code', r.promo_code, 'discount_type', p.discount_type, 'value', p.value, 'max_discount', p.max_discount) end
  );
end $$;

-- ---------- ulasan dari struk ----------
create or replace function public.pas_submit_order_review(p_code text, p_phone text, p_name text, p_rating integer, p_comment text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.pas_orders; ph text := public.pas_norm_phone(p_phone);
begin
  select * into r from public.pas_orders where code = upper(trim(coalesce(p_code, ''))) and phone = ph for update;
  if not found then return json_build_object('status', 'not_found'); end if;
  if r.status <> 'selesai' then return json_build_object('status', 'not_finished'); end if;
  if r.reviewed_at is not null then return json_build_object('status', 'used'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return json_build_object('status', 'error', 'message', 'Rating harus 1 sampai 5.'); end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then return json_build_object('status', 'error', 'message', 'Nama minimal 2 karakter.'); end if;
  if char_length(trim(coalesce(p_comment, ''))) < 10 then return json_build_object('status', 'error', 'message', 'Komentar minimal 10 karakter.'); end if;
  insert into public.pas_reviews (code, name, service, rating, comment, is_visible, source, order_code)
  values (null, left(trim(p_name), 60), public.pas_service_title(r.service), p_rating, left(trim(p_comment), 600), false, 'struk', r.code);
  update public.pas_orders set reviewed_at = now() where code = r.code;
  return json_build_object('status', 'ok');
end $$;

-- Ulasan lewat kode manual juga ditahan dulu
create or replace function public.pas_submit_review(p_code text, p_name text, p_service text, p_rating integer, p_comment text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text := upper(trim(p_code)); r public.pas_order_codes;
begin
  select * into r from public.pas_order_codes where code = v_code for update;
  if not found then return json_build_object('status', 'invalid'); end if;
  if r.used_at is not null then return json_build_object('status', 'used'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return json_build_object('status', 'error', 'message', 'Rating harus 1 sampai 5.'); end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then return json_build_object('status', 'error', 'message', 'Nama minimal 2 karakter.'); end if;
  if char_length(trim(coalesce(p_comment, ''))) < 10 then return json_build_object('status', 'error', 'message', 'Komentar minimal 10 karakter.'); end if;
  insert into public.pas_reviews (code, name, service, rating, comment, is_visible, source)
  values (v_code, left(trim(p_name), 60), left(trim(coalesce(nullif(p_service, ''), r.service, 'Lainnya')), 60),
          p_rating, left(trim(p_comment), 600), false, 'kode');
  update public.pas_order_codes set used_at = now() where code = v_code;
  return json_build_object('status', 'ok');
end $$;

revoke all on function public.pas_service_title(text) from public, anon, authenticated;
revoke all on function public.pas_new_order_code() from public, anon, authenticated;
revoke all on function public.pas_orders_touch() from public, anon, authenticated;
revoke all on function public.pas_create_order(text, text, text, text, jsonb, integer, text, text) from public;
revoke all on function public.pas_order_status(text, text) from public;
revoke all on function public.pas_submit_order_review(text, text, text, integer, text) from public;
grant execute on function public.pas_create_order(text, text, text, text, jsonb, integer, text, text) to anon, authenticated;
grant execute on function public.pas_order_status(text, text) to anon, authenticated;
grant execute on function public.pas_submit_order_review(text, text, text, integer, text) to anon, authenticated;

-- Izin admin untuk kolom ulasan baru (izin pas_reviews diberikan per kolom)
grant select (source, order_code, approved_at) on public.pas_reviews to authenticated;
grant update (approved_at) on public.pas_reviews to authenticated;
