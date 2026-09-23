alter table public.pipeline_stages
  add column is_visible boolean not null default true;
