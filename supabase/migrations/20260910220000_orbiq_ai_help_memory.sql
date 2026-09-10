-- ===========================================================
-- ORBIQ PLATFORM
-- Memória org-scoped do assistente de ajuda in-app
-- ===========================================================

create table if not exists
public.ai_help_memories (
    id uuid
        primary key
        default gen_random_uuid(),
    organization_id uuid
        not null
        references public.organizations (id)
        on delete cascade,
    question_normalized text
        not null,
    question_text text
        not null,
    answer_text text
        not null,
    source text
        not null,
    hit_count integer
        not null
        default 1,
    created_by uuid
        references auth.users (id)
        on delete set null,
    created_at timestamptz
        not null
        default now(),
    last_hit_at timestamptz
        not null
        default now(),
    constraint ai_help_memories_question_normalized_check
        check (
            char_length(question_normalized) between 1 and 500
            and question_normalized = lower(question_normalized)
            and question_normalized !~ '[\r\n]'
        ),
    constraint ai_help_memories_question_text_check
        check (
            char_length(question_text) between 1 and 1000
            and question_text !~ E'[\\x00]'
        ),
    constraint ai_help_memories_answer_text_check
        check (
            char_length(answer_text) between 1 and 8000
            and answer_text !~ E'[\\x00]'
        ),
    constraint ai_help_memories_source_check
        check (
            source in ('faq', 'llm', 'memory')
        ),
    constraint ai_help_memories_hit_count_check
        check (hit_count >= 1)
);


create unique index if not exists
ai_help_memories_org_question_unique
on public.ai_help_memories (
    organization_id,
    question_normalized
);


create index if not exists
ai_help_memories_org_last_hit_idx
on public.ai_help_memories (
    organization_id,
    last_hit_at desc
);


alter table
public.ai_help_memories
enable row level security;


drop policy if exists
ai_help_memories_select_member
on public.ai_help_memories;


create policy
ai_help_memories_select_member
on public.ai_help_memories
for select
to authenticated
using (
    public.is_org_member(organization_id)
);


drop policy if exists
ai_help_memories_insert_member
on public.ai_help_memories;


create policy
ai_help_memories_insert_member
on public.ai_help_memories
for insert
to authenticated
with check (
    public.is_org_member(organization_id)
    and (
        created_by is null
        or created_by = (select auth.uid())
    )
);


drop policy if exists
ai_help_memories_update_member
on public.ai_help_memories;


create policy
ai_help_memories_update_member
on public.ai_help_memories
for update
to authenticated
using (
    public.is_org_member(organization_id)
)
with check (
    public.is_org_member(organization_id)
);


revoke all
on table public.ai_help_memories
from anon;


revoke delete
on table public.ai_help_memories
from authenticated;


grant select, insert, update
on table public.ai_help_memories
to authenticated;


-- ===========================================================
-- Lookup + gravação com rate limit leve e normalização
-- ===========================================================

drop function if exists
public.lookup_ai_help_memory(
    uuid,
    text
);


create or replace function
public.lookup_ai_help_memory(
    target_org_id uuid,
    target_question_normalized text
)
returns table (
    memory_id uuid,
    answer_text text,
    source text,
    hit_count integer
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
    clean_question text;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception
            'Authentication required'
            using errcode = '42501';
    end if;

    if not public.is_org_member(target_org_id) then
        raise exception
            'A oficina informada não pertence ao usuário autenticado.'
            using errcode = '42501';
    end if;

    clean_question := lower(trim(coalesce(target_question_normalized, '')));

    if
        char_length(clean_question) < 1
        or char_length(clean_question) > 500
        or clean_question ~ '[\r\n]'
    then
        raise exception
            'Pergunta inválida para memória de ajuda.'
            using errcode = '22023';
    end if;

    return query
    update public.ai_help_memories as memory
    set
        hit_count = memory.hit_count + 1,
        last_hit_at = now()
    where
        memory.organization_id = target_org_id
        and memory.question_normalized = clean_question
    returning
        memory.id,
        memory.answer_text,
        'memory'::text,
        memory.hit_count;
end;
$$;


revoke all
on function public.lookup_ai_help_memory(uuid, text)
from public, anon;


grant execute
on function public.lookup_ai_help_memory(uuid, text)
to authenticated;


drop function if exists
public.remember_ai_help_memory(
    uuid,
    text,
    text,
    text,
    text
);


create or replace function
public.remember_ai_help_memory(
    target_org_id uuid,
    target_question_normalized text,
    target_question_text text,
    target_answer_text text,
    target_source text
)
returns table (
    memory_id uuid,
    hit_count integer
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
    current_user_id uuid;
    clean_normalized text;
    clean_question text;
    clean_answer text;
    clean_source text;
begin
    current_user_id := auth.uid();

    if current_user_id is null then
        raise exception
            'Authentication required'
            using errcode = '42501';
    end if;

    if not public.is_org_member(target_org_id) then
        raise exception
            'A oficina informada não pertence ao usuário autenticado.'
            using errcode = '42501';
    end if;

    clean_normalized := lower(trim(coalesce(target_question_normalized, '')));
    clean_question := trim(coalesce(target_question_text, ''));
    clean_answer := trim(coalesce(target_answer_text, ''));
    clean_source := lower(trim(coalesce(target_source, '')));

    if
        char_length(clean_normalized) < 1
        or char_length(clean_normalized) > 500
        or clean_normalized ~ '[\r\n]'
    then
        raise exception
            'Pergunta normalizada inválida.'
            using errcode = '22023';
    end if;

    if
        char_length(clean_question) < 1
        or char_length(clean_question) > 1000
    then
        raise exception
            'Pergunta inválida.'
            using errcode = '22023';
    end if;

    if
        char_length(clean_answer) < 1
        or char_length(clean_answer) > 8000
    then
        raise exception
            'Resposta inválida.'
            using errcode = '22023';
    end if;

    if clean_source not in ('faq', 'llm', 'memory') then
        raise exception
            'Origem de memória inválida.'
            using errcode = '22023';
    end if;

    return query
    insert into public.ai_help_memories (
        organization_id,
        question_normalized,
        question_text,
        answer_text,
        source,
        created_by
    )
    values (
        target_org_id,
        clean_normalized,
        clean_question,
        clean_answer,
        clean_source,
        current_user_id
    )
    on conflict (organization_id, question_normalized)
    do update set
        answer_text = excluded.answer_text,
        source = excluded.source,
        hit_count = public.ai_help_memories.hit_count + 1,
        last_hit_at = now()
    returning
        public.ai_help_memories.id,
        public.ai_help_memories.hit_count;
end;
$$;


revoke all
on function public.remember_ai_help_memory(uuid, text, text, text, text)
from public, anon;


grant execute
on function public.remember_ai_help_memory(uuid, text, text, text, text)
to authenticated;


notify pgrst, 'reload schema';
