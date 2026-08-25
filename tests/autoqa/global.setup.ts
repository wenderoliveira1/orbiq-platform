import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";

import {
  adminInsertRows,
  adminSelectRows,
  signUp,
  type AutoQaState,
} from "./support/orbiq-api";

const stateDirectory = resolve(process.cwd(), ".autoqa");
const statePath = resolve(stateDirectory, "state.json");

function token() {
  return randomBytes(32).toString("hex");
}

export default async function globalSetup() {
  const stamp = Date.now();
  const email = `orbiq.autoqa.${stamp}@example.com`;
  const password = `Orbiq-AutoQA-${stamp}!Aa1`;

  // O usuário é criado pela mesma API pública usada pelo produto.
  // Apenas a preparação dos fixtures usa a chave administrativa LOCAL do runner.
  // Nenhuma chave ou dado de produção participa deste processo.
  const { userId } = await signUp(email, password);

  const organizationId = randomUUID();
  const customerId = randomUUID();
  const vehicleId = randomUUID();
  const supplierId = randomUUID();

  await adminInsertRows(
    "organizations",
    {
      id: organizationId,
      name: "Orbiq AutoQA Oficina",
      slug: `orbiq-autoqa-${stamp}`,
      cnpj: "12.345.678/0001-99",
      plan: "professional",
    },
  );

  await adminInsertRows(
    "organization_members",
    {
      organization_id: organizationId,
      user_id: userId,
      role: "owner",
      status: "active",
    },
  );

  await adminInsertRows(
    "organization_settings",
    {
      organization_id: organizationId,
      legal_name: "Orbiq AutoQA Ltda",
      phone: "(31) 3333-4444",
      whatsapp: "(31) 99999-8888",
      email: "qa@orbiq.example.com",
      postal_code: "30110-000",
      address_line: "Avenida AutoQA",
      address_number: "100",
      address_complement: "Box 1",
      district: "Centro",
      city: "Belo Horizonte",
      state: "MG",
      quote_validity_days: 10,
      default_parts_margin_percent: 35,
      default_quote_notes:
        "AUTOQA: orçamento válido conforme condições da oficina.",
    },
  );

  await adminInsertRows(
    "customers",
    {
      id: customerId,
      organization_id: organizationId,
      name: "Cliente AutoQA",
      phone: "31988887777",
      email: "cliente.autoqa@example.com",
      created_by: userId,
    },
  );

  await adminInsertRows(
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
  );

  await adminInsertRows(
    "suppliers",
    {
      id: supplierId,
      organization_id: organizationId,
      name: "Fornecedor AutoQA",
      whatsapp: "31999990000",
      notes: "Criado automaticamente pelo AutoQA",
      active: true,
    },
  );

  const marginQuoteId = randomUUID();
  const savedQuoteId = randomUUID();
  const publicApproveQuoteId = randomUUID();
  const publicRejectQuoteId = randomUUID();

  await adminInsertRows(
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
        commercial_status: "ready",
        mileage: 12345,
        parts_cost_amount: 100,
        parts_sale_amount: 175,
        labor_sale_amount: 150,
        subtotal_amount: 325,
        discount_type: "none",
        discount_value: 0,
        discount_amount: 0,
        final_amount: 325,
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
        commercial_status: "ready",
        mileage: 12345,
        parts_cost_amount: 100,
        parts_sale_amount: 135,
        labor_sale_amount: 150,
        subtotal_amount: 285,
        discount_type: "none",
        discount_value: 0,
        discount_amount: 0,
        final_amount: 285,
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
        commercial_status: "ready",
        mileage: 12345,
        parts_cost_amount: 100,
        parts_sale_amount: 135,
        labor_sale_amount: 150,
        subtotal_amount: 285,
        discount_type: "none",
        discount_value: 0,
        discount_amount: 0,
        final_amount: 285,
        created_by: userId,
      },
    ],
  );

  const marginItemId = randomUUID();
  const savedItemId = randomUUID();
  const approveItemId = randomUUID();
  const rejectItemId = randomUUID();

  await adminInsertRows(
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
  );

  await adminInsertRows(
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
        sale_unit_amount: 175,
        sale_total_amount: 175,
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
        sale_unit_amount: 135,
        sale_total_amount: 135,
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
        sale_unit_amount: 135,
        sale_total_amount: 135,
      },
    ],
  );

  // Inserimos links diretamente no banco isolado para testar o trigger real da 1.8B.
  // O expires_at enviado aqui é propositalmente incorreto (1 dia); o trigger deve
  // substituí-lo pela validade configurada de 10 dias.
  const publicApproveToken = token();
  const publicRejectToken = token();
  const dummyExpiry = new Date(Date.now() + 86_400_000).toISOString();

  await adminInsertRows(
    "quote_public_links",
    [
      {
        organization_id: organizationId,
        quote_id: publicApproveQuoteId,
        token: publicApproveToken,
        expires_at: dummyExpiry,
        created_by: userId,
      },
      {
        organization_id: organizationId,
        quote_id: publicRejectQuoteId,
        token: publicRejectToken,
        expires_at: dummyExpiry,
        created_by: userId,
      },
    ],
  );

  const links = await adminSelectRows<
    Array<{
      token: string;
      created_at: string;
      expires_at: string;
    }>
  >(
    "quote_public_links",
    `token=in.(${publicApproveToken},${publicRejectToken})&select=token,created_at,expires_at`,
  );

  if (links.length !== 2) {
    throw new Error(`Links públicos esperados: 2; encontrados: ${links.length}`);
  }

  for (const link of links) {
    const days =
      (Date.parse(link.expires_at) - Date.parse(link.created_at)) / 86_400_000;

    if (days < 9.9 || days > 10.1) {
      throw new Error(
        `Trigger de validade falhou no fixture AutoQA. Dias encontrados: ${days}`,
      );
    }
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

  await mkdir(stateDirectory, {
    recursive: true,
  });

  await writeFile(
    statePath,
    JSON.stringify(state, null, 2),
    "utf8",
  );

  console.log("[AUTOQA] Ambiente isolado criado com sucesso.");
  console.log(`[AUTOQA] Oficina sintética: ${organizationId}`);
  console.log(`[AUTOQA] Usuário sintético: ${email}`);
  console.log("[AUTOQA] Nenhum dado de produção foi utilizado.");
}
