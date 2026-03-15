import { html } from 'htm/preact';
import { telemetry } from '../shared/use-signal-store.js';
import { formatCentFromCt, formatCentFromTenthCt } from './dashboard-compute.js';

/**
 * EPEX price KPI card -- current/next slot prices, today min/max.
 */
export function EpexCard() {
  const t = telemetry.value || {};
  const epex = t.epex?.summary || {};
  return html`
    <section class="panel span-4 reveal">
      <p class="card-title">EPEX-Preise</p>
      <div class="metric-row">
        <span>Aktuell</span>
        <strong class="big-value">${formatCentFromCt(epex.current)}</strong>
      </div>
      <div class="metric-row">
        <span>Naechster Slot</span>
        <strong>${formatCentFromCt(epex.next)}</strong>
      </div>
      <div class="metric-row">
        <span>Heute Min</span>
        <strong style="color:var(--dvhub-green)">${formatCentFromTenthCt(epex.todayMin)}</strong>
      </div>
      <div class="metric-row">
        <span>Heute Max</span>
        <strong style="color:var(--dvhub-red)">${formatCentFromTenthCt(epex.todayMax)}</strong>
      </div>
    </section>
  `;
}
