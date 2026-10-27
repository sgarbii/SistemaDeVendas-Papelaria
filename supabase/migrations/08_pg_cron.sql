-- =============================================================
-- 08_pg_cron.sql
-- RN02: libera as reservas vencidas a cada minuto.
--
-- Antes de rodar: ative a extensão pg_cron no painel do Supabase
-- (Database > Extensions > pg_cron > Enable). O comando abaixo também
-- tenta ativá-la, caso ainda não esteja ativa.
-- =============================================================

create extension if not exists pg_cron;

-- '* * * * *' = a cada minuto. Rodar de novo com o mesmo nome só atualiza o agendamento.
select cron.schedule(
  'liberar-reservas-vencidas',
  '* * * * *',
  $$ select public.liberar_reservas_vencidas(); $$
);

-- Para conferir:  select * from cron.job;
-- Histórico:      select * from cron.job_run_details order by start_time desc limit 10;
