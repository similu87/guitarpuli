-- 吉他普利 會員資料表：每位會員一列，存收藏、自建譜、最近瀏覽、移調設定和歌詞。
-- 在 Supabase 的 SQL Editor 貼上整段後按 Run。只需要執行一次。
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 開啟資料列權限：每個人只能讀寫自己的那一列，其他會員和訪客都看不到
alter table public.user_data enable row level security;

create policy "own row: read"   on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "own row: insert" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own row: update" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own row: delete" on public.user_data for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.user_data to authenticated;
