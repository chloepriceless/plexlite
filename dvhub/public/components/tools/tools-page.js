import { html } from 'htm/preact';

export function ToolsPage() {
  return html`
    <header class="panel compact-topbar reveal">
      <div class="compact-topbar-copy">
        <p class="page-kicker">System</p>
        <h1 class="page-title">Wartung</h1>
        <p class="page-subtitle">Systemwartung, Diagnose und manuelle Eingriffe.</p>
      </div>
    </header>
    <main class="dashboard-grid">
      <section class="panel span-12 reveal">
        <p class="card-title">Werkzeuge</p>
        <h2 class="section-title">Wartung</h2>
        <p class="meta">Die Wartungsseite wird in einer folgenden Phase implementiert.</p>
      </section>
    </main>
  `;
}
