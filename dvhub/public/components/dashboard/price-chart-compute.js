/**
 * Pure function: compute bar layout for EPEX price chart.
 * Extracted for Node.js testability without Preact import map.
 *
 * @param {Array<{ time: string|Date, price: number }>} pricesArray
 * @param {number} width  - SVG viewBox width
 * @param {number} height - SVG viewBox height
 * @returns {Array<{ x: number, y: number, w: number, h: number, color: string, label: string }>}
 */
export function computeBarLayout(pricesArray, width, height) {
  if (!pricesArray || pricesArray.length === 0) return [];

  const midY = height / 2;
  const gap = 1;
  const barW = (width / pricesArray.length) - gap;
  const maxAbs = Math.max(...pricesArray.map(p => Math.abs(p.price)), 0.01);

  return pricesArray.map((entry, i) => {
    const price = entry.price || 0;
    const barH = (Math.abs(price) / maxAbs) * midY;
    const positive = price >= 0;
    return {
      x: i * (barW + gap),
      y: positive ? midY - barH : midY,
      w: Math.max(0, barW),
      h: barH,
      color: positive ? 'var(--chart-positive)' : 'var(--chart-negative)',
      label: `${formatSlotTime(entry.time)}: ${price.toFixed(2)} ct/kWh`,
    };
  });
}

function formatSlotTime(time) {
  if (!time) return '--:--';
  const d = time instanceof Date ? time : new Date(time);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}
