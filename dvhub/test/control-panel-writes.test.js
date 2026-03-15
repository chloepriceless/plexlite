import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPendingState,
  resolvePendingState,
  computeRenderState
} from '../public/components/dashboard/control-compute.js';

// --- createPendingState ---

test('createPendingState returns object with previousReadback, targetValue, submittedAt', () => {
  const result = createPendingState({
    currentReadback: 14,
    submittedValue: 20,
    submittedAt: 1234
  });
  assert.deepEqual(result, {
    previousReadback: 14,
    targetValue: 20,
    submittedAt: 1234
  });
});

test('createPendingState defaults submittedAt to Date.now()', () => {
  const before = Date.now();
  const result = createPendingState({ currentReadback: 10, submittedValue: 30 });
  const after = Date.now();
  assert.equal(result.previousReadback, 10);
  assert.equal(result.targetValue, 30);
  assert.ok(result.submittedAt >= before && result.submittedAt <= after);
});

// --- resolvePendingState ---

test('resolvePendingState returns null when readback matches target (confirmed)', () => {
  const pending = { previousReadback: 14, targetValue: 20, submittedAt: 1234 };
  const result = resolvePendingState({ pendingState: pending, readbackValue: 20 });
  assert.equal(result, null);
});

test('resolvePendingState returns null when readback changed to different value (someone else wrote)', () => {
  const pending = { previousReadback: 14, targetValue: 20, submittedAt: 1234 };
  const result = resolvePendingState({ pendingState: pending, readbackValue: 50 });
  assert.equal(result, null);
});

test('resolvePendingState returns pendingState when readback has not changed yet', () => {
  const pending = { previousReadback: 14, targetValue: 20, submittedAt: 1234 };
  const result = resolvePendingState({ pendingState: pending, readbackValue: 14 });
  assert.deepEqual(result, pending);
});

test('resolvePendingState returns pendingState when readbackValue is null', () => {
  const pending = { previousReadback: 14, targetValue: 20, submittedAt: 1234 };
  const result = resolvePendingState({ pendingState: pending, readbackValue: null });
  assert.deepEqual(result, pending);
});

test('resolvePendingState returns null when no pendingState', () => {
  const result = resolvePendingState({ pendingState: null, readbackValue: 20 });
  assert.equal(result, null);
});

// --- computeRenderState ---

test('computeRenderState shouldBlink is true when pending', () => {
  const pending = { previousReadback: 14, targetValue: 20, submittedAt: 1234 };
  const result = computeRenderState({ readbackValue: 14, pendingState: pending });
  assert.equal(result.shouldBlink, true);
  assert.deepEqual(result.pendingState, pending);
});

test('computeRenderState shouldBlink is false when confirmed', () => {
  const pending = { previousReadback: 14, targetValue: 20, submittedAt: 1234 };
  const result = computeRenderState({ readbackValue: 20, pendingState: pending });
  assert.equal(result.shouldBlink, false);
  assert.equal(result.pendingState, null);
});

test('computeRenderState shouldBlink is false when no pending state', () => {
  const result = computeRenderState({ readbackValue: 14, pendingState: null });
  assert.equal(result.shouldBlink, false);
  assert.equal(result.pendingState, null);
});
