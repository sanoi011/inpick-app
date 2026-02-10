import Link from "next/link";

const styles = [
  "전체",
  "모던",
  "미니멀",
  "내추럴",
  "클래식",
  "북유럽",
  "인더스트리얼",
  "빈티지",
  "한국적",
];

const mockPortfolios = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  title: `인테리어 포트폴리오 ${i + 1}`,
  professional: `전문가 ${i + 1}`,
  style: styles[Math.floor(Math.random() * (styles.length - 1)) + 1],
  likes: Math.floor(Math.random() * 500),
  space: ["거실", "침실", "주방", "서재"][Math.floor(Math.random() * 4)],
}));

export default function PortfolioPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">포트폴리오</h1>
        <p className="mt-2 text-neutral-500">
          다양한 인테리어 포트폴리오를 둘러보고 영감을 얻어보세요
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {styles.map((style) => (
          <button
            key={style}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              style === "전체"
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {style}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {mockPortfolios.map((item) => (
          <Link
            key={item.id}
            href={`/portfolio/${item.id}`}
            className="card overflow-hidden group"
          >
            <div className="aspect-[4/3] bg-neutral-200 flex items-center justify-center">
              <span className="text-neutral-400 text-sm">이미지 영역</span>
            </div>
            <div className="p-4">
              <div className="flex gap-2">
                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                  {item.style}
                </span>
                <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">
                  {item.space}
                </span>
              </div>
              <h3 className="mt-2 font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                {item.title}
              </h3>
              <div className="mt-2 flex items-center justify-between text-sm text-neutral-500">
                <span>{item.professional}</span>
                <span>&#9825; {item.likes}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
