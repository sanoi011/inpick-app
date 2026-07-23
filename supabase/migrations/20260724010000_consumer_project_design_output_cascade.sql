-- A deleted consumer project must not leave Step 2 images that can be restored
-- into a future workflow session.

-- Clean legacy orphans first. These rows were created before design_outputs had
-- an authoritative consumer_projects foreign key.
delete from public.design_outputs as output
where not exists (
  select 1
  from public.consumer_projects as project
  where project.id = output.project_id
    and project.user_id = output.user_id
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'design_outputs_consumer_project_fk'
      and conrelid = 'public.design_outputs'::regclass
  ) then
    alter table public.design_outputs
      add constraint design_outputs_consumer_project_fk
      foreign key (project_id)
      references public.consumer_projects(id)
      on delete cascade;
  end if;
end
$$;

comment on constraint design_outputs_consumer_project_fk on public.design_outputs is
  'Hard project deletion cascades Step 2 evidence; prevents deleted designs from being restored.';
