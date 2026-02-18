"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-8">개인정보처리방침</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
            <p>
              AIOD(이하 &quot;회사&quot;)는 INPICK 서비스(이하 &quot;서비스&quot;) 이용자의 개인정보를 중요시하며,
              「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법률을 준수합니다.
              본 개인정보처리방침은 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며,
              개인정보 보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제2조 (수집하는 개인정보 항목)</h2>
            <p className="mb-2">회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>소비자 회원가입 시:</strong> 이메일, 이름 (소셜 로그인 시 프로필 정보)</li>
              <li><strong>사업자 등록 시:</strong> 상호명, 대표자명, 연락처, 이메일, 사업자등록번호, 주소, 지역</li>
              <li><strong>서비스 이용 시:</strong> 프로젝트 정보 (주소, 면적, 공간 유형), 견적 데이터, 채팅 내용</li>
              <li><strong>결제 시:</strong> 결제 수단 정보 (Toss Payments를 통해 처리, 회사는 카드번호를 직접 저장하지 않음)</li>
              <li><strong>자동 수집:</strong> IP 주소, 쿠키, 접속 로그, 서비스 이용 기록</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제3조 (개인정보의 수집 및 이용 목적)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>회원 식별 및 본인 확인</li>
              <li>인테리어 견적 산출 및 프로젝트 관리 서비스 제공</li>
              <li>사업자-소비자 간 매칭 및 커뮤니케이션</li>
              <li>결제 처리 및 크레딧 관리</li>
              <li>AI 서비스 품질 개선 (익명화된 데이터 활용)</li>
              <li>고객 문의 응대 및 분쟁 해결</li>
              <li>서비스 이용 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제4조 (개인정보의 보유 및 이용 기간)</h2>
            <p className="mb-2">
              회사는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.
              단, 관련 법령에 의한 정보 보존이 필요한 경우 법령이 정한 기간 동안 보존합니다.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
              <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
              <li>로그인 기록: 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제5조 (개인정보의 제3자 제공)</h2>
            <p>
              회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
              다만, 견적 요청 시 사업자에게 프로젝트 정보(주소, 면적, 희망 공사 내용)가 공유되며,
              이는 서비스 이용 과정에서 이용자가 직접 동의한 범위 내에서 이루어집니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제6조 (개인정보의 파기 절차 및 방법)</h2>
            <p>
              회원 탈퇴 시 개인정보는 즉시 파기되며, 전자적 파일 형태는 복구 불가능한 방법으로 삭제합니다.
              종이 문서에 기록된 개인정보는 분쇄하거나 소각합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제7조 (이용자의 권리)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>개인정보 열람, 정정, 삭제, 처리 정지 요구 가능</li>
              <li>내 계정 페이지에서 직접 정보 수정 및 탈퇴 가능</li>
              <li>이메일(tjsqhs011@naver.com)을 통한 요청 가능</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제8조 (개인정보 보호책임자)</h2>
            <ul className="list-none space-y-1">
              <li>성명: 선우빈</li>
              <li>직위: 대표</li>
              <li>이메일: tjsqhs011@naver.com</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제9조 (개인정보처리방침 변경)</h2>
            <p>
              본 개인정보처리방침은 시행일로부터 적용되며, 변경사항이 있을 경우
              웹사이트를 통해 공지합니다.
            </p>
            <p className="mt-2 text-gray-500">시행일: 2026년 2월 19일</p>
          </section>
        </div>
      </main>
    </div>
  );
}
