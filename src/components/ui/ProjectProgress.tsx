"use client";

import { Home, Box, Palette, Image, Calculator, FileText } from "lucide-react";
import type { ConsumerProjectStatus } from "@/types/consumer-project";

const STATUS_TO_STEP: Record<ConsumerProjectStatus, number> = {
  ADDRESS_SELECTION: 1,
  FLOOR_PLAN: 2,
  AI_DESIGN: 3,
  RENDERING: 4,
  ESTIMATING: 5,
  RFQ: 6,
  CONTRACTED: 7,
};

const STEPS = [
  { label: "우리집", icon: Home },
  { label: "도면", icon: Box },
  { label: "AI디자인", icon: Palette },
  { label: "렌더링", icon: Image },
  { label: "물량", icon: Calculator },
  { label: "견적", icon: FileText },
];

interface ProjectProgressProps {
  status?: ConsumerProjectStatus;
  compact?: boolean;
}

export function ProjectProgress({ status, compact = false }: ProjectProgressProps) {
  const currentStep = status ? STATUS_TO_STEP[status] ?? 1 : 1;

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 mt-2">
        {STEPS.map((step, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          return (
            <div key={step.label} className="flex items-center">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  isCompleted
                    ? "bg-green-500"
                    : isCurrent
                    ? "bg-blue-500"
                    : "bg-gray-200"
                }`}
                title={step.label}
              />
              {idx < STEPS.length - 1 && (
                <div
                  className={`w-3 h-0.5 ${
                    stepNum < currentStep ? "bg-green-300" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
        <span className="text-[10px] text-gray-400 ml-1.5">
          {currentStep > 6 ? "완료" : `${currentStep}/6`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-2">
      {STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-[10px] mt-1 whitespace-nowrap ${
                  isCompleted
                    ? "text-green-600 font-medium"
                    : isCurrent
                    ? "text-blue-600 font-medium"
                    : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mt-[-12px] ${
                  stepNum < currentStep ? "bg-green-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
