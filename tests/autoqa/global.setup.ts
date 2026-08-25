import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";

import {
  insertRows,
  rpc,
  selectRows,
  signUp,
  type AutoQaState,
} from "./support/orbiq-api";

const stateDirectory = resolve(process.cwd(), ".autoqa");
const statePath = resolve(stateDirectory, "state.json");

export default async function globalSetup() {
  const stamp = Date.now();
  const email = `orbiq.autoqa.${stamp}@example.com`;
  const password = `Orbiq-AutoQA-${stamp}!Aa1`;

  const { accessToken, userId } = await signUp(email, password);

  const organizationId = await rpc<string>(
    "create_organization",
    {
      organization_name: "Orbiq AutoQA Oficina",
      organization_slug: `orbiq-autoqa-${stamp}`,
      organization_cnpj: "12.345.678/0001-99",
    },
    accessToken,
  );

  if (!organizationId) {
    throw new Error("create_organization nao retornou organization_id.");
  }

  await rpc(
    "update_organization_settings",
    {
      target_org_id: organizationId,
      target_name: "Orbiq AutoQA Oficina",
      target_cnpj: "12.345.678/0001-99",
      target_legal_name: "Orbiq AutoQA Ltda",
      target_phone: "(31) 3333-4444",
      target_whatsapp: "(31) 99999-8888",
      target_email: "qa@orbiq.example.com",
      target_postal_code: "30110-000",
      target_address_line: "Avenida AutoQA",
      target_address_number: "100",
      target_address_complement: "Box 1",
      target_district: "Centro",
      target_city: "Belo Horizonte",
      target_state: "MG",
      target_quote_validity_days: 10,
      target_default_parts_margin_percent: 35,
      target_default_quote_notes:
        "AUTOQA: orçamento válido conforme condições da oficina.",
    },
    accessToken,
  );

  const customerId = randomUUID();
  const vehicleId = randomUUID();
  const supplierId = randomUUID();

  await insertRows(
    "customers",
    {
      id: customerId,
      organization_id: organizationId,
      name: "Cliente AutoQA",
      phone: "31988887777",
      email: "cliente.autoqa@example.com",
      created_by: userId,
    },
    accessToken,
  );

  await insertRows(
    "vehicles",
    {
      id: vehicleId,
      organization_id: organizationId,
      customer_id: customerId,
      plate: "QAA1A23",
      brand: "Orbiq",
      model: "QA Runner",
      version: "1.8B",
      model_year: 2026,
      mileage: 12345,
    },
    accessToken,
  );

  await insertRows(
    "suppliers",
    {
      id: supplierId,
      organization_id: organizationId,
      name: "Fornecedor AutoQA",
      whatsapp: "31999990000",
      notes: "Criado automaticamente pelo AutoQA",
      active: true,
    },
    accessToken,
  );

  const marginQuoteId = randomUUID();
  const savedQuoteId = randomUUID();
  const publicApproveQuoteId = randomUUID();
  const publicRejectQuoteId = randomUUID();

  await insertRows(
    "quotes",
    [
      {
        id: marginQuoteId,
        organization_id: organizationId,
        customer_id: customerId,
        vehicle_id: vehicleId,
        protocol: `AUTOQA-${stamp}-MARGIN`,
        priority: "normal",
        status: "estimating",
        commercial_status: "draft",
        mileage: 12345,
        created_by: userId,
      },
      {
        id: savedQuoteId,
        organization_id: organizationId,
        customer_id: customerId,
        vehicle_id: vehicleId,
        protocol: `AUTOQA-${stamp}-SAVED`,
        priority: "normal",
        status: "estimating",
        commercial_status: "draft",
        mileage: 12345,
        created_by: userId,
      },
      {
        id: publicApproveQuoteId,
        organization_id: organizationId,
        customer_id: customerId,
        vehicle_id: vehicleId,
        protocol: `AUTOQA-${stamp}-PUBLIC-A`,
        priority: "normal",
        status: "estimating",
        commercial_status: "draft",
        mileage: 12345,
        created_by: userId,
      },
      {
        id: publicRejectQuoteId,
        organization_id: organizationId,
        customer_id: customerId,
        vehicle_id: vehicleId,
        protocol: `AUTOQA-${stamp}-PUBLIC-R`,
        priority: "normal",
        status: "estimating",
        commercial_status: "draft",
        mileage: 12345,
        created_by: userId,
      },
    ],
    accessToken,
  );

  const marginItemId = randomUUID();
  const savedItemId = randomUUID();
  const approveItemId = randomUUID();
  const rejectItemId = randomUUID();

  await insertRows(
    "quote_services",
    [
      {
        id: randomUUID(),
        organization_id: organizationId,
        quote_id: marginQuoteId,
        category: "Mecânica geral",
        description: "Trocar coxim do motor",
        needs_part: true,
        labor_amount: 150,
      },
      {
        id: randomUUID(),
        organization_id: organizationId,
        quote_id: savedQuoteId,
        category: "Revisão",
        description: "Trocar filtro AutoQA",
        needs_part: true,
        labor_amount: 150,
      },
      {
        id: randomUUID(),
        organization_id: organizationId,
        quote_id: publicApproveQuoteId,
        category: "Mecânica geral",
        description: "Serviço público AutoQA A",
        needs_part: true,
        labor_amount: 150,
      },
      {
        id: randomUUID(),
        organization_id: organizationId,
        quote_id: publicRejectQuoteId,
        category: "Mecânica geral",
        description: "Serviço público AutoQA R",
        needs_part: true,
        labor_amount: 150,
      },
    ],
    accessToken,
  );

  await insertRows(
    "quote_items",
    [
      {
        id: marginItemId,
        organization_id: organizationId,
        quote_id: marginQuoteId,
        category: "Mecânica",
        description: "Coxim AutoQA",
        quantity: 1,
        unit: "un",
        supplier_id: supplierId,
        chosen_amount: 100,
        sale_unit_amount: null,
        sale_total_amount: null,
      },
      {
        id: savedItemId,
        organization_id: organizationId,
        quote_id: savedQuoteId,
        category: "Revisão",
        description: "Filtro AutoQA",
        quantity: 1,
        unit: "un",
        supplier_id: supplierId,
        chosen_amount: 100,
        sale_unit_amount: null,
        sale_total_amount: null,
      },
      {
        id: approveItemId,
        organization_id: organizationId,
        quote_id: publicApproveQuoteId,
        category: "Mecânica",
        description: "Peça pública AutoQA A",
        quantity: 1,
        unit: "un",
        supplier_id: supplierId,
        chosen_amount: 100,
        sale_unit_amount: null,
        sale_total_amount: null,
      },
      {
        id: rejectItemId,
        organization_id: organizationId,
        quote_id: publicRejectQuoteId,
        category: "Mecânica",
        description: "Peça pública AutoQA R",
        quantity: 1,
        unit: "un",
        supplier_id: supplierId,
        chosen_amount: 100,
        sale_unit_amount: null,
        sale_total_amount: null,
      },
    ],
    accessToken,
  );

  await rpc(
    "save_quote_commercial",
    {
      target_org_id: organizationId,
      target_quote_id: savedQuoteId,
      target_items: [
        { quote_item_id: savedItemId, sale_unit_amount: 175 },
      ],
      target_discount_type: "none",
      target_discount_value: 0,
    },
    accessToken,
  );

  for (const [quoteId, itemId] of [
    [publicApproveQuoteId, approveItemId],
    [publicRejectQuoteId, rejectItemId],
  ] as const) {
    await rpc(
      "save_quote_commercial",
      {
        target_org_id: organizationId,
        target_quote_id: quoteId,
        target_items: [
          { quote_item_id: itemId, sale_unit_amount: 135 },
        ],
        target_discount_type: "none",
        target_discount_value: 0,
      },
      accessToken,
    );
  }

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
    throw new Error("AutoQA nao conseguiu gerar os links publicos.");
  }

  const links = await selectRows<Array<{ token: string; expires_at: string }>>(
    "quote_public_links",
    `token=in.(${publicApproveToken},${publicRejectToken})&select=token,expires_at`,
    accessToken,
  );

  if (links.length !== 2) {
    throw new Error(`Links publicos esperados: 2; encontrados: ${links.length}`);
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
  };

  await mkdir(stateDirectory, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");

  console.log("[AUTOQA] Ambiente isolado criado com sucesso.");
  console.log(`[AUTOQA] Oficina: ${organizationId}`);
  console.log(`[AUTOQA] Usuario: ${email}`);
  console.log("[AUTOQA] Nenhum dado de producao foi utilizado.");
}
