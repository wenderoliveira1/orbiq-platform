type WorkshopLetterheadProps = {
  organizationName: string;
  legalName?: string | null;
  tagline?: string | null;
  cnpj?: string | null;
  contacts?: string | null;
  address?: string | null;
  protocol?: string | null;
  validityDays?: number | null;
  compact?: boolean;
};

export function WorkshopLetterhead({
  organizationName,
  legalName,
  tagline,
  cnpj,
  contacts,
  address,
  protocol,
  validityDays,
  compact = false,
}: WorkshopLetterheadProps) {
  const subtitle = tagline ?? legalName ?? null;

  return (
    <div className={compact ? "workshop-letterhead is-compact" : "workshop-letterhead"}>
      <strong className="workshop-letterhead-name">{organizationName}</strong>
      {subtitle ? <span className="workshop-letterhead-tagline">{subtitle}</span> : null}
      {cnpj ? <span>CNPJ {cnpj}</span> : null}
      {contacts ? <span>{contacts}</span> : null}
      {address ? <span>{address}</span> : null}
      {protocol ? <span>Orçamento {protocol}</span> : null}
      {typeof validityDays === "number" ? (
        <span>Validade comercial: {validityDays} dias</span>
      ) : null}
      <small className="workshop-letterhead-powered">Powered by Orbiq</small>
    </div>
  );
}
