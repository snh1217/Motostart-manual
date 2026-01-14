-- Cases table extensions for diagnosis linkage
alter table public.cases add column if not exists category text;
alter table public.cases add column if not exists "symptomTitle" text;
alter table public.cases add column if not exists title text;
alter table public.cases add column if not exists description text;
alter table public.cases add column if not exists "fixSteps" text;
alter table public.cases add column if not exists "diagnosisTreeId" text;
alter table public.cases add column if not exists "diagnosisResultId" text;
alter table public.cases add column if not exists "references" text;

create index if not exists cases_model_diagnosis_idx
  on public.cases (model, "diagnosisTreeId", "diagnosisResultId");
