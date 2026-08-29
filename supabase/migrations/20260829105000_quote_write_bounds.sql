-- ===========================================================
-- ORBIQ PLATFORM
-- FASE 2.0S
-- LIMITES DEFENSIVOS DE ESCRITA PARA ORCAMENTOS
-- ===========================================================
--
-- Espelha no PostgreSQL os limites da fronteira Web introduzidos
-- na Fase 2.0R. Os CHECKs são criados como NOT VALID para não
-- bloquear a implantação por causa de dados históricos; mesmo assim,
-- passam a ser aplicados imediatamente a INSERTs e UPDATEs novos.
-- ===========================================================

alter table public.quotes
    drop constraint if exists quotes_mileage_upper_bound;

alter table public.quotes
    add constraint quotes_mileage_upper_bound
    check (
        mileage is null
        or mileage <= 9999999
    ) not valid;

alter table public.quotes
    drop constraint if exists quotes_notes_length_bound;

alter table public.quotes
    add constraint quotes_notes_length_bound
    check (
        notes is null
        or char_length(notes) <= 4000
    ) not valid;

alter table public.quote_services
    drop constraint if exists quote_services_category_length_bound;

alter table public.quote_services
    add constraint quote_services_category_length_bound
    check (
        char_length(btrim(category)) between 1 and 80
    ) not valid;

alter table public.quote_services
    drop constraint if exists quote_services_description_length_bound;

alter table public.quote_services
    add constraint quote_services_description_length_bound
    check (
        char_length(btrim(description)) between 1 and 300
    ) not valid;

alter table public.quote_services
    drop constraint if exists quote_services_labor_amount_upper_bound;

alter table public.quote_services
    add constraint quote_services_labor_amount_upper_bound
    check (
        labor_amount is null
        or labor_amount <= 1000000
    ) not valid;

alter table public.quote_items
    drop constraint if exists quote_items_category_length_bound;

alter table public.quote_items
    add constraint quote_items_category_length_bound
    check (
        char_length(btrim(category)) between 1 and 80
    ) not valid;

alter table public.quote_items
    drop constraint if exists quote_items_description_length_bound;

alter table public.quote_items
    add constraint quote_items_description_length_bound
    check (
        char_length(btrim(description)) between 1 and 300
    ) not valid;

alter table public.quote_items
    drop constraint if exists quote_items_quantity_upper_bound;

alter table public.quote_items
    add constraint quote_items_quantity_upper_bound
    check (
        quantity <= 100000
    ) not valid;

alter table public.quote_items
    drop constraint if exists quote_items_unit_length_bound;

alter table public.quote_items
    add constraint quote_items_unit_length_bound
    check (
        char_length(btrim(unit)) between 1 and 40
    ) not valid;

alter table public.quote_items
    drop constraint if exists quote_items_side_length_bound;

alter table public.quote_items
    add constraint quote_items_side_length_bound
    check (
        side is null
        or char_length(btrim(side)) <= 80
    ) not valid;

alter table public.quote_items
    drop constraint if exists quote_items_specification_length_bound;

alter table public.quote_items
    add constraint quote_items_specification_length_bound
    check (
        specification is null
        or char_length(btrim(specification)) <= 300
    ) not valid;

alter table public.quote_items
    drop constraint if exists quote_items_notes_length_bound;

alter table public.quote_items
    add constraint quote_items_notes_length_bound
    check (
        notes is null
        or char_length(btrim(notes)) <= 500
    ) not valid;

notify pgrst, 'reload schema';
