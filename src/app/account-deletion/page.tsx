import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Google Play 데이터 보안 요건용 공개 페이지 — 스토어 등록정보에 URL 노출됨.
// 요건: 앱 이름 명시 · 삭제 요청 절차 · 삭제/보관 데이터 유형과 기간 명시.
export const metadata: Metadata = {
  title: "계정 및 데이터 삭제 안내",
  description: "INPICK(인픽) 계정 삭제 및 데이터 삭제 요청 방법 안내",
};

export default function AccountDeletionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link href="/" className="text-xl font-bold text-blue-600">INPICK</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">계정 및 데이터 삭제 안내</h1>
        <p className="text-sm text-gray-500 mb-8">
          INPICK(인픽) — 주식회사 아이오드(AIOD Co.,Ltd) 제공
        </p>

        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 앱에서 직접 계정 삭제하기</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li>INPICK 앱 또는 웹사이트(interiorpick.co.kr)에 로그인합니다.</li>
              <li>
                <strong>마이페이지 → 계정</strong> 메뉴로 이동합니다.
              </li>
              <li>
                화면 하단의 <strong>회원 탈퇴</strong> 버튼을 누르고 안내에 따라 확인하면 계정이 즉시
                삭제됩니다.
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 이메일로 삭제 요청하기</h2>
            <p>
              로그인이 어려운 경우(비밀번호 분실, 소셜 계정 연결 해제 등)에는 가입 시 사용한 이메일 주소를
              기재하여 아래 주소로 요청해 주세요. <strong>영업일 기준 7일 이내</strong>에 본인 확인 후
              처리 결과를 회신해 드립니다.
            </p>
            <p className="mt-2">
              문의처: <a href="mailto:tjsqhs011@gmail.com" className="text-blue-600 underline">tjsqhs011@gmail.com</a>
              {" "}(제목에 &quot;계정 삭제 요청&quot; 기재)
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 삭제되는 데이터</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>계정 정보: 이메일, 이름, 프로필(소셜 로그인 연결 정보 포함)</li>
              <li>프로젝트 데이터: 주소·도면·AI 디자인·견적 등 이용자가 생성한 프로젝트 정보</li>
              <li>업로드한 사진 및 첨부 파일</li>
              <li>잔여 토큰(크레딧) — 삭제 시 소멸되며 복구되지 않습니다</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 법령에 따라 일정 기간 보관되는 데이터</h2>
            <p className="mb-2">
              아래 정보는 계정 삭제 후에도 관련 법령에 따라 분리 보관된 뒤 기간 만료 시 파기됩니다.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                결제·거래 기록: <strong>5년</strong> (전자상거래 등에서의 소비자보호에 관한 법률)
              </li>
              <li>
                소비자 불만·분쟁 처리 기록: <strong>3년</strong> (동법)
              </li>
              <li>
                접속 로그: <strong>3개월</strong> (통신비밀보호법)
              </li>
            </ul>
            <p className="mt-2">
              커뮤니티에 작성한 게시물은 탈퇴 시 작성자 정보가 비식별 처리됩니다. 게시물 자체의 삭제를
              원하시면 탈퇴 전에 직접 삭제하거나 이메일로 함께 요청해 주세요.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. 계정 삭제 없이 일부 데이터만 삭제하기</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>프로젝트: 앱/웹의 <strong>내 프로젝트</strong>에서 프로젝트별로 개별 삭제할 수 있습니다.</li>
              <li>커뮤니티 게시물: 각 게시물 메뉴에서 직접 삭제할 수 있습니다.</li>
              <li>
                업로드 사진 등 특정 데이터의 삭제는 위 문의처 이메일로 요청하시면 계정 유지 상태에서
                처리해 드립니다.
              </li>
            </ul>
          </section>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          본 안내는 INPICK 개인정보처리방침(
          <Link href="/privacy" className="underline">interiorpick.co.kr/privacy</Link>
          )과 함께 적용됩니다. 최종 수정일: 2026-07-08
        </p>
      </main>
    </div>
  );
}
