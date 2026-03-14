import { html } from 'htm/preact';
import { useComputed } from '@preact/signals';
import { computeBarLayout } from './price-chart-compute.js';

// Re-export for convenience
export { computeBarLayout };

function getCurrentSlotIndex(pricesArray) {
  if (!pricesArray || pricesArray.length === 0) return -1;
  const now = Date.now();
  for (let i = pricesArray.length - 1; i >= 0; i--) {
    const t = new Date(pricesArray[i].time).getTime();
    if (t <= now) return i;
  }
  return -1;
}

const CHART_W = 1000;
const CHART_H = 300;
const TIME_LABELS = ['0:00', '6:00', '12:00', '18:00', '24:00'];

/**
 * EPEX 96-slot bar chart component.
 * @param {{ prices: import('@preact/signals').Signal }} props
 */
export function PriceChart({ prices }) {
  const bars = useComputed(() => computeBarLayout(prices.value || [], CHART_W, CHART_H));
  const currentIdx = useComputed(() => getCurrentSlotIndex(prices.value));

  const maxPrice = useComputed(() => {
    const arr = prices.value || [];
    if (arr.length === 0) return 10;
    return Math.max(...arr.map(p => Math.abs(p.price)), 0.01);
  });

  return html`
    <section class="panel span-12 reveal">
      <p class="card-title">EPEX Strompreise</p>
      <svg viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto">
        <!-- Center axis -->
        <line x1="0" y1="${CHART_H / 2}" x2="${CHART_W}" y2="${CHART_H / 2}"
          stroke="var(--chart-axis)" stroke-width="1" opacity="0.5" />

        <!-- Price scale labels -->
        <text x="4" y="18" fill="var(--chart-label)" font-size="10">${maxPrice.value.toFixed(1)} ct</text>
        <text x="4" y="${CHART_H / 2 - 4}" fill="var(--chart-label)" font-size="10">0 ct</text>
        <text x="4" y="${CHART_H - 4}" fill="var(--chart-label)" font-size="10">-${maxPrice.value.toFixed(1)} ct</text>

        <!-- Bars -->
        ${bars.value.map((bar, i) => {
          const isNow = i === currentIdx.value;
          const fill = isNow
            ? (bar.y < CHART_H / 2 ? 'var(--chart-positive-highlight)' : 'var(--chart-negative-highlight)')
            : bar.color;
          return html`
            <rect x=${bar.x} y=${bar.y} width=${bar.w} height=${bar.h}
              fill=${fill} rx="1">
              <title>${bar.label}</title>
            </rect>
          `;
        })}

        <!-- Current time indicator -->
        ${currentIdx.value >= 0 && html`
          <line x1=${bars.value[currentIdx.value]?.x || 0} y1="0"
            x2=${bars.value[currentIdx.value]?.x || 0} y2="${CHART_H}"
            stroke="var(--chart-now)" stroke-width="2" stroke-dasharray="4 2" />
        `}

        <!-- Time labels -->
        ${TIME_LABELS.map((lbl, i) => html`
          <text x=${(i / (TIME_LABELS.length - 1)) * CHART_W} y="${CHART_H - 2}"
            fill="var(--chart-label)" font-size="10" text-anchor="middle">${lbl}</text>
        `)}
      </svg>
    </section>
  `;
}
