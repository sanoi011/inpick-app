import Link from "next/link";

const mockProfessionals = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `인테리어 전문가 ${i + 1}`,
  company: `디자인 스튜디오 ${i + 1}`,
  specialties: ["모던", "미니멀", "내추럴"].slice(0, Math.floor(Math.random() * 3) + 1),
  rating: (4 + Math.random()).toFixed(1),
  reviewCount: Math.floor(Math.random() * 100) + 10,
  careerYears: Math.floor(Math.random() * 15) + 3,
  portfolioCount: Math.floor(Math.random() * 50) + 5,
}));

export default function ProfessionalsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">전문가 찾기</h1>
        <p className="mt-2 text-neutral-500">
          검증된 인테리어 전문가를 찾아 상담을 받아보세요
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-4 mb-8">
        <input
          type="text"
          placeholder="전문가 이름, 지역, 스타일로 검색"
          className="flex-1 px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        />
        <button className="btn-primary">검색</button>
      </div>

      {/* Professional Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProfessionals.map((pro) => (
          <Link
            key={pro.id}
            href={`/professionals/${pro.id}`}
            className="card p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-neutral-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-neutral-400 text-xs">프로필</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                  {pro.name}
                </h3>
                <p className="text-sm text-neutral-500">{pro.company}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-yellow-500">&#9733;</span>
                  <span className="text-sm font-medium">{pro.rating}</span>
                  <span className="text-sm text-neutral-400">
                    ({pro.reviewCount}개 리뷰)
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {pro.specialties.map((s) => (
                <span
                  key={s}
                  className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full"
                >
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-neutral-500 border-t border-neutral-100 pt-4">
              <span>경력 {pro.careerYears}년</span>
              <span>포트폴리오 {pro.portfolioCount}개</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
