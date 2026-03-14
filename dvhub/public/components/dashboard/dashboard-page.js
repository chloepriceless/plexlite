import { html } from 'htm/preact';
import { telemetry, wsConnected } from '../shared/use-signal-store.js';

export function DashboardPage() {
  return html`
    <header class="panel compact-topbar reveal">
      <div class="compact-topbar-copy">
        <p class="page-kicker">Leitstand</p>
        <h1 class="page-title">DVhub Leitstand</h1>
        <p class="page-subtitle">Direktvermarktung, Energiefluesse und Automationen in einer kompakten Betriebsansicht.</p>
      </div>
      <div class="page-actions">
        <span class="ws-indicator ${wsConnected.value ? 'ws-connected' : 'ws-disconnected'}"></span>
        <a class="btn btn-ghost" href="#/settings">Einrichtung</a>
        <a class="btn btn-primary" href="#/tools">Wartung oeffnen</a>
      </div>
    </header>
    <main class="dashboard-grid">
      <section class="panel span-12 reveal">
        <p class="card-title">Dashboard</p>
        <h2 class="section-title">Leitstand wird geladen...</h2>
        <p class="meta">Die Echtzeit-Widgets werden in der naechsten Phase implementiert.</p>
      </section>
    </main>
  `;
}
