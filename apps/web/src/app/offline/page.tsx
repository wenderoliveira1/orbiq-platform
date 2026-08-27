import type { Metadata } from "next";

import styles from "./offline.module.css";

export const metadata: Metadata = {
  title: "Sem conexão",
};

export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="offline-title">
        <span className={styles.brand} aria-hidden="true">
          O
        </span>
        <span className={styles.eyebrow}>ORBIQ PROTEGIDO</span>
        <h1 id="offline-title">Você está sem conexão</h1>
        <p>
          Reconecte o aparelho para continuar trabalhando. Nenhum orçamento,
          cliente ou dado da oficina foi gravado no cache deste dispositivo.
        </p>

        <div className={styles.notice}>
          <span aria-hidden="true">✓</span>
          <span>
            <strong>Seus dados continuam protegidos</strong>
            <small>
              O Orbiq guarda offline somente esta tela e os recursos públicos
              de instalação.
            </small>
          </span>
        </div>

        <form action="/dashboard" method="get">
          <button type="submit">Tentar novamente</button>
        </form>
      </section>
    </main>
  );
}
