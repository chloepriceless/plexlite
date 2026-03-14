import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeBarLayout } from '../public/components/dashboard/price-chart-compute.js';

describe('computeBarLayout', () => {
  it('96 price entries -> returns 96 bars', () => {
    const prices = Array.from({ length: 96 }, (_, i) => ({
      time: new Date(2026, 2, 14, Math.floor(i / 4), (i % 4) * 15).toISOString(),
      price: Math.sin(i / 10) * 15,
    }));
    const bars = computeBarLayout(prices, 1000, 300);
    assert.equal(bars.length, 96);
  });

  it('All positive prices -> all bars extend upward from midline', () => {
    const prices = Array.from({ length: 10 }, (_, i) => ({
      time: new Date(2026, 2, 14, i).toISOString(),
      price: 5 + i,
    }));
    const bars = computeBarLayout(prices, 1000, 300);
    const midY = 300 / 2;
    for (const bar of bars) {
      assert.ok(bar.y < midY || bar.y === midY, `Bar y=${bar.y} should be at or above midline ${midY}`);
      assert.ok(bar.h > 0, 'Bar should have positive height');
    }
  });

  it('Mixed positive/negative -> correct positions', () => {
    const prices = [
      { time: '2026-03-14T00:00:00Z', price: 10 },
      { time: '2026-03-14T00:15:00Z', price: -5 },
    ];
    const bars = computeBarLayout(prices, 1000, 300);
    const midY = 300 / 2;

    // Positive bar above midline
    assert.ok(bars[0].y < midY, 'Positive bar should be above midline');
    // Negative bar at or below midline
    assert.ok(bars[1].y >= midY, 'Negative bar should be at or below midline');
  });

  it('Empty array -> returns empty array', () => {
    const bars = computeBarLayout([], 1000, 300);
    assert.deepEqual(bars, []);
  });

  it('Single price entry -> returns 1 bar spanning full width', () => {
    const prices = [{ time: '2026-03-14T00:00:00Z', price: 12 }];
    const bars = computeBarLayout(prices, 1000, 300);
    assert.equal(bars.length, 1);
    // Bar width should be close to chart width minus gap
    assert.ok(bars[0].w > 900, `Bar width ${bars[0].w} should span most of the chart`);
  });
});
