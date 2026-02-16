"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, MapPin, Loader2, Building2 } from "lucide-react";
import type { AddressSearchResult } from "@/types/address";

const RECENT_ADDRESSES_KEY = "inpick_recent_addresses";
const MAX_RECENT = 5;

function loadRecentAddresses(): AddressSearchResult[] {
  try {
    const stored = localStorage.getItem(RECENT_ADDRESSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentAddress(addr: AddressSearchResult) {
  try {
    const recent = loadRecentAddresses();
    const filtered = recent.filter((r) => r.roadAddress !== addr.roadAddress);
    const updated = [addr, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(updated));
  } catch {}
}

interface Props {
  onSelectAddress: (addr: AddressSearchResult) => void;
  selectedAddress: AddressSearchResult | null;
}

export default function AddressSearchPanel({ onSelectAddress, selectedAddress }: Props) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [showRecent, setShowRecent] = useState(false);
  const [recentAddresses, setRecentAddresses] = useState<AddressSearchResult[]>([]);

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

  const handleSelect = (addr: AddressSearchResult) => {
    saveRecentAddress(addr);
    setKeyword(addr.roadAddress);
    setResults([]);
    setShowRecent(false);
    onSelectAddress(addr);
  };

  if (selectedAddress) {
    return (
      <div className="px-4 py-3">
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-900 truncate">{selectedAddress.roadAddress}</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {selectedAddress.buildingName && `${selectedAddress.buildingName} | `}{selectedAddress.zipCode}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onSelectAddress(null as unknown as AddressSearchResult);
              setKeyword("");
            }}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            주소 변경
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
        <Search className="w-4 h-4" /> 주소 검색
      </h3>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4 animate-spin" />}
        <input
          type="text"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setShowRecent(false); }}
          onDoubleClick={() => {
            if (keyword.trim().length === 0) {
              const recent = loadRecentAddresses();
              setRecentAddresses(recent);
              if (recent.length > 0) setShowRecent(true);
            }
          }}
          onBlur={() => setTimeout(() => setShowRecent(false), 200)}
          placeholder="도로명 주소 또는 건물명"
          className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          autoFocus
        />

        {showRecent && recentAddresses.length > 0 && results.length === 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto z-20">
            <div className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100">최근 검색</div>
            {recentAddresses.map((addr, i) => (
              <button
                key={i}
                onClick={() => handleSelect(addr)}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
              >
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{addr.roadAddress}</p>
                  <p className="text-[10px] text-gray-500">{addr.buildingName}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto z-20">
            <div className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100">
              {totalCount.toLocaleString()}건
            </div>
            {results.map((addr, i) => (
              <button
                key={i}
                onClick={() => handleSelect(addr)}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{addr.roadAddress}</p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {addr.jibunAddress} {addr.buildingName && `| ${addr.buildingName}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <Building2 className="w-5 h-5 text-blue-600 mb-1" />
          <p className="text-xs font-semibold text-gray-900">아파트 / 빌라</p>
          <p className="text-[10px] text-gray-500">도면 자동 조회</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <Building2 className="w-5 h-5 text-indigo-600 mb-1" />
          <p className="text-xs font-semibold text-gray-900">상가 / 사무실</p>
          <p className="text-[10px] text-gray-500">맞춤 견적</p>
        </div>
      </div>
    </div>
  );
}
