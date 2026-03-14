import { html } from 'htm/preact';
import { useComputed } from '@preact/signals';
import { formatPower } from '../shared/format.js';
import { computeFlowLines } from './power-flow-compute.js';

// Re-export for convenience
export { computeFlowLines };

const NODE_POSITIONS = {
  pv:      { x: 300, y: 40,  color: '#FFD600', label: 'PV' },
  battery: { x: 100, y: 200, color: '#39E06F', label: 'Batterie' },
  grid:    { x: 500, y: 200, color: '#0077FF', label: 'Netz' },
  load:    { x: 300, y: 360, color: '#FFFFFF', label: 'Haus' },
  ev:      { x: 480, y: 360, color: '#00E5FF', label: 'E-Auto' },
};

const LINE_ENDPOINTS = {
  'pv-battery':   { x1: 300, y1: 40,  x2: 100, y2: 200 },
  'pv-load':      { x1: 300, y1: 40,  x2: 300, y2: 360 },
  'pv-grid':      { x1: 300, y1: 40,  x2: 500, y2: 200 },
  'grid-load':    { x1: 500, y1: 200, x2: 300, y2: 360 },
  'battery-load': { x1: 100, y1: 200, x2: 300, y2: 360 },
  'grid-ev':      { x1: 500, y1: 200, x2: 480, y2: 360 },
};

function strokeWidth(power) {
  return Math.max(2, Math.min(8, Math.abs(power) / 1000));
}

/**
 * Animated SVG power flow diagram with 5 nodes.
 * @param {{ telemetry: import('@preact/signals').Signal }} props
 */
export function PowerFlow({ telemetry }) {
  const flowLines = useComputed(() => computeFlowLines(telemetry.value || {}));
  const hasEv = useComputed(() => (telemetry.value || {}).evPower != null);

  const nodeKeys = useComputed(() => {
    const keys = ['pv', 'battery', 'grid', 'load'];
    if (hasEv.value) keys.push('ev');
    return keys;
  });

  return html`
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto" aria-label="Power Flow Diagram">
      ${flowLines.value.map((fl) => {
        if (!fl.active) return null;
        const key = `${fl.from}-${fl.to}`;
        const ep = LINE_ENDPOINTS[key];
        if (!ep) return null;
        const cls = fl.reverse ? 'flow-animated flow-reverse' : 'flow-animated';
        return html`
          <line x1=${ep.x1} y1=${ep.y1} x2=${ep.x2} y2=${ep.y2}
            stroke="var(--dvhub-electric)" stroke-width=${strokeWidth(fl.power)}
            stroke-dasharray="8 4" class=${cls} opacity="0.7" />
        `;
      })}

      ${nodeKeys.value.map((key) => {
        const n = NODE_POSITIONS[key];
        return html`
          <g>
            <circle cx=${n.x} cy=${n.y} r="28" fill="none" stroke=${n.color} stroke-width="2" opacity="0.9" />
            <circle cx=${n.x} cy=${n.y} r="18" fill=${n.color} opacity="0.18" />
            <text x=${n.x} y=${n.y + 4} text-anchor="middle" fill=${n.color}
              font-size="11" font-weight="700" font-family="var(--font-title)">${n.label}</text>
          </g>
        `;
      })}

      ${nodeKeys.value.map((key) => {
        const n = NODE_POSITIONS[key];
        const t = telemetry.value || {};
        const powerMap = { pv: t.pvPower, battery: t.batteryPower, grid: t.gridPower, load: t.loadPower, ev: t.evPower };
        const val = powerMap[key];
        if (val == null) return null;
        return html`
          <text x=${n.x} y=${n.y + 44} text-anchor="middle" fill="var(--text-muted)"
            font-size="10" font-family="var(--font-body)">${formatPower(val)}</text>
        `;
      })}
    </svg>
  `;
}
