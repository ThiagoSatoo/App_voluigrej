-- =====================================================================
-- Índices nas chaves estrangeiras que o Supabase apontou sem índice.
-- Deixam mais rápidas as consultas por período e por pessoa (substituições).
-- =====================================================================
create index if not exists attendance_period_id_idx on public.attendance (period_id);
create index if not exists substitutions_in_id_idx on public.substitutions (in_id);
create index if not exists substitutions_out_id_idx on public.substitutions (out_id);
create index if not exists substitutions_period_id_idx on public.substitutions (period_id);
