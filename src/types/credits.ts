// 크레딧 시스템 타입 정의

export interface UserCredits {
  id: string;
  userId: string;
  balance: number;
  freeGenerationsUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: "CHARGE" | "USE" | "FREE" | "REFUND";
  description: string;
  createdAt: string;
}

export interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  discount?: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "pkg-10", credits: 10, price: 1000, label: "10 크레딧" },
  { id: "pkg-50", credits: 50, price: 4500, label: "50 크레딧", discount: "10% 할인" },
  { id: "pkg-100", credits: 100, price: 8000, label: "100 크레딧", discount: "20% 할인" },
  { id: "pkg-300", credits: 300, price: 21000, label: "300 크레딧", discount: "30% 할인" },
];

export const CREDITS_PER_GENERATION = 10;
export const FREE_GENERATION_LIMIT = 1;
