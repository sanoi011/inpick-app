export type EstimateStatus = 'DRAFT' | 'CONFIRMED' | 'BIDDING' | 'CONTRACTED';

export interface Estimate {
  id: string;
  userId?: string;
  projectName: string;
  address: string;
  buildingType: string;
  totalArea: number;
  status: EstimateStatus;
  materialCost: number;
  laborCost: number;
  overheadCost: number;
  totalCost: number;
  marginRate: number;
  finalPrice: number;
  items: EstimateItem[];
  spaceSummary: SpaceSummary[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type EstimateItemType = 'FINISH' | 'PREREQ' | 'SUBMATERIAL';

export interface EstimateItem {
  id: string;
  estimateId: string;
  spaceAreaId?: string;
  finishItemId?: string;
  prereqId?: string;
  itemType: EstimateItemType;
  itemName: string;
  specification?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  laborRate: number;
  materialCost: number;
  laborCost: number;
  totalCost: number;
  sortOrder: number;
  isAutoAdded: boolean;
}

export interface SpaceSummary {
  id: string;
  estimateId: string;
  spaceTypeId?: string;
  spaceName: string;
  areaM2: number;
  materialTotal: number;
  laborTotal: number;
  overheadTotal: number;
  spaceTotal: number;
}

// DB → 프론트엔드 변환 유틸
export function mapDbEstimate(db: Record<string, unknown>): Estimate {
  const items = (db.estimate_items as Record<string, unknown>[] | undefined) || [];
  const spaces = (db.estimate_space_summary as Record<string, unknown>[] | undefined) || [];
  const meta = (db.metadata as Record<string, unknown>) || {};
  const calc = (meta.calculation as Record<string, number>) || {};

  return {
    id: db.id as string,
    userId: db.user_id as string | undefined,
    projectName: db.title as string || '',
    address: (db.address as string) || '',
    buildingType: (db.project_type as string) || '',
    totalArea: (db.total_area_m2 as number) || 0,
    status: mapDbStatus(db.status as string),
    materialCost: (db.total_material as number) || 0,
    laborCost: (db.total_labor as number) || 0,
    overheadCost: (db.total_overhead as number) || 0,
    totalCost: calc.netConstruction || ((db.total_material as number || 0) + (db.total_labor as number || 0) + (db.total_overhead as number || 0)),
    marginRate: calc.profit ? (calc.profit / (calc.totalBeforeTax || 1)) * 100 : 15,
    finalPrice: (db.grand_total as number) || 0,
    items: items.map(mapDbItem),
    spaceSummary: spaces.map(mapDbSpaceSummary),
    notes: (db.notes as string) || undefined,
    createdAt: db.created_at as string,
    updatedAt: db.updated_at as string,
  };
}

function mapDbStatus(s: string): EstimateStatus {
  switch (s) {
    case 'confirmed': return 'CONFIRMED';
    case 'bidding': case 'in_progress': return 'BIDDING';
    case 'contracted': case 'completed': return 'CONTRACTED';
    default: return 'DRAFT';
  }
}

function mapDbItem(db: Record<string, unknown>): EstimateItem {
  const mat = (db.material_cost as number) || 0;
  const lab = (db.labor_cost as number) || 0;
  return {
    id: db.id as string,
    estimateId: db.estimate_id as string,
    spaceAreaId: db.space_type_id as string | undefined,
    finishItemId: db.finish_item_id as string | undefined,
    prereqId: db.prereq_id as string | undefined,
    itemType: (db.item_type as EstimateItemType) || 'FINISH',
    itemName: (db.item_name as string) || '',
    specification: db.specification as string | undefined,
    unit: (db.unit as string) || '식',
    quantity: (db.quantity as number) || 1,
    unitPrice: mat + lab,
    laborRate: lab > 0 ? (lab / (mat + lab)) * 100 : 0,
    materialCost: mat,
    laborCost: lab,
    totalCost: (db.subtotal as number) || mat + lab,
    sortOrder: (db.sort_order as number) || 0,
    isAutoAdded: (db.is_auto_added as boolean) || false,
  };
}

function mapDbSpaceSummary(db: Record<string, unknown>): SpaceSummary {
  return {
    id: db.id as string,
    estimateId: db.estimate_id as string,
    spaceTypeId: db.space_type_id as string | undefined,
    spaceName: (db.space_name as string) || '',
    areaM2: (db.area_m2 as number) || 0,
    materialTotal: (db.material_total as number) || 0,
    laborTotal: (db.labor_total as number) || 0,
    overheadTotal: (db.overhead_total as number) || 0,
    spaceTotal: (db.space_total as number) || 0,
  };
}

// 상태 라벨
export const STATUS_LABELS: Record<EstimateStatus, string> = {
  DRAFT: '초안',
  CONFIRMED: '확정',
  BIDDING: '입찰중',
  CONTRACTED: '계약완료',
};

export const STATUS_COLORS: Record<EstimateStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  BIDDING: 'bg-amber-100 text-amber-700',
  CONTRACTED: 'bg-green-100 text-green-700',
};
