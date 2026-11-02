-- 吉他普利 網站數據：到訪、熱門歌曲、熱門搜尋、會員人數。
-- 在 Supabase 的 SQL Editor 貼上整段後按 Run。可以重複執行。
-- 計數一天一個項目一列（台灣時間），不記錄任何個人資料。

create table if not exists public.stat_daily (
  day  date    not null,
  kind text    not null check (kind in ('view', 'visitor', 'song', 'search')),
  key  text    not null default '',
  n    integer not null default 0,
  primary key (day, kind, key)
);
-- 開啟資料列權限但不開任何規則：訪客不能直接讀寫這張表，只能透過下面的函式
alter table public.stat_daily enable row level security;
revoke all on public.stat_daily from anon, authenticated;

-- 只有這些 Email 登入的帳號能看完整數據
create or replace function public.stat_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'email', '') in ('similu87@gmail.com', 'pulipapa5986@gmail.com');
$$;

-- 記一筆：view 每次開頁、visitor 每個瀏覽器每天一次、song 歌曲代稱、search 搜尋字
create or replace function public.stat_hit(p_kind text, p_key text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  k text := lower(regexp_replace(btrim(coalesce(p_key, '')), '\s+', ' ', 'g'));
begin
  if p_kind = 'song' then
    if k !~ '^[a-z0-9-]{1,80}$' then return; end if;
  elsif p_kind = 'search' then
    k := left(k, 30);
    if k = '' then return; end if;
  elsif p_kind in ('view', 'visitor') then
    k := '';
  else
    return;
  end if;
  insert into public.stat_daily as s (day, kind, key, n)
  values ((now() at time zone 'Asia/Taipei')::date, p_kind, k, 1)
  on conflict (day, kind, key) do update set n = s.n + 1;
end $$;

-- 公開數據：p_terms 是網站上每首歌的歌名、歌手（小寫），熱門搜尋只回傳對得上歌、且被搜尋至少 3 次的字
create or replace function public.stat_public(p_terms text[] default '{}')
returns json language sql stable security definer set search_path = public, auth as $$
  with today as (select (now() at time zone 'Asia/Taipei')::date as d)
  select json_build_object(
    'today_views',    (select coalesce(sum(n), 0) from stat_daily, today where kind = 'view' and day = today.d),
    'total_views',    (select coalesce(sum(n), 0) from stat_daily where kind = 'view'),
    'today_visitors', (select coalesce(sum(n), 0) from stat_daily, today where kind = 'visitor' and day = today.d),
    'members',        (select count(*) from auth.users),
    'songs_week',  (select coalesce(json_agg(x), '[]') from (
        select key, sum(n)::int as n from stat_daily, today where kind = 'song' and day > today.d - 7
        group by key order by n desc, key limit 10) x),
    'songs_month', (select coalesce(json_agg(x), '[]') from (
        select key, sum(n)::int as n from stat_daily, today where kind = 'song' and day > today.d - 30
        group by key order by n desc, key limit 10) x),
    'search_week', (select coalesce(json_agg(x), '[]') from (
        select key, sum(n)::int as n from stat_daily, today where kind = 'search' and day > today.d - 7
        and exists (select 1 from unnest(p_terms) t where t <> '' and (position(key in t) > 0 or position(t in key) > 0))
        group by key having sum(n) >= 3 order by n desc, key limit 10) x)
  );
$$;

-- 完整數據（只有管理者）：最近 p_days 天每天的瀏覽／訪客、全部歌曲點閱、全部搜尋字
create or replace function public.stat_admin(p_days integer default 30)
returns json language plpgsql stable security definer set search_path = public, auth as $$
declare d0 date := (now() at time zone 'Asia/Taipei')::date - greatest(1, least(p_days, 366)) + 1;
begin
  if not public.stat_is_admin() then raise exception 'not allowed'; end if;
  return json_build_object(
    'members', (select count(*) from auth.users),
    'daily', (select coalesce(json_agg(x order by x.day desc), '[]') from (
        select day, sum(n) filter (where kind = 'view')::int as views, sum(n) filter (where kind = 'visitor')::int as visitors
        from stat_daily where day >= d0 and kind in ('view', 'visitor') group by day) x),
    'songs', (select coalesce(json_agg(x), '[]') from (
        select key, sum(n)::int as n from stat_daily where kind = 'song' and day >= d0 group by key order by n desc, key) x),
    'searches', (select coalesce(json_agg(x), '[]') from (
        select key, sum(n)::int as n from stat_daily where kind = 'search' and day >= d0 group by key order by n desc, key limit 500) x)
  );
end $$;

revoke all on function public.stat_hit(text, text), public.stat_public(text[]), public.stat_admin(integer), public.stat_is_admin() from public;
grant execute on function public.stat_hit(text, text), public.stat_public(text[]) to anon, authenticated;
grant execute on function public.stat_admin(integer), public.stat_is_admin() to authenticated;
