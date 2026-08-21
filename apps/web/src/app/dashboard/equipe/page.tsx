import {
  getCurrentContext,
} from "../_lib/current-organization";

import {
  createInviteAction,
  revokeInviteAction,
  setMemberStatusAction,
  updateMemberRoleAction,
} from "./actions";

import {
  InviteLinkCard,
} from "./invite-link-card";


type PageProps = {

  searchParams:
    Promise<{
      message?: string;
      error?: string;
      invite?: string;
      invite_email?: string;
    }>;
};


type TeamMember = {

  user_id: string;

  full_name: string;

  email: string | null;

  phone: string | null;

  role: string;

  status: string;

  joined_at: string;
};


type TeamInvite = {

  invite_id: string;

  email: string;

  role: string;

  expires_at: string;

  created_at: string;
};


const roleLabels:
  Record<
    string,
    string
  > = {

  owner:
    "Proprietário",

  admin:
    "Administrador",

  manager:
    "Gerente",

  estimator:
    "Orçamentista",

  technician:
    "Técnico",

  viewer:
    "Somente leitura",
};


const roleDescriptions:
  Record<
    string,
    string
  > = {

  owner:
    "Controle total da oficina e da equipe.",

  admin:
    "Administração operacional e gestão de funcionários.",

  manager:
    "Gestão da operação da oficina.",

  estimator:
    "Atendimento, orçamento e cotação.",

  technician:
    "Execução dos serviços e acompanhamento técnico.",

  viewer:
    "Consulta sem funções administrativas.",
};


