/**
 * WaterWise Deterministic Pool Volume, Recirculation Turnover & Chemical Adjustments Engine
 * Pure TypeScript — Zero UI or network dependencies.
 */

export type PoolShape = 'rectangular' | 'circular' | 'oval' | 'custom';
export type PoolUsageType = 'residential' | 'commercial';

export interface PoolInputs {
  shape: PoolShape;
  usageType: PoolUsageType;
  lengthM: number;         // Length (m) for rectangular/oval
  widthM: number;          // Width (m) for rectangular/oval
  diameterM: number;       // Diameter (m) for circular
  shallowDepthM: number;   // Shallow end depth (m)
  deepDepthM: number;      // Deep end depth (m)
  customVolumeM3: number;  // Direct volume (m³) if shape === 'custom'
  customTurnoverHours?: number; // Optional override for turnover period (hours)
  currentFreeCl2Ppm: number;
  targetFreeCl2Ppm: number;
  naoclConcentrationPercent: number;
  naoclDensityKgPerL: number;
  currentCyanuricAcidPpm: number;
  targetCyanuricAcidPpm: number;
}

export interface PoolResults {
  averageDepthM: number;
  surfaceAreaM2: number;
  volumeM3: number;
  volumeLiters: number;
  volumeUsGallons: number;
  recommendedTurnoverHours: number;
  recirculationFlowM3h: number;
  recirculationFlowLpm: number;
  recirculationFlowGpm: number;
  // Daily maintenance chlorine dose
  cl2DeficitPpm: number;
  maintenanceNaoclLiters: number;
  // Shock chlorination (10 ppm boost)
  shockNaoclLiters: number;
  // Cyanuric acid (CYA) stabilizer dose (kg)
  cyaNeededKg: number;
}

export function calculatePoolMetrics(inputs: PoolInputs): PoolResults {
  const shallow = Math.max(0, inputs.shallowDepthM);
  const deep = Math.max(0, inputs.deepDepthM);
  const averageDepthM = (shallow + deep) / 2;

  let surfaceAreaM2 = 0;
  let volumeM3 = 0;

  switch (inputs.shape) {
    case 'rectangular': {
      surfaceAreaM2 = Math.max(0, inputs.lengthM) * Math.max(0, inputs.widthM);
      volumeM3 = surfaceAreaM2 * averageDepthM;
      break;
    }
    case 'circular': {
      const radius = Math.max(0, inputs.diameterM) / 2;
      surfaceAreaM2 = Math.PI * radius * radius;
      volumeM3 = surfaceAreaM2 * averageDepthM;
      break;
    }
    case 'oval': {
      const a = Math.max(0, inputs.lengthM) / 2;
      const b = Math.max(0, inputs.widthM) / 2;
      surfaceAreaM2 = Math.PI * a * b;
      volumeM3 = surfaceAreaM2 * averageDepthM;
      break;
    }
    case 'custom': {
      volumeM3 = Math.max(0, inputs.customVolumeM3);
      surfaceAreaM2 = averageDepthM > 0 ? volumeM3 / averageDepthM : 0;
      break;
    }
  }

  const volumeLiters = volumeM3 * 1000;
  const volumeUsGallons = volumeM3 * 264.172;

  // Standard turnover rates: Commercial = 4 hours (or 6h), Residential = 8 hours
  const defaultTurnover = inputs.usageType === 'commercial' ? 4 : 8;
  const recommendedTurnoverHours =
    inputs.customTurnoverHours && inputs.customTurnoverHours > 0
      ? inputs.customTurnoverHours
      : defaultTurnover;

  const recirculationFlowM3h =
    recommendedTurnoverHours > 0 ? volumeM3 / recommendedTurnoverHours : 0;
  const recirculationFlowLpm = (recirculationFlowM3h * 1000) / 60;
  const recirculationFlowGpm = (recirculationFlowM3h * 264.172) / 60;

  // Chemical adjustments
  const concFraction = Math.max(0.01, inputs.naoclConcentrationPercent) / 100;
  const density = Math.max(0.1, inputs.naoclDensityKgPerL);

  const cl2DeficitPpm = Math.max(0, inputs.targetFreeCl2Ppm - inputs.currentFreeCl2Ppm);
  const cl2MassKg = (volumeM3 * cl2DeficitPpm) / 1000;
  const maintenanceNaoclLiters = cl2MassKg / (concFraction * density);

  // Shock dose (standard 10 ppm superchlorination)
  const shockMassKg = (volumeM3 * 10) / 1000;
  const shockNaoclLiters = shockMassKg / (concFraction * density);

  // Cyanuric acid stabilizer (100% dry granular)
  const cyaDeficitPpm = Math.max(0, inputs.targetCyanuricAcidPpm - inputs.currentCyanuricAcidPpm);
  const cyaNeededKg = (volumeM3 * cyaDeficitPpm) / 1000;

  return {
    averageDepthM,
    surfaceAreaM2,
    volumeM3,
    volumeLiters,
    volumeUsGallons,
    recommendedTurnoverHours,
    recirculationFlowM3h,
    recirculationFlowLpm,
    recirculationFlowGpm,
    cl2DeficitPpm,
    maintenanceNaoclLiters,
    shockNaoclLiters,
    cyaNeededKg,
  };
}
