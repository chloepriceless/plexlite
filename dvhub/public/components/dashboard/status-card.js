import { html } from 'htm/preact';
import { telemetry } from '../shared/use-signal-store.js';
import { formatPower } from '../shared/format.js';
import { resolveDvControlIndicators, formatTimestamp } from './dashboard-compute.js';

/**
 * System status card -- 3-phase grid power, DV flags, neg price, keepalive.
 */
export function StatusCard() {
  const t = telemetry.value || {};
  const meter = t.meter || {};
  const dv = resolveDvControlIndicators(t);
  const negPrice = t.ctrl?.negativePriceActive;
  const keepaliveTs = t.keepalive?.modbusLastQuery?.ts;
  return html`
    <section class="panel span-4 reveal">
      <p class="card-title">System-Status</p>
      <div class="metric-row">
        <span>L1</span><strong>${formatPower(meter.grid_l1_w)}</strong>
      </div>
      <div class="metric-row">
        <span>L2</span><strong>${formatPower(meter.grid_l2_w)}</strong>
      </div>
      <div class="metric-row">
        <span>L3</span><strong>${formatPower(meter.grid_l3_w)}</strong>
      </div>
      <div class="metric-row">
        <span>DV DC</span>
        <strong style="color:${dv.dc.tone === 'ok' ? 'var(--dvhub-green)' : dv.dc.tone === 'off' ? 'var(--dvhub-red)' : 'var(--text-muted)'}">${dv.dc.text}</strong>
      </div>
      <div class="metric-row">
        <span>DV AC</span>
        <strong style="color:${dv.ac.tone === 'ok' ? 'var(--dvhub-green)' : dv.ac.tone === 'off' ? 'var(--dvhub-red)' : 'var(--text-muted)'}">${dv.ac.text}</strong>
      </div>
      <div class="metric-row">
        <span>Neg. Preis</span>
        <strong style="color:${negPrice ? 'var(--dvhub-orange)' : 'var(--text-muted)'}">${negPrice ? 'AKTIV' : 'Inaktiv'}</strong>
      </div>
      <div class="metric-row">
        <span>Keepalive</span>
        <strong style="color:var(--text-muted)">${formatTimestamp(keepaliveTs)}</strong>
      </div>
    </section>
  `;
}
