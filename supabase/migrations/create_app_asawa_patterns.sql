create table app_asawa_patterns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  columns integer not null,
  rows integer not null,
  stroke_weight real not null,
  stroke_color text not null,
  rotation_random real not null default 0,
  position_random real not null default 0,
  random_seed integer not null default 0,
  svg_preview text not null,
  pinned boolean not null default false,
  created_at timestamptz default now() not null
);

alter table app_asawa_patterns enable row level security;

create policy "Users can manage their own asawa patterns"
  on app_asawa_patterns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
