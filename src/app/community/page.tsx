import Link from "next/link";

const categories = [
  "전체",
  "인테리어 팁",
  "제품 리뷰",
  "질문/답변",
  "비포&애프터",
  "자유게시판",
];

const mockPosts = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  title: `커뮤니티 게시글 제목 ${i + 1}`,
  excerpt:
    "인테리어에 관한 다양한 이야기를 나눠보세요. 전문가와 일반 사용자 모두 참여할 수 있습니다.",
  author: `사용자${i + 1}`,
  category: categories[Math.floor(Math.random() * (categories.length - 1)) + 1],
  commentsCount: Math.floor(Math.random() * 30),
  likesCount: Math.floor(Math.random() * 100),
  createdAt: "2026-02-10",
}));

export default function CommunityPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">커뮤니티</h1>
          <p className="mt-2 text-neutral-500">
            인테리어에 대한 경험과 노하우를 공유하세요
          </p>
        </div>
        <Link href="/community/write" className="btn-primary">
          글쓰기
        </Link>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              cat === "전체"
                ? "bg-primary-600 text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {mockPosts.map((post) => (
          <Link
            key={post.id}
            href={`/community/${post.id}`}
            className="card block p-6 group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
                  {post.category}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                  {post.title}
                </h3>
                <p className="mt-1 text-sm text-neutral-500 line-clamp-2">
                  {post.excerpt}
                </p>
                <div className="mt-3 flex items-center gap-4 text-sm text-neutral-400">
                  <span>{post.author}</span>
                  <span>{post.createdAt}</span>
                  <span>&#9825; {post.likesCount}</span>
                  <span>&#128172; {post.commentsCount}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
