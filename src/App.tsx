import React, { useState, useMemo, useEffect } from 'react';
import {
  Droplets,
  Gauge,
  Waves,
  FolderKanban,
  Sparkles,
  FileText,
  Lock,
  Unlock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Save,
  Trash2,
  Printer,
  Copy,
  Check,
  KeyRound,
  Info,
  Beaker,
  RefreshCw,
} from 'lucide-react';

/**
 * ============================================================================
 * 1. CORE DETERMINISTIC AUTHENTICATION & 3-DAY PASSWORD ROTATION ENGINE
 * Preserved verbatim from Eslam Abubakr's original WaterWise Calculator
 * ============================================================================
 */
export const MASTER_SECRET = 'WW2025';
export const ADMIN_BYPASS_CODE = 'WW2025-ADMIN';
export const ROTATION_EPOCH_UTC = Date.UTC(2025, 0, 1);
export const THREE_DAYS_MS = 3 * 86400000;

export const WORD_BANK = [
  'WATER',
  'DOSE',
  'PUMP',
  'FLOW',
  'NALCO',
  'CHEM',
  'SAFE',
  'TREAT',
  'KAFD',
  'ESLAM',
] as const;

export interface PasswordScheduleEntry {
  periodIndex: number;
  password: string;
  startDateISO: string;
  endDateISO: string;
  isCurrent: boolean;
}

export function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getPeriodIndex(timestampMs: number = Date.now()): number {
  return Math.floor((timestampMs - ROTATION_EPOCH_UTC) / THREE_DAYS_MS);
}

export function generatePasswordForPeriod(periodIndex: number): string {
  const hash = hashStr(`${MASTER_SECRET}${periodIndex}`);
  const word = WORD_BANK[hash % WORD_BANK.length];
  const digits = String(hash % 10000).padStart(4, '0');
  return `${word}-${digits}`;
}

export function verifyAccessPassword(
  input: string,
  timestampMs: number = Date.now()
): { valid: boolean; isAdmin: boolean; currentPassword: string } {
  const normalized = input.trim().toUpperCase();
  const currentPeriod = getPeriodIndex(timestampMs);
  const currentPassword = generatePasswordForPeriod(currentPeriod);

  if (normalized === ADMIN_BYPASS_CODE) {
    return { valid: true, isAdmin: true, currentPassword };
  }
  if (normalized === currentPassword) {
    return { valid: true, isAdmin: false, currentPassword };
  }
  return { valid: false, isAdmin: false, currentPassword };
}

export function getPasswordSchedule(
  timestampMs: number = Date.now(),
  pastPeriods: number = 2,
  futurePeriods: number = 6
): PasswordScheduleEntry[] {
  const currentPeriod = getPeriodIndex(timestampMs);
  const schedule: PasswordScheduleEntry[] = [];

  for (let offset = -pastPeriods; offset <= futurePeriods; offset++) {
    const p = currentPeriod + offset;
    const startMs = ROTATION_EPOCH_UTC + p * THREE_DAYS_MS;
    const endMs = startMs + THREE_DAYS_MS;
    schedule.push({
      periodIndex: p,
      password: generatePasswordForPeriod(p),
      startDateISO: new Date(startMs).toISOString().slice(0, 10),
      endDateISO: new Date(endMs).toISOString().slice(0, 10),
      isCurrent: offset === 0,
    });
  }
  return schedule;
}

/**
 * ============================================================================
 * 2. CORE DETERMINISTIC ENGINEERING CALCULATION ENGINE (100% OFFLINE)
 * ============================================================================
 */
export type DosingMode = 'chlorination' | 'dechlorination';
export type ContainerSizeLiters = 30 | 200 | 1000;
export type FlowRateUnit = 'm3_per_h' | 'm3_per_day';
export type PoolShape = 'rectangular' | 'circular' | 'oval' | 'custom';
export type PoolUsageType = 'residential' | 'commercial';

export interface PathogenCTTarget {
  id: string;
  nameEn: string;
  nameAr: string;
  bilingualLabel: string;
  requiredCT: number;
  referenceNote: string;
}

export const PATHOGEN_CT_TARGETS: PathogenCTTarget[] = [
  {
    id: 'ecoli',
    nameEn: 'E. coli & Enteric Bacteria (CT = 8)',
    nameAr: 'بكتيريا الإيكولاي والمعوية (CT = 8)',
    bilingualLabel: 'بكتيريا الإيكولاي · E. coli & Enteric Bacteria (CT = 8)',
    requiredCT: 8,
    referenceNote: 'WHO / EPA standard disinfection (8 mg·min/L)',
  },
  {
    id: 'viruses',
    nameEn: 'Enteric Viruses 4-log (CT = 15)',
    nameAr: 'الفيروسات المعوية 4-log (CT = 15)',
    bilingualLabel: 'الفيروسات المعوية · Enteric Viruses 4-log (CT = 15)',
    requiredCT: 15,
    referenceNote: '4-log viral inactivation at 15–25°C, pH 6–9',
  },
  {
    id: 'giardia',
    nameEn: 'Giardia lamblia Cysts 3-log (CT = 65)',
    nameAr: 'حويصلات الجيارديا 3-log (CT = 65)',
    bilingualLabel: 'حويصلات الجيارديا · Giardia Cysts 3-log (CT = 65)',
    requiredCT: 65,
    referenceNote: '3-log cyst inactivation at pH 7.5, 20°C',
  },
  {
    id: 'legionella',
    nameEn: 'Legionella Tank Hyperchlorination (CT = 3000)',
    nameAr: 'الليجيونيلا - تعقيم الخزانات الفائق (CT = 3000)',
    bilingualLabel: 'الليجيونيلا (تعقيم الخزانات) · Legionella Hyperchlorination (CT = 3000)',
    requiredCT: 3000,
    referenceNote: '50 ppm for 60 min or 20 ppm for 150 min (BS 8558)',
  },
];

export const SMBS_STOICHIOMETRIC_RATIO = 1.34;

export interface DosingInputs {
  mode: DosingMode;
  systemVolumeM3: number;
  targetPpm: number;
  concentrationPercent: number;
  densityKgPerL: number;
  containerSizeL: ContainerSizeLiters;
  recirculationFlowLh: number;
  selectedPathogenId: string;
}

export interface DosingResults {
  mode: DosingMode;
  activeMassKg: number;
  activeMassGrams: number;
  liquidVolumeLiters: number;
  liquidVolumeMl: number;
  solutionMassKg: number;
  containersNeeded: number;
  containersRoundedUp: number;
  containerSizeL: ContainerSizeLiters;
  contactTimeMinutes: number;
  achievedCT: number;
  requiredCT: number;
  ctSafetyRatio: number;
  ctCompliant: boolean;
}

export function calculateDosing(inputs: DosingInputs): DosingResults {
  const volumeM3 = Math.max(0, inputs.systemVolumeM3);
  const ppm = Math.max(0, inputs.targetPpm);
  const concPct = Math.max(0.01, inputs.concentrationPercent);
  const density = Math.max(0.1, inputs.densityKgPerL);

  const baseCl2MassKg = (volumeM3 * ppm) / 1000;
  const activeMassKg =
    inputs.mode === 'dechlorination'
      ? baseCl2MassKg * SMBS_STOICHIOMETRIC_RATIO
      : baseCl2MassKg;

  const activeMassGrams = activeMassKg * 1000;
  const concFraction = concPct / 100;
  const liquidVolumeLiters = activeMassKg / (concFraction * density);
  const liquidVolumeMl = liquidVolumeLiters * 1000;
  const solutionMassKg = liquidVolumeLiters * density;

  const containersNeeded = liquidVolumeLiters / inputs.containerSizeL;
  const containersRoundedUp = Math.ceil(containersNeeded);

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

export interface PumpInputs {
  waterFlowRate: number;
  flowUnit: FlowRateUnit;
  targetDosePpm: number;
  stockConcentrationPercent: number;
  densityKgPerL: number;
  isDiluted: boolean;
  chemicalAddedLiters: number;
  dayTankTotalVolumeLiters: number;
  pumpMaxCapacityLh: number;
  selectedStrokePercent: number;
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

  let effectiveConcentrationPercent = stockConc;
  let effectiveDensityKgPerL = stockDensity;

  if (inputs.isDiluted && inputs.dayTankTotalVolumeLiters > 0) {
    const ratio = Math.min(
      1,
      Math.max(0.001, inputs.chemicalAddedLiters / inputs.dayTankTotalVolumeLiters)
    );
    effectiveConcentrationPercent = stockConc * ratio;
    effectiveDensityKgPerL = 1 + (stockDensity - 1) * ratio;
  }

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

  const strokeFraction = Math.max(0.05, inputs.selectedStrokePercent / 100);
  const requiredSpeedPercentAtStroke = pumpUtilizationPercent / strokeFraction;

  let status: PumpResults['status'] = 'optimal';
  if (pumpUtilizationPercent > 100) {
    status = 'under_sized';
  } else if (pumpUtilizationPercent < 10) {
    status = 'over_sized';
  } else if (requiredSpeedPercentAtStroke > 100) {
    status = 'stroke_warning';
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

export interface PoolInputs {
  shape: PoolShape;
  usageType: PoolUsageType;
  lengthM: number;
  widthM: number;
  diameterM: number;
  shallowDepthM: number;
  deepDepthM: number;
  customVolumeM3: number;
  customTurnoverHours: number;
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
  cl2DeficitPpm: number;
  maintenanceNaoclLiters: number;
  shockNaoclLiters: number;
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

  const defaultTurnover = inputs.usageType === 'commercial' ? 4 : 8;
  const recommendedTurnoverHours =
    inputs.customTurnoverHours > 0 ? inputs.customTurnoverHours : defaultTurnover;

  const recirculationFlowM3h =
    recommendedTurnoverHours > 0 ? volumeM3 / recommendedTurnoverHours : 0;
  const recirculationFlowLpm = (recirculationFlowM3h * 1000) / 60;
  const recirculationFlowGpm = (recirculationFlowM3h * 264.172) / 60;

  const concFraction = Math.max(0.01, inputs.naoclConcentrationPercent) / 100;
  const density = Math.max(0.1, inputs.naoclDensityKgPerL);

  const cl2DeficitPpm = Math.max(0, inputs.targetFreeCl2Ppm - inputs.currentFreeCl2Ppm);
  const cl2MassKg = (volumeM3 * cl2DeficitPpm) / 1000;
  const maintenanceNaoclLiters = cl2MassKg / (concFraction * density);

  const shockMassKg = (volumeM3 * 10) / 1000;
  const shockNaoclLiters = shockMassKg / (concFraction * density);

  const cyaDeficitPpm = Math.max(
    0,
    inputs.targetCyanuricAcidPpm - inputs.currentCyanuricAcidPpm
  );
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

/**
 * ============================================================================
 * 3. OFFLINE PROJECT STORAGE REPOSITORY (SAFE LOCALSTORAGE + CAPACITOR READY)
 * ============================================================================
 */
export interface SavedWaterWiseProject {
  id: string;
  projectName: string;
  siteLocation: string;
  engineerName: string;
  notes: string;
  updatedAtISO: string;
  dosing: DosingInputs;
  pump: PumpInputs;
  pool: PoolInputs;
}

const STORAGE_KEY = 'waterwise_saved_projects_v2';

const DEFAULT_SAMPLE_PROJECTS: SavedWaterWiseProject[] = [
  {
    id: 'kafd-tower-tank-01',
    projectName: 'KAFD Cooling & Potable Tank Disinfection',
    siteLocation: 'Riyadh · KAFD Parcel 3',
    engineerName: 'Eslam Abubakr',
    notes: 'Potable concrete break tank chlorination and dosing skid verification',
    updatedAtISO: '2026-10-31T16:00:00.000Z',
    dosing: {
      mode: 'chlorination',
      systemVolumeM3: 450,
      targetPpm: 2.0,
      concentrationPercent: 12.5,
      densityKgPerL: 1.18,
      containerSizeL: 200,
      recirculationFlowLh: 45000,
      selectedPathogenId: 'ecoli',
    },
    pump: {
      waterFlowRate: 85,
      flowUnit: 'm3_per_h',
      targetDosePpm: 2.0,
      stockConcentrationPercent: 12.5,
      densityKgPerL: 1.18,
      isDiluted: true,
      chemicalAddedLiters: 25,
      dayTankTotalVolumeLiters: 100,
      pumpMaxCapacityLh: 8.0,
      selectedStrokePercent: 75,
    },
    pool: {
      shape: 'rectangular',
      usageType: 'commercial',
      lengthM: 25,
      widthM: 12,
      diameterM: 10,
      shallowDepthM: 1.2,
      deepDepthM: 1.8,
      customVolumeM3: 450,
      customTurnoverHours: 4,
      currentFreeCl2Ppm: 0.5,
      targetFreeCl2Ppm: 2.0,
      naoclConcentrationPercent: 12.5,
      naoclDensityKgPerL: 1.18,
      currentCyanuricAcidPpm: 15,
      targetCyanuricAcidPpm: 40,
    },
  },
];

function loadSavedProjects(): SavedWaterWiseProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAMPLE_PROJECTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SAMPLE_PROJECTS;
  } catch {
    return DEFAULT_SAMPLE_PROJECTS;
  }
}

function persistProjects(projects: SavedWaterWiseProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Ignore storage quota or sandbox restrictions
  }
}

/**
 * ============================================================================
 * 4. OPTIONAL CLOUD / AI SERVICE LAYER (OPENAI & CLAUDE + OFFLINE FALLBACK)
 * Dual Bilingual (Arabic + English) Terminology in Reports
 * ============================================================================
 */
export type AIProvider = 'offline_heuristic' | 'openai' | 'claude';

export function buildDeterministicEngineeringAudit(
  projectName: string,
  siteLocation: string,
  dosing: DosingResults,
  pump: PumpResults,
  pool: PoolResults,
  _lang: 'ar' | 'en'
): string {
  const ctStatusBilingual = dosing.ctCompliant
    ? `[PASS] تحقق زمن التلامس (CT Verification Compliant): Achieved المحقق ${dosing.achievedCT.toFixed(1)} mg·min/L ≥ Required المطلوب ${dosing.requiredCT} mg·min/L (Safety Factor معامل الأمان: ${dosing.ctSafetyRatio.toFixed(1)}x)`
    : `[FAIL] عجز زمن التلامس (Disinfection CT Deficit): Achieved المحقق ${dosing.achievedCT.toFixed(1)} mg·min/L < Required المطلوب ${dosing.requiredCT} mg·min/L — Increase Retention Time or Target Dose (ارفع زمن المكث أو الجرعة)`;

  const pumpStatusBilingual =
    pump.status === 'optimal'
      ? `[PASS] معايرة المضخة مثالية (Optimal Pump Sizing): Capacity Utilization استغلال السعة ${pump.pumpUtilizationPercent.toFixed(1)}% | Required Speed السرعة المطلوبة: ${pump.requiredSpeedPercentAtStroke.toFixed(1)}%`
      : pump.status === 'under_sized'
      ? `[FAIL] سعة المضخة غير كافية (Pump Under-Sized): Required Output التدفق المطلوب (${pump.requiredPumpFlowLh.toFixed(2)} L/h) > Max Capacity (${pump.pumpUtilizationPercent.toFixed(1)}%)`
      : `[CAUTION] تنبيه ضبط الشوط والسرعة (Stroke / Speed Calibration Notice): Required Speed السرعة المطلوبة ${pump.requiredSpeedPercentAtStroke.toFixed(1)}% — Keep Stroke between 70%–85%`;

  return [
    `📋 التقرير الهندسي المزدوج · Engineering Verification Report`,
    `Project / المشروع: ${projectName} | Location / الموقع: ${siteLocation}`,
    `════════════════════════════════════════════════════════════════`,
    `1️⃣ الجرعات الكيميائية والتطهير · Chemical Dosing & CT Disinfection (${dosing.mode === 'chlorination' ? 'كلورة NaOCl Chlorination' : 'إزالة الكلور SMBS Dechlorination'}):`,
    `   • كتلة المادة الفعالة · Active Chemical Mass: ${dosing.activeMassKg.toFixed(3)} kg (${dosing.activeMassGrams.toFixed(0)} g)`,
    `   • حجم المحلول التجاري · Commercial Liquid Volume: ${dosing.liquidVolumeLiters.toFixed(2)} L (${dosing.liquidVolumeMl.toFixed(0)} mL)`,
    `   • عدد العبوات القياسية · Standard Containers (${dosing.containerSizeL}L): ${dosing.containersNeeded.toFixed(2)} units (Order المطلوب: ${dosing.containersRoundedUp})`,
    `   • ${ctStatusBilingual}`,
    ``,
    `2️⃣ معايرة مضخة الحقن الكيميائي · Chemical Dosing Pump Calibration:`,
    `   • التركيز الفعلي في خزان التحضير · Effective Day-Tank Conc.: ${pump.effectiveConcentrationPercent.toFixed(2)}% (Density الكثافة: ${pump.effectiveDensityKgPerL.toFixed(2)} kg/L)`,
    `   • معدل الضخ المطلوب · Required Pump Flow Rate: ${pump.requiredPumpFlowLh.toFixed(3)} L/h (${pump.requiredPumpFlowMlMin.toFixed(1)} mL/min)`,
    `   • الاستهلاك اليومي · Daily Consumption: ${pump.dailyChemicalConsumptionL.toFixed(2)} L/day (Day-Tank Autonomy كفاية الخزان: ${pump.dayTankAutonomyHours.toFixed(1)} hrs)`,
    `   • ${pumpStatusBilingual}`,
    ``,
    `3️⃣ حسابات المسابح والتدوير · Swimming Pool & Turnover Sizing:`,
    `   • الحجم الكلي للمسبح · Total Pool Volume: ${pool.volumeM3.toFixed(1)} m³ (${pool.volumeLiters.toLocaleString()} L · ${pool.volumeUsGallons.toFixed(0)} US Gal)`,
    `   • تدفق الفلاتر والتدوير · Filtration Turnover Flow Rate: ${pool.recirculationFlowM3h.toFixed(2)} m³/h (${pool.recirculationFlowGpm.toFixed(1)} GPM @ ${pool.recommendedTurnoverHours}h)`,
    `   • جرعة الكلور التعويضية · Maintenance NaOCl Dose: ${pool.maintenanceNaoclLiters.toFixed(2)} L | جرعة الصدمة · Shock Dose (10 ppm): ${pool.shockNaoclLiters.toFixed(2)} L`,
  ].join('\n');
}

/**
 * ============================================================================
 * 5. MAIN REACT + TYPESCRIPT PWA APPLICATION COMPONENT
 * - Dark Premium Metallic Gold Color System (#080A0F obsidian, #D4AF37 / #F3E5AB gold)
 * - Dedicated Engineering Status Colors:
 *     PASS: Emerald Green (#10B981)
 *     CAUTION: Amber (#F59E0B)
 *     FAIL: Crimson Red (#EF4444)
 *     INFO: Sky Blue (#3B82F6)
 * - Dual Arabic + English Engineering Terminology across all labels & cards
 * - AI Advisor & Password Schedule strictly private to Admin (Eslam Abubakr)
 * ============================================================================
 */
export default function App() {
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const isRTL = lang === 'ar';

  const [isUnlocked, setIsUnlocked] = useState<boolean>(true);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<boolean>(false);

  const [showAdminPinModal, setShowAdminPinModal] = useState<boolean>(false);
  const [adminPinInput, setAdminPinInput] = useState<string>('');
  const [adminPinError, setAdminPinError] = useState<boolean>(false);

  const currentPeriodIdx = useMemo(() => getPeriodIndex(), []);
  const currentPeriodPassword = useMemo(
    () => generatePasswordForPeriod(currentPeriodIdx),
    [currentPeriodIdx]
  );
  const passwordSchedule = useMemo(() => getPasswordSchedule(), []);

  const [activeTab, setActiveTab] = useState<
    'dosing' | 'pump' | 'pool' | 'projects' | 'ai'
  >('dosing');

  useEffect(() => {
    if (!isAdminUnlocked && activeTab === 'ai') {
      setActiveTab('dosing');
    }
  }, [isAdminUnlocked, activeTab]);

  // Project Metadata
  const [projectName, setProjectName] = useState<string>(
    'KAFD Cooling & Potable Tank Disinfection'
  );
  const [siteLocation, setSiteLocation] = useState<string>('Riyadh · KAFD Parcel 3');
  const [engineerName, setEngineerName] = useState<string>('Eslam Abubakr');
  const [projectNotes, setProjectNotes] = useState<string>(
    'Pre-commissioning tank chlorination & dosing skid calibration'
  );

  // Module 1: Dosing Inputs
  const [dosingInputs, setDosingInputs] = useState<DosingInputs>({
    mode: 'chlorination',
    systemVolumeM3: 450,
    targetPpm: 2.0,
    concentrationPercent: 12.5,
    densityKgPerL: 1.18,
    containerSizeL: 200,
    recirculationFlowLh: 45000,
    selectedPathogenId: 'ecoli',
  });

  // Module 2: Pump Inputs
  const [pumpInputs, setPumpInputs] = useState<PumpInputs>({
    waterFlowRate: 85,
    flowUnit: 'm3_per_h',
    targetDosePpm: 2.0,
    stockConcentrationPercent: 12.5,
    densityKgPerL: 1.18,
    isDiluted: true,
    chemicalAddedLiters: 25,
    dayTankTotalVolumeLiters: 100,
    pumpMaxCapacityLh: 8.0,
    selectedStrokePercent: 75,
  });

  // Module 3: Pool Inputs
  const [poolInputs, setPoolInputs] = useState<PoolInputs>({
    shape: 'rectangular',
    usageType: 'commercial',
    lengthM: 25,
    widthM: 12,
    diameterM: 10,
    shallowDepthM: 1.2,
    deepDepthM: 1.8,
    customVolumeM3: 450,
    customTurnoverHours: 4,
    currentFreeCl2Ppm: 0.5,
    targetFreeCl2Ppm: 2.0,
    naoclConcentrationPercent: 12.5,
    naoclDensityKgPerL: 1.18,
    currentCyanuricAcidPpm: 15,
    targetCyanuricAcidPpm: 40,
  });

  const [savedProjects, setSavedProjects] = useState<SavedWaterWiseProject[]>(() =>
    loadSavedProjects()
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  const [aiProvider, setAiProvider] = useState<AIProvider>('offline_heuristic');
  const [aiApiKey, setAiApiKey] = useState<string>('');
  const [aiModel, setAiModel] = useState<string>('gpt-4o-mini');
  const [aiOutput, setAiOutput] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [showScheduleTable, setShowScheduleTable] = useState<boolean>(false);

  // Deterministic Calculation Outputs
  const dosingResults = useMemo(() => calculateDosing(dosingInputs), [dosingInputs]);
  const pumpResults = useMemo(() => calculatePumpCalibration(pumpInputs), [pumpInputs]);
  const poolResults = useMemo(() => calculatePoolMetrics(poolInputs), [poolInputs]);

  useEffect(() => {
    if (aiProvider === 'offline_heuristic') {
      setAiOutput(
        buildDeterministicEngineeringAudit(
          projectName,
          siteLocation,
          dosingResults,
          pumpResults,
          poolResults,
          lang
        )
      );
    }
  }, [projectName, siteLocation, dosingResults, pumpResults, poolResults, lang, aiProvider]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = verifyAccessPassword(passwordInput);
    if (res.valid) {
      setIsUnlocked(true);
      setIsAdminUnlocked(res.isAdmin);
      setAuthError(false);
      if (res.isAdmin) {
        triggerToast(
          'تم تفعيل وضع المالك (إسلام أبوبكر) — صفحة AI وجدول كلمات المرور متاحة لك الآن · Admin Mode Active'
        );
      } else {
        setActiveTab('dosing');
        triggerToast(
          'تم الدخول كمستخدم قياسي (صفحة AI مخفية) · Standard User Mode Unlocked'
        );
      }
    } else {
      setAuthError(true);
    }
  };

  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPinInput.trim().toUpperCase() === ADMIN_BYPASS_CODE) {
      setIsAdminUnlocked(true);
      setShowAdminPinModal(false);
      setAdminPinInput('');
      setAdminPinError(false);
      setActiveTab('ai');
      triggerToast(
        'مرحباً م. إسلام — تم إظهار صفحة المستشار الذكي AI الخاصة بك · Owner AI Tab Unlocked'
      );
    } else {
      setAdminPinError(true);
    }
  };

  const handleSaveCurrentProject = () => {
    const newProj: SavedWaterWiseProject = {
      id: `proj-${Date.now()}`,
      projectName: projectName.trim() || 'Untitled WaterWise Project',
      siteLocation: siteLocation.trim() || 'Riyadh',
      engineerName: engineerName.trim() || 'Eslam Abubakr',
      notes: projectNotes,
      updatedAtISO: new Date().toISOString(),
      dosing: dosingInputs,
      pump: pumpInputs,
      pool: poolInputs,
    };
    const updated = [newProj, ...savedProjects];
    setSavedProjects(updated);
    persistProjects(updated);
    triggerToast(
      `تم حفظ المشروع محلياً · Saved "${newProj.projectName}" to Offline Storage`
    );
  };

  const handleLoadProject = (proj: SavedWaterWiseProject) => {
    setProjectName(proj.projectName);
    setSiteLocation(proj.siteLocation);
    setEngineerName(proj.engineerName);
    setProjectNotes(proj.notes);
    setDosingInputs(proj.dosing);
    setPumpInputs(proj.pump);
    setPoolInputs(proj.pool);
    setActiveTab('dosing');
    triggerToast(`تم تحميل المشروع · Loaded "${proj.projectName}"`);
  };

  const handleDeleteProject = (id: string) => {
    const updated = savedProjects.filter((p) => p.id !== id);
    setSavedProjects(updated);
    persistProjects(updated);
    triggerToast('تم حذف المشروع · Project removed from local storage');
  };

  const handleRunCloudAI = async () => {
    setAiLoading(true);
    try {
      if (aiProvider === 'offline_heuristic' || !aiApiKey.trim()) {
        const summary = buildDeterministicEngineeringAudit(
          projectName,
          siteLocation,
          dosingResults,
          pumpResults,
          poolResults,
          lang
        );
        setAiOutput(summary);
        triggerToast(
          'تم توليد التقرير الهندسي المزدوج (Offline Deterministic Engine)'
        );
        setAiLoading(false);
        return;
      }

      const systemPrompt =
        'أنت مهندس خبير في معالجة المياه ومعايرة مضخات الحقن الكيميائي. راجع نتائج الحسابات الهندسية وقدم توصيات تشغيلية وإرشادات سلامة مختصرة ودقيقة باللغتين العربية والإنجليزية معاً (Bilingual Arabic & English Engineering Terminology).';

      const payload = JSON.stringify(
        {
          projectName,
          siteLocation,
          dosingResults,
          pumpResults,
          poolResults,
        },
        null,
        2
      );

      if (aiProvider === 'openai') {
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiApiKey.trim()}`,
          },
          body: JSON.stringify({
            model: aiModel || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: payload },
            ],
            temperature: 0.2,
          }),
        });
        if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}`);
        const data = await resp.json();
        setAiOutput(data.choices?.[0]?.message?.content || '');
      } else if (aiProvider === 'claude') {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': aiApiKey.trim(),
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: aiModel || 'claude-3-5-sonnet-latest',
            max_tokens: 800,
            system: systemPrompt,
            messages: [{ role: 'user', content: payload }],
          }),
        });
        if (!resp.ok) throw new Error(`Claude HTTP ${resp.status}`);
        const data = await resp.json();
        setAiOutput(data.content?.[0]?.text || '');
      }
    } catch (err) {
      const fallback = buildDeterministicEngineeringAudit(
        projectName,
        siteLocation,
        dosingResults,
        pumpResults,
        poolResults,
        lang
      );
      setAiOutput(
        `${fallback}\n\n[Cloud API Notice: Switched to offline deterministic engine — ${
          err instanceof Error ? err.message : 'Network/Key Error'
        }]`
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyReport = () => {
    const text = buildDeterministicEngineeringAudit(
      projectName,
      siteLocation,
      dosingResults,
      pumpResults,
      poolResults,
      lang
    );
    try {
      navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // ============================================================================
  // LOCK SCREEN GATEWAY (#lockScreen) — DARK PREMIUM METALLIC GOLD THEME
  // ============================================================================
  if (!isUnlocked) {
    return (
      <div
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-screen bg-[#080A0F] text-[#F8FAFC] flex flex-col items-center justify-center p-4 font-sans selection:bg-[#D4AF37] selection:text-[#080A0F]"
      >
        <div className="w-full max-w-md bg-[#11151F]/95 border border-[#D4AF37]/35 rounded-3xl p-6 shadow-2xl shadow-black/80 backdrop-blur-xl">
          <div className="flex justify-between items-center mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#D4AF37]/15 text-[#F3E5AB] border border-[#D4AF37]/35">
              <Droplets className="w-3.5 h-3.5 text-[#D4AF37]" />
              PWA + Capacitor · Gold Edition
            </span>
            <button
              type="button"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="px-3 py-1 rounded-xl bg-[#171C28] hover:bg-[#1E2536] text-xs text-[#F3E5AB] flex items-center gap-1.5 border border-[#D4AF37]/25 transition"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
              {lang === 'ar' ? 'اتجاه LTR / EN' : 'اتجاه RTL / عربي'}
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F3E5AB] via-[#D4AF37] to-[#AA7C11] mx-auto flex items-center justify-center shadow-lg shadow-[#D4AF37]/25 mb-3">
              <Droplets className="w-9 h-9 text-[#080A0F]" />
            </div>
            <h1 className="text-2xl font-bold text-[#F8FAFC] tracking-tight">
              WaterWise Calculator
            </h1>
            <p className="text-xs text-[#D4AF37] mt-1 font-semibold tracking-wide">
              Eslam Abubakr · #WaterWiseByEslam
            </p>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#CBD5E1] mb-1.5 font-medium text-center">
                أدخل كلمة المرور · Enter Access Password
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setAuthError(false);
                  }}
                  placeholder={currentPeriodPassword}
                  className={`w-full px-4 py-3 rounded-xl bg-[#080A0F] border text-center font-mono text-base tracking-wider uppercase focus:outline-none transition ${
                    authError
                      ? 'border-[#EF4444] text-[#FCA5A5]'
                      : 'border-[#D4AF37]/35 focus:border-[#D4AF37] text-[#F3E5AB]'
                  }`}
                />
                {authError && (
                  <span className="absolute inset-y-0 end-3 flex items-center text-[#EF4444] text-sm font-bold">
                    ✕
                  </span>
                )}
              </div>
              {authError && (
                <p className="text-xs text-[#EF4444] mt-1.5 text-center font-medium">
                  [FAIL] كلمة المرور غير صحيحة · Invalid Password
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] hover:brightness-110 text-[#080A0F] font-extrabold text-sm shadow-lg shadow-[#D4AF37]/25 transition"
            >
              ⚡ دخول · Enter
            </button>
          </form>

          {/* Role explanation & quick-test buttons */}
          <div className="mt-5 pt-4 border-t border-[#D4AF37]/15 space-y-2.5">
            <p className="text-[11px] text-[#94A3B8] text-center">
              اختبر صلاحيات الدخول (المستخدم العادي مقابل حسابك الخاص `WW2025-ADMIN`):
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordInput(currentPeriodPassword);
                  setIsUnlocked(true);
                  setIsAdminUnlocked(false);
                  setActiveTab('dosing');
                }}
                className="px-3 py-2 rounded-xl bg-[#171C28] hover:bg-[#1E2536] border border-[#3B82F6]/35 text-[11px] text-[#93C5FD] font-mono flex flex-col items-center justify-center gap-0.5 transition"
              >
                <span className="flex items-center gap-1 font-bold">
                  <KeyRound className="w-3 h-3 text-[#3B82F6]" />
                  {currentPeriodPassword}
                </span>
                <span className="text-[10px] text-[#94A3B8] font-sans">
                  دخول مستخدم (بدون AI)
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordInput(ADMIN_BYPASS_CODE);
                  setIsUnlocked(true);
                  setIsAdminUnlocked(true);
                }}
                className="px-3 py-2 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 border border-[#D4AF37]/45 text-[11px] text-[#F3E5AB] font-mono flex flex-col items-center justify-center gap-0.5 transition"
              >
                <span className="flex items-center gap-1 font-bold">
                  <Unlock className="w-3 h-3 text-[#D4AF37]" />
                  WW2025-ADMIN
                </span>
                <span className="text-[10px] text-[#D4AF37] font-sans">
                  دخول المالك (يظهر AI)
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#080A0F] text-[#F8FAFC] pb-24 font-sans selection:bg-[#D4AF37] selection:text-[#080A0F]"
    >
      {/* Top App Bar — Dark Obsidian & Metallic Gold Accent */}
      <header className="sticky top-0 z-30 bg-[#080A0F]/95 backdrop-blur-md border-b border-[#D4AF37]/25 px-4 py-3 shadow-lg shadow-black/40">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F3E5AB] via-[#D4AF37] to-[#AA7C11] flex items-center justify-center shadow-md shadow-[#D4AF37]/25">
              <Droplets className="w-5 h-5 text-[#080A0F]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-[#F8FAFC] leading-tight">
                  WaterWise Calculator
                </h1>
                {/* Engineering Status: PASS (Green) for Offline Ready */}
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/40">
                  PASS · Offline Ready
                </span>
                {/* Engineering Status: INFO (Blue) for Bilingual Mode */}
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#3B82F6]/15 text-[#93C5FD] border border-[#3B82F6]/40">
                  INFO · عربي + EN
                </span>
                {isAdminUnlocked && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/50">
                    👑 وضع المالك · Owner Gold
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#D4AF37] font-medium">
                Eslam Abubakr · #WaterWiseByEslam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSaveCurrentProject}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] hover:brightness-110 text-[#080A0F] text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-[#D4AF37]/20 transition"
              title="حفظ المشروع محلياً · Save Project"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">حفظ · Save</span>
            </button>

            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#141923] hover:bg-[#1C2331] border border-[#D4AF37]/30 text-[#F3E5AB] text-xs font-medium flex items-center gap-1.5 transition"
            >
              <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="hidden sm:inline">تقرير · Report</span>
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="px-2.5 py-1.5 rounded-xl bg-[#141923] hover:bg-[#1C2331] border border-[#D4AF37]/25 text-[#E2E8F0] text-xs font-medium flex items-center gap-1 transition"
              title="تبديل اتجاه الواجهة RTL / LTR"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
              {lang === 'ar' ? 'LTR' : 'RTL'}
            </button>

            {/* Owner / Admin Private Toggle Button */}
            {isAdminUnlocked ? (
              <button
                type="button"
                onClick={() => {
                  setIsAdminUnlocked(false);
                  if (activeTab === 'ai') setActiveTab('dosing');
                  triggerToast(
                    'تم إخفاء صفحة AI الخاصة والعودة لوضع المستخدم العادي · Exited Admin Mode'
                  );
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/50 text-[#F3E5AB] text-xs font-bold flex items-center gap-1 transition"
                title="إخفاء وضع المالك (إخفاء AI)"
              >
                <Unlock className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden md:inline">إخفاء AI</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowAdminPinModal(true);
                  setAdminPinError(false);
                }}
                className="p-1.5 rounded-xl bg-[#141923] hover:bg-[#1C2331] border border-[#D4AF37]/25 text-[#D4AF37] transition"
                title="دخول المالك (إسلام أبوبكر) لإظهار صفحة AI"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsUnlocked(false)}
              className="p-1.5 rounded-xl bg-[#141923] hover:bg-[#EF4444]/20 border border-slate-700/80 hover:border-[#EF4444]/50 text-slate-300 hover:text-[#FCA5A5] transition"
              title="شاشة القفل · Lock Screen"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Owner / Admin Secret Pin Modal */}
      {showAdminPinModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11151F] border border-[#D4AF37]/50 rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-2.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-sm font-bold text-[#F8FAFC]">
                  دخول المالك الخاص · Owner Access
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminPinModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              صفحة المستشار الذكي (AI Advisor) وجدول كلمات المرور مخفية عن المستخدمين العاديين. أدخل كود المالك الخاص بك (`WW2025-ADMIN`) لإظهارها:
            </p>
            <form onSubmit={handleAdminPinSubmit} className="space-y-3">
              <input
                type="password"
                value={adminPinInput}
                onChange={(e) => {
                  setAdminPinInput(e.target.value);
                  setAdminPinError(false);
                }}
                placeholder="WW2025-ADMIN"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#080A0F] border border-[#D4AF37]/40 text-center font-mono text-sm text-[#F3E5AB] uppercase focus:border-[#D4AF37] focus:outline-none"
              />
              {adminPinError && (
                <p className="text-[11px] text-[#EF4444] text-center font-semibold">
                  [FAIL] الكود غير صحيح · Invalid Owner Code
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminUnlocked(true);
                    setShowAdminPinModal(false);
                    setActiveTab('ai');
                    triggerToast('تم تفعيل وضع المالك وإظهار صفحة AI الخاصة بك');
                  }}
                  className="py-2 px-3 rounded-xl bg-[#171C28] hover:bg-[#1E2536] border border-[#D4AF37]/35 text-[#F3E5AB] text-xs font-mono"
                >
                  تعبئة WW2025-ADMIN
                </button>
                <button
                  type="submit"
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] text-[#080A0F] font-extrabold text-xs"
                >
                  تفعيل · Unlock AI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="bg-[#11151F]/95 border border-[#D4AF37]/60 text-[#F3E5AB] px-4 py-2 rounded-2xl shadow-2xl text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Executive Engineering Status & KPI Summary Strip (Dashboard Bar) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Metallic Gold Highlight KPI */}
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#161B26] to-[#11151F] border border-[#D4AF37]/35 shadow-md">
            <div className="flex items-center justify-between text-[10px] text-[#D4AF37] font-bold">
              <span>الجرعة الكيميائية · DOSING</span>
              <Droplets className="w-3.5 h-3.5" />
            </div>
            <p className="text-lg font-extrabold font-mono text-[#F3E5AB] mt-1">
              {dosingResults.liquidVolumeLiters.toFixed(2)} L
            </p>
            <p className="text-[10px] text-[#94A3B8]">
              {dosingResults.activeMassKg.toFixed(2)} kg Active · {dosingResults.containersRoundedUp}×{dosingResults.containerSizeL}L
            </p>
          </div>

          {/* Engineering Status: PASS (Green) or FAIL (Red) for Disinfection CT */}
          <div
            className={`p-3 rounded-2xl border shadow-md ${
              dosingResults.ctCompliant
                ? 'bg-[#10B981]/10 border-[#10B981]/40'
                : 'bg-[#EF4444]/10 border-[#EF4444]/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span
                className={
                  dosingResults.ctCompliant ? 'text-[#34D399]' : 'text-[#FCA5A5]'
                }
              >
                {dosingResults.ctCompliant ? 'PASS · تحقق CT' : 'FAIL · عجز CT'}
              </span>
              {dosingResults.ctCompliant ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
              )}
            </div>
            <p className="text-lg font-extrabold font-mono text-white mt-1">
              {dosingResults.achievedCT.toFixed(1)}{' '}
              <span className="text-[11px] font-normal text-slate-300">
                / {dosingResults.requiredCT}
              </span>
            </p>
            <p className="text-[10px] text-slate-300">
              Contact Time: {dosingResults.contactTimeMinutes.toFixed(1)} min
            </p>
          </div>

          {/* Engineering Status: PASS (Green) / CAUTION (Amber) / FAIL (Red) for Pump Calibration */}
          <div
            className={`p-3 rounded-2xl border shadow-md ${
              pumpResults.status === 'optimal'
                ? 'bg-[#10B981]/10 border-[#10B981]/40'
                : pumpResults.status === 'under_sized'
                ? 'bg-[#EF4444]/10 border-[#EF4444]/40'
                : 'bg-[#F59E0B]/10 border-[#F59E0B]/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span
                className={
                  pumpResults.status === 'optimal'
                    ? 'text-[#34D399]'
                    : pumpResults.status === 'under_sized'
                    ? 'text-[#FCA5A5]'
                    : 'text-[#FCD34D]'
                }
              >
                {pumpResults.status === 'optimal'
                  ? 'PASS · المضخة'
                  : pumpResults.status === 'under_sized'
                  ? 'FAIL · المضخة'
                  : 'CAUTION · المضخة'}
              </span>
              <Gauge className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <p className="text-lg font-extrabold font-mono text-white mt-1">
              {pumpResults.requiredPumpFlowLh.toFixed(2)} L/h
            </p>
            <p className="text-[10px] text-slate-300">
              Speed: {pumpResults.requiredSpeedPercentAtStroke.toFixed(0)}% @ {pumpInputs.selectedStrokePercent}% Stroke
            </p>
          </div>

          {/* Engineering Status: INFO (Blue) for Pool / Basin Turnover */}
          <div className="p-3 rounded-2xl bg-[#3B82F6]/10 border border-[#3B82F6]/40 shadow-md">
            <div className="flex items-center justify-between text-[10px] text-[#93C5FD] font-bold">
              <span>INFO · تدوير المسبح</span>
              <Info className="w-3.5 h-3.5 text-[#3B82F6]" />
            </div>
            <p className="text-lg font-extrabold font-mono text-white mt-1">
              {poolResults.volumeM3.toFixed(0)} m³
            </p>
            <p className="text-[10px] text-[#BFDBFE]">
              Flow: {poolResults.recirculationFlowM3h.toFixed(1)} m³/h ({poolResults.recirculationFlowGpm.toFixed(0)} GPM)
            </p>
          </div>
        </section>

        {/* Active Project Context Bar (Dark Charcoal & Gold Border) */}
        <section className="bg-[#11151F]/90 border border-[#D4AF37]/20 rounded-2xl p-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] text-[#D4AF37] font-medium mb-1">
                اسم المشروع / المحطة · Project / Plant Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#080A0F] border border-slate-800 text-xs text-white focus:border-[#D4AF37] focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#D4AF37] font-medium mb-1">
                الموقع / الكود · Site Location / Tag
              </label>
              <input
                type="text"
                value={siteLocation}
                onChange={(e) => setSiteLocation(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#080A0F] border border-slate-800 text-xs text-white focus:border-[#D4AF37] focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#D4AF37] font-medium mb-1">
                المهندس المسؤول · Lead Engineer
              </label>
              <input
                type="text"
                value={engineerName}
                onChange={(e) => setEngineerName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[#080A0F] border border-slate-800 text-xs text-white focus:border-[#D4AF37] focus:outline-none transition"
              />
            </div>
          </div>
        </section>

        {/* ====================================================================
            TAB 1: CHEMICAL DOSING & CT DISINFECTION MODULE
           ==================================================================== */}
        {activeTab === 'dosing' && (
          <div className="space-y-4">
            {/* Mode Switcher: Metallic Gold Signature Active Button */}
            <div className="grid grid-cols-2 gap-2 bg-[#11151F] p-1.5 rounded-2xl border border-[#D4AF37]/25">
              <button
                type="button"
                onClick={() =>
                  setDosingInputs((prev) => ({ ...prev, mode: 'chlorination' }))
                }
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                  dosingInputs.mode === 'chlorination'
                    ? 'bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] text-[#080A0F] shadow-md shadow-[#D4AF37]/20'
                    : 'text-[#CBD5E1] hover:bg-[#171C28]'
                }`}
              >
                <Droplets className="w-4 h-4 shrink-0" />
                <span>حساب جرعة الكلور · NaOCl Chlorination</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDosingInputs((prev) => ({ ...prev, mode: 'dechlorination' }))
                }
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition ${
                  dosingInputs.mode === 'dechlorination'
                    ? 'bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] text-[#080A0F] shadow-md shadow-[#D4AF37]/20'
                    : 'text-[#CBD5E1] hover:bg-[#171C28]'
                }`}
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>إزالة الكلور · SMBS Dechlorination (1.34×)</span>
              </button>
            </div>

            {/* Inputs & Real-Time Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left Column: Engineering Parameters */}
              <div className="md:col-span-7 bg-[#11151F]/95 border border-[#D4AF37]/20 rounded-2xl p-4 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-[#D4AF37]/15 pb-2.5">
                  <h2 className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
                    <Beaker className="w-4 h-4 text-[#D4AF37]" />
                    <span>بيانات الخزان والمحلول · System & Chemical Inputs</span>
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/35 text-[11px] font-mono text-[#93C5FD]">
                    INFO · {dosingInputs.mode === 'chlorination' ? 'NaOCl' : 'Na₂S₂O₅ (SMBS)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs text-[#CBD5E1] mb-1">
                      حجم النظام / الخزان · System Volume (m³)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={dosingInputs.systemVolumeM3}
                      onChange={(e) =>
                        setDosingInputs({
                          ...dosingInputs,
                          systemVolumeM3: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#CBD5E1] mb-1">
                      {dosingInputs.mode === 'chlorination'
                        ? 'تركيز الكلور المستهدف · Target Free Cl₂ (ppm)'
                        : 'الكلور المراد تعادله · Initial Cl₂ (ppm)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={dosingInputs.targetPpm}
                      onChange={(e) =>
                        setDosingInputs({
                          ...dosingInputs,
                          targetPpm: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Concentration Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-[#CBD5E1]">
                      تركيز المحلول التجاري · Stock Concentration (%)
                    </label>
                    <span className="text-xs font-mono font-bold text-[#D4AF37]">
                      {dosingInputs.concentrationPercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[5, 7.5, 10, 12.5].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() =>
                          setDosingInputs({
                            ...dosingInputs,
                            concentrationPercent: pct,
                          })
                        }
                        className={`py-1.5 rounded-xl font-mono text-xs border transition ${
                          dosingInputs.concentrationPercent === pct
                            ? 'bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] border-[#F3E5AB] text-[#080A0F] font-extrabold shadow-sm'
                            : 'bg-[#080A0F] border-slate-800 text-[#94A3B8] hover:border-[#D4AF37]/40'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={dosingInputs.concentrationPercent}
                    onChange={(e) =>
                      setDosingInputs({
                        ...dosingInputs,
                        concentrationPercent: parseFloat(e.target.value) || 0.1,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs text-[#CBD5E1] mb-1">
                      كثافة المحلول · Specific Gravity / Density (kg/L)
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      max="2.5"
                      step="0.01"
                      value={dosingInputs.densityKgPerL}
                      onChange={(e) =>
                        setDosingInputs({
                          ...dosingInputs,
                          densityKgPerL: parseFloat(e.target.value) || 1.0,
                        })
                      }
                      className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#CBD5E1] mb-1">
                      حجم العبوة القياسية · Standard Container Size
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([30, 200, 1000] as ContainerSizeLiters[]).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() =>
                            setDosingInputs({ ...dosingInputs, containerSizeL: sz })
                          }
                          className={`py-2 rounded-xl text-[11px] font-mono border transition ${
                            dosingInputs.containerSizeL === sz
                              ? 'bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] border-[#F3E5AB] text-[#080A0F] font-extrabold'
                              : 'bg-[#080A0F] border-slate-800 text-[#94A3B8] hover:border-[#D4AF37]/40'
                          }`}
                        >
                          {sz === 30
                            ? '30L جركن Jerry'
                            : sz === 200
                            ? '200L برميل Drum'
                            : '1000L خزان IBC'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact Time (CT) Verification Sub-card */}
                <div className="pt-3 border-t border-[#D4AF37]/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#F3E5AB]">
                      التحقق من زمن التلامس والتطهير · Disinfection CT Verification
                    </h3>
                    <span className="text-[11px] font-mono text-[#93C5FD]">
                      CT = C (ppm) × T (min)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#CBD5E1] mb-1">
                        معدل التدفق / التدوير · Recirculation Flow (L/h)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={dosingInputs.recirculationFlowLh}
                        onChange={(e) =>
                          setDosingInputs({
                            ...dosingInputs,
                            recirculationFlowLh: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-xs font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#CBD5E1] mb-1">
                        الميكروب المستهدف · Target Pathogen Standard
                      </label>
                      <select
                        value={dosingInputs.selectedPathogenId}
                        onChange={(e) =>
                          setDosingInputs({
                            ...dosingInputs,
                            selectedPathogenId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-xs text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                      >
                        {PATHOGEN_CT_TARGETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.bilingualLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Deterministic Results */}
              <div className="md:col-span-5 space-y-3.5">
                <div className="bg-gradient-to-br from-[#141923] via-[#11151F] to-[#1A160B] border border-[#D4AF37]/40 rounded-2xl p-4 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F3E5AB]">
                      النتائج المحسوبة · Calculated Dosing Output
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/35 text-[#93C5FD] font-mono text-[11px]">
                      INFO · {dosingInputs.systemVolumeM3} m³
                    </span>
                  </div>

                  {/* Primary Metric: Metallic Gold Showcase Card */}
                  <div className="p-4 rounded-2xl bg-[#080A0F] border border-[#D4AF37]/45 text-center shadow-inner">
                    <p className="text-xs text-[#CBD5E1] mb-1">
                      حجم المحلول التجاري المطلوب · Required Liquid Volume
                    </p>
                    <div className="text-3xl font-extrabold font-mono text-[#D4AF37]">
                      {dosingResults.liquidVolumeLiters.toFixed(2)}{' '}
                      <span className="text-base font-normal text-[#F3E5AB]">
                        L (لتر)
                      </span>
                    </div>
                    <p className="text-xs font-mono text-[#94A3B8] mt-1">
                      {dosingResults.liquidVolumeMl.toFixed(0)} mL (مل) ·{' '}
                      {dosingResults.solutionMassKg.toFixed(2)} kg Solution Weight
                    </p>
                  </div>

                  {/* Secondary Metrics Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl bg-[#080A0F]/80 border border-slate-800">
                      <p className="text-[11px] text-[#94A3B8]">
                        {dosingInputs.mode === 'chlorination'
                          ? 'كتلة الكلور الفعال · Active Cl₂ Mass'
                          : 'كتلة SMBS الفعالة · Active SMBS Mass'}
                      </p>
                      <p className="text-lg font-bold font-mono text-[#F8FAFC] mt-0.5">
                        {dosingResults.activeMassKg.toFixed(3)} kg
                      </p>
                      <p className="text-[11px] font-mono text-[#94A3B8]">
                        ({dosingResults.activeMassGrams.toFixed(0)} g جرام)
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#080A0F]/80 border border-[#D4AF37]/25">
                      <p className="text-[11px] text-[#94A3B8]">
                        العبوات المطلوبة · Containers ({dosingResults.containerSizeL}L)
                      </p>
                      <p className="text-lg font-bold font-mono text-[#F3E5AB] mt-0.5">
                        {dosingResults.containersNeeded.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-[#D4AF37]">
                        إجمالي الطلب · Order: {dosingResults.containersRoundedUp} عبوة
                      </p>
                    </div>
                  </div>

                  {/* CT Compliance Card — Strictly Green for PASS, Red for FAIL */}
                  <div
                    className={`p-3.5 rounded-xl border ${
                      dosingResults.ctCompliant
                        ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#D1FAE5]'
                        : 'bg-[#EF4444]/15 border-[#EF4444]/50 text-[#FEE2E2]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold flex items-center gap-1.5">
                        {dosingResults.ctCompliant ? (
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
                        )}
                        <span>حالة التطهير · Disinfection CT Status</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                          dosingResults.ctCompliant
                            ? 'bg-[#10B981] text-[#080A0F]'
                            : 'bg-[#EF4444] text-white'
                        }`}
                      >
                        {dosingResults.ctCompliant
                          ? 'PASS · مطابق'
                          : 'FAIL · غير كافٍ'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-2 pt-2 border-t border-white/10 font-mono text-xs">
                      <div>
                        <span className="block text-[10px] opacity-75">
                          زمن المكث · Contact Time
                        </span>
                        {dosingResults.contactTimeMinutes.toFixed(1)} min
                      </div>
                      <div>
                        <span className="block text-[10px] opacity-75">
                          المحقق · Achieved CT
                        </span>
                        {dosingResults.achievedCT.toFixed(1)}
                      </div>
                      <div>
                        <span className="block text-[10px] opacity-75">
                          المطلوب · Required CT
                        </span>
                        {dosingResults.requiredCT}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: CHEMICAL DOSING PUMP SIZING & STROKE/SPEED CALIBRATION
           ==================================================================== */}
        {activeTab === 'pump' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 bg-[#11151F]/95 border border-[#D4AF37]/20 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#D4AF37]/15 pb-2.5">
                <h2 className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-[#D4AF37]" />
                  <span>معايرة مضخة الحقن · Dosing Pump & Day-Tank Calibration</span>
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/35 text-[11px] font-mono text-[#93C5FD]">
                  INFO · L/h & Stroke %
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs text-[#CBD5E1] mb-1">
                    معدل تدفق المياه · Water Flow Rate
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={pumpInputs.waterFlowRate}
                      onChange={(e) =>
                        setPumpInputs({
                          ...pumpInputs,
                          waterFlowRate: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                    />
                    <select
                      value={pumpInputs.flowUnit}
                      onChange={(e) =>
                        setPumpInputs({
                          ...pumpInputs,
                          flowUnit: e.target.value as FlowRateUnit,
                        })
                      }
                      className="px-2.5 py-2 rounded-xl bg-[#080A0F] border border-[#D4AF37]/35 text-xs font-mono text-[#F3E5AB]"
                    >
                      <option value="m3_per_h">m³/h (م³/ساعة)</option>
                      <option value="m3_per_day">m³/day (م³/يوم)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#CBD5E1] mb-1">
                    الجرعة المستهدفة · Target Chemical Dose (ppm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={pumpInputs.targetDosePpm}
                    onChange={(e) =>
                      setPumpInputs({
                        ...pumpInputs,
                        targetDosePpm: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs text-[#CBD5E1] mb-1">
                    تركيز المحلول الأصلي · Stock Concentration (%)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={pumpInputs.stockConcentrationPercent}
                    onChange={(e) =>
                      setPumpInputs({
                        ...pumpInputs,
                        stockConcentrationPercent: parseFloat(e.target.value) || 0.1,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#CBD5E1] mb-1">
                    الكثافة النوعية · Solution Density (kg/L)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.01"
                    value={pumpInputs.densityKgPerL}
                    onChange={(e) =>
                      setPumpInputs({
                        ...pumpInputs,
                        densityKgPerL: parseFloat(e.target.value) || 1.0,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC] focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>
              </div>

              {/* Day-Tank Dilution Toggle (?Diluted) */}
              <div className="p-3.5 rounded-2xl bg-[#080A0F]/90 border border-[#D4AF37]/25 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-bold text-[#F3E5AB] flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pumpInputs.isDiluted}
                      onChange={(e) =>
                        setPumpInputs({ ...pumpInputs, isDiluted: e.target.checked })
                      }
                      className="rounded border-[#D4AF37] accent-[#D4AF37] focus:ring-0"
                    />
                    <span>تخفيف خزان التحضير اليومي · Pre-Diluted Day Tank (?Diluted)</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#93C5FD]">
                    INFO · التركيز الفعلي Eff. Conc:{' '}
                    {pumpResults.effectiveConcentrationPercent.toFixed(2)}%
                  </span>
                </div>

                {pumpInputs.isDiluted && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">
                        كمية الكيماوي المضافة · Chemical Added (L)
                      </label>
                      <input
                        type="number"
                        min="0.1"
                        step="1"
                        value={pumpInputs.chemicalAddedLiters}
                        onChange={(e) =>
                          setPumpInputs({
                            ...pumpInputs,
                            chemicalAddedLiters: parseFloat(e.target.value) || 0.1,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-xl bg-[#11151F] border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#94A3B8] mb-1">
                        حجم خزان التحضير الكلي · Total Day-Tank Volume (L)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={pumpInputs.dayTankTotalVolumeLiters}
                        onChange={(e) =>
                          setPumpInputs({
                            ...pumpInputs,
                            dayTankTotalVolumeLiters: parseFloat(e.target.value) || 1,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-xl bg-[#11151F] border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pump Max Capacity & Stroke Length */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div>
                  <label className="block text-xs text-[#CBD5E1] mb-1">
                    السعة القصوى للمضخة · Pump Max Capacity (L/h)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={pumpInputs.pumpMaxCapacityLh}
                    onChange={(e) =>
                      setPumpInputs({
                        ...pumpInputs,
                        pumpMaxCapacityLh: parseFloat(e.target.value) || 0.1,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-[#F8FAFC]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#F3E5AB] font-medium mb-1">
                    طول الشوط · Stroke Length ({pumpInputs.selectedStrokePercent}%)
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={pumpInputs.selectedStrokePercent}
                    onChange={(e) =>
                      setPumpInputs({
                        ...pumpInputs,
                        selectedStrokePercent: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-[#D4AF37] mt-2"
                  />
                </div>
              </div>
            </div>

            {/* Pump Output Card */}
            <div className="md:col-span-5 space-y-3.5">
              <div className="bg-gradient-to-br from-[#141923] via-[#11151F] to-[#1A160B] border border-[#D4AF37]/40 rounded-2xl p-4 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F3E5AB]">
                    نتائج معايرة المضخة · Pump Calibration Output
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/35 font-mono text-[11px] text-[#93C5FD]">
                    INFO · {pumpResults.normalizedWaterFlowM3h.toFixed(1)} m³/h
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-[#080A0F] border border-[#D4AF37]/45 text-center">
                  <p className="text-xs text-[#CBD5E1] mb-1">
                    معدل الضخ المطلوب · Required Dosing Flow Rate
                  </p>
                  <div className="text-3xl font-extrabold font-mono text-[#D4AF37]">
                    {pumpResults.requiredPumpFlowLh.toFixed(3)}{' '}
                    <span className="text-base font-normal text-[#F3E5AB]">
                      L/h (لتر/ساعة)
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#94A3B8] mt-1">
                    {pumpResults.requiredPumpFlowMlMin.toFixed(1)} mL/min ·{' '}
                    {pumpResults.dailyChemicalConsumptionL.toFixed(2)} L/day (لتر/يوم)
                  </p>
                </div>

                {/* Visual Calibration Bar Chart (Stroke vs Speed vs Utilization) */}
                <div className="p-3 rounded-xl bg-[#080A0F]/90 border border-slate-800 space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#CBD5E1]">
                      استغلال سعة المضخة · Capacity Utilization
                    </span>
                    <span className="font-mono font-bold text-[#F3E5AB]">
                      {pumpResults.pumpUtilizationPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pumpResults.status === 'optimal'
                          ? 'bg-[#10B981]'
                          : pumpResults.status === 'under_sized'
                          ? 'bg-[#EF4444]'
                          : 'bg-[#F59E0B]'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(4, pumpResults.pumpUtilizationPercent))}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#080A0F]/80 border border-slate-800">
                    <p className="text-[11px] text-[#94A3B8]">
                      السرعة المطلوبة · Speed % (at {pumpInputs.selectedStrokePercent}% Stroke)
                    </p>
                    <p
                      className={`text-xl font-bold font-mono mt-0.5 ${
                        pumpResults.requiredSpeedPercentAtStroke > 100
                          ? 'text-[#EF4444]'
                          : pumpResults.status === 'optimal'
                          ? 'text-[#10B981]'
                          : 'text-[#F59E0B]'
                      }`}
                    >
                      {pumpResults.requiredSpeedPercentAtStroke.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">
                      استغلال السعة · Utilization: {pumpResults.pumpUtilizationPercent.toFixed(1)}%
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#080A0F]/80 border border-slate-800">
                    <p className="text-[11px] text-[#94A3B8]">
                      كفاية الخزان · Day-Tank Autonomy
                    </p>
                    <p className="text-xl font-bold font-mono text-[#F8FAFC] mt-0.5">
                      {pumpResults.dayTankAutonomyHours.toFixed(1)} h
                    </p>
                    <p className="text-[10px] text-[#94A3B8]">
                      ({(pumpResults.dayTankAutonomyHours / 24).toFixed(1)} Days / يوم)
                    </p>
                  </div>
                </div>

                {/* Engineering Status Alert: Green (PASS), Amber (CAUTION), Red (FAIL) */}
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    pumpResults.status === 'optimal'
                      ? 'bg-[#10B981]/15 border-[#10B981]/50 text-[#D1FAE5]'
                      : pumpResults.status === 'under_sized'
                      ? 'bg-[#EF4444]/15 border-[#EF4444]/50 text-[#FEE2E2]'
                      : 'bg-[#F59E0B]/15 border-[#F59E0B]/50 text-[#FEF3C7]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold">
                      {pumpResults.status === 'optimal'
                        ? 'حالة المعايرة · Calibration Status'
                        : pumpResults.status === 'under_sized'
                        ? 'حالة السعة · Capacity Error'
                        : 'تنبيه الضبط · Calibration Warning'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-extrabold ${
                        pumpResults.status === 'optimal'
                          ? 'bg-[#10B981] text-[#080A0F]'
                          : pumpResults.status === 'under_sized'
                          ? 'bg-[#EF4444] text-white'
                          : 'bg-[#F59E0B] text-[#080A0F]'
                      }`}
                    >
                      {pumpResults.status === 'optimal'
                        ? 'PASS'
                        : pumpResults.status === 'under_sized'
                        ? 'FAIL'
                        : 'CAUTION'}
                    </span>
                  </div>
                  {pumpResults.status === 'optimal'
                    ? 'المضخة ضمن النطاق المثالي · Optimal Sizing (10%–85% Capacity). اضبط طول الشوط (Stroke %) والسرعة (Speed %) كما هو موضح.'
                    : pumpResults.status === 'under_sized'
                    ? 'التدفق يتجاوز 100% من سعة المضخة · Pump Under-Sized! استخدم مضخة أكبر أو قلل تخفيف المحلول.'
                    : 'تنبيه معايرة الشوط · Stroke / Turndown Notice: ارفع نسبة طول الشوط (Stroke %) أو زد تخفيف الخزان.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: SWIMMING POOL VOLUME, TURNOVER & CHEMICAL BALANCING MODULE
           ==================================================================== */}
        {activeTab === 'pool' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 bg-[#11151F]/95 border border-[#D4AF37]/20 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#D4AF37]/15 pb-2.5">
                <h2 className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
                  <Waves className="w-4 h-4 text-[#D4AF37]" />
                  <span>حسابات المسابح والتدوير · Pool Volume & Turnover Sizing</span>
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-[#3B82F6]/15 border border-[#3B82F6]/35 text-[11px] font-mono text-[#93C5FD]">
                  INFO · DIN / commercial
                </span>
              </div>

              {/* Shape & Usage Type Selectors — Metallic Gold Active */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'rectangular', label: 'مستطيل · Rectangular' },
                    { id: 'circular', label: 'دائري · Circular' },
                    { id: 'oval', label: 'بيضاوي · Oval' },
                    { id: 'custom', label: 'مخصص · Custom m³' },
                  ] as const
                ).map((sh) => (
                  <button
                    key={sh.id}
                    type="button"
                    onClick={() => setPoolInputs({ ...poolInputs, shape: sh.id })}
                    className={`py-2 px-2 rounded-xl text-[11px] font-extrabold border transition ${
                      poolInputs.shape === sh.id
                        ? 'bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] border-[#F3E5AB] text-[#080A0F]'
                        : 'bg-[#080A0F] border-slate-800 text-[#94A3B8] hover:border-[#D4AF37]/40'
                    }`}
                  >
                    {sh.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPoolInputs({
                      ...poolInputs,
                      usageType: 'residential',
                      customTurnoverHours: 8,
                    })
                  }
                  className={`py-2 px-2 rounded-xl text-xs font-extrabold border transition ${
                    poolInputs.usageType === 'residential'
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#F3E5AB]'
                      : 'bg-[#080A0F] border-slate-800 text-[#94A3B8]'
                  }`}
                >
                  مسبح منزلي · Residential (8h Turnover)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPoolInputs({
                      ...poolInputs,
                      usageType: 'commercial',
                      customTurnoverHours: 4,
                    })
                  }
                  className={`py-2 px-2 rounded-xl text-xs font-extrabold border transition ${
                    poolInputs.usageType === 'commercial'
                      ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#F3E5AB]'
                      : 'bg-[#080A0F] border-slate-800 text-[#94A3B8]'
                  }`}
                >
                  مسبح تجاري / فندقي · Commercial (4h Turnover)
                </button>
              </div>

              {/* Dynamic Geometry Inputs */}
              {poolInputs.shape === 'custom' ? (
                <div>
                  <label className="block text-xs text-[#CBD5E1] mb-1">
                    الحجم المخصص مباشرة · Direct Pool Volume (m³)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={poolInputs.customVolumeM3}
                    onChange={(e) =>
                      setPoolInputs({
                        ...poolInputs,
                        customVolumeM3: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-white"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {poolInputs.shape === 'circular' ? (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs text-[#CBD5E1] mb-1">
                        القطر · Diameter (m)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={poolInputs.diameterM}
                        onChange={(e) =>
                          setPoolInputs({
                            ...poolInputs,
                            diameterM: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-white"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs text-[#CBD5E1] mb-1">
                          الطول · Length (m)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={poolInputs.lengthM}
                          onChange={(e) =>
                            setPoolInputs({
                              ...poolInputs,
                              lengthM: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#CBD5E1] mb-1">
                          العرض · Width (m)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={poolInputs.widthM}
                          onChange={(e) =>
                            setPoolInputs({
                              ...poolInputs,
                              widthM: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-white"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs text-[#CBD5E1] mb-1">
                      العمق الضحل · Shallow Depth (m)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={poolInputs.shallowDepthM}
                      onChange={(e) =>
                        setPoolInputs({
                          ...poolInputs,
                          shallowDepthM: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#CBD5E1] mb-1">
                      العمق العميق · Deep Depth (m)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={poolInputs.deepDepthM}
                      onChange={(e) =>
                        setPoolInputs({
                          ...poolInputs,
                          deepDepthM: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700/80 text-sm font-mono text-white"
                    />
                  </div>
                </div>
              )}

              {/* Chemical Balancing Inputs */}
              <div className="pt-3 border-t border-[#D4AF37]/15 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    الكلور الحالي · Current Cl₂ (ppm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={poolInputs.currentFreeCl2Ppm}
                    onChange={(e) =>
                      setPoolInputs({
                        ...poolInputs,
                        currentFreeCl2Ppm: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#080A0F] border border-slate-700/80 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    الكلور المستهدف · Target Cl₂ (ppm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={poolInputs.targetFreeCl2Ppm}
                    onChange={(e) =>
                      setPoolInputs({
                        ...poolInputs,
                        targetFreeCl2Ppm: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#080A0F] border border-slate-700/80 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#94A3B8] mb-1">
                    زمن التدوير · Turnover Time (hrs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={poolInputs.customTurnoverHours}
                    onChange={(e) =>
                      setPoolInputs({
                        ...poolInputs,
                        customTurnoverHours: parseFloat(e.target.value) || 4,
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl bg-[#080A0F] border border-slate-700/80 text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>

            {/* Pool Results */}
            <div className="md:col-span-5 space-y-3.5">
              <div className="bg-gradient-to-br from-[#141923] via-[#11151F] to-[#1A160B] border border-[#D4AF37]/40 rounded-2xl p-4 space-y-4 shadow-2xl">
                <div className="p-4 rounded-2xl bg-[#080A0F] border border-[#D4AF37]/45 text-center">
                  <p className="text-xs text-[#CBD5E1] mb-1">
                    الحجم الكلي للمسبح · Total Pool Volume
                  </p>
                  <div className="text-3xl font-extrabold font-mono text-[#D4AF37]">
                    {poolResults.volumeM3.toFixed(1)}{' '}
                    <span className="text-base font-normal text-[#F3E5AB]">
                      m³ (م³)
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[#94A3B8] mt-1">
                    {poolResults.volumeLiters.toLocaleString()} L ·{' '}
                    {poolResults.volumeUsGallons.toFixed(0)} US Gal
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/35">
                    <p className="text-[11px] text-[#93C5FD] font-semibold">
                      INFO · تدفق الفلاتر Filtration
                    </p>
                    <p className="text-lg font-bold font-mono text-white mt-0.5">
                      {poolResults.recirculationFlowM3h.toFixed(2)} m³/h
                    </p>
                    <p className="text-[11px] font-mono text-[#93C5FD]">
                      {poolResults.recirculationFlowGpm.toFixed(1)} GPM ({poolResults.recirculationFlowLpm.toFixed(0)} L/min)
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/35">
                    <p className="text-[11px] text-[#34D399] font-semibold">
                      PASS · جرعة الكلور التعويضية
                    </p>
                    <p className="text-lg font-bold font-mono text-[#34D399] mt-0.5">
                      {poolResults.maintenanceNaoclLiters.toFixed(2)} L
                    </p>
                    <p className="text-[11px] text-[#CBD5E1]">
                      جرعة الصدمة · Shock (10 ppm): {poolResults.shockNaoclLiters.toFixed(1)} L
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 4: OFFLINE LOCAL PROJECT STORAGE REPOSITORY
           ==================================================================== */}
        {activeTab === 'projects' && (
          <div className="bg-[#11151F]/95 border border-[#D4AF37]/25 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4AF37]/15 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-[#D4AF37]" />
                  <span>
                    المشاريع المحفوظة محلياً · Offline Project Storage (LocalStorage / Capacitor)
                  </span>
                </h2>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  احفظ واسترجع حسابات المحطات والمواقع بدون اتصال بالإنترنت · Save & reload site calculations offline.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveCurrentProject}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] hover:brightness-110 text-[#080A0F] font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#D4AF37]/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ المشروع الحالي · Save Current Project</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {savedProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-4 rounded-2xl bg-[#080A0F] border border-[#D4AF37]/20 hover:border-[#D4AF37]/60 transition flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#F3E5AB]">
                        {proj.projectName}
                      </h3>
                      <span className="text-[10px] font-mono text-[#94A3B8]">
                        {proj.updatedAtISO.slice(0, 10)}
                      </span>
                    </div>
                    <p className="text-xs text-[#D4AF37] mt-0.5">
                      {proj.siteLocation} · {proj.engineerName}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5 text-[11px] font-mono text-[#CBD5E1]">
                      <span className="px-2 py-0.5 rounded bg-[#11151F] border border-slate-800">
                        الخزان Tank: {proj.dosing.systemVolumeM3} m³ @ {proj.dosing.targetPpm} ppm
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#11151F] border border-slate-800">
                        المضخة Pump: {proj.pump.waterFlowRate} m³/h
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#11151F] border border-slate-800">
                        المسبح Pool: {proj.pool.customVolumeM3} m³
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
                    <button
                      type="button"
                      onClick={() => handleLoadProject(proj)}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] text-[#080A0F] text-xs font-extrabold"
                    >
                      تحميل المشروع · Load Project
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      className="p-1.5 rounded-xl bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#FCA5A5] border border-[#EF4444]/30"
                      title="حذف · Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 5: PRIVATE OWNER AI ADVISOR & PASSWORD SCHEDULE
            Strictly rendered ONLY when `isAdminUnlocked === true` (WW2025-ADMIN)
           ==================================================================== */}
        {isAdminUnlocked && activeTab === 'ai' && (
          <div className="bg-[#11151F]/95 border border-[#D4AF37]/45 rounded-2xl p-4 space-y-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4AF37]/20 pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                  <h2 className="text-sm font-bold text-[#F3E5AB]">
                    صفحة المستشار الهندسي الذكي (خاصة بـ م. إسلام فقط · Owner-Only AI Advisor)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/40">
                    مخفية عن المستخدمين · Private Gold Access
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  هذه الصفحة لا تظهر لأي مستخدم يدخل بكلمة المرور الدورية العادية، وتظهر لك فقط عند الدخول بكود المالك (`WW2025-ADMIN`).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#CBD5E1] mb-1">
                  مزود الخدمة الذكية · AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as AIProvider)}
                  className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-[#D4AF37]/35 text-xs text-[#F8FAFC]"
                >
                  <option value="offline_heuristic">
                    المحرك الهندسي المحلي · Offline Deterministic Audit
                  </option>
                  <option value="openai">OpenAI API (GPT-4o / GPT-4o-mini)</option>
                  <option value="claude">Anthropic Claude API (Claude 3.5 Sonnet)</option>
                </select>
              </div>

              {aiProvider !== 'offline_heuristic' && (
                <>
                  <div>
                    <label className="block text-xs text-[#CBD5E1] mb-1">
                      مفتاح API الخاص بك · Private API Key
                    </label>
                    <input
                      type="password"
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={aiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                      className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#CBD5E1] mb-1">
                      اسم النموذج · Model Name
                    </label>
                    <input
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#080A0F] border border-slate-700 text-xs font-mono text-white"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRunCloudAI}
                disabled={aiLoading}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] hover:brightness-110 text-[#080A0F] font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#D4AF37]/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                <span>توليد المراجعة الهندسية · Generate Bilingual Engineering Audit</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScheduleTable(!showScheduleTable)}
                className="px-3 py-2 rounded-xl bg-[#171C28] hover:bg-[#1E2536] text-xs text-[#F3E5AB] border border-[#D4AF37]/40 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {showScheduleTable
                    ? 'إخفاء جدول كلمات المرور · Hide Password Schedule'
                    : 'إظهار جدول كلمات المرور (كل 3 أيام) · Show 3-Day Passwords'}
                </span>
              </button>
            </div>

            {/* Admin 3-Day Password Schedule Table */}
            {showScheduleTable && (
              <div className="bg-[#080A0F] border border-[#D4AF37]/35 rounded-2xl p-3.5 space-y-2">
                <h3 className="text-xs font-bold text-[#F3E5AB]">
                  جدول كلمات المرور الدورية للمستخدمين · 3-Day Rotating User Passwords
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead>
                      <tr className="border-b border-[#D4AF37]/25 text-[#D4AF37]">
                        <th className="py-1.5 px-2 text-start">الفترة · Period</th>
                        <th className="py-1.5 px-2 text-start">من · Start (UTC)</th>
                        <th className="py-1.5 px-2 text-start">إلى · End (UTC)</th>
                        <th className="py-1.5 px-2 text-start">كلمة المرور · Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passwordSchedule.map((row) => (
                        <tr
                          key={row.periodIndex}
                          className={`border-b border-slate-800/60 ${
                            row.isCurrent
                              ? 'bg-[#D4AF37]/15 font-bold text-[#F3E5AB]'
                              : 'text-[#CBD5E1]'
                          }`}
                        >
                          <td className="py-1.5 px-2 font-mono">#{row.periodIndex}</td>
                          <td className="py-1.5 px-2 font-mono">{row.startDateISO}</td>
                          <td className="py-1.5 px-2 font-mono">{row.endDateISO}</td>
                          <td className="py-1.5 px-2 font-mono text-[#D4AF37]">
                            {row.password}{' '}
                            {row.isCurrent && (
                              <span className="ms-1 px-1.5 py-0.5 text-[10px] rounded bg-[#10B981] text-[#080A0F] font-sans font-bold">
                                PASS · ACTIVE
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <pre className="p-4 rounded-2xl bg-[#080A0F] border border-[#D4AF37]/25 text-xs leading-relaxed whitespace-pre-wrap font-mono text-[#F8FAFC] overflow-x-auto">
              {aiOutput}
            </pre>
          </div>
        )}
      </main>

      {/* ====================================================================
          PRINTABLE PDF / ENGINEERING REPORT MODAL OVERLAY (#pdfOverlay)
         ==================================================================== */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11151F] border border-[#D4AF37]/50 rounded-3xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D4AF37]/20 pb-3">
              <div>
                <h2 className="text-base font-bold text-[#F3E5AB] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                  <span>تقرير المشروع الهندسي · Official Engineering Report</span>
                </h2>
                <p className="text-xs text-[#D4AF37]">
                  {projectName} · {siteLocation} · {engineerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-3 py-1 rounded-xl bg-[#171C28] text-slate-300 text-xs hover:bg-slate-700"
              >
                ✕ إغلاق · Close
              </button>
            </div>

            <pre className="p-4 rounded-2xl bg-[#080A0F] border border-[#D4AF37]/25 text-xs leading-relaxed whitespace-pre-wrap font-mono text-[#F8FAFC]">
              {buildDeterministicEngineeringAudit(
                projectName,
                siteLocation,
                dosingResults,
                pumpResults,
                poolResults,
                lang
              )}
            </pre>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyReport}
                className="px-4 py-2 rounded-xl bg-[#171C28] hover:bg-[#1E2536] text-xs font-medium text-[#F3E5AB] border border-[#D4AF37]/35 flex items-center gap-1.5"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-4 h-4 text-[#10B981]" />
                    <span>تم النسخ · Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#D4AF37]" />
                    <span>نسخ التقرير · Copy Report</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] text-[#080A0F] font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-[#D4AF37]/20"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة PDF · Print PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MOBILE BOTTOM NAVIGATION BAR — METALLIC GOLD ACTIVE ELEMENTS
         ==================================================================== */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#080A0F]/95 backdrop-blur-lg border-t border-[#D4AF37]/25 px-2 py-1.5 shadow-2xl">
        <div
          className={`max-w-lg mx-auto grid gap-1 ${
            isAdminUnlocked ? 'grid-cols-5' : 'grid-cols-4'
          }`}
        >
          {(
            [
              {
                id: 'dosing' as const,
                icon: Droplets,
                label: 'الجرعات · Dosing',
                adminOnly: false,
              },
              {
                id: 'pump' as const,
                icon: Gauge,
                label: 'المضخة · Pump',
                adminOnly: false,
              },
              {
                id: 'pool' as const,
                icon: Waves,
                label: 'المسابح · Pool',
                adminOnly: false,
              },
              {
                id: 'projects' as const,
                icon: FolderKanban,
                label: 'المشاريع · Saved',
                adminOnly: false,
              },
              {
                id: 'ai' as const,
                icon: Sparkles,
                label: '👑 AI (خاص)',
                adminOnly: true,
              },
            ] as const
          )
            .filter((tab) => !tab.adminOnly || isAdminUnlocked)
            .map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
                    isActive
                      ? 'bg-gradient-to-r from-[#F3E5AB] via-[#D4AF37] to-[#B5891C] text-[#080A0F] font-extrabold shadow-md shadow-[#D4AF37]/20'
                      : 'text-[#94A3B8] hover:text-[#F3E5AB]'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-0.5" />
                  <span className="text-[10px] leading-tight text-center">
                    {tab.label}
                  </span>
                </button>
              );
            })}
        </div>
      </nav>
    </div>
  );
}