"use client";

import { useState } from "react";
import { Search, Building2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AddressPage() {
  const [address, setAddress] = useState("");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl text-center">
        <Link href="/" className="text-2xl font-bold text-blue-600 mb-2 inline-block">INPICK</Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-4">주소를 입력해주세요</h1>
        <p className="text-gray-500 mt-2 mb-8">인테리어할 공간의 주소를 검색하면 건물 정보를 자동으로 불러옵니다</p>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="도로명 주소 또는 건물명을 입력하세요"
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-300 text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

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

        <button className="mt-8 inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-blue-700 transition-colors">
          다음 단계로 <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
