import { html } from 'htm/preact';
import { telemetry } from '../shared/use-signal-store.js';
import { formatCentFromCt, formatCentFromTenthCt } from './dashboard-compute.js';

/**
 * EPEX price KPI card -- current/next slot prices, today min/max.
 */
export function EpexCard() {
  const t = telemetry.value || {};
  const epex = t.epex?.summary || {};
  // current/next are objects {ts, day, eur_mwh, ct_kwh}, todayMin/todayMax are {ct_kwh, ...}
  const currentCt = epex.current?.ct_kwh ?? null;
  const nextCt = epex.next?.ct_kwh ?? null;
  const minCt = epex.todayMin?.ct_kwh ?? null;
  const maxCt = epex.todayMax?.ct_kwh ?? null;
  return html`
    <section class="panel span-4 reveal">
      <p class="card-title">EPEX-Preise</p>
      <div class="metric-row">
        <span>Aktuell</span>
        <strong class="big-value">${formatCentFromCt(currentCt)}</strong>
      </div>
      <div class="metric-row">
        <span>Naechster Slot</span>
        <strong>${formatCentFromCt(nextCt)}</strong>
      </div>
      <div class="metric-row">
        <span>Heute Min</span>
        <strong style="color:var(--dvhub-green)">${formatCentFromCt(minCt)}</strong>
      </div>
      <div class="metric-row">
        <span>Heute Max</span>
        <strong style="color:var(--dvhub-red)">${formatCentFromCt(maxCt)}</strong>
      </div>
    </section>
  `;
}
