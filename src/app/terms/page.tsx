"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
        <h1 className="text-2xl font-bold text-gray-900 mb-8">서비스 이용약관</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-8 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
            <p>
              본 약관은 AIOD(이하 &quot;회사&quot;)가 제공하는 INPICK 인테리어 견적 플랫폼 서비스(이하 &quot;서비스&quot;)의
              이용조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항 등을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제2조 (정의)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>&quot;서비스&quot;</strong>: AI 기반 인테리어 견적 산출, 업체 매칭, 프로젝트 관리 등 회사가 제공하는 일체의 서비스</li>
              <li><strong>&quot;소비자 회원&quot;</strong>: 인테리어 견적을 받고자 하는 개인 이용자</li>
              <li><strong>&quot;사업자 회원&quot;</strong>: 인테리어 시공 서비스를 제공하는 업체 이용자</li>
              <li><strong>&quot;크레딧&quot;</strong>: AI 기능 이용을 위해 충전하는 서비스 내 가상 결제 단위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
            <p>
              본 약관은 서비스 화면에 게시하거나 기타 방법으로 이용자에게 공지함으로써 효력을 발생합니다.
              회사는 필요한 경우 관련 법령에 위배되지 않는 범위에서 약관을 개정할 수 있으며,
              변경 시 적용일 7일 전부터 서비스 내 공지합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제4조 (회원가입 및 서비스 이용)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>소비자: 이메일 또는 소셜 로그인(Google)으로 가입</li>
              <li>사업자: 사업자 등록 신청 후 승인 절차를 거쳐 이용</li>
              <li>회원은 가입 시 정확한 정보를 제공해야 하며, 허위 정보 제공 시 서비스 이용이 제한될 수 있습니다</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제5조 (서비스의 내용)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI 기반 도면 인식 및 물량 자동 산출</li>
              <li>17개 공종 견적서 생성 및 PDF 내보내기</li>
              <li>인테리어 업체 검색 및 견적 요청</li>
              <li>사업자-소비자 간 실시간 채팅</li>
              <li>시공 공정표 관리</li>
              <li>AI 인테리어 디자인 상담</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제6조 (크레딧 및 결제)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI 이미지 생성 등 유료 기능은 크레딧을 사용합니다</li>
              <li>크레딧은 Toss Payments를 통해 구매할 수 있습니다</li>
              <li>구매한 크레딧은 환불이 불가능합니다 (단, 서비스 장애로 인한 미사용 크레딧은 예외)</li>
              <li>크레딧의 유효기간은 구매일로부터 1년입니다</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제7조 (견적 및 시공에 관한 책임)</h2>
            <p className="mb-2">
              회사는 AI 기반 자동 견적 산출 서비스를 제공하며, 산출된 견적은 참고용입니다.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>실제 시공 비용은 현장 조건에 따라 달라질 수 있습니다</li>
              <li>회사는 소비자와 사업자 간 계약의 당사자가 아니며, 시공 결과에 대한 직접적인 책임을 지지 않습니다</li>
              <li>사업자 회원의 자격, 시공 품질에 대한 보증은 해당 사업자에게 있습니다</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제8조 (이용자의 의무)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>타인의 개인정보를 도용하지 않아야 합니다</li>
              <li>서비스를 부정한 목적으로 이용하지 않아야 합니다</li>
              <li>다른 이용자의 서비스 이용을 방해하지 않아야 합니다</li>
              <li>허위 리뷰 작성, 부정 입찰 등의 행위를 하지 않아야 합니다</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제9조 (서비스 이용 제한)</h2>
            <p>
              회사는 이용자가 본 약관을 위반하거나 서비스의 정상적인 운영을 방해하는 경우
              서비스 이용을 제한하거나 회원 자격을 박탈할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제10조 (면책)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>천재지변, 시스템 장애 등 불가항력으로 인한 서비스 중단에 대해 책임지지 않습니다</li>
              <li>이용자 간 거래에서 발생하는 분쟁에 대해 회사는 중개 역할만 수행합니다</li>
              <li>AI 견적은 참고용이며, 실제 시공 비용과 차이가 발생할 수 있습니다</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제11조 (분쟁 해결)</h2>
            <p>
              서비스 이용과 관련하여 분쟁이 발생한 경우, 회사와 이용자는 상호 협의하여 해결하며,
              합의가 이루어지지 않을 경우 민사소송법에 따른 관할 법원에 소를 제기할 수 있습니다.
            </p>
          </section>

          <section>
            <p className="text-gray-500">시행일: 2026년 2월 19일</p>
          </section>
        </div>
      </main>
    </div>
  );
}
