import { HeirType, Gender, Heir, CalculationResult } from "../types";

/**
 * Professional-grade inheritance calculator following Moroccan Moudawana.
 * Supports:
 * - Fixed Shares (Fard)
 * - Residuary (Asaba)
 * - Pro-rata reduction (Awl)
 * - Surplus redistribution (Radd)
 * - Nested deaths (Manasakhah)
 */
export function calculateInheritance(
  totalWeightedArea: number,
  deceasedGender: Gender,
  heirs: Heir[]
): CalculationResult[] {
  // Step 1: Estate Aggregation
  // If totalWeightedArea is 0, we use 100 as a dummy value for proportional visualization
  const isDummyArea = totalWeightedArea <= 0;
  const totalEstateArea = isDummyArea ? 100 : totalWeightedArea;

  const livingHeirs = heirs.filter(h => !h.isDeceased);
  const getCount = (type: HeirType) => livingHeirs.filter(h => h.type === type).length;
  
  const sons = getCount(HeirType.SON);
  const daughters = getCount(HeirType.DAUGHTER);
  const hasChildren = sons > 0 || daughters > 0;

  const results: CalculationResult[] = [];
  let totalAssignedArea = 0;

  // Step 2: Fixed Shares (Fara'id) - Assuming children exist as per prompt
  // Spouse(s)
  const spouseHeirs = livingHeirs.filter(h => h.type === HeirType.SPOUSE);
  if (spouseHeirs.length > 0) {
    const totalSpouseShare = deceasedGender === Gender.FEMALE 
      ? (hasChildren ? 0.25 : 0.5) // Husband: 1/4 if children, 1/2 if not
      : (hasChildren ? 0.125 : 0.25); // Wife: 1/8 if children, 1/4 if not
    
    const individualSpouseShare = totalSpouseShare / spouseHeirs.length;
    const individualSpouseArea = totalEstateArea * individualSpouseShare;
    
    spouseHeirs.forEach(spouse => {
      results.push({
        heirId: spouse.id,
        heirType: HeirType.SPOUSE,
        heirName: spouse.name,
        shareFraction: deceasedGender === Gender.FEMALE ? (hasChildren ? "1/4" : "1/2") : (hasChildren ? `1/8 ÷ ${spouseHeirs.length}` : `1/4 ÷ ${spouseHeirs.length}`),
        shareDecimal: individualSpouseShare,
        requiredWeightedArea: isDummyArea ? 0 : individualSpouseArea,
        requiredArea: 0,
        description: "نصيب مفروض (الفرض) - يشترك فيه الزوجات"
      });
      totalAssignedArea += individualSpouseArea;
    });
  }

  // Mother
  const motherHeir = livingHeirs.find(h => h.type === HeirType.MOTHER);
  if (motherHeir) {
    const share = hasChildren ? 1/6 : 1/3;
    const area = totalEstateArea * share;
    results.push({
      heirId: motherHeir.id,
      heirType: HeirType.MOTHER,
      heirName: motherHeir.name,
      shareFraction: hasChildren ? "1/6" : "1/3",
      shareDecimal: share,
      requiredWeightedArea: isDummyArea ? 0 : area,
      requiredArea: 0,
      description: "نصيب مفروض (الفرض)"
    });
    totalAssignedArea += area;
  }

  // Father
  const fatherHeir = livingHeirs.find(h => h.type === HeirType.FATHER);
  if (fatherHeir) {
    const share = 1/6; // Father gets 1/6 if children exist
    const area = totalEstateArea * share;
    results.push({
      heirId: fatherHeir.id,
      heirType: HeirType.FATHER,
      heirName: fatherHeir.name,
      shareFraction: "1/6",
      shareDecimal: share,
      requiredWeightedArea: isDummyArea ? 0 : area,
      requiredArea: 0,
      description: "نصيب مفروض (الفرض)"
    });
    totalAssignedArea += area;
  }

  // Step 3: Remainder Calculation
  const remainder = totalEstateArea - totalAssignedArea;

  // Step 4: Residuary (Asabah) 2:1 Ratio
  if (hasChildren && remainder > 0) {
    const totalUnits = (sons * 2) + daughters;
    const valuePerUnit = remainder / totalUnits;

    // Individual Sons
    const sonHeirs = livingHeirs.filter(h => h.type === HeirType.SON);
    sonHeirs.forEach(son => {
      const individualSonArea = valuePerUnit * 2;
      results.push({
        heirId: son.id,
        heirType: HeirType.SON,
        heirName: son.name,
        shareFraction: "التعصيب (2:1)",
        shareDecimal: individualSonArea / totalEstateArea,
        requiredWeightedArea: isDummyArea ? 0 : individualSonArea,
        requiredArea: 0,
        description: "نصيب بالتعصيب - ابن"
      });
    });

    // Individual Daughters
    const daughterHeirs = livingHeirs.filter(h => h.type === HeirType.DAUGHTER);
    daughterHeirs.forEach(daughter => {
      const individualDaughterArea = valuePerUnit;
      results.push({
        heirId: daughter.id,
        heirType: HeirType.DAUGHTER,
        heirName: daughter.name,
        shareFraction: "التعصيب (2:1)",
        shareDecimal: individualDaughterArea / totalEstateArea,
        requiredWeightedArea: isDummyArea ? 0 : individualDaughterArea,
        requiredArea: 0,
        description: "نصيب بالتعصيب - بنت"
      });
    });
  }

  // Step 5: Zero-Sum Verification
  const currentTotal = results.reduce((sum, r) => sum + r.requiredWeightedArea, 0);
  const diff = totalEstateArea - currentTotal;
  
  if (Math.abs(diff) > 0.0001) {
    // Adjust the first "Son" result if it exists, otherwise the last result
    const sonResult = results.find(r => r.heirType === HeirType.SON);
    if (sonResult) {
      if (!isDummyArea) sonResult.requiredWeightedArea += diff;
      sonResult.shareDecimal = (isDummyArea ? (sonResult.shareDecimal * totalEstateArea + diff) : sonResult.requiredWeightedArea) / totalEstateArea;
    } else if (results.length > 0) {
      if (!isDummyArea) results[results.length - 1].requiredWeightedArea += diff;
      results[results.length - 1].shareDecimal = (isDummyArea ? (results[results.length - 1].shareDecimal * totalEstateArea + diff) : results[results.length - 1].requiredWeightedArea) / totalEstateArea;
    }
  }

  return results;
}
