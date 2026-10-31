/**
 * WaterWise Deterministic Chemical Dosing & Disinfection CT Engine
 * Pure TypeScript — Zero UI or network dependencies.
 */

export type DosingMode = 'chlorination' | 'dechlorination';
export type ContainerSizeLiters = 30 | 200 | 1000;

export interface PathogenCTTarget {
  id: string;
  nameEn: string;
  nameAr: string;
  requiredCT: number; // mg·min/L
  referenceNote: string;
}

/**
 * Standard Disinfection CT values preserved from WaterWise Calculator
 */
export const PATHOGEN_CT_TARGETS: PathogenCTTarget[] = [
  {
    id: 'ecoli',
    nameEn: 'E. coli & Enteric Bacteria',
    nameAr: 'بكتيريا الإيكولاي والبكتيريا المعوية',
    requiredCT: 8,
    referenceNote: 'WHO / EPA standard disinfection (8 mg·min/L)',
  },
  {
    id: 'viruses',
    nameEn: 'Enteric Viruses (4-log)',
    nameAr: 'الفيروسات المعوية (4-log)',
    requiredCT: 15,
    referenceNote: '4-log viral inactivation at 15–25°C, pH 6–9',
  },
  {
    id: 'giardia',
    nameEn: 'Giardia lamblia Cysts (3-log)',
    nameAr: 'حويصلات الجيارديا (3-log)',
    requiredCT: 65,
    referenceNote: '3-log cyst inactivation at pH 7.5, 20°C',
  },
  {
    id: 'legionella',
    nameEn: 'Legionella (Tank Hyperchlorination)',
    nameAr: 'الليجيونيلا (تعقيم الخزانات الفائق)',
    requiredCT: 3000,
    referenceNote: '50 ppm for 60 min or 20 ppm for 150 min (BS 8558 / ASHRAE 188)',
  },
];

export const SMBS_STOICHIOMETRIC_RATIO = 1.34; // 1.34 mg SMBS per 1.0 mg Free Cl2

export interface DosingInputs {
  mode: DosingMode;
  systemVolumeM3: number;       // System water volume (m³)
  targetPpm: number;            // Target Cl2 (ppm) or Initial Cl2 to neutralize (ppm)
  concentrationPercent: number; // Stock chemical concentration (%, e.g., 5, 7.5, 10, 12.5)
  densityKgPerL: number;        // Stock chemical density (kg/L, default 1.18 for NaOCl)
  containerSizeL: ContainerSizeLiters;
  // CT Verification optional parameters
  recirculationFlowLh: number;  // Flow rate in L/h
  selectedPathogenId: string;
}

export interface DosingResults {
  mode: DosingMode;
  activeMassKg: number;          // Pure Cl2 or Pure SMBS mass (kg)
  activeMassGrams: number;       // Pure mass (g)
  liquidVolumeLiters: number;    // Required commercial solution volume (L)
  liquidVolumeMl: number;        // Required commercial solution volume (mL)
  solutionMassKg: number;        // Total weight of liquid solution (kg)
  containersNeeded: number;      // Exact fractional number of containers
  containersRoundedUp: number;   // Whole containers needed
  containerSizeL: ContainerSizeLiters;
  // CT Verification outputs
  contactTimeMinutes: number;
  achievedCT: number;            // mg·min/L
  requiredCT: number;            // mg·min/L
  ctSafetyRatio: number;         // achievedCT / requiredCT
  ctCompliant: boolean;
}

export function calculateDosing(inputs: DosingInputs): DosingResults {
  const volumeM3 = Math.max(0, inputs.systemVolumeM3);
  const ppm = Math.max(0, inputs.targetPpm);
  const concPct = Math.max(0.01, inputs.concentrationPercent);
  const density = Math.max(0.1, inputs.densityKgPerL);

  // 1. Active chemical mass (kg)
  // For chlorination: Mass Cl2 (kg) = (Volume m³ * Target ppm) / 1000
  // For dechlorination (SMBS): Mass SMBS (kg) = (Volume m³ * Initial Cl2 ppm * 1.34) / 1000
  const baseCl2MassKg = (volumeM3 * ppm) / 1000;
  const activeMassKg =
    inputs.mode === 'dechlorination'
      ? baseCl2MassKg * SMBS_STOICHIOMETRIC_RATIO
      : baseCl2MassKg;

  const activeMassGrams = activeMassKg * 1000;

  // 2. Commercial liquid chemical volume (L)
  // Liquid Volume (L) = Mass (kg) / ((Conc% / 100) * Density (kg/L))
  const concFraction = concPct / 100;
  const liquidVolumeLiters = activeMassKg / (concFraction * density);
  const liquidVolumeMl = liquidVolumeLiters * 1000;
  const solutionMassKg = liquidVolumeLiters * density;

  // 3. Container breakdown
  const containersNeeded = liquidVolumeLiters / inputs.containerSizeL;
  const containersRoundedUp = Math.ceil(containersNeeded);

  // 4. Contact Time (CT) Verification
  // System Volume in Liters = volumeM3 * 1000
  // Contact time (minutes) = (Volume_L / Flow_L_per_h) * 60
  const volumeLiters = volumeM3 * 1000;
  const flowLh = Math.max(0, inputs.recirculationFlowLh);
  const contactTimeMinutes = flowLh > 0 ? (volumeLiters / flowLh) * 60 : 0;
  const achievedCT = contactTimeMinutes * ppm;

  const pathogen =
    PATHOGEN_CT_TARGETS.find((p) => p.id === inputs.selectedPathogenId) ||
    PATHOGEN_CT_TARGETS[0];

  const requiredCT = pathogen.requiredCT;
  const ctSafetyRatio = requiredCT > 0 ? achievedCT / requiredCT : 0;
  const ctCompliant = achievedCT >= requiredCT;

  return {
    mode: inputs.mode,
    activeMassKg,
    activeMassGrams,
    liquidVolumeLiters,
    liquidVolumeMl,
    solutionMassKg,
    containersNeeded,
    containersRoundedUp,
    containerSizeL: inputs.containerSizeL,
    contactTimeMinutes,
    achievedCT,
    requiredCT,
    ctSafetyRatio,
    ctCompliant,
  };
}
