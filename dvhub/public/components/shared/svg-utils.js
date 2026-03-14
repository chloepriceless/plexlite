/**
 * Create a linear scale function mapping domain values to range values.
 * @param {[number, number]} domain - [min, max] input range
 * @param {[number, number]} range - [min, max] output range
 * @returns {function(number): number}
 */
export function scaleLinear(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/**
 * Compute bar layout for a bar chart.
 * @param {object} opts
 * @param {number[]} opts.data - Array of numeric values
 * @param {number} opts.width - Chart width in px/units
 * @param {number} opts.height - Chart height in px/units
 * @param {number} [opts.padding=2] - Gap between bars in px/units
 * @returns {Array<{x: number, y: number, w: number, h: number}>}
 */
export function computeBarLayout({ data, width, height, padding = 2 }) {
  if (!data || data.length === 0) return [];
  const barWidth = (width - padding * (data.length - 1)) / data.length;
  const maxVal = Math.max(...data.map(Math.abs));
  if (maxVal === 0) return data.map((_, i) => ({
    x: i * (barWidth + padding),
    y: height,
    w: Math.max(0, barWidth),
    h: 0
  }));

  return data.map((val, i) => {
    const barH = (Math.abs(val) / maxVal) * height;
    return {
      x: i * (barWidth + padding),
      y: val >= 0 ? height - barH : height,
      w: Math.max(0, barWidth),
      h: barH
    };
  });
}

/**
 * Format axis label based on type.
 * @param {number} value
 * @param {'power'|'energy'|'price'|'percent'|'number'} type
 * @returns {string}
 */
export function formatAxisLabel(value, type) {
  switch (type) {
    case 'power':
      return Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)} kW` : `${Math.round(value)} W`;
    case 'energy':
      return Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)} kWh` : `${Math.round(value)} Wh`;
    case 'price':
      return `${value.toFixed(1)} ct`;
    case 'percent':
      return `${Math.round(value)}%`;
    default:
      return String(value);
  }
}
