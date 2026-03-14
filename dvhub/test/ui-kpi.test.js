import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import pure computation functions (no Preact/signal dependency needed)
import { computeAutarky, computeSelfConsumption } from '../public/components/shared/compute.js';

describe('KPI computations', () => {
  describe('computeAutarky', () => {
    it('pvPower=5000, loadPower=3000, gridPower=-2000 (exporting) -> autarky=100%', () => {
      // gridPower=-2000 means exporting. max(0, -2000)=0, so selfSupplied=3000-0=3000
      // autarky = 3000/3000 * 100 = 100%
      assert.equal(computeAutarky(3000, -2000), 100);
    });

    it('pvPower=0, loadPower=3000, gridPower=3000 -> autarky=0%', () => {
      // All load from grid: selfSupplied = 3000 - max(0, 3000) = 0
      assert.equal(computeAutarky(3000, 3000), 0);
    });

    it('pvPower=2000, loadPower=3000, gridPower=1000 -> autarky=67%', () => {
      // selfSupplied = 3000 - max(0, 1000) = 2000
      // autarky = 2000/3000 * 100 = 66.67 -> rounded to 67
      assert.equal(computeAutarky(3000, 1000), 67);
    });

    it('edge case: loadPower=0 -> autarky=0%', () => {
      assert.equal(computeAutarky(0, 0), 0);
    });

    it('edge case: loadPower undefined -> autarky=0%', () => {
      assert.equal(computeAutarky(undefined, 0), 0);
    });
  });

  describe('computeSelfConsumption', () => {
    it('pvPower=5000, gridPower=-2000 (exporting 2000) -> selfConsumption=60%', () => {
      // export = max(0, -(-2000)) = 2000. selfConsumed = 5000 - 2000 = 3000
      // rate = 3000/5000 * 100 = 60%
      assert.equal(computeSelfConsumption(5000, -2000), 60);
    });

    it('pvPower=0, loadPower=3000, gridPower=3000 -> selfConsumption=0%', () => {
      assert.equal(computeSelfConsumption(0, 3000), 0);
    });

    it('pvPower=2000, gridPower=1000 (importing) -> selfConsumption=100%', () => {
      // gridPower positive = importing, so export = max(0, -1000) = 0
      // selfConsumed = 2000 - 0 = 2000, rate = 100%
      assert.equal(computeSelfConsumption(2000, 1000), 100);
    });

    it('edge case: pvPower=0, loadPower=0 -> selfConsumption=0%', () => {
      assert.equal(computeSelfConsumption(0, 0), 0);
    });

    it('edge case: pvPower undefined -> selfConsumption=0%', () => {
      assert.equal(computeSelfConsumption(undefined, 0), 0);
    });
  });
});
