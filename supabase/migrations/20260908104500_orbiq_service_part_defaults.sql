-- ===========================================================
-- ORBIQ PLATFORM
-- SERVICOS QUE NORMALMENTE EXIGEM COMPRA DE PECA/MATERIAL
-- ===========================================================

alter table public.service_catalog
    add column if not exists requires_part boolean not null default false;

update public.service_catalog
set requires_part = true
where category = upper(category)
  and description in (
    'TROCA COXIM MOTOR',
    'TROCA BOMBA DE COMBUSTÍVEL',
    'TROCA CORREIA DE ACESSÓRIOS',
    'TROCA BOMBA D''ÁGUA',
    'TROCA VELAS DE IGNIÇÃO',
    'TROCA FILTRO DE COMBUSTÍVEL',
    'TROCA PIVÔ',
    'TROCA AMORTECEDOR',
    'TROCA PASTILHAS DE FREIO',
    'TROCA DISCO DE FREIO',
    'TROCA TERMINAL DE DIREÇÃO',
    'SUBSTITUIR RADIADOR',
    'TROCA DE ÓLEO DO CÂMBIO'
  );

notify pgrst, 'reload schema';
