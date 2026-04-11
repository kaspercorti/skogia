import { useMemo } from "react";
import type { Stand } from "@/hooks/useSkogskollData";

// ─── Constants ───
const CO2_PER_M3SK = 0.9; // ton CO2 per m³sk
const DEFAULT_CARBON_PRICE = 350; // kr/ton CO2

// Estimated annual growth m³sk/ha based on site index letter + number
// Fallback table when growth_rate_percent is missing
const GROWTH_TABLE: Record<string, number> = {
  T16: 3.0, T18: 3.8, T20: 4.5, T22: 5.2, T24: 6.0, T26: 6.8, T28: 7.5,
  G16: 4.0, G18: 5.0, G20: 6.0, G22: 7.0, G24: 8.0, G26: 9.0, G28: 10.0, G30: 11.0, G32: 12.0,
  B16: 2.5, B18: 3.0, B20: 3.5, B22: 4.0, B24: 4.5,
};

function estimateAnnualGrowthM3sk(stand: Stand): number {
  // Use growth_rate_percent if available
  if (stand.growth_rate_percent && stand.volume_m3sk) {
    return (stand.volume_m3sk * stand.growth_rate_percent) / 100;
  }

  // Estimate from site index
  if (stand.site_index) {
    const key = stand.site_index.replace(/\s/g, "").toUpperCase();
    const growthPerHa = GROWTH_TABLE[key];
    if (growthPerHa) {
      return growthPerHa * stand.area_ha;
    }
  }

  // Rough fallback based on tree species
  const species = (stand.tree_species || "").toLowerCase();
  let growthPerHa = 5.0; // default
  if (species.includes("gran")) growthPerHa = 7.0;
  else if (species.includes("tall")) growthPerHa = 5.0;
  else if (species.includes("björk") || species.includes("löv")) growthPerHa = 3.5;

  return growthPerHa * stand.area_ha;
}

export interface StandCarbonData {
  standId: string;
  standName: string;
  annualGrowthM3sk: number;
  annualCO2: number; // ton
  totalCO2: number; // ton
  annualCarbonCredits: number;
  totalCarbonCredits: number;
  annualValue: number; // kr
  totalValue: number; // kr
}

export interface CarbonSummary {
  totalAnnualCO2: number;
  totalCO2Stock: number;
  totalAnnualCredits: number;
  totalCredits: number;
  totalAnnualValue: number;
  totalStockValue: number;
  carbonPricePerTon: number;
  stands: StandCarbonData[];
}

export function calculateCarbonForStand(stand: Stand, carbonPrice: number): StandCarbonData {
  const annualGrowthM3sk = estimateAnnualGrowthM3sk(stand);
  const annualCO2 = annualGrowthM3sk * CO2_PER_M3SK;
  const totalCO2 = (stand.volume_m3sk ?? 0) * CO2_PER_M3SK;

  return {
    standId: stand.id,
    standName: stand.name,
    annualGrowthM3sk: Math.round(annualGrowthM3sk * 10) / 10,
    annualCO2: Math.round(annualCO2 * 10) / 10,
    totalCO2: Math.round(totalCO2 * 10) / 10,
    annualCarbonCredits: Math.round(annualCO2 * 10) / 10,
    totalCarbonCredits: Math.round(totalCO2 * 10) / 10,
    annualValue: Math.round(annualCO2 * carbonPrice),
    totalValue: Math.round(totalCO2 * carbonPrice),
  };
}

export function useCarbonCredits(stands: Stand[], carbonPrice = DEFAULT_CARBON_PRICE): CarbonSummary {
  return useMemo(() => {
    const standData = stands.map((s) => calculateCarbonForStand(s, carbonPrice));

    return {
      totalAnnualCO2: Math.round(standData.reduce((sum, s) => sum + s.annualCO2, 0) * 10) / 10,
      totalCO2Stock: Math.round(standData.reduce((sum, s) => sum + s.totalCO2, 0) * 10) / 10,
      totalAnnualCredits: Math.round(standData.reduce((sum, s) => sum + s.annualCarbonCredits, 0) * 10) / 10,
      totalCredits: Math.round(standData.reduce((sum, s) => sum + s.totalCarbonCredits, 0) * 10) / 10,
      totalAnnualValue: standData.reduce((sum, s) => sum + s.annualValue, 0),
      totalStockValue: standData.reduce((sum, s) => sum + s.totalValue, 0),
      carbonPricePerTon: carbonPrice,
      stands: standData,
    };
  }, [stands, carbonPrice]);
}

export { DEFAULT_CARBON_PRICE, CO2_PER_M3SK };