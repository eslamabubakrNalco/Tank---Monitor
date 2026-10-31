import { describe, it, expect } from 'vitest';
import { calculateDosing } from '../dosing';
import { calculatePumpCalibration } from '../pump';
import { calculatePoolMetrics } from '../pool';
import {
  hashStr,
  generatePasswordForPeriod,
  verifyAccessPassword,
  ADMIN_BYPASS_CODE,
} from '../../auth/passwordRotation';

describe('WaterWise Deterministic Calculation Engine', () => {
  it('calculates NaOCl dosing mass and liquid volume accurately', () => {
    // 1000 m³ tank, 2 ppm target Cl2, 12.5% NaOCl, density 1.18 kg/L
    const res = calculateDosing({
      mode: 'chlorination',
      systemVolumeM3: 1000,
      targetPpm: 2,
      concentrationPercent: 12.5,
      densityKgPerL: 1.18,
      containerSizeL: 30,
      recirculationFlowLh: 50000,
      selectedPathogenId: 'ecoli',
    });

    // Mass Cl2 = (1000 * 2) / 1000 = 2.0 kg
    expect(res.activeMassKg).toBeCloseTo(2.0, 5);
    // Liquid L = 2.0 / (0.125 * 1.18) = 13.5593 L
    expect(res.liquidVolumeLiters).toBeCloseTo(13.5593, 3);
    expect(res.containersRoundedUp).toBe(1);
    expect(res.ctCompliant).toBe(true);
  });

  it('calculates SMBS dechlorination with 1.34x stoichiometric ratio', () => {
    const res = calculateDosing({
      mode: 'dechlorination',
      systemVolumeM3: 500,
      targetPpm: 10,
      concentrationPercent: 10,
      densityKgPerL: 1.2,
      containerSizeL: 200,
      recirculationFlowLh: 25000,
      selectedPathogenId: 'ecoli',
    });

    // Base Cl2 = 5 kg -> SMBS = 5 * 1.34 = 6.7 kg
    expect(res.activeMassKg).toBeCloseTo(6.7, 4);
  });

  it('calculates chemical dosing pump flow rate and stroke/speed calibration', () => {
    const res = calculatePumpCalibration({
      waterFlowRate: 100,
      flowUnit: 'm3_per_h',
      targetDosePpm: 2.5,
      stockConcentrationPercent: 12.5,
      densityKgPerL: 1.18,
      isDiluted: false,
      chemicalAddedLiters: 50,
      dayTankTotalVolumeLiters: 100,
      pumpMaxCapacityLh: 5.0,
      selectedStrokePercent: 80,
    });

    // Required L/h = (100 * 2.5) / (12.5 * 10 * 1.18) = 250 / 147.5 = 1.6949 L/h
    expect(res.requiredPumpFlowLh).toBeCloseTo(1.6949, 3);
    expect(res.status).toBe('optimal');
  });

  it('calculates pool geometries and turnover flow rates', () => {
    const res = calculatePoolMetrics({
      shape: 'rectangular',
      usageType: 'commercial',
      lengthM: 25,
      widthM: 12.5,
      diameterM: 10,
      shallowDepthM: 1.2,
      deepDepthM: 2.0,
      customVolumeM3: 500,
      currentFreeCl2Ppm: 0.5,
      targetFreeCl2Ppm: 2.0,
      naoclConcentrationPercent: 12.5,
      naoclDensityKgPerL: 1.18,
      currentCyanuricAcidPpm: 10,
      targetCyanuricAcidPpm: 40,
    });

    // Avg depth = 1.6 m, Area = 312.5 m², Volume = 500 m³
    expect(res.volumeM3).toBeCloseTo(500, 3);
    // Commercial 4h turnover -> 125 m³/h
    expect(res.recirculationFlowM3h).toBeCloseTo(125, 3);
  });

  it('rotates passwords deterministically every 3 days and supports WW2025-ADMIN', () => {
    const p1 = generatePasswordForPeriod(120);
    const p2 = generatePasswordForPeriod(120);
    expect(p1).toBe(p2);
    expect(hashStr('WW20250')).toBeGreaterThan(0);

    const adminCheck = verifyAccessPassword(ADMIN_BYPASS_CODE);
    expect(adminCheck.valid).toBe(true);
    expect(adminCheck.isAdmin).toBe(true);
  });
});
