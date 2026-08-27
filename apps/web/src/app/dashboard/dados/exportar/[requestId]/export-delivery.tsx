"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { createClient } from "@/lib/supabase/client";

import styles from "./export-delivery.module.css";

const EXPORT_BUCKET = "organization-data-exports";
const SIGNED_URL_SECONDS = 60;
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;

type ExportSnapshotRow = {
  export_byte_size: number;
  export_checksum: string;
  export_created_at: string;
  export_filename: string;
  export_organization_id: string;
  export_organization_name: string;
  export_schema_version: number;
  export_snapshot: string;
};

type DeliveryStage =
  | "starting"
  | "preparing"
  | "uploading"
  | "signing"
  | "downloading"
  | "cleaning"
  | "done"
  | "cleanup-warning"
  | "error";

type PendingArtifact = {
  blob: Blob;
  filename: string;
  path: string;
};

type UploadedArtifact = {
  expectedSize?: number;
  filename: string;
  path: string;
};

type Props = {
  consumedAt: string | null;
  organizationName: string;
  requestExpiresAt: string;
  requestId: string;
};

const STAGE_COPY: Record<DeliveryStage, string> = {
  "cleanup-warning": "Arquivo baixado; falta remover a cópia temporária.",
  cleaning: "Removendo a cópia temporária do Storage...",
  done: "Exportação concluída e cópia temporária removida.",
  downloading: "Transferindo o arquivo diretamente do Storage privado...",
  error: "A exportação precisa de atenção.",
  preparing: "Gerando o snapshot e validando a integridade SHA-256...",
  signing: "Criando uma URL assinada de curta duração...",
  starting: "Preparando o canal privado de exportação...",
  uploading: "Enviando o arquivo diretamente ao Storage privado...",
};

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Text(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
}

