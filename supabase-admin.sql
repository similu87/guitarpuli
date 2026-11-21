-- 吉他普利 管理者在網站上改難易度、BPM（song_meta）
-- 在 Supabase 的 SQL Editor 貼上整段後按 Run。可以重複執行。
-- 先跑過 supabase-stats.sql（要用到裡面的 stat_is_admin()）。

create table if not exists public.song_meta (
  id         text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  diff       smallint check (diff between 1 and 3),
  bpm        smallint check (bpm between 30 and 260),
  updated_at timestamptz not null default now()
);
alter table public.song_meta enable row level security;

-- 所有人都能讀（網站要套用新的難易度、BPM）
drop policy if exists song_meta_read on public.song_meta;
create policy song_meta_read on public.song_meta for select to anon, authenticated using (true);
grant select on public.song_meta to anon, authenticated;   -- 新的 Supabase 專案不會自動開放讀取，要明確給
revoke insert, update, delete on public.song_meta from anon, authenticated;

-- 只有管理者帳號能寫，透過這個函式
create or replace function public.song_meta_set(p_id text, p_diff smallint default null, p_bpm smallint default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.stat_is_admin() then raise exception '只有管理者帳號可以修改'; end if;
  insert into public.song_meta as m (id, diff, bpm, updated_at)
  values (p_id, p_diff, p_bpm, now())
  on conflict (id) do update set diff = coalesce(excluded.diff, m.diff), bpm = coalesce(excluded.bpm, m.bpm), updated_at = now();
end $$;
revoke all on function public.song_meta_set(text, smallint, smallint) from public, anon;
grant execute on function public.song_meta_set(text, smallint, smallint) to authenticated;

-- ===== 2026-11-21 加：管理者在網站上改曲風、指法、和弦與拍子 =====
-- 存的是「覆寫」：網站載入時用這裡的內容蓋過 songs/ 的原本內容。下次上傳新歌時，Claude 會把這些修改抄回筆記和 songs/，再清掉這裡的覆寫。
alter table public.song_meta add column if not exists genres   jsonb;   -- ["ballad","rnb"]，最多 3 個
alter table public.song_meta add column if not exists shapes   jsonb;   -- [{"c":"G7sus4","capo":0,"f":["353433"]}]
alter table public.song_meta add column if not exists sections jsonb;   -- 整首譜的段落（跟 songs.json 的 sections 同格式）

-- 改一個欄位；p_value 傳 null 就是清掉覆寫、回到原本的內容
create or replace function public.song_meta_put(p_id text, p_field text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.stat_is_admin() then raise exception '只有管理者帳號可以修改'; end if;
  if p_field not in ('genres', 'shapes', 'sections') then raise exception '不能改這個欄位：%', p_field; end if;
  if p_value is not null and pg_column_size(p_value) > 200000 then raise exception '內容太大'; end if;
  insert into public.song_meta (id) values (p_id) on conflict (id) do nothing;
  execute format('update public.song_meta set %I = $1, updated_at = now() where id = $2', p_field) using p_value, p_id;
end $$;
revoke all on function public.song_meta_put(text, text, jsonb) from public, anon;
grant execute on function public.song_meta_put(text, text, jsonb) to authenticated;
