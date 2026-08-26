import Link from "next/link";

import styles from "./system-state.module.css";

export default function NotFound() {
  return (
    <main className={styles.globalState}>
      <section className={styles.stateCard}>
        <span className={styles.brandMark} aria-hidden="true">O</span>
        <span className={styles.eyebrow}>ERRO 404</span>
        <h1>Esta página não existe.</h1>
        <p>
          O endereço pode ter mudado ou você pode ter seguido um link antigo. Escolha um caminho seguro para continuar.
        </p>

        <div className={styles.actions}>
          <Link href="/dashboard" className={styles.primaryAction}>
            Abrir o dashboard
          </Link>
          <Link href="/login" className={styles.secondaryAction}>
            Ir para o acesso
          </Link>
        </div>
      </section>
    </main>
  );
}