function withinRecoveryWindow(consumedAt: string | null) {
  if (!consumedAt) {
    return false;
  }

  const timestamp = new Date(consumedAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < RECOVERY_WINDOW_MS;
}

export function ExportDelivery({
  consumedAt,
  organizationName,
  requestExpiresAt,
  requestId,
}: Props) {
  const [stage, setStage] = useState<DeliveryStage>("starting");
  const [detail, setDetail] = useState(
    "A exportação será entregue sem passar o arquivo pelo servidor Web do Orbiq.",
  );
  const [cleanupPath, setCleanupPath] = useState<string | null>(null);
  const startedRef = useRef(false);
  const pendingRef = useRef<PendingArtifact | null>(null);
  const uploadedRef = useRef<UploadedArtifact | null>(null);

  const downloadAndCleanup = useCallback(
    async (artifact: UploadedArtifact) => {
      const supabase = createClient();

      setStage("signing");
      setDetail(
        `A URL privada ficará válida por apenas ${SIGNED_URL_SECONDS} segundos.`,
      );

      const { data: signed, error: signedError } = await supabase.storage
        .from(EXPORT_BUCKET)
        .createSignedUrl(artifact.path, SIGNED_URL_SECONDS);

      if (signedError || !signed?.signedUrl) {
        throw new Error(
          "Não foi possível criar a autorização temporária de download.",
        );
      }

      setStage("downloading");
      setDetail("O navegador está recebendo o arquivo diretamente do Storage.");

      const response = await fetch(signed.signedUrl, {
        cache: "no-store",
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error("O Storage não entregou o arquivo esperado.");
      }

      const downloadedBlob = await response.blob();

      if (
        artifact.expectedSize !== undefined &&
        downloadedBlob.size !== artifact.expectedSize
      ) {
        throw new Error(
          "A cópia recebida não possui o mesmo tamanho do arquivo publicado.",
        );
      }

      const objectUrl = URL.createObjectURL(downloadedBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = artifact.filename;
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);

      setStage("cleaning");
      setDetail(
        "O download já foi entregue. Agora o Orbiq está removendo a cópia temporária.",
      );

      const { error: removeError } = await supabase.storage
        .from(EXPORT_BUCKET)
        .remove([artifact.path]);

      if (removeError) {
        setCleanupPath(artifact.path);
        setStage("cleanup-warning");
        setDetail(
          "O arquivo foi baixado, mas a remoção automática falhou. A cópia continua privada e pode ser removida novamente por esta tela.",
        );
        return;
      }

      uploadedRef.current = null;
      pendingRef.current = null;
      setCleanupPath(null);
      setStage("done");
      setDetail(
        "O arquivo foi baixado e o objeto temporário não permanece armazenado no Orbiq.",
      );
    },
    [],
  );

  const uploadPendingArtifact = useCallback(
    async (artifact: PendingArtifact) => {
      const supabase = createClient();

      setStage("uploading");
      setDetail(
        "A transferência acontece do seu navegador para o Supabase Storage, sem usar o corpo de resposta do Next.js.",
      );

      const { error: uploadError } = await supabase.storage
        .from(EXPORT_BUCKET)
        .upload(artifact.path, artifact.blob, {
          cacheControl: "0",
          contentType: "application/json",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          "Não foi possível publicar a cópia privada temporária. Tente novamente sem fechar esta página.",
        );
      }

      const uploaded: UploadedArtifact = {
        expectedSize: artifact.blob.size,
        filename: artifact.filename,
        path: artifact.path,
      };

      pendingRef.current = null;
      uploadedRef.current = uploaded;
      await downloadAndCleanup(uploaded);
    },
    [downloadAndCleanup],
  );

  const recoverUploadedArtifact = useCallback(async () => {
    if (!withinRecoveryWindow(consumedAt)) {
      throw new Error(
        "Esta autorização já foi utilizada e a janela de recuperação terminou. Gere uma nova exportação.",
      );
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Sua sessão precisa ser renovada antes do download.");
    }

    const folder = `${user.id}/${requestId}`;
    const { data: files, error: listError } = await supabase.storage
      .from(EXPORT_BUCKET)
      .list(folder, {
        limit: 10,
        sortBy: {
          column: "created_at",
          order: "desc",
        },
      });

    if (listError) {
      throw new Error("Não foi possível consultar a cópia temporária da exportação.");
    }

    const candidate = files?.find((file) => file.name.endsWith(".json"));

    if (!candidate) {
      throw new Error(
        "A autorização foi utilizada, mas não existe uma cópia temporária para retomar. Gere uma nova exportação.",
      );
    }

    const metadata = candidate.metadata as { size?: unknown } | null;
    const expectedSize =
      typeof metadata?.size === "number" ? metadata.size : undefined;
    const artifact: UploadedArtifact = {
      expectedSize,
      filename: safeFilename(candidate.name),
      path: `${folder}/${candidate.name}`,
    };

    uploadedRef.current = artifact;
    await downloadAndCleanup(artifact);
  }, [consumedAt, downloadAndCleanup, requestId]);

  const runDelivery = useCallback(async () => {
    try {
      setCleanupPath(null);

      if (uploadedRef.current) {
        await downloadAndCleanup(uploadedRef.current);
        return;
      }

      if (pendingRef.current) {
        await uploadPendingArtifact(pendingRef.current);
        return;
      }

      if (consumedAt) {
        await recoverUploadedArtifact();
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Sua sessão precisa ser renovada antes da exportação.");
      }

      setStage("preparing");
      setDetail(
        "O PostgreSQL está produzindo um snapshot owner-only e removendo segredos internos.",
      );

      const { data, error } = await supabase.rpc(
        "consume_organization_data_export",
        {
          target_request_id: requestId,
        },
      );

      if (error) {
        throw new Error(
          error.code === "55000"
            ? "Esta autorização expirou ou já foi utilizada. Gere uma nova exportação."
            : "A exportação não está disponível para esta conta.",
        );
      }

      const exported = (data?.[0] ?? null) as ExportSnapshotRow | null;

      if (!exported?.export_snapshot || !exported.export_filename) {
        throw new Error("O snapshot de dados não pôde ser gerado.");
      }

      const snapshotHash = await sha256Text(exported.export_snapshot);

      if (snapshotHash !== String(exported.export_checksum).toLowerCase()) {
        throw new Error(
          "A verificação SHA-256 recusou o snapshot antes de qualquer upload.",
        );
      }

      const manifest = {
        algorithm: "SHA-256",
        byte_size: Number(exported.export_byte_size),
        checksum_scope: "snapshot UTF-8 compacto",
        organization_id: exported.export_organization_id,
        organization_name: exported.export_organization_name,
        schema_version: exported.export_schema_version,
        sha256: exported.export_checksum,
      };
      const body =
        `{"integrity":${JSON.stringify(manifest)},` +
        `"snapshot":${exported.export_snapshot}}\n`;
      const blob = new Blob([body], {
        type: "application/json;charset=utf-8",
      });
      const filename = safeFilename(exported.export_filename);
      const path = `${user.id}/${requestId}/${filename}`;
      const artifact: PendingArtifact = {
        blob,
        filename,
        path,
      };

      pendingRef.current = artifact;
      await uploadPendingArtifact(artifact);
    } catch (error) {
      setStage("error");
      setDetail(
        error instanceof Error
          ? error.message
          : "A exportação foi interrompida por uma falha inesperada.",
      );
    }
  }, [
    consumedAt,
    downloadAndCleanup,
    recoverUploadedArtifact,
    requestId,
    uploadPendingArtifact,
  ]);

  const retryCleanup = useCallback(async () => {
    if (!cleanupPath) {
      return;
    }

    const supabase = createClient();
    setStage("cleaning");
    setDetail("Tentando remover novamente a cópia privada temporária...");

    const { error } = await supabase.storage
      .from(EXPORT_BUCKET)
      .remove([cleanupPath]);

    if (error) {
      setStage("cleanup-warning");
      setDetail(
        "A cópia continua privada, mas ainda não foi possível removê-la. Tente novamente antes de sair desta tela.",
      );
      return;
    }

    uploadedRef.current = null;
    pendingRef.current = null;
    setCleanupPath(null);
    setStage("done");
    setDetail("Cópia temporária removida com sucesso.");
  }, [cleanupPath]);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    const timeoutId = window.setTimeout(() => {
      void runDelivery();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [runDelivery]);

  const expiresAt = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(requestExpiresAt));

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className="orbiq-eyebrow">EXPORTAÇÃO PRIVADA</span>
          <h1>Preparando dados de {organizationName}</h1>
          <p>
            O arquivo sai do Supabase diretamente para este navegador. O servidor
            Web não transporta o JSON da oficina.
          </p>
        </div>

        <span className={styles.privateBadge}>Storage privado</span>
      </section>

      <section
        className={styles.deliveryPanel}
        aria-live="polite"
        aria-busy={!(["done", "cleanup-warning", "error"] as DeliveryStage[]).includes(stage)}
      >
        <div className={styles.progressMark} data-stage={stage} aria-hidden="true">
          {stage === "done" ? "✓" : stage === "error" ? "!" : "↗"}
        </div>

        <div className={styles.progressCopy}>
          <span className="orbiq-eyebrow">ENTREGA SEGURA</span>
          <h2>{STAGE_COPY[stage]}</h2>
          <p>{detail}</p>
        </div>
      </section>

      <section className={styles.securityGrid} aria-label="Controles da entrega">
        <article>
          <span>01</span>
          <strong>SHA-256 antes do upload</strong>
          <p>O navegador recusa um snapshot cujo hash não corresponda ao banco.</p>
        </article>
        <article>
          <span>02</span>
          <strong>URL assinada por 60 segundos</strong>
          <p>O objeto não se torna público nem recebe uma URL permanente.</p>
        </article>
        <article>
          <span>03</span>
          <strong>Sem payload no Next.js</strong>
          <p>O JSON não depende do limite de resposta da futura hospedagem Web.</p>
        </article>
        <article>
          <span>04</span>
          <strong>Limpeza automática</strong>
          <p>A cópia temporária é removida após o Blob chegar ao navegador.</p>
        </article>
      </section>

      <section className={styles.metaPanel}>
        <div>
          <span>Autorização</span>
          <strong>{requestId.slice(0, 8)}…</strong>
        </div>
        <div>
          <span>Validade original</span>
          <strong>{expiresAt}</strong>
        </div>
        <div>
          <span>Recuperação</span>
          <strong>até 15 min após consumo</strong>
        </div>
      </section>

      <div className={styles.actions}>
        {stage === "error" ? (
          <button
            type="button"
            className="orbiq-primary-button"
            onClick={() => void runDelivery()}
          >
            Tentar novamente
          </button>
        ) : null}

        {stage === "cleanup-warning" ? (
          <button
            type="button"
            className="orbiq-primary-button"
            onClick={() => void retryCleanup()}
          >
            Remover cópia temporária
          </button>
        ) : null}

        <Link href="/dashboard/dados" className="orbiq-ghost-button">
          Voltar para Dados e privacidade
        </Link>
      </div>
    </div>
  );
}
