import styles from "../system-state.module.css";

export default function DashboardLoading() {
  return (
    <main className={styles.loadingState} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>Carregando o dashboard…</span>

      <section className={styles.loadingHero} aria-hidden="true">
        <span />
        <strong />
        <small />
      </section>

      <section className={styles.loadingGrid} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <article key={index}>
            <span />
            <strong />
            <small />
          </article>
        ))}
      </section>

      <section className={styles.loadingPanel} aria-hidden="true">
        <span />
        <strong />
        <div />
        <div />
        <div />
      </section>
    </main>
  );
}
