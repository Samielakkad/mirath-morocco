export enum HeirType {
  SPOUSE = "SPOUSE",
  SON = "SON",
  DAUGHTER = "DAUGHTER",
  FATHER = "FATHER",
  MOTHER = "MOTHER",
  FULL_BROTHER = "FULL_BROTHER",
  FULL_SISTER = "FULL_SISTER",
  PATERNAL_BROTHER = "PATERNAL_BROTHER",
  PATERNAL_SISTER = "PATERNAL_SISTER",
  MATERNAL_BROTHER = "MATERNAL_BROTHER",
  MATERNAL_SISTER = "MATERNAL_SISTER",
  GRANDFATHER = "GRANDFATHER",
  GRANDMOTHER = "GRANDMOTHER",
}

export enum Gender {
  MALE = "MALE",
  FEMALE = "FEMALE",
}

export enum LandType {
  AGRICULTURAL = "AGRICULTURAL",
  URBAN = "URBAN",
}

export enum SoilType {
  TIRS = "TIRS",     // Dark, fertile
  HAMRI = "HAMRI",   // Red, clay
  RMEL = "RMEL",     // Sandy
  ROCKY = "ROCKY",   // Hard, low value
}

export interface SoilZone {
  id: string;
  type: SoilType;
  coefficient: number;
  path: { lat: number; lng: number }[];
  color: string;
}

export interface ValueZone {
  id: string;
  name: string;
  coefficient: number; // e.g., 1.5 for road access, 0.7 for rocky soil
  path: { lat: number; lng: number }[];
  color: string;
}

export interface AccessLine {
  id: string;
  name: string;
  path: { lat: number; lng: number }[]; // Polyline for road access
}

export interface Heir {
  id: string;
  type: HeirType;
  count: number;
  age?: number;
  name?: string;
  isDeceased?: boolean;
  subHeirs?: Heir[]; // For Manasakhah (Nested Deaths)
}

export interface SubPlot {
  heirId: string;
  heirType: HeirType;
  heirName: string;
  path: { lat: number; lng: number }[];
  color: string;
  area: number; // Physical area
  weightedArea: number; // Area * Coefficient
  value: number; // Monetary or relative value
}

export interface LandPlot {
  id: string;
  name: string;
  area: number;
  weightedArea: number;
  path: { lat: number; lng: number }[];
  address?: string;
  landType: LandType;
  subPlots?: SubPlot[];
  assignedHeirId?: string; // Manual assignment suggestion
}

export interface Soulte {
  fromHeirId: string;
  fromHeirName: string;
  toHeirId: string;
  toHeirName: string;
  amount: number;
  reason: string;
}

export interface CalculationResult {
  heirId: string;
  heirType: HeirType;
  heirName: string;
  shareFraction: string;
  shareDecimal: number;
  requiredArea: number;
  requiredWeightedArea: number;
  description: string;
}

export interface EstatePlan {
  id?: string;
  name: string;
  deceasedGender: Gender;
  heirs: Heir[];
  plots: LandPlot[];
  valueZones: ValueZone[];
  accessLines: AccessLine[];
  landType: LandType;
  createdAt: string;
  updatedAt: string;
}
