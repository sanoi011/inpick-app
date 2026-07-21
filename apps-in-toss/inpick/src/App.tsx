import { useEffect, useState } from "react";
import { appLogin, closeView } from "./toss-bridge.js";
import WorkflowPage from "../inpick-source/src/app/workflow/page";
import EstimatePage from "../inpick-source/src/app/workflow/estimate/page";
import { ToastContainer } from "../inpick-source/src/components/ui/Toast";
import { TokensProvider } from "../inpick-source/src/contexts/TokensContext";
import { createClient } from "../inpick-source/src/lib/supabase/client";
import { getCurrentMiniAppPath, subscribeMiniAppNavigation } from "./adapters/navigation";

type AuthState = "checking" | "signed_out" | "signing_in" | "ready" | "error";

function TossLoginGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("preview") === "1"
    ) {
      setState("ready");
      return;
    }
    let active = true;
    const supabase = createClient();

    void supabase.auth.getUser().then(({ data }) => {
      if (active) setState(data.user ? "ready" : "signed_out");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session?.user) setState("ready");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async () => {
    setState("signing_in");
    setMessage("");
    try {
      const { authorizationCode, referrer } = await appLogin();
      const response = await fetch("/api/apps-in-toss/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorizationCode, referrer }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        tokenHash?: string;
        error?: string;
      };
      if (!response.ok || !payload.tokenHash) {
        throw new Error(payload.error || "토스 계정 연결에 실패했습니다.");
      }

      const { error } = await createClient().auth.verifyOtp({
        token_hash: payload.tokenHash,
        type: "email",
      });
      if (error) throw error;
      setState("ready");
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      // 토스 로그인 화면을 사용자가 닫은 경우 미니앱도 닫아 검수 가이드를 따른다.
      if (/cancel|close|취소|닫/i.test(text)) {
        await closeView().catch(() => undefined);
        return;
      }
      setMessage(text || "로그인을 완료하지 못했습니다. 다시 시도해 주세요.");
      setState("error");
    }
  };

  if (state === "ready") return <>{children}</>;

  if (state === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-[#0d0d0d]">
        <div className="text-center">
          <span className="hex-mask mx-auto block h-10 w-10 animate-pulse text-[#F73B20]" />
          <p className="mt-5 text-[18px] font-bold tracking-[-0.055em]">inpick</p>
          <p className="mt-2 text-xs text-black/45">로그인 상태를 확인하고 있어요.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f5] px-5 py-10 text-[#0d0d0d]">
      <section className="w-full max-w-md rounded-[30px] border border-black/[0.07] bg-white p-7 shadow-[0_24px_80px_rgba(0,0,0,0.09)]">
        <div className="flex items-center gap-2.5">
          <span className="hex-mask h-[24px] w-[24px] text-[#F73B20]" />
          <span className="text-[22px] font-bold tracking-[-0.055em]">inpick</span>
        </div>
        <p className="mt-10 text-xs font-bold tracking-[0.12em] text-[#F73B20]">AI INTERIOR</p>
        <h1 className="mt-3 text-[30px] font-black leading-[1.2] tracking-[-0.045em]">
          우리 집을 설계하고<br />실시간 견적까지 확인하세요.
        </h1>
        <p className="mt-4 text-sm leading-6 text-black/55">
          주소·평형을 입력하면 실별 AI 디자인을 만들고, 대화로 원하는 부분을 수정한 뒤 선택한 최종 이미지로 견적을 계산합니다.
        </p>
        <div className="mt-8 rounded-2xl bg-[#f7f7f5] px-4 py-3 text-xs leading-5 text-black/50">
          생성형 AI 결과와 예상 견적은 참고용이며 실제 시공 전 현장 실측과 전문가 확인이 필요합니다.
        </div>
        {message ? <p className="mt-4 text-sm font-medium text-red-600">{message}</p> : null}
        <button
          type="button"
          onClick={signIn}
          disabled={state === "signing_in"}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-[#F73B20] text-base font-extrabold text-white transition disabled:opacity-55"
        >
          {state === "signing_in" ? "토스 계정 연결 중..." : "토스로 시작하기"}
        </button>
      </section>
    </main>
  );
}

function InPickApp() {
  const [path, setPath] = useState(getCurrentMiniAppPath);

  useEffect(() => subscribeMiniAppNavigation(setPath), []);

  return (
    <TokensProvider>
      {path.startsWith("/workflow/estimate") ? <EstimatePage /> : <WorkflowPage />}
      <ToastContainer />
    </TokensProvider>
  );
}

export default function App() {
  return (
    <TossLoginGate>
      <InPickApp />
    </TossLoginGate>
  );
}
