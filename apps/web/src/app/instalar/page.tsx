import type { Metadata } from "next";
import Link from "next/link";

import styles from "./install.module.css";

export const metadata: Metadata = {
  description:
    "Instale o Orbiq no iPhone, iPad, Android ou computador e use a plataforma como aplicativo.",
  title: "Instalar aplicativo",
};

const platforms = [
  {
    badge: "APPLE",
    icon: "◉",
    steps: [
      "Abra esta página no Safari.",
      "Toque em Compartilhar na barra do navegador.",
      "Escolha Adicionar à Tela de Início e confirme em Adicionar.",
    ],
    title: "iPhone e iPad",
  },
  {
    badge: "ANDROID",
    icon: "◆",
    steps: [
      "Abra o Orbiq no Google Chrome.",
      "Toque no menu de três pontos.",
      "Escolha Instalar app ou Adicionar à tela inicial e confirme.",
    ],
    title: "Celular Android",
  },
  {
    badge: "DESKTOP",
    icon: "□",
    steps: [
      "Abra o Orbiq no Chrome ou Microsoft Edge.",
      "Clique no ícone de instalação na barra de endereço.",
      "Confirme em Instalar para criar a janela do aplicativo.",
    ],
    title: "Computador",
  },
] as const;

export default function InstallPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/dashboard" className={styles.brand} aria-label="Orbiq">
          <span aria-hidden="true">O</span>
          <span>
            <strong>Orbiq</strong>
            <small>Automotive Operations Platform</small>
          </span>
        </Link>

        <Link href="/dashboard" className={styles.back}>
          Voltar ao Dashboard
        </Link>
      </header>

      <section className={styles.hero} aria-labelledby="install-title">
        <span className={styles.eyebrow}>WEB APP · INSTALAÇÃO SEGURA</span>
        <h1 id="install-title">Leve o Orbiq com você.</h1>
        <p>
          Instale a plataforma na tela inicial e abra em uma janela própria,
          com acesso rápido aos orçamentos e à operação da oficina.
        </p>

        <div className={styles.benefits} aria-label="Benefícios">
          <span>Sem loja de aplicativos</span>
          <span>Atualização automática</span>
          <span>Mesma conta e segurança</span>
        </div>
      </section>

      <section className={styles.grid} aria-label="Instruções por aparelho">
        {platforms.map((platform) => (
          <article key={platform.title} className={styles.platform}>
            <div className={styles.platformHeader}>
              <span className={styles.platformIcon} aria-hidden="true">
                {platform.icon}
              </span>
              <span>
                <small>{platform.badge}</small>
                <h2>{platform.title}</h2>
              </span>
            </div>

            <ol>
              {platform.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>

      <aside className={styles.requirement}>
        <span aria-hidden="true">✓</span>
        <span>
          <strong>Pronto para a futura publicação Web</strong>
          <small>
            Fora do ambiente local, navegadores exigem HTTPS para instalar. A
            configuração já está preparada; nenhum plano pago é necessário
            nesta fase.
          </small>
        </span>
      </aside>

      <div className={styles.actions}>
        <Link href="/dashboard" className={styles.primaryAction}>
          Continuar no Orbiq
        </Link>
        <span>
          Use sempre o navegador oficial e confirme o domínio antes de entrar.
        </span>
      </div>
    </main>
  );
}
