export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type ExpenseCategory = 'MATERIAL' | 'LABOR' | 'EQUIPMENT' | 'TRANSPORT' | 'OFFICE' | 'INSURANCE' | 'OTHER';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'CARD' | 'CHECK' | 'OTHER';

export interface Invoice {
  id: string;
  contractorId: string;
  projectId?: string;
  projectName?: string;
  contractId?: string;
  invoiceNumber: string;
  description?: string;
  amount: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  issuedAt?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  contractorId: string;
  invoiceId?: string;
  projectId?: string;
  projectName?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentType: 'INCOME' | 'EXPENSE';
  description?: string;
  paidAt: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  contractorId: string;
  projectId?: string;
  projectName?: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface FinanceSummary {
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  prevMonthRevenue: number;
  revenueChangeRate: number;
  receivables: {
    total: number;
    current: number;
    overdue30: number;
    overdue60: number;
    overdue90: number;
  };
  projectedBalance: number;
}

export interface CashFlowItem {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
}

export interface ProjectProfit {
  projectId: string;
  projectName: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

// DB → 프론트엔드 변환
export function mapDbInvoice(db: Record<string, unknown>): Invoice {
  return {
    id: db.id as string,
    contractorId: db.contractor_id as string,
    projectId: db.project_id as string | undefined,
    projectName: db.project_name as string | undefined,
    contractId: db.contract_id as string | undefined,
    invoiceNumber: (db.invoice_number as string) || '',
    description: db.description as string | undefined,
    amount: (db.amount as number) || 0,
    tax: (db.tax as number) || 0,
    total: (db.total as number) || 0,
    status: mapInvoiceStatus(db.status as string),
    issuedAt: db.issued_at as string | undefined,
    dueDate: db.due_date as string | undefined,
    paidAt: db.paid_at as string | undefined,
    createdAt: db.created_at as string,
  };
}

export function mapDbExpense(db: Record<string, unknown>): ExpenseRecord {
  return {
    id: db.id as string,
    contractorId: db.contractor_id as string,
    projectId: db.project_id as string | undefined,
    projectName: db.project_name as string | undefined,
    category: mapExpenseCategory(db.category as string),
    description: (db.description as string) || '',
    amount: (db.amount as number) || 0,
    expenseDate: (db.expense_date as string) || '',
    receiptUrl: db.receipt_url as string | undefined,
    createdAt: db.created_at as string,
  };
}

export function mapDbPayment(db: Record<string, unknown>): PaymentRecord {
  return {
    id: db.id as string,
    contractorId: db.contractor_id as string,
    invoiceId: db.invoice_id as string | undefined,
    projectId: db.project_id as string | undefined,
    projectName: db.project_name as string | undefined,
    amount: (db.amount as number) || 0,
    paymentMethod: mapPaymentMethod(db.payment_method as string),
    paymentType: (db.payment_type as string) === 'expense' ? 'EXPENSE' : 'INCOME',
    description: db.description as string | undefined,
    paidAt: (db.paid_at as string) || '',
    createdAt: db.created_at as string,
  };
}

function mapInvoiceStatus(s: string): InvoiceStatus {
  switch (s) {
    case 'sent': return 'SENT';
    case 'paid': return 'PAID';
    case 'overdue': return 'OVERDUE';
    case 'cancelled': return 'CANCELLED';
    default: return 'DRAFT';
  }
}

function mapExpenseCategory(s: string): ExpenseCategory {
  switch (s) {
    case 'material': return 'MATERIAL';
    case 'labor': return 'LABOR';
    case 'equipment': return 'EQUIPMENT';
    case 'transport': return 'TRANSPORT';
    case 'office': return 'OFFICE';
    case 'insurance': return 'INSURANCE';
    default: return 'OTHER';
  }
}

function mapPaymentMethod(s: string): PaymentMethod {
  switch (s) {
    case 'cash': return 'CASH';
    case 'card': return 'CARD';
    case 'check': return 'CHECK';
    case 'bank_transfer': return 'BANK_TRANSFER';
    default: return 'OTHER';
  }
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: '초안',
  SENT: '발송',
  PAID: '수금 완료',
  OVERDUE: '연체',
  CANCELLED: '취소',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-400',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  MATERIAL: '자재비',
  LABOR: '노무비',
  EQUIPMENT: '장비비',
  TRANSPORT: '운반비',
  OFFICE: '사무비',
  INSURANCE: '보험료',
  OTHER: '기타',
};

export const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  MATERIAL: 'bg-blue-100 text-blue-700',
  LABOR: 'bg-green-100 text-green-700',
  EQUIPMENT: 'bg-purple-100 text-purple-700',
  TRANSPORT: 'bg-amber-100 text-amber-700',
  OFFICE: 'bg-gray-100 text-gray-700',
  INSURANCE: 'bg-cyan-100 text-cyan-700',
  OTHER: 'bg-gray-100 text-gray-500',
};
