"use client";

import { useState, useEffect } from "react";
import { Database, Building2, MapPin, Users } from "lucide-react";

interface CoverageData {
  totalRegions: number;
  totalComplexes: number;
  totalHouseholds: number;
  coveragePercent: number;
  sidoStats: { name: string; regions: number; complexes: number; households: number }[];
}

export default function DataCoverage() {
  const [data, setData] = useState<CoverageData | null>(null);

  useEffect(() => {
    fetch("/api/admin/coverage")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || data.totalComplexes === 0) return null;

  const maxComplexes = Math.max(...data.sidoStats.map((s) => s.complexes), 1);

  return (
    <section className="py-20 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-4">
            <Database className="w-4 h-4" />
            실시간 데이터 현황
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            전국 아파트 데이터 확보 현황
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            네이버 부동산 데이터를 기반으로 전국 아파트 단지의 동수, 세대수, 층수 정보를 확보하고 있습니다.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <StatBox
            icon={MapPin}
            value={data.totalRegions.toLocaleString()}
            label="수집 지역"
            color="text-emerald-400"
          />
          <StatBox
            icon={Building2}
            value={data.totalComplexes.toLocaleString()}
            label="아파트 단지"
            color="text-blue-400"
          />
          <StatBox
            icon={Users}
            value={
              data.totalHouseholds >= 10000
                ? `${(data.totalHouseholds / 10000).toFixed(1)}만`
                : data.totalHouseholds.toLocaleString()
            }
            label="총 세대수"
            color="text-purple-400"
          />
          <StatBox
            icon={Database}
            value={`${data.coveragePercent}%`}
            label="전국 커버리지"
            color="text-amber-400"
          />
        </div>

        {/* Sido Bar Chart */}
        {data.sidoStats.length > 0 && (
          <div className="bg-gray-800/50 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-semibold mb-6">시도별 데이터 현황</h3>
            <div className="space-y-3">
              {data.sidoStats.map((sido) => (
                <div key={sido.name} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-28 flex-shrink-0 text-right">
                    {sido.name.replace(/(특별|광역)(시|자치시|자치도)/, "")}
                  </span>
                  <div className="flex-1 h-7 bg-gray-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full flex items-center justify-end px-3 transition-all duration-500"
                      style={{
                        width: `${Math.max(8, (sido.complexes / maxComplexes) * 100)}%`,
                      }}
                    >
                      <span className="text-xs font-medium whitespace-nowrap">
                        {sido.complexes}개 단지
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-6 text-center">
              데이터는 지속적으로 확장 중입니다
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function StatBox({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-5 text-center">
      <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
      <p className="text-2xl md:text-3xl font-bold">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  );
}
