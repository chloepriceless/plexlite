/**
 * Plan Engine -- Stores optimization plans, scores them, and manages the active (winning) plan.
 *
 * The active plan is exposed via RxJS BehaviorSubject for event bus integration.
 * History is capped at a configurable maximum with newest-first ordering.
 */

import { BehaviorSubject } from 'rxjs';
import { chooseWinningPlan } from './plan-scorer.js';

/**
 * Create a plan engine that receives, scores, and manages optimization plans.
 * @param {object} options
 * @param {object} options.scorer - Plan scorer instance with scorePlan(plan) method
 * @param {number} [options.maxHistory=50] - Maximum plans kept in memory
 * @returns {{ submitPlan, getActivePlan, getActivePlan$, getHistory, clearActivePlan, destroy }}
 */
export function createPlanEngine({ scorer, maxHistory = 50 } = {}) {
  const activePlan$ = new BehaviorSubject(null);

  /** @type {Array<{ plan: object, score: object, receivedAt: string }>} */
  const history = [];

  /**
   * Submit a plan for scoring and potential activation.
   * @param {object} plan - Canonical plan object
   * @returns {{ entry: object, isNewWinner: boolean }}
   */
  function submitPlan(plan) {
    const score = scorer.scorePlan(plan);
    const entry = { plan, score, receivedAt: new Date().toISOString() };

    // Add to history (newest first)
    history.unshift(entry);
    if (history.length > maxHistory) {
      history.length = maxHistory;
    }

    // Re-evaluate winner from all feasible entries
    const feasibleCandidates = history
      .filter(h => h.score.feasible !== false)
      .map(h => ({ ...h.plan, score: h.score }));

    const result = chooseWinningPlan(feasibleCandidates);

    if (result.active) {
      activePlan$.next(result.active);
    } else {
      activePlan$.next(null);
    }

    return {
      entry,
      isNewWinner: result.active?.runId === plan.runId,
    };
  }

  /**
   * Get the current active (winning) plan synchronously.
   * @returns {object|null}
   */
  function getActivePlan() {
    return activePlan$.getValue();
  }

  /**
   * Get an observable of the active plan stream.
   * @returns {Observable}
   */
  function getActivePlan$() {
    return activePlan$.asObservable();
  }

  /**
   * Get submission history, newest first.
   * @param {object} [options]
   * @param {number} [options.limit] - Maximum entries to return
   * @returns {Array<{ plan, score, receivedAt }>}
   */
  function getHistory({ limit } = {}) {
    return limit ? history.slice(0, limit) : [...history];
  }

  /**
   * Clear the active plan (set to null).
   */
  function clearActivePlan() {
    activePlan$.next(null);
  }

  /**
   * Destroy the engine, completing all streams.
   */
  function destroy() {
    activePlan$.complete();
  }

  return { submitPlan, getActivePlan, getActivePlan$, getHistory, clearActivePlan, destroy };
}
