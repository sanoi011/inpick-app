"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Save, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";

type RateRow = {
  surface: string;
  label: string;
  basis: string;
  trade: string;
  installPerUnit: number;
  demoPerUnit: number;
  disposalPerUnit: number;
  auxRate: number;
  loss: number;
  minLabor: number;
  fromDb: boolean;
};

const FIELDS: Array<{ key: keyof RateRow; label: string; suffix: string; pct?: boolean }> = [
  { key: "installPerUnit", label: "설치 노무", suffix: "원/단위" },
  { key: "demoPerUnit", label: "철거 노무", suffix: "원/단위" },
  { key: "disposalPerUnit", label: "폐기물", suffix: "원/단위" },
  { key: "auxRate", label: "부자재율", suffix: "%", pct: true },
  { key: "loss", label: "로스율", suffix: "%", pct: true },
  { key: "minLabor", label: "최소 노무", suffix: "원" },
];

function adminAuth(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("admin_token") ?? "" : ""}`,
  };
}

export default function AdminPartialRatesPage() {
  const [rows, setRows] = useState<RateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableReady, setTableReady] = useState(true);
  const [authErr, setAuthErr] = useState(false);
  const [savingSurface, setSavingSurface] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setAuthErr(false);
    try {
      const res = await fetch("/api/admin/partial-rates", { headers: adminAuth() });
      if (res.status === 401) {
        setAuthErr(true);
        return;
      }
      const data = await res.json();
      setRows(data.rates ?? []);
      setTableReady(data.tableReady !== false);
    } catch {
      setMsg("불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (surface: string, key: keyof RateRow, value: number) => {
    setRows((prev) => prev.map((r) => (r.surface === surface ? { ...r, [key]: value } : r)));
  };

  const save = async (row: RateRow) => {
    setSavingSurface(row.surface);
    setMsg("");
    try {
      const res = await fetch("/api/admin/partial-rates", {
        method: "PUT",
        headers: adminAuth(),
        body: JSON.stringify({
          surface: row.surface,
          installPerUnit: row.installPerUnit,
          demoPerUnit: row.demoPerUnit,
          disposalPerUnit: row.disposalPerUnit,
          auxRate: row.auxRate,
          loss: row.loss,
          minLabor: row.minLabor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data?.error ?? "저장 실패");
        return;
      }
      setMsg(`${row.label} 단가 저장됨`);
      load();
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setSavingSurface(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">부분 적산 단가 관리</h1>
          <p className="mt-1 text-sm text-zinc-500">
            부분 인테리어 견적의 부위별 노무·부자재·폐기물·로스 단가입니다. 저장 시 즉시 적산에 반영됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 border border-zinc-300 px-3 py-2 text-sm font-bold text-zinc-600 hover:border-primary-400"
        >
          <RotateCcw className="h-4 w-4" /> 새로고침
        </button>
      </div>

      {!tableReady && (
        <div className="mt-4 flex items-start gap-2 border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>partial_estimate_rates</b> 테이블이 아직 없습니다. 현재는 기본값을 보여주며, 저장하려면 마이그레이션
            <code className="mx-1 rounded bg-amber-100 px-1">20260611000000_partial_estimate_rates.sql</code>
            을 적용하세요. (미적용 상태에서도 적산은 기본값으로 정상 동작)
          </span>
        </div>
      )}

      {authErr ? (
        <div className="mt-8 border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
          관리자 인증이 필요합니다.{" "}
          <Link href="/admin/login" className="font-bold text-primary-600 underline">
            관리자 로그인
          </Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((row) => (
            <div key={row.surface} className="border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-black text-zinc-900">{row.label}</span>
                  <span className="ml-2 text-xs font-bold text-zinc-400">
                    {row.trade} · {row.basis === "area" ? "면적(㎡)" : "수량(개)"} 기준
                    {row.fromDb ? " · DB" : " · 기본값"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => save(row)}
                  disabled={savingSurface === row.surface}
                  className="inline-flex items-center gap-1.5 bg-zinc-900 px-3 py-2 text-sm font-black text-white hover:bg-primary-600 disabled:opacity-60"
                >
                  {savingSurface === row.surface ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  저장
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {FIELDS.map((f) => {
                  const raw = row[f.key] as number;
                  const display = f.pct ? Math.round(raw * 1000) / 10 : raw;
                  return (
                    <label key={String(f.key)} className="block">
                      <span className="block text-[11px] font-bold text-zinc-500">{f.label}</span>
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="number"
                          value={display}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setField(row.surface, f.key, f.pct ? (Number.isFinite(v) ? v / 100 : 0) : Math.round(v));
                          }}
                          className="h-9 w-full border border-zinc-300 px-2 text-right text-sm font-bold outline-none focus:border-primary-500"
                        />
                        <span className="shrink-0 text-[11px] text-zinc-400">{f.suffix}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> {msg}
        </p>
      )}
    </div>
  );
}
