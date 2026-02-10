"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Building2, ArrowRight, MapPin, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AddressResult {
  roadAddr: string;
  jibunAddr: string;
  zipNo: string;
  bdNm: string;
  siNm: string;
  sggNm: string;
  emdNm: string;
  bdKdcd: string;
}

export default function AddressPage() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AddressResult[]>([]);
  const [selected, setSelected] = useState<AddressResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const router = useRouter();

  const searchAddress = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResults([]);
      setTotalCount(0);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/address?keyword=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.error) {
        setResults([]);
        setTotalCount(0);
      } else {
        setResults(data.results || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword.trim().length >= 2) {
        searchAddress(keyword);
      } else {
        setResults([]);
        setTotalCount(0);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, searchAddress]);

  const handleSelect = (addr: AddressResult) => {
    setSelected(addr);
    setKeyword(addr.roadAddr);
    setResults([]);
  };

  const handleNext = () => {
    if (selected) {
      const params = new URLSearchParams({
        address: selected.roadAddr,
        zipNo: selected.zipNo,
        bdNm: selected.bdNm || "",
        bdKdcd: selected.bdKdcd || "",
      });
      router.push(`/consult?${params.toString()}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl text-center">
        <Link href="/" className="text-2xl font-bold text-blue-600 mb-2 inline-block">INPICK</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">주소를 입력해주세요</h1>
        <p className="text-gray-500 mt-2 mb-8">인테리어할 공간의 주소를 검색하면 건물 정보를 자동으로 불러옵니다</p>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          {loading && <Loader2 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-blue-500 w-5 h-5 animate-spin" />}
          <input
            type="text"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setSelected(null); }}
            placeholder="도로명 주소 또는 건물명을 입력하세요"
            className="w-full pl-12 pr-12 py-4 rounded-xl border border-gray-300 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />

          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-gray-200 shadow-lg max-h-80 overflow-y-auto z-10">
              <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">
                검색결과 {totalCount.toLocaleString()}건
              </div>
              {results.map((addr, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(addr)}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                >
                  <MapPin className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{addr.roadAddr}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {addr.jibunAddr} {addr.bdNm && `| ${addr.bdNm}`} [{addr.zipNo}]
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-4 bg-blue-50 rounded-xl p-4 text-left border border-blue-100">
            <p className="text-sm font-medium text-blue-900">{selected.roadAddr}</p>
            <p className="text-xs text-blue-600 mt-1">
              {selected.bdNm && `${selected.bdNm} | `}{selected.zipNo}
              {selected.bdKdcd === "1" ? " | 공동주택" : " | 일반건물"}
            </p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-left">
            <Building2 className="w-8 h-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-gray-900">아파트 / 빌라</h3>
            <p className="text-sm text-gray-500 mt-1">공동주택 도면 자동 조회</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-left">
            <Building2 className="w-8 h-8 text-indigo-600 mb-3" />
            <h3 className="font-semibold text-gray-900">상가 / 사무실</h3>
            <p className="text-sm text-gray-500 mt-1">상업공간 맞춤 견적</p>
          </div>
        </div>

        <button
          onClick={handleNext}
          disabled={!selected}
          className="mt-8 inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          다음 단계로 <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
