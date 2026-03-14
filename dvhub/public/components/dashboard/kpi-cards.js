import { html } from 'htm/preact';
import { autarkyRate, selfConsumptionRate, telemetry } from '../shared/use-signal-store.js';
import { formatPower } from '../shared/format.js';

function rateColor(pct) {
  if (pct > 70) return 'var(--dvhub-green)';
  if (pct >= 30) return 'var(--dvhub-orange)';
  return 'var(--dvhub-red)';
}

/**
 * KPI cards: Autarky, self-consumption, PV power, grid power.
 */
export function KpiCards() {
  const t = telemetry.value || {};
  const autarky = autarkyRate.value || 0;
  const selfCons = selfConsumptionRate.value || 0;
  const gridDir = (t.gridPower || 0) >= 0 ? 'Bezug' : 'Einspeisung';

  return html`
    <section class="panel span-6 reveal">
      <p class="card-title">Kennzahlen</p>
      <div class="metric-row">
        <span>Autarkiegrad</span>
        <strong class="big-value" style="color:${rateColor(autarky)}">${Math.round(autarky)}%</strong>
      </div>
      <div class="metric-row">
        <span>Eigenverbrauch</span>
        <strong class="big-value" style="color:${rateColor(selfCons)}">${Math.round(selfCons)}%</strong>
      </div>
      <div class="metric-row">
        <span>PV-Leistung</span>
        <strong class="big-value">${formatPower(t.pvPower)}</strong>
      </div>
      <div class="metric-row">
        <span>Netzleistung (${gridDir})</span>
        <strong class="big-value">${formatPower(t.gridPower)}</strong>
      </div>
    </section>
  `;
}
