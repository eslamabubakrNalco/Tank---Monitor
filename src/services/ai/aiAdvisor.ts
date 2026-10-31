/**
 * WaterWise Optional Cloud/AI Service Layer (OpenAI & Anthropic Claude)
 * Decoupled from the deterministic engineering engine:
 * - Engineering math is ALWAYS computed deterministically offline first.
 * - AI is strictly optional and used only to generate bilingual treatment SOPs, safety audits, or field troubleshooting advice.
 */

import type { DosingResults } from '../../core/engine/dosing';
import type { PumpResults } from '../../core/engine/pump';
import type { PoolResults } from '../../core/engine/pool';

export type AIProvider = 'openai' | 'claude' | 'offline_heuristic';

export interface AIAdvisorConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export interface EngineeringSnapshot {
  projectName: string;
  siteLocation: string;
  dosingResults: DosingResults;
  pumpResults: PumpResults;
  poolResults: PoolResults;
  language: 'ar' | 'en';
}

export async function generateEngineeringAudit(
  snapshot: EngineeringSnapshot,
  config: AIAdvisorConfig
): Promise<string> {
  // Always provide a rich deterministic engineering audit when offline or when no API key is set
  if (config.provider === 'offline_heuristic' || !config.apiKey.trim()) {
    return buildDeterministicEngineeringSummary(snapshot);
  }

  const systemPrompt =
    snapshot.language === 'ar'
      ? 'أنت مهندس خبير في معالجة المياه ومعايرة مضخات الحقن الكيميائي. راجع نتائج الحسابات الهندسية التالية وقدم توصيات تشغيلية وإرشادات سلامة مختصرة ودقيقة باللغة العربية.'
      : 'You are a Senior Water Treatment & Chemical Dosing Engineer. Review the deterministic engineering calculation payload below and provide concise operational SOPs, safety checks, and pump calibration advice.';

  const userPayload = JSON.stringify(snapshot, null, 2);

  if (config.provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayload },
        ],
        temperature: 0.2,
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI API Error (${response.status})`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || buildDeterministicEngineeringSummary(snapshot);
  }

  if (config.provider === 'claude') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-5-sonnet-latest',
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPayload }],
      }),
    });
    if (!response.ok) {
      throw new Error(`Claude API Error (${response.status})`);
    }
    const data = await response.json();
    return data.content?.[0]?.text || buildDeterministicEngineeringSummary(snapshot);
  }

  return buildDeterministicEngineeringSummary(snapshot);
}

export function buildDeterministicEngineeringSummary(snapshot: EngineeringSnapshot): string {
  const { dosingResults, pumpResults, poolResults, language } = snapshot;

  if (language === 'ar') {
    const ctNote = dosingResults.ctCompliant
      ? `✅ تحقق زمن التلامس (CT): محقق (${dosingResults.achievedCT.toFixed(1)} مقابل المطلوب ${dosingResults.requiredCT} mg·min/L).`
      : `⚠️ تنبيه زمن التلامس (CT): القيمة المحققة (${dosingResults.achievedCT.toFixed(1)} mg·min/L) أقل من المطلوب (${dosingResults.requiredCT} mg·min/L). يوصى بزيادة زمن المكث أو الجرعة.`;

    const pumpNote =
      pumpResults.status === 'optimal'
        ? `✅ معايرة المضخة ضمن النطاق المثالي (${pumpResults.pumpUtilizationPercent.toFixed(1)}% من السعة القصوى).`
        : pumpResults.status === 'under_sized'
        ? `🚨 المضخة أصغر من المطلوب (${pumpResults.pumpUtilizationPercent.toFixed(1)}% > 100%). يلزم مضخة بسعة أكبر أو تقليل نسبة التخفيف.`
        : `⚠️ المضخة تعمل عند نسبة منخفضة أو تحتاج تعديل طول الشوط (السرعة المطلوبة: ${pumpResults.requiredSpeedPercentAtStroke.toFixed(1)}%).`;

    return [
      `📋 التقرير الهندسي الذكي — ${snapshot.projectName || 'مشروع WaterWise'}`,
      `• الكمية الكيميائية المطلوبة: ${dosingResults.liquidVolumeLiters.toFixed(2)} لتر (${dosingResults.activeMassKg.toFixed(3)} كجم مادة فعالة).`,
      `• العبوات المطلوبة (${dosingResults.containerSizeL}L): ${dosingResults.containersNeeded.toFixed(2)} عبوة (تقريب إلى ${dosingResults.containersRoundedUp} عبوة).`,
      `• ${ctNote}`,
      `• معدل ضخ المضخة المطلوب: ${pumpResults.requiredPumpFlowLh.toFixed(3)} لتر/ساعة (${pumpResults.requiredPumpFlowMlMin.toFixed(1)} مل/دقيقة).`,
      `• ${pumpNote}`,
      `• حجم المسبح / الخزان الإضافي: ${poolResults.volumeM3.toFixed(1)} م³ ومعدل التدوير المطلوب ${poolResults.recirculationFlowM3h.toFixed(2)} م³/ساعة.`,
    ].join('\n');
  }

  const ctNoteEn = dosingResults.ctCompliant
    ? `✅ Disinfection CT Verified: Achieved ${dosingResults.achievedCT.toFixed(1)} vs required ${dosingResults.requiredCT} mg·min/L.`
    : `⚠️ Disinfection CT Deficit: Achieved ${dosingResults.achievedCT.toFixed(1)} mg·min/L is below target ${dosingResults.requiredCT} mg·min/L. Increase retention time or residual dose.`;

  const pumpNoteEn =
    pumpResults.status === 'optimal'
      ? `✅ Pump sizing is within optimal range (${pumpResults.pumpUtilizationPercent.toFixed(1)}% capacity utilization).`
      : pumpResults.status === 'under_sized'
      ? `🚨 Pump Under-Sized (${pumpResults.pumpUtilizationPercent.toFixed(1)}% > 100% capacity). Select a higher-capacity dosing pump.`
      : `⚠️ Adjust pump stroke/speed calibration (Required Speed: ${pumpResults.requiredSpeedPercentAtStroke.toFixed(1)}%).`;

  return [
    `📋 Engineering Verification Summary — ${snapshot.projectName || 'WaterWise Site'}`,
    `• Required Liquid Chemical Volume: ${dosingResults.liquidVolumeLiters.toFixed(2)} L (${dosingResults.activeMassKg.toFixed(3)} kg active mass).`,
    `• Containers Needed (${dosingResults.containerSizeL}L): ${dosingResults.containersNeeded.toFixed(2)} units (${dosingResults.containersRoundedUp} whole containers).`,
    `• ${ctNoteEn}`,
    `• Required Dosing Pump Output: ${pumpResults.requiredPumpFlowLh.toFixed(3)} L/h (${pumpResults.requiredPumpFlowMlMin.toFixed(1)} mL/min).`,
    `• ${pumpNoteEn}`,
    `• Pool / Basin Volume: ${poolResults.volumeM3.toFixed(1)} m³ with required turnover flow of ${poolResults.recirculationFlowM3h.toFixed(2)} m³/h.`,
  ].join('\n');
}
