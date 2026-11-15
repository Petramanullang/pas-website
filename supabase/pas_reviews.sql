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
