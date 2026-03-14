import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeFlowLines } from '../public/components/dashboard/power-flow-compute.js';

describe('computeFlowLines', () => {
  it('PV producing 5000W, battery charging 2000W, grid exporting 1000W, load 2000W', () => {
    const lines = computeFlowLines({
      pvPower: 5000,
      batteryPower: 2000,   // charging
      gridPower: -1000,     // exporting
      loadPower: 2000,
    });

    const pvToBat = lines.find(l => l.from === 'pv' && l.to === 'battery');
    assert.ok(pvToBat.active, 'PV->Battery should be active');
    assert.equal(pvToBat.power, 2000);
    assert.equal(pvToBat.reverse, false);

    const pvToLoad = lines.find(l => l.from === 'pv' && l.to === 'load');
    assert.ok(pvToLoad.active, 'PV->Load should be active');
    assert.equal(pvToLoad.power, 2000);
    assert.equal(pvToLoad.reverse, false);

    const pvToGrid = lines.find(l => l.from === 'pv' && l.to === 'grid');
    assert.ok(pvToGrid.active, 'PV->Grid should be active');
    assert.equal(pvToGrid.power, 1000);
    assert.equal(pvToGrid.reverse, false);
  });

  it('Night: PV=0, grid importing 3000W, battery discharging 1000W', () => {
    const lines = computeFlowLines({
      pvPower: 0,
      batteryPower: -1000,  // discharging
      gridPower: 3000,      // importing
      loadPower: 4000,
    });

    const gridToLoad = lines.find(l => l.from === 'grid' && l.to === 'load');
    assert.ok(gridToLoad.active, 'Grid->Load should be active');
    assert.equal(gridToLoad.power, 3000);

    const batToLoad = lines.find(l => l.from === 'battery' && l.to === 'load');
    assert.ok(batToLoad.active, 'Battery->Load should be active');
    assert.equal(batToLoad.power, 1000);

    // PV lines should be inactive
    const pvLines = lines.filter(l => l.from === 'pv');
    for (const pl of pvLines) {
      assert.equal(pl.active, false, `PV->${pl.to} should be inactive at night`);
    }
  });

  it('All zeros -> no active flow lines', () => {
    const lines = computeFlowLines({
      pvPower: 0,
      batteryPower: 0,
      gridPower: 0,
      loadPower: 0,
    });

    for (const line of lines) {
      assert.equal(line.active, false, `${line.from}->${line.to} should be inactive`);
    }
  });

  it('EV charging 7000W from grid', () => {
    const lines = computeFlowLines({
      pvPower: 0,
      batteryPower: 0,
      gridPower: 10000,
      loadPower: 3000,
      evPower: 7000,
    });

    const gridToEv = lines.find(l => l.from === 'grid' && l.to === 'ev');
    assert.ok(gridToEv.active, 'Grid->EV should be active');
    assert.equal(gridToEv.power, 7000);
  });
});
