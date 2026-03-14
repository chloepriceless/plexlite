import { html, render } from 'htm/preact';
import { useState } from 'preact/hooks';
import { currentRoute } from './shared/router.js';
import { useWebSocket } from './shared/use-websocket.js';
import { wsConnected } from './shared/use-signal-store.js';
import { DashboardPage } from './dashboard/dashboard-page.js';
import { SettingsPage } from './settings/settings-page.js';
import { SetupPage } from './setup/setup-page.js';
import { HistoryPage } from './history/history-page.js';
import { ToolsPage } from './tools/tools-page.js';

const routes = {
  '/': DashboardPage,
  '/settings': SettingsPage,
  '/setup': SetupPage,
  '/history': HistoryPage,
  '/tools': ToolsPage,
};

function AppShell() {
  useWebSocket(`ws://${location.host}/ws`);
  const [menuOpen, setMenuOpen] = useState(false);

  const Page = routes[currentRoute.value] || DashboardPage;

  function handleNavClick() {
    setMenuOpen(false);
  }

  return html`
    <div class="app-shell shell-layout">
      <button class="app-nav-toggle" aria-label="Navigation oeffnen"
              onClick=${() => setMenuOpen(!menuOpen)}>
        <span class="app-nav-toggle-bar"></span>
        <span class="app-nav-toggle-bar"></span>
        <span class="app-nav-toggle-bar"></span>
      </button>

      <aside class="app-nav panel reveal ${menuOpen ? 'is-open' : ''}" aria-label="Hauptnavigation">
        <div class="app-nav-brand">
          <img src="/assets/dvhub.jpg" alt="DVhub Logo" class="app-brand-logo" />
          <div>
            <p class="app-nav-eyebrow">Direktvermarktung</p>
            <strong class="app-nav-title">DVhub</strong>
          </div>
        </div>
        <nav class="app-nav-links">
          <a class="app-nav-link ${currentRoute.value === '/' ? 'is-active' : ''}"
             href="#/" onClick=${handleNavClick}>Leitstand</a>
          <a class="app-nav-link ${currentRoute.value === '/history' ? 'is-active' : ''}"
             href="#/history" onClick=${handleNavClick}>Historie</a>
          <a class="app-nav-link ${currentRoute.value === '/settings' ? 'is-active' : ''}"
             href="#/settings" onClick=${handleNavClick}>Einrichtung</a>
          <a class="app-nav-link ${currentRoute.value === '/tools' ? 'is-active' : ''}"
             href="#/tools" onClick=${handleNavClick}>Wartung</a>
          <a class="app-nav-link ${currentRoute.value === '/setup' ? 'is-active' : ''}"
             href="#/setup" onClick=${handleNavClick}>Einrichtung starten</a>
        </nav>
        <div class="ws-indicator ${wsConnected.value ? 'ws-connected' : 'ws-disconnected'}"
             title="${wsConnected.value ? 'WebSocket verbunden' : 'WebSocket getrennt'}">
        </div>
      </aside>

      <div class="app-main">
        <${Page} />
      </div>
    </div>
  `;
}

render(html`<${AppShell} />`, document.getElementById('app'));
