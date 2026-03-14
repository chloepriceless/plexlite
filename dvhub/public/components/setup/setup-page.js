import { html } from 'htm/preact';

export function SetupPage() {
  return html`
    <header class="panel compact-topbar reveal">
      <div class="compact-topbar-copy">
        <p class="page-kicker">Ersteinrichtung</p>
        <h1 class="page-title">Einrichtung starten</h1>
        <p class="page-subtitle">Schritt-fuer-Schritt Ersteinrichtung des DVhub-Systems.</p>
      </div>
    </header>
    <main class="dashboard-grid">
      <section class="panel span-12 reveal">
        <p class="card-title">Setup-Assistent</p>
        <h2 class="section-title">Einrichtung starten</h2>
        <p class="meta">Der Setup-Assistent wird in einer folgenden Phase implementiert.</p>
      </section>
    </main>
  `;
}
