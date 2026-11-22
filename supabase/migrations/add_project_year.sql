alter table public.projects
  add column if not exists project_year integer
  check (project_year between 1000 and 9999);
