-- Create vehicles table for Usagers
create table if not exists vehicles (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references users(id) not null,
  license_plate text not null unique,
  make text,
  model text,
  color text,
  created_at timestamptz default now()
);

-- RLS
alter table vehicles enable row level security;

-- Policy for owners
create policy "Users can manage their own vehicles" on vehicles
  for all
  using (auth.uid() = owner_id);

-- Policy for agents/admin to read (for lookup)
create policy "Agents can view all vehicles" on vehicles
  for select
  using (
    exists (
      select 1 from users 
      where users.id = auth.uid() 
      and users.role in ('POLICE_OFFICER', 'ADMIN')
    )
  );
