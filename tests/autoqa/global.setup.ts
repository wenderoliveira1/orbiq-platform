import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import {
  rpc,
  runPostgres,
  signUp,
  sqlLiteral,
  type AutoQaState,
} from "./support/orbiq-api";

const stateDirectory = resolve(process.cwd(), ".autoqa");
const statePath = resolve(stateDirectory, "state.json");

function q(value: string | null): string {
  return sqlLiteral(value);
}

function uuid(value: string): string {
  return `${q(value)}::uuid`;
}

type LinkTiming = {
  createdAt: string;
  expiresAt: string;
};

function readLinkTimings(tokens: string[]): Map<string, LinkTiming> {
  const output = runPostgres(`
    select
      token,
      extract(epoch from created_at),
      extract(epoch from expires_at)
    from public.quote_public_links
    where token in (${tokens.map(q).join(", ")})
    order by token;
  `);

  const result = new Map<string, LinkTiming>();

  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [token, createdEpochRaw, expiresEpochRaw] = line.split("|");
    const createdEpoch = Number(createdEpochRaw);
    const expiresEpoch = Number(expiresEpochRaw);

    if (!token || !Number.isFinite(createdEpoch) || !Number.isFinite(expiresEpoch)) {
      throw new Error(`Linha de validade inválida no AutoQA: ${line}`);
    }

    const days = (expiresEpoch - createdEpoch) / 86_400;

    if (days < 9.9 || days > 10.1) {
      throw new Error(
        `Trigger de validade da 1.8B falhou. Token ${token.slice(0, 8)}... = ${days.toFixed(3)} dias`,
      );
    }

    result.set(token, {
      createdAt: new Date(createdEpoch * 1000).toISOString(),
      expiresAt: new Date(expiresEpoch * 1000).toISOString(),
    });
  }

  return result;
}

