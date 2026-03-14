import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPlanScorer, chooseWinningPlan } from '../modules/optimizer/plan-scorer.js';

/**
 * Helper: create a canonical plan with sensible defaults.
 * 4 slots, each 15 min, reasonable SoC/power values.
 */
function makePlan(overrides = {}) {
  const now = new Date();
  const slots = (overrides.slots || [0, 1, 2, 3]).map((s, i) => {
    const slotData = typeof s === 'object' ? s : {};
    const start = new Date(now.getTime() + i * 15 * 60_000);
    const end = new Date(start.getTime() + 15 * 60_000);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      gridImportWh: 500,
      gridExportWh: 0,
      batteryChargeWh: 200,
      batteryDischargeWh: 0,
      targetSocPct: 60,
      expectedProfitEur: 0.25,
      meta: null,
      ...slotData,
    };
  });
  return {
    optimizer: 'eos',
    runId: overrides.runId || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    slots,
    ...Object.fromEntries(
      Object.entries(overrides).filter(([k]) => k !== 'slots' && k !== 'runId')
    ),
  };
}

describe('plan-scorer', () => {
  describe('scorePlan', () => {
    it('returns feasible with scores for a valid plan', () => {
      const scorer = createPlanScorer();
      const plan = makePlan();
      const result = scorer.scorePlan(plan);
      assert.equal(result.feasible, true);
      assert.equal(typeof result.economicScore, 'number');
      assert.equal(typeof result.socScore, 'number');
      assert.equal(typeof result.totalScore, 'number');
    });

    it('returns infeasible when targetSocPct exceeds maxSocPct', () => {
      const scorer = createPlanScorer({ maxSocPct: 90 });
      const plan = makePlan({ slots: [{ targetSocPct: 95 }] });
      const result = scorer.scorePlan(plan);
      assert.equal(result.feasible, false);
      assert.ok(result.reason.includes('exceeds max'));
    });

    it('returns infeasible when targetSocPct below minSocPct', () => {
      const scorer = createPlanScorer({ minSocPct: 10 });
      const plan = makePlan({ slots: [{ targetSocPct: 3 }] });
      const result = scorer.scorePlan(plan);
      assert.equal(result.feasible, false);
      assert.ok(result.reason.includes('below min'));
    });

    it('returns infeasible when gridImportWh exceeds maxGridImportWh', () => {
      const scorer = createPlanScorer({ maxGridImportWh: 3000 });
      const plan = makePlan({ slots: [{ gridImportWh: 4000 }] });
      const result = scorer.scorePlan(plan);
      assert.equal(result.feasible, false);
      assert.ok(result.reason.includes('exceeds max'));
    });

    it('economicScore equals sum of all slot expectedProfitEur', () => {
      const scorer = createPlanScorer();
      const plan = makePlan({
        slots: [
          { expectedProfitEur: 1.0 },
          { expectedProfitEur: 2.5 },
          { expectedProfitEur: -0.5 },
        ],
      });
      const result = scorer.scorePlan(plan);
      assert.equal(result.feasible, true);
      assert.ok(Math.abs(result.economicScore - 3.0) < 0.001);
    });

    it('socScore penalizes plans ending with low SoC (below 20%)', () => {
      const scorer = createPlanScorer();
      const lowSocPlan = makePlan({
        slots: [
          { targetSocPct: 60 },
          { targetSocPct: 50 },
          { targetSocPct: 30 },
          { targetSocPct: 10 },
        ],
      });
      const highSocPlan = makePlan({
        slots: [
          { targetSocPct: 60 },
          { targetSocPct: 50 },
          { targetSocPct: 40 },
          { targetSocPct: 50 },
        ],
      });
      const lowResult = scorer.scorePlan(lowSocPlan);
      const highResult = scorer.scorePlan(highSocPlan);
      assert.ok(lowResult.socScore < highResult.socScore);
    });

    it('totalScore uses configurable weights (default 0.7 economic + 0.3 soc)', () => {
      const scorer = createPlanScorer({ economicWeight: 0.7, socWeight: 0.3 });
      const plan = makePlan();
      const result = scorer.scorePlan(plan);
      const expected = result.economicScore * 0.7 + result.socScore * 0.3;
      assert.ok(Math.abs(result.totalScore - expected) < 0.001);
    });
  });

  describe('chooseWinningPlan', () => {
    it('returns { active: null, rejected: [] } for empty array', () => {
      const result = chooseWinningPlan([]);
      assert.equal(result.active, null);
      assert.deepEqual(result.rejected, []);
    });

    it('returns the only feasible plan as active', () => {
      const plan = { runId: 'a', score: { feasible: true, totalScore: 10 } };
      const result = chooseWinningPlan([plan]);
      assert.equal(result.active.runId, 'a');
      assert.equal(result.rejected.length, 0);
    });

    it('returns higher totalScore as active with two feasible plans', () => {
      const planA = { runId: 'a', score: { feasible: true, totalScore: 5 } };
      const planB = { runId: 'b', score: { feasible: true, totalScore: 15 } };
      const result = chooseWinningPlan([planA, planB]);
      assert.equal(result.active.runId, 'b');
      assert.equal(result.rejected.length, 1);
      assert.equal(result.rejected[0].runId, 'a');
    });

    it('returns best feasible as active, infeasible in rejected', () => {
      const feasible = { runId: 'f', score: { feasible: true, totalScore: 10 } };
      const infeasible = { runId: 'i', score: { feasible: false, reason: 'bad' } };
      const result = chooseWinningPlan([feasible, infeasible]);
      assert.equal(result.active.runId, 'f');
      assert.equal(result.rejected.length, 1);
      assert.equal(result.rejected[0].runId, 'i');
    });

    it('returns null active when all plans are infeasible', () => {
      const plans = [
        { runId: 'a', score: { feasible: false, reason: 'bad1' } },
        { runId: 'b', score: { feasible: false, reason: 'bad2' } },
      ];
      const result = chooseWinningPlan(plans);
      assert.equal(result.active, null);
      assert.equal(result.rejected.length, 2);
    });
  });
});
