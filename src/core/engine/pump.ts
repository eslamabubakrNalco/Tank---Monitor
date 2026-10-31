/**
 * WaterWise Deterministic Chemical Dosing Pump Sizing & Calibration Engine
 * Pure TypeScript — Zero UI or network dependencies.
 */

export type FlowRateUnit = 'm3_per_h' | 'm3_per_day';

export interface PumpInputs {
  waterFlowRate: number;            // Water flow value
  flowUnit: FlowRateUnit;           // m³/h or m³/day
  targetDosePpm: number;            // Target dose (mg/L or ppm)
  stockConcentrationPercent: number;// Commercial stock concentration (%)
  densityKgPerL: number;            // Solution density (kg/L)
  isDiluted: boolean;               // Day-tank dilution enabled
  chemicalAddedLiters: number;      // Liters of stock chemical added to day tank
  dayTankTotalVolumeLiters: number; // Total volume of day tank (L)
  pumpMaxCapacityLh: number;        // Rated max pump flow rate (L/h)
  selectedStrokePercent: number;    // Manual stroke length setting (%, e.g., 70%–80% optimal)
}

export interface PumpResults {
  normalizedWaterFlowM3h: number;
  normalizedWaterFlowM3Day: number;
  effectiveConcentrationPercent: number;
  effectiveDensityKgPerL: number;
  requiredPumpFlowLh: number;
  requiredPumpFlowMlMin: number;
  dailyChemicalConsumptionL: number;
  dayTankAutonomyHours: number;
  pumpUtilizationPercent: number;
  requiredSpeedPercentAtStroke: number;
  status: 'optimal' | 'under_sized' | 'over_sized' | 'stroke_warning';
}

export function calculatePumpCalibration(inputs: PumpInputs): PumpResults {
  const normalizedWaterFlowM3h =
    inputs.flowUnit === 'm3_per_day'
      ? Math.max(0, inputs.waterFlowRate) / 24
      : Math.max(0, inputs.waterFlowRate);

  const normalizedWaterFlowM3Day = normalizedWaterFlowM3h * 24;
  const stockConc = Math.max(0.01, inputs.stockConcentrationPercent);
  const stockDensity = Math.max(0.1, inputs.densityKgPerL);

  // Day-tank dilution math
  let effectiveConcentrationPercent = stockConc;
  let effectiveDensityKgPerL = stockDensity;

  if (inputs.isDiluted && inputs.dayTankTotalVolumeLiters > 0) {
    const ratio = Math.min(
      1,
      Math.max(0.001, inputs.chemicalAddedLiters / inputs.dayTankTotalVolumeLiters)
    );
    effectiveConcentrationPercent = stockConc * ratio;
    // Diluted density interpolates between water (1.0 kg/L) and stock density
    effectiveDensityKgPerL = 1 + (stockDensity - 1) * ratio;
  }

  // Core formula from WaterWise:
  // Required Pump Flow (L/h) = (Water Flow (m³/h) * Target Dose (ppm)) / (Effective Conc % * 10 * Density (kg/L))
  const requiredPumpFlowLh =
    (normalizedWaterFlowM3h * Math.max(0, inputs.targetDosePpm)) /
    (effectiveConcentrationPercent * 10 * effectiveDensityKgPerL);

  const requiredPumpFlowMlMin = (requiredPumpFlowLh * 1000) / 60;
  const dailyChemicalConsumptionL = requiredPumpFlowLh * 24;

  const dayTankAutonomyHours =
    requiredPumpFlowLh > 0 && inputs.dayTankTotalVolumeLiters > 0
      ? inputs.dayTankTotalVolumeLiters / requiredPumpFlowLh
      : 0;

  const maxCap = Math.max(0.01, inputs.pumpMaxCapacityLh);
  const pumpUtilizationPercent = (requiredPumpFlowLh / maxCap) * 100;

  // Pump output = MaxCapacity * (Stroke% / 100) * (Speed% / 100)
  // Therefore Required Speed % = PumpUtilization% / (Stroke% / 100)
  const strokeFraction = Math.max(0.05, inputs.selectedStrokePercent / 100);
  const requiredSpeedPercentAtStroke = pumpUtilizationPercent / strokeFraction;

  let status: PumpResults['status'] = 'optimal';
  if (pumpUtilizationPercent > 100) {
    status = 'under_sized'; // Pump max capacity is too small
  } else if (pumpUtilizationPercent < 10) {
    status = 'over_sized'; // Pump is running below 10% turndown ratio
  } else if (requiredSpeedPercentAtStroke > 100) {
    status = 'stroke_warning'; // Need higher stroke % to achieve flow
  }

  return {
    normalizedWaterFlowM3h,
    normalizedWaterFlowM3Day,
    effectiveConcentrationPercent,
    effectiveDensityKgPerL,
    requiredPumpFlowLh,
    requiredPumpFlowMlMin,
    dailyChemicalConsumptionL,
    dayTankAutonomyHours,
    pumpUtilizationPercent,
    requiredSpeedPercentAtStroke,
    status,
  };
}
