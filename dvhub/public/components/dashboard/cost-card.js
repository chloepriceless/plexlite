import { html } from 'htm/preact';
import { telemetry } from '../shared/use-signal-store.js';
import { computeCostColor } from './dashboard-compute.js';

/**
 * Cost card -- import costs, export revenue, net costs with color coding.
 */
export function CostCard() {
  const t = telemetry.value || {};
  const c = t.costs || {};
  const netColor = computeCostColor(c.netEur);
  return html`
    <section class="panel span-4 reveal">
      <p class="card-title">Kosten (heute)</p>
      <div class="metric-row">
        <span>Import</span>
        <strong>${c.costEur != null ? c.costEur.toFixed(2) + ' EUR' : '-- EUR'}</strong>
      </div>
      <div class="metric-row">
        <span>Export-Erloese</span>
        <strong style="color:var(--dvhub-green)">${c.revenueEur != null ? c.revenueEur.toFixed(2) + ' EUR' : '-- EUR'}</strong>
      </div>
      <div class="metric-row">
        <span>Netto</span>
        <strong class="big-value" style="color:${netColor}">${c.netEur != null ? c.netEur.toFixed(2) + ' EUR' : '-- EUR'}</strong>
      </div>
    </section>
  `;
}