export default async function globalSetup() {
  const stamp = Date.now();
  const email = `orbiq.autoqa.${stamp}@example.com`;
  const password = `Orbiq-AutoQA-${stamp}!Aa1`;

  // Autenticação é criada pela API pública real do Supabase.
  // Os dados sintéticos são preparados diretamente no PostgreSQL LOCAL/isolado
  // do runner, sem depender de grants da Data API e sem tocar produção.
  const { accessToken, userId } = await signUp(email, password);

  const organizationId = randomUUID();
  const customerId = randomUUID();
  const vehicleId = randomUUID();
  const supplierId = randomUUID();

  const marginQuoteId = randomUUID();
  const savedQuoteId = randomUUID();
  const publicApproveQuoteId = randomUUID();
  const publicRejectQuoteId = randomUUID();

  const marginItemId = randomUUID();
  const savedItemId = randomUUID();
  const approveItemId = randomUUID();
  const rejectItemId = randomUUID();

  const sql = `
    begin;

    insert into public.organizations (
      id, name, slug, cnpj, plan
    ) values (
      ${uuid(organizationId)},
      ${q("Orbiq AutoQA Oficina")},
      ${q(`orbiq-autoqa-${stamp}`)},
      ${q("12.345.678/0001-99")},
      ${q("professional")}
    );

    insert into public.organization_members (
      organization_id, user_id, role, status
    ) values (
      ${uuid(organizationId)},
      ${uuid(userId)},
      ${q("owner")},
      ${q("active")}
    );

    insert into public.organization_settings (
      organization_id,
      legal_name,
      phone,
      whatsapp,
      email,
      postal_code,
      address_line,
      address_number,
      address_complement,
      district,
      city,
      state,
      quote_validity_days,
      default_parts_margin_percent,
      default_quote_notes
    ) values (
      ${uuid(organizationId)},
      ${q("Orbiq AutoQA Ltda")},
      ${q("(31) 3333-4444")},
      ${q("(31) 99999-8888")},
      ${q("qa@orbiq.example.com")},
      ${q("30110-000")},
      ${q("Avenida AutoQA")},
      ${q("100")},
      ${q("Box 1")},
      ${q("Centro")},
      ${q("Belo Horizonte")},
      ${q("MG")},
      10,
      35,
      ${q("AUTOQA: orçamento válido conforme condições da oficina.")}
    );

    insert into public.customers (
      id, organization_id, name, phone, email, created_by
    ) values (
      ${uuid(customerId)},
      ${uuid(organizationId)},
      ${q("Cliente AutoQA")},
      ${q("31988887777")},
      ${q("cliente.autoqa@example.com")},
      ${uuid(userId)}
    );

    insert into public.vehicles (
      id, organization_id, customer_id, plate, brand, model, version, model_year, mileage
    ) values (
      ${uuid(vehicleId)},
      ${uuid(organizationId)},
      ${uuid(customerId)},
      ${q("QAA1A23")},
      ${q("Orbiq")},
      ${q("QA Runner")},
      ${q("1.8B")},
      2026,
      12345
    );

    insert into public.suppliers (
      id, organization_id, name, whatsapp, notes, active
    ) values (
      ${uuid(supplierId)},
      ${uuid(organizationId)},
      ${q("Fornecedor AutoQA")},
      ${q("31999990000")},
      ${q("Criado automaticamente pelo AutoQA")},
      true
    );

    insert into public.quotes (
      id,
      organization_id,
      customer_id,
      vehicle_id,
      protocol,
      priority,
      status,
      commercial_status,
      mileage,
      parts_cost_amount,
      parts_sale_amount,
      labor_sale_amount,
      subtotal_amount,
      discount_type,
      discount_value,
      discount_amount,
      final_amount,
      created_by
    ) values
      (
        ${uuid(marginQuoteId)}, ${uuid(organizationId)}, ${uuid(customerId)}, ${uuid(vehicleId)},
        ${q(`AUTOQA-${stamp}-MARGIN`)}, ${q("normal")}, ${q("estimating")}, ${q("draft")},
        12345, 100, 0, 150, 150, ${q("none")}, 0, 0, null, ${uuid(userId)}
      ),
      (
        ${uuid(savedQuoteId)}, ${uuid(organizationId)}, ${uuid(customerId)}, ${uuid(vehicleId)},
        ${q(`AUTOQA-${stamp}-SAVED`)}, ${q("normal")}, ${q("estimating")}, ${q("ready")},
        12345, 100, 175, 150, 325, ${q("none")}, 0, 0, 325, ${uuid(userId)}
      ),
      (
        ${uuid(publicApproveQuoteId)}, ${uuid(organizationId)}, ${uuid(customerId)}, ${uuid(vehicleId)},
        ${q(`AUTOQA-${stamp}-PUBLIC-A`)}, ${q("normal")}, ${q("estimating")}, ${q("ready")},
        12345, 100, 135, 150, 285, ${q("none")}, 0, 0, 285, ${uuid(userId)}
      ),
      (
        ${uuid(publicRejectQuoteId)}, ${uuid(organizationId)}, ${uuid(customerId)}, ${uuid(vehicleId)},
        ${q(`AUTOQA-${stamp}-PUBLIC-R`)}, ${q("normal")}, ${q("estimating")}, ${q("ready")},
        12345, 100, 135, 150, 285, ${q("none")}, 0, 0, 285, ${uuid(userId)}
      );

    insert into public.quote_services (
      id, organization_id, quote_id, category, description, needs_part, labor_amount
    ) values
      (${uuid(randomUUID())}, ${uuid(organizationId)}, ${uuid(marginQuoteId)}, ${q("Mecânica geral")}, ${q("Trocar coxim do motor")}, true, 150),
      (${uuid(randomUUID())}, ${uuid(organizationId)}, ${uuid(savedQuoteId)}, ${q("Revisão")}, ${q("Trocar filtro AutoQA")}, true, 150),
      (${uuid(randomUUID())}, ${uuid(organizationId)}, ${uuid(publicApproveQuoteId)}, ${q("Mecânica geral")}, ${q("Serviço público AutoQA A")}, true, 150),
      (${uuid(randomUUID())}, ${uuid(organizationId)}, ${uuid(publicRejectQuoteId)}, ${q("Mecânica geral")}, ${q("Serviço público AutoQA R")}, true, 150);

    insert into public.quote_items (
      id,
      organization_id,
      quote_id,
      category,
      description,
      quantity,
      unit,
      supplier_id,
      chosen_amount,
      sale_unit_amount,
      sale_total_amount
    ) values
      (${uuid(marginItemId)}, ${uuid(organizationId)}, ${uuid(marginQuoteId)}, ${q("Mecânica")}, ${q("Coxim AutoQA")}, 1, ${q("un")}, ${uuid(supplierId)}, 100, null, null),
      (${uuid(savedItemId)}, ${uuid(organizationId)}, ${uuid(savedQuoteId)}, ${q("Revisão")}, ${q("Filtro AutoQA")}, 1, ${q("un")}, ${uuid(supplierId)}, 100, 175, 175),
      (${uuid(approveItemId)}, ${uuid(organizationId)}, ${uuid(publicApproveQuoteId)}, ${q("Mecânica")}, ${q("Peça pública AutoQA A")}, 1, ${q("un")}, ${uuid(supplierId)}, 100, 135, 135),
      (${uuid(rejectItemId)}, ${uuid(organizationId)}, ${uuid(publicRejectQuoteId)}, ${q("Mecânica")}, ${q("Peça pública AutoQA R")}, 1, ${q("un")}, ${uuid(supplierId)}, 100, 135, 135);

    commit;
  `;

  runPostgres(sql);

  // Cria links pelo MESMO RPC operacional do Orbiq. Assim o AutoQA valida
  // firewall de permissões + função original + trigger de validade da 1.8B.
  const publicApproveToken = await rpc<string>(
    "create_quote_public_link",
    {
      target_org_id: organizationId,
      target_quote_id: publicApproveQuoteId,
    },
    accessToken,
  );

  const publicRejectToken = await rpc<string>(
    "create_quote_public_link",
    {
      target_org_id: organizationId,
      target_quote_id: publicRejectQuoteId,
    },
    accessToken,
  );

  if (!publicApproveToken || !publicRejectToken) {
    throw new Error("RPC create_quote_public_link não retornou os dois tokens AutoQA.");
  }

  const timings = readLinkTimings([publicApproveToken, publicRejectToken]);
  const approveTiming = timings.get(publicApproveToken);
  const rejectTiming = timings.get(publicRejectToken);

  if (!approveTiming || !rejectTiming || timings.size !== 2) {
    throw new Error(
      `Links públicos esperados: 2; encontrados no PostgreSQL: ${timings.size}`,
    );
  }

  const state: AutoQaState = {
    email,
    password,
    userId,
    organizationId,
    customerId,
    vehicleId,
    supplierId,
    marginQuoteId,
    savedQuoteId,
    publicApproveQuoteId,
    publicRejectQuoteId,
    publicApproveToken,
    publicRejectToken,
    publicApproveCreatedAt: approveTiming.createdAt,
    publicApproveExpiresAt: approveTiming.expiresAt,
    publicRejectCreatedAt: rejectTiming.createdAt,
    publicRejectExpiresAt: rejectTiming.expiresAt,
  };

  await mkdir(stateDirectory, {
    recursive: true,
  });

  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");

  console.log("[AUTOQA] Ambiente PostgreSQL isolado criado com sucesso.");
  console.log(`[AUTOQA] Oficina sintética: ${organizationId}`);
  console.log(`[AUTOQA] Usuário sintético: ${email}`);
  console.log("[AUTOQA] Links criados pelo RPC real e validados em 10 dias.");
  console.log("[AUTOQA] Nenhum dado de produção foi utilizado.");
}
