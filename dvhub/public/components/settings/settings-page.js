import { html } from 'htm/preact';

export function SettingsPage() {
  return html`
    <header class="panel compact-topbar reveal">
      <div class="compact-topbar-copy">
        <p class="page-kicker">Konfiguration</p>
        <h1 class="page-title">Einrichtung</h1>
        <p class="page-subtitle">System- und Modulkonfiguration fuer DVhub.</p>
      </div>
    </header>
    <main class="dashboard-grid">
      <section class="panel span-12 reveal">
        <p class="card-title">Einstellungen</p>
        <h2 class="section-title">Einrichtung</h2>
        <p class="meta">Die Einstellungsseite wird in einer folgenden Phase implementiert.</p>
      </section>
    </main>
  `;
}
