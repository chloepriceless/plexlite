import { html } from 'htm/preact';

export function HistoryPage() {
  return html`
    <header class="panel compact-topbar reveal">
      <div class="compact-topbar-copy">
        <p class="page-kicker">Auswertung</p>
        <h1 class="page-title">Historie</h1>
        <p class="page-subtitle">Historische Energie- und Preisdaten im Ueberblick.</p>
      </div>
    </header>
    <main class="dashboard-grid">
      <section class="panel span-12 reveal">
        <p class="card-title">Verlauf</p>
        <h2 class="section-title">Historie</h2>
        <p class="meta">Die Historienansicht wird in einer folgenden Phase implementiert.</p>
      </section>
    </main>
  `;
}
