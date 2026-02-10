import Link from "next/link";

const styleCategories = [
  { name: "모던", image: "🏢", slug: "modern" },
  { name: "미니멀", image: "⬜", slug: "minimal" },
  { name: "내추럴", image: "🌿", slug: "natural" },
  { name: "클래식", image: "🏛️", slug: "classic" },
  { name: "북유럽", image: "🪵", slug: "nordic" },
  { name: "인더스트리얼", image: "🏗️", slug: "industrial" },
  { name: "빈티지", image: "🪑", slug: "vintage" },
  { name: "한국적", image: "🏯", slug: "korean" },
];

const popularPortfolios = [
  {
    id: 1,
    title: "30평대 모던 아파트 리모델링",
    professional: "스튜디오 모던",
    likes: 324,
    style: "모던",
  },
  {
    id: 2,
    title: "신혼부부 미니멀 원룸 인테리어",
    professional: "미니멀리스트 디자인",
    likes: 287,
    style: "미니멀",
  },
  {
    id: 3,
    title: "카페풍 내추럴 거실 꾸미기",
    professional: "그린하우스 인테리어",
    likes: 256,
    style: "내추럴",
  },
  {
    id: 4,
    title: "빈티지 감성 원목 서재",
    professional: "올드앤뉴 디자인",
    likes: 198,
    style: "빈티지",
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              나에게 딱 맞는
              <br />
              인테리어를 찾아보세요
            </h1>
            <p className="mt-6 text-lg text-primary-100">
              수천 개의 인테리어 포트폴리오와 전문가를 만나보세요.
              <br />
              INPICK이 당신의 공간을 특별하게 만들어 드립니다.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link
                href="/portfolio"
                className="bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors text-center"
              >
                포트폴리오 둘러보기
              </Link>
              <Link
                href="/professionals"
                className="border border-white/30 text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors text-center"
              >
                전문가 찾기
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Style Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="section-title">스타일별 탐색</h2>
        <p className="section-subtitle">원하는 인테리어 스타일을 선택하세요</p>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {styleCategories.map((style) => (
            <Link
              key={style.slug}
              href={`/portfolio?style=${style.slug}`}
              className="flex flex-col items-center gap-3 p-4 rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <span className="text-3xl">{style.image}</span>
              <span className="text-sm font-medium text-neutral-700">
                {style.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Popular Portfolios */}
      <section className="bg-neutral-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">인기 포트폴리오</h2>
              <p className="section-subtitle">지금 가장 많은 관심을 받는 인테리어</p>
            </div>
            <Link
              href="/portfolio"
              className="text-primary-600 hover:text-primary-700 font-medium hidden sm:block"
            >
              전체보기 &rarr;
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {popularPortfolios.map((item) => (
              <Link key={item.id} href={`/portfolio/${item.id}`} className="card overflow-hidden group">
                <div className="aspect-[4/3] bg-neutral-200 flex items-center justify-center">
                  <span className="text-neutral-400 text-sm">이미지 영역</span>
                </div>
                <div className="p-4">
                  <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                    {item.style}
                  </span>
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
          <div className="mt-6 text-center sm:hidden">
            <Link href="/portfolio" className="text-primary-600 font-medium">
              전체보기 &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-3xl font-bold">
            인테리어 전문가이신가요?
          </h2>
          <p className="mt-3 text-white/80 max-w-lg mx-auto">
            INPICK에 전문가로 등록하고 포트폴리오를 공유하세요.
            수많은 고객이 당신을 기다리고 있습니다.
          </p>
          <Link
            href="/auth?mode=signup&role=professional"
            className="mt-6 inline-block bg-white text-primary-700 px-8 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
          >
            전문가 등록하기
          </Link>
        </div>
      </section>
    </div>
  );
}