function date(
  value:
    string,
): string {

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


function initials(
  value:
    string,
): string {

  return value
    .trim()
    .split(/\s+/)
    .slice(
      0,
      2,
    )
    .map(
      (part) =>
        part[0] ??
        "",
    )
    .join("")
    .toUpperCase() ||
    "?";
}


export default async function TeamPage({
  searchParams,
}: PageProps) {

  const query =
    await searchParams;


  const {
    supabase,
    user,
    organization,
    membership,
  } =
    await getCurrentContext();


  const canManage =
    [
      "owner",
      "admin",
    ].includes(
      membership.role,
    );


  const {
    data: teamData,
    error: teamError,
  } =
    await supabase.rpc(
      "list_organization_team",
      {
        target_org_id:
          organization.id,
      },
    );


  if (teamError) {

    throw new Error(
      teamError.message,
    );
  }


  const team =
    (
      teamData ??
      []
    ) as TeamMember[];


  let invites:
    TeamInvite[] =
    [];


  if (canManage) {

    const {
      data,
      error,
    } =
      await supabase.rpc(
        "list_organization_invites",
        {
          target_org_id:
            organization.id,
        },
      );


    if (error) {

      throw new Error(
        error.message,
      );
    }


    invites =
      (
        data ??
        []
      ) as TeamInvite[];
  }


  const activeMembers =
    team.filter(
      (member) =>
        member.status ===
        "active",
    );


  const disabledMembers =
    team.filter(
      (member) =>
        member.status ===
        "disabled",
    );


  const managementCount =
    activeMembers.filter(
      (member) =>
        [
          "owner",
          "admin",
          "manager",
        ].includes(
          member.role,
        ),
    ).length;


  const operationalCount =
    activeMembers.filter(
      (member) =>
        [
          "estimator",
          "technician",
        ].includes(
          member.role,
        ),
    ).length;


  const inviteToken =
    query.invite ??
    "";


  const inviteEmail =
    query.invite_email ??
    "";


  const inviteRoles =
    membership.role ===
    "owner"
      ? [
          "admin",
          "manager",
          "estimator",
          "technician",
          "viewer",
        ]
      : [
          "manager",
          "estimator",
          "technician",
          "viewer",
        ];


  return (
    <div className="orbiq-page team-page">

      <section className="team-heading">

        <div>

          <span className="orbiq-eyebrow">
            ACESSOS
          </span>

          <h1>
            Equipe
          </h1>

          <p>
            Gerencie quem trabalha na {organization.name} e qual papel cada pessoa ocupa.
          </p>

        </div>


        <span className="team-current-role">

          Seu acesso

          <strong>
            {roleLabels[
              membership.role
            ] ??
            membership.role}
          </strong>

        </span>

      </section>


      {query.message ? (

        <div className="orbiq-alert success">
          {query.message}
        </div>

      ) : null}


      {query.error ? (

        <div className="orbiq-alert error">
          {query.error}
        </div>

      ) : null}


      {inviteToken ? (

        <InviteLinkCard
          token={inviteToken}
          email={inviteEmail}
        />

      ) : null}


      <section className="team-metrics">

        <article>

          <span>
            Ativos
          </span>

          <strong>
            {activeMembers.length}
          </strong>

          <small>
            usuários com acesso
          </small>

        </article>


        <article>

          <span>
            Gestão
          </span>

          <strong>
            {managementCount}
          </strong>

          <small>
            proprietário, admins e gerentes
          </small>

        </article>


        <article>

          <span>
            Operação
          </span>

          <strong>
            {operationalCount}
          </strong>

          <small>
            orçamento e técnica
          </small>

        </article>


        <article>

          <span>
            Convites pendentes
          </span>

          <strong>
            {invites.length}
          </strong>

          <small>
            aguardando aceite
          </small>

        </article>

      </section>


      {canManage ? (

        <section className="orbiq-panel">

          <div className="orbiq-panel-heading">

            <div>

              <span className="orbiq-eyebrow">
                NOVO FUNCIONÁRIO
              </span>

              <h2>
                Convidar para a oficina
              </h2>

            </div>

          </div>


          <form
            action={createInviteAction}
            className="team-invite-form"
          >

            <label>

              <span>
                E-mail
              </span>

              <input
                type="email"
                name="email"
                required
                placeholder="funcionario@empresa.com.br"
              />

            </label>


            <label>

              <span>
                Cargo
              </span>

              <select
                name="role"
                defaultValue="estimator"
                required
              >

                {inviteRoles.map(
                  (role) => (

                    <option
                      key={role}
                      value={role}
                    >
                      {roleLabels[
                        role
                      ]}
                    </option>

                  ),
                )}

              </select>

            </label>


            <button
              type="submit"
              className="orbiq-primary-button"
            >
              Gerar convite
            </button>

          </form>

        </section>

      ) : (

        <div className="team-readonly-note">

          <strong>
            Visualização da equipe
          </strong>

          <span>
            Somente proprietário e administradores podem convidar ou alterar funcionários.
          </span>

        </div>

      )}


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              FUNCIONÁRIOS
            </span>

            <h2>
              Pessoas com acesso
            </h2>

          </div>


          <span className="orbiq-count-badge">
            {team.length}
          </span>

        </div>


        <div className="team-list">

          {team.map(
            (member) => {

              const isSelf =
                member.user_id ===
                user.id;


              const ownerProtected =
                member.role ===
                "owner";


              const adminProtected =
                membership.role ===
                  "admin" &&
                member.role ===
                  "admin";


              const canEdit =
                canManage &&
                !isSelf &&
                !ownerProtected &&
                !adminProtected;


              const availableRoles =
                membership.role ===
                "owner"
                  ? [
                      "admin",
                      "manager",
                      "estimator",
                      "technician",
                      "viewer",
                    ]
                  : [
                      "manager",
                      "estimator",
                      "technician",
                      "viewer",
                    ];


              return (
                <article
                  key={member.user_id}
                  className={
                    `team-member-row${
                      member.status ===
                      "disabled"
                        ? " is-disabled"
                        : ""
                    }`
                  }
                >

                  <div className="team-avatar">
                    {initials(
                      member.full_name,
                    )}
                  </div>


                  <div className="team-member-person">

                    <div>

                      <strong>
                        {member.full_name}
                      </strong>


                      {isSelf ? (
                        <span className="team-you">
                          Você
                        </span>
                      ) : null}

                    </div>


                    <span>
                      {member.email ??
                        "E-mail não disponível"}
                    </span>


                    <small>
                      Entrou em{" "}
                      {date(
                        member.joined_at,
                      )}
                    </small>

                  </div>


                  <div className="team-role-view">

                    <span>
                      Cargo
                    </span>

                    <strong>
                      {roleLabels[
                        member.role
                      ] ??
                      member.role}
                    </strong>

                    <small>
                      {roleDescriptions[
                        member.role
                      ] ??
                      ""}
                    </small>

                  </div>


                  <span
                    className={
                      `team-status status-${member.status}`
                    }
                  >
                    {member.status ===
                    "active"
                      ? "Ativo"
                      : member.status ===
                        "disabled"
                        ? "Desativado"
                        : "Convidado"}
                  </span>


                  <div className="team-member-actions">

                    {canEdit ? (

                      <>

                        <form
                          action={updateMemberRoleAction}
                          className="team-role-form"
                        >

                          <input
                            type="hidden"
                            name="user_id"
                            value={member.user_id}
                          />


                          <select
                            name="role"
                            defaultValue={member.role}
                          >

                            {availableRoles.map(
                              (role) => (

                                <option
                                  key={role}
                                  value={role}
                                >
                                  {roleLabels[
                                    role
                                  ]}
                                </option>

                              ),
                            )}

                          </select>


                          <button
                            type="submit"
                            className="orbiq-secondary-button"
                          >
                            Salvar cargo
                          </button>

                        </form>


                        <form
                          action={setMemberStatusAction}
                        >

                          <input
                            type="hidden"
                            name="user_id"
                            value={member.user_id}
                          />


                          <input
                            type="hidden"
                            name="status"
                            value={
                              member.status ===
                              "active"
                                ? "disabled"
                                : "active"
                            }
                          />


                          <button
                            type="submit"
                            className={
                              member.status ===
                              "active"
                                ? "team-disable-button"
                                : "orbiq-secondary-button"
                            }
                          >
                            {member.status ===
                            "active"
                              ? "Desativar"
                              : "Reativar"}
                          </button>

                        </form>

                      </>

                    ) : (

                      <span className="team-protected">

                        {ownerProtected
                          ? "Proprietário protegido"
                          : isSelf
                            ? "Seu usuário"
                            : adminProtected
                              ? "Gerenciado pelo proprietário"
                              : "Somente leitura"}

                      </span>

                    )}

                  </div>

                </article>
              );
            },
          )}

        </div>


        {disabledMembers.length >
        0 ? (

          <p className="team-disabled-count">
            {disabledMembers.length} usuário(s) desativado(s) continuam no histórico da oficina.
          </p>

        ) : null}

      </section>


      {canManage ? (

        <section className="orbiq-panel">

          <div className="orbiq-panel-heading">

            <div>

              <span className="orbiq-eyebrow">
                CONVITES
              </span>

              <h2>
                Aguardando entrada
              </h2>

            </div>

          </div>


          {invites.length ===
          0 ? (

            <div className="orbiq-empty compact">

              <strong>
                Nenhum convite pendente.
              </strong>

              <span>
                Novos convites aparecerão aqui até serem aceitos ou revogados.
              </span>

            </div>

          ) : (

            <div className="team-pending-list">

              {invites.map(
                (invite) => (

                  <article
                    key={invite.invite_id}
                    className="team-pending-row"
                  >

                    <div>

                      <strong>
                        {invite.email}
                      </strong>

                      <span>
                        {roleLabels[
                          invite.role
                        ] ??
                        invite.role}
                      </span>

                    </div>


                    <div>

                      <span>
                        Expira em
                      </span>

                      <strong>
                        {date(
                          invite.expires_at,
                        )}
                      </strong>

                    </div>


                    <form
                      action={revokeInviteAction}
                    >

                      <input
                        type="hidden"
                        name="invite_id"
                        value={invite.invite_id}
                      />


                      <button
                        type="submit"
                        className="team-disable-button"
                      >
                        Revogar
                      </button>

                    </form>

                  </article>

                ),
              )}

            </div>

          )}

        </section>

      ) : null}


      <section className="orbiq-panel">

        <div className="orbiq-panel-heading">

          <div>

            <span className="orbiq-eyebrow">
              CARGOS
            </span>

            <h2>
              Estrutura de acesso
            </h2>

          </div>

        </div>


        <div className="team-role-grid">

          {Object.entries(
            roleLabels,
          ).map(
            ([
              role,
              label,
            ]) => (

              <article
                key={role}
              >

                <span>
                  {label}
                </span>

                <p>
                  {roleDescriptions[
                    role
                  ]}
                </p>

              </article>

            ),
          )}

        </div>


        <div className="team-permission-next">

          <strong>
            Próxima etapa: permissões por módulo
          </strong>

          <span>
            Na Fase 1.7B estes cargos passarão a controlar no servidor e no PostgreSQL quem pode criar, editar, aprovar, comprar, executar e apenas visualizar.
          </span>

        </div>

      </section>

    </div>
  );
}