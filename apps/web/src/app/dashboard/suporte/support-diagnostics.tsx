"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import styles from "./support-diagnostics.module.css";

type CheckStatus = "checking" | "ok" | "attention" | "error";

type DiagnosticCheck = {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

type ReleaseSnapshot = {
  channel: "local" | "ci" | "preview" | "production";
  commit: string;
  release: string;
  service: "orbiq-web";
  version: string;
};

type ClientSnapshot = {
  environment: "local" | "remote";
  mode: "installed" | "browser";
  online: boolean;
  release: ReleaseSnapshot | null;
  serviceWorker: "controlled" | "registered" | "missing" | "unsupported";
  viewport: string;
};

const INITIAL_CHECKS: DiagnosticCheck[] = [
  {
    key: "web",
    label: "Aplicação Web",
    status: "checking",
    detail: "Aguardando verificação.",
  },
  {
    key: "ready",
    label: "Configuração pública",
    status: "checking",
    detail: "Aguardando verificação.",
  },
  {
    key: "release",
    label: "Identidade da versão",
    status: "checking",
    detail: "Aguardando verificação.",
  },
  {
    key: "manifest",
    label: "Instalação PWA",
    status: "checking",
    detail: "Aguardando verificação.",
  },
  {
    key: "connection",
    label: "Conectividade",
    status: "checking",
    detail: "Aguardando verificação.",
  },
  {
    key: "service-worker",
    label: "Service worker",
    status: "checking",
    detail: "Aguardando verificação.",
  },
  {
    key: "display-mode",
    label: "Modo do aplicativo",
    status: "checking",
    detail: "Aguardando verificação.",
  },
];

const STATUS_LABELS: Record<CheckStatus, string> = {
  attention: "Atenção",
  checking: "Verificando",
  error: "Falha",
  ok: "Operacional",
};

function readDisplayMode() {
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );

  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone
    ? "installed"
    : "browser";
}

function readEnvironment() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "local"
    : "remote";
}

async function readServiceWorkerState(): Promise<ClientSnapshot["serviceWorker"]> {
  if (!("serviceWorker" in navigator)) {
    return "unsupported";
  }

  if (navigator.serviceWorker.controller) {
    return "controlled";
  }

  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? "registered" : "missing";
}

function getEndpointCheck(
  key: string,
  label: string,
  ok: boolean,
  detail: string,
): DiagnosticCheck {
  return {
    key,
    label,
    status: ok ? "ok" : "error",
    detail,
  };
}

async function checkEndpoint(
  path: string,
  options?: { contentType?: string; validateJson?: (value: unknown) => boolean },
) {
  try {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: options?.contentType ?? "application/json",
      },
    });

    if (!response.ok) {
      return false;
    }

    if (options?.contentType) {
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes(options.contentType)) {
        return false;
      }
    }

    if (options?.validateJson) {
      const payload: unknown = await response.json();
      return options.validateJson(payload);
    }

    return true;
  } catch {
    return false;
  }
}

function isManifestPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const manifest = value as {
    display?: unknown;
    name?: unknown;
    short_name?: unknown;
  };

  return (
    typeof manifest.name === "string" &&
    manifest.name.includes("Orbiq") &&
    manifest.short_name === "Orbiq" &&
    manifest.display === "standalone"
  );
}

function isReleaseSnapshot(value: unknown): value is ReleaseSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const release = value as Partial<ReleaseSnapshot>;
  const validChannel = ["local", "ci", "preview", "production"].includes(
    String(release.channel ?? ""),
  );

  return (
    release.service === "orbiq-web" &&
    validChannel &&
    typeof release.version === "string" &&
    /^[0-9]+\.[0-9]+\.[0-9]+$/.test(release.version) &&
    typeof release.release === "string" &&
    /^[a-zA-Z0-9._-]{1,64}$/.test(release.release) &&
    typeof release.commit === "string" &&
    (release.commit === "local" || /^[0-9a-f]{7,12}$/.test(release.commit))
  );
}

async function readReleaseSnapshot(): Promise<ReleaseSnapshot | null> {
  try {
    const response = await fetch("/api/release", {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    return isReleaseSnapshot(payload) ? payload : null;
  } catch {
    return null;
  }
}

export function SupportDiagnostics() {
  const [checks, setChecks] = useState<DiagnosticCheck[]>(INITIAL_CHECKS);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const runDiagnostics = useCallback(async () => {
    setChecks(
      INITIAL_CHECKS.map((check) => ({
        ...check,
        detail: "Verificando agora...",
        status: "checking",
      })),
    );
    setCopyState("idle");

    const environment = readEnvironment();
    const mode = readDisplayMode();
    const online = navigator.onLine;

    const [webOk, readyOk, release, manifestOk, serviceWorker] = await Promise.all([
      checkEndpoint("/api/health"),
      checkEndpoint("/api/ready"),
      readReleaseSnapshot(),
      checkEndpoint("/manifest.webmanifest", {
        contentType: "application/manifest+json",
        validateJson: isManifestPayload,
      }),
      readServiceWorkerState(),
    ]);

    const viewport = `${window.innerWidth}×${window.innerHeight}`;
    const nextSnapshot: ClientSnapshot = {
      environment,
      mode,
      online,
      release,
      serviceWorker,
      viewport,
    };

    const serviceWorkerCheck: DiagnosticCheck = (() => {
      if (serviceWorker === "controlled") {
        return {
          key: "service-worker",
          label: "Service worker",
          status: "ok",
          detail: "Versão instalada sob controle do ciclo seguro de atualização.",
        };
      }

      if (serviceWorker === "registered") {
        return {
          key: "service-worker",
          label: "Service worker",
          status: "attention",
          detail: "Worker registrado e aguardando assumir o controle desta navegação.",
        };
      }

      if (serviceWorker === "unsupported") {
        return {
          key: "service-worker",
          label: "Service worker",
          status: "attention",
          detail: "Este navegador não oferece suporte ao recurso de instalação offline.",
        };
      }

      return {
        key: "service-worker",
        label: "Service worker",
        status: "attention",
        detail:
          environment === "local"
            ? "Ausente no desenvolvimento local, comportamento esperado para preservar o Hot Reload."
            : "Ainda não registrado nesta sessão; a aplicação online continua funcional.",
      };
    })();

    setSnapshot(nextSnapshot);
    setChecks([
      getEndpointCheck(
        "web",
        "Aplicação Web",
        webOk,
        webOk
          ? "O processo Web respondeu ao health check."
          : "O health check não respondeu como esperado.",
      ),
      getEndpointCheck(
        "ready",
        "Configuração pública",
        readyOk,
        readyOk
          ? "O contrato público de ambiente está pronto."
          : "A prontidão de ambiente precisa de verificação técnica.",
      ),
      getEndpointCheck(
        "release",
        "Identidade da versão",
        Boolean(release),
        release
          ? `Versão ${release.version} · ${release.release} · canal ${release.channel}.`
          : "A aplicação respondeu, mas não publicou uma identidade de versão válida.",
      ),
      getEndpointCheck(
        "manifest",
        "Instalação PWA",
        manifestOk,
        manifestOk
          ? "Manifesto instalável do Orbiq validado."
          : "O manifesto de instalação não passou na verificação.",
      ),
      {
        key: "connection",
        label: "Conectividade",
        status: online ? "ok" : "attention",
        detail: online
          ? "O navegador informa conexão disponível."
          : "Sem conexão no momento; evite iniciar novas gravações.",
      },
      serviceWorkerCheck,
      {
        key: "display-mode",
        label: "Modo do aplicativo",
        status: mode === "installed" ? "ok" : "attention",
        detail:
          mode === "installed"
            ? "Orbiq aberto como aplicativo instalado."
            : "Orbiq aberto no navegador; a instalação continua opcional.",
      },
    ]);
    setLastRunAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    const initialRun = window.setTimeout(() => {
      void runDiagnostics();
    }, 0);

    const handleConnectivity = () => {
      void runDiagnostics();
    };

    window.addEventListener("online", handleConnectivity);
    window.addEventListener("offline", handleConnectivity);

    return () => {
      window.clearTimeout(initialRun);
      window.removeEventListener("online", handleConnectivity);
      window.removeEventListener("offline", handleConnectivity);
    };
  }, [runDiagnostics]);

  const safeReport = useMemo(() => {
    const lines = [
      "ORBIQ — DIAGNÓSTICO SEGURO",
      `gerado_em=${lastRunAt ?? "ainda_nao_concluido"}`,
      "rota=/dashboard/suporte",
      `ambiente=${snapshot?.environment ?? "verificando"}`,
      `release=${snapshot?.release?.release ?? "verificando"}`,
      `versao=${snapshot?.release?.version ?? "verificando"}`,
      `commit=${snapshot?.release?.commit ?? "verificando"}`,
      `canal=${snapshot?.release?.channel ?? "verificando"}`,
      `conexao=${snapshot ? (snapshot.online ? "online" : "offline") : "verificando"}`,
      `modo=${snapshot?.mode ?? "verificando"}`,
      `viewport=${snapshot?.viewport ?? "verificando"}`,
      `service_worker=${snapshot?.serviceWorker ?? "verificando"}`,
      ...checks.map((check) => `${check.key}=${check.status}`),
    ];

    return lines.join("\n");
  }, [checks, lastRunAt, snapshot]);

  const okCount = checks.filter((check) => check.status === "ok").length;
  const attentionCount = checks.filter(
    (check) => check.status === "attention",
  ).length;
  const errorCount = checks.filter((check) => check.status === "error").length;

  async function copySafeReport() {
    try {
      await navigator.clipboard.writeText(safeReport);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className="orbiq-eyebrow">SUPORTE SEGURO</span>
          <h1>Diagnóstico do Orbiq</h1>
          <p>
            Verifique instalação, conectividade e prontidão técnica sem expor
            clientes, oficina, usuário, tokens ou conteúdo operacional.
          </p>
        </div>

        <button
          type="button"
          className="orbiq-secondary-button"
          onClick={() => void runDiagnostics()}
        >
          Atualizar diagnóstico
        </button>
      </section>

      <section className={styles.summary} aria-label="Resumo do diagnóstico">
        <div>
          <span>Operacionais</span>
          <strong>{okCount}</strong>
        </div>
        <div>
          <span>Atenções</span>
          <strong>{attentionCount}</strong>
        </div>
        <div>
          <span>Falhas</span>
          <strong>{errorCount}</strong>
        </div>
      </section>

      <section className={styles.grid} aria-label="Verificações técnicas">
        {checks.map((check) => (
          <article
            key={check.key}
            className={styles.check}
            data-orbiq-diagnostic={check.key}
            data-status={check.status}
          >
            <div className={styles.checkHeading}>
              <strong>{check.label}</strong>
              <span data-status={check.status}>{STATUS_LABELS[check.status]}</span>
            </div>
            <p>{check.detail}</p>
          </article>
        ))}
      </section>

      <section className={`orbiq-panel ${styles.reportPanel}`}>
        <div className={styles.reportHeading}>
          <div>
            <span className="orbiq-eyebrow">RELATÓRIO PARA SUPORTE</span>
            <h2>Compartilhe apenas o diagnóstico seguro</h2>
            <p>
              O bloco abaixo foi desenhado para não incluir e-mail, nome da
              oficina, placas, clientes, URLs internas, chaves ou dados de
              orçamento.
            </p>
          </div>

          <button
            type="button"
            className="orbiq-primary-button"
            onClick={() => void copySafeReport()}
          >
            Copiar diagnóstico seguro
          </button>
        </div>

        <pre className={styles.report} data-orbiq-safe-report>
          {safeReport}
        </pre>

        <p className={styles.copyStatus} role="status" aria-live="polite">
          {copyState === "copied"
            ? "Diagnóstico copiado."
            : copyState === "error"
              ? "O navegador bloqueou a cópia automática. Selecione o bloco manualmente."
              : "Nenhum dado pessoal é necessário para esta primeira análise."}
        </p>
      </section>
    </div>
  );
}
