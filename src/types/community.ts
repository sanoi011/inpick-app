// ─── 커뮤니티 타입 정의 ──────────────────────────────

export interface CommunityPost {
  id: string;
  title: string;
  gradient: string; // Tailwind gradient placeholder
  authorName: string;
  likes: number;
  saves: number;
  comments: number;
  tags: string[];
  createdAt: string;
  roomType: string;
  style: string;
  area?: number;
}

export interface DiscussionThread {
  id: string;
  title: string;
  content: string;
  authorName: string;
  isAnonymous: boolean;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  boardSlug: string;
  createdAt: string;
}

export interface GalleryItem {
  id: string;
  gradient: string;
  prompt: string;
  style: string;
  roomType: string;
  authorName: string;
  remixCount: number;
  likes: number;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  prompt: string;
  category: string;
  useCount: number;
  rating: number;
  tags: string[];
}

export interface CommunityBoard {
  slug: string;
  name: string;
  description: string;
  threadCount: number;
}

export interface CollectionBoard {
  id: string;
  name: string;
  gradients: string[];
  saveCount: number;
  authorName: string;
}

export interface RegionCase {
  id: string;
  apartmentName: string;
  area: number;
  style: string;
  rating: number;
  date: string;
  gradient: string;
}

// ─── 상수 ──────────────────────────────

export const STYLE_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "modern", label: "모던" },
  { value: "nordic", label: "북유럽" },
  { value: "classic", label: "클래식" },
  { value: "minimal", label: "미니멀" },
  { value: "natural", label: "내추럴" },
] as const;

export const ROOM_TYPE_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "living", label: "거실" },
  { value: "bedroom", label: "안방" },
  { value: "kitchen", label: "주방" },
  { value: "bathroom", label: "욕실" },
  { value: "entrance", label: "현관" },
] as const;

export const BOARD_LIST: CommunityBoard[] = [
  { slug: "free", name: "자유게시판", description: "인테리어 관련 자유로운 이야기", threadCount: 1247 },
  { slug: "review", name: "시공후기", description: "실제 시공 경험을 공유해주세요", threadCount: 892 },
  { slug: "material", name: "자재정보", description: "자재 비교, 추천, 후기", threadCount: 634 },
  { slug: "price", name: "가격비교", description: "견적 비교와 시세 정보", threadCount: 1053 },
  { slug: "contractor", name: "업체후기", description: "시공업체 이용 후기", threadCount: 478 },
  { slug: "question", name: "질문게시판", description: "인테리어 궁금한 점 질문", threadCount: 2156 },
];

export const TRENDING_TAGS = [
  "25평리모델링", "화이트인테리어", "신혼집꾸미기", "욕실리모델링",
  "주방인테리어", "모던거실", "원목가구", "아이방꾸미기",
  "수납정리", "조명추천",
];

export const REGION_LIST = [
  { id: "seoul", name: "서울", caseCount: 342 },
  { id: "gyeonggi", name: "경기", caseCount: 287 },
  { id: "incheon", name: "인천", caseCount: 124 },
  { id: "daejeon", name: "대전", caseCount: 98 },
  { id: "busan", name: "부산", caseCount: 156 },
  { id: "daegu", name: "대구", caseCount: 89 },
  { id: "gwangju", name: "광주", caseCount: 67 },
  { id: "sejong", name: "세종", caseCount: 45 },
];

// ─── Mock 데이터 ──────────────────────────────

const GRADIENTS = [
  "from-amber-100 to-orange-200",
  "from-blue-100 to-indigo-200",
  "from-emerald-100 to-teal-200",
  "from-rose-100 to-pink-200",
  "from-violet-100 to-purple-200",
  "from-cyan-100 to-sky-200",
  "from-lime-100 to-green-200",
  "from-fuchsia-100 to-rose-200",
  "from-slate-100 to-gray-200",
  "from-yellow-100 to-amber-200",
  "from-indigo-100 to-blue-200",
  "from-teal-100 to-cyan-200",
  "from-orange-100 to-red-200",
  "from-sky-100 to-indigo-200",
  "from-pink-100 to-fuchsia-200",
  "from-green-100 to-emerald-200",
];

export const MOCK_POSTS: CommunityPost[] = [
  { id: "p1", title: "25평 모던 화이트 거실 리모델링 완성", gradient: GRADIENTS[0], authorName: "인테리어맘", likes: 342, saves: 89, comments: 45, tags: ["모던", "화이트", "25평"], createdAt: "2시간 전", roomType: "living", style: "modern", area: 84 },
  { id: "p2", title: "북유럽 감성 원목 주방 꾸미기", gradient: GRADIENTS[1], authorName: "우드러버", likes: 256, saves: 67, comments: 32, tags: ["북유럽", "원목", "주방"], createdAt: "5시간 전", roomType: "kitchen", style: "nordic" },
  { id: "p3", title: "욕실 타일 교체 전후 비교", gradient: GRADIENTS[2], authorName: "타일마스터", likes: 198, saves: 45, comments: 28, tags: ["욕실", "타일", "리모델링"], createdAt: "8시간 전", roomType: "bathroom", style: "modern" },
  { id: "p4", title: "신혼집 안방 미니멀 인테리어", gradient: GRADIENTS[3], authorName: "새댁일기", likes: 412, saves: 134, comments: 56, tags: ["미니멀", "안방", "신혼"], createdAt: "1일 전", roomType: "bedroom", style: "minimal" },
  { id: "p5", title: "30평 클래식 거실 몰딩 시공", gradient: GRADIENTS[4], authorName: "클래식홈", likes: 167, saves: 38, comments: 19, tags: ["클래식", "몰딩", "30평"], createdAt: "1일 전", roomType: "living", style: "classic", area: 99 },
  { id: "p6", title: "내추럴 우드톤 현관 꾸미기", gradient: GRADIENTS[5], authorName: "홈가드닝", likes: 223, saves: 51, comments: 24, tags: ["내추럴", "현관", "원목"], createdAt: "2일 전", roomType: "entrance", style: "natural" },
  { id: "p7", title: "아이방 수납 아이디어 모음", gradient: GRADIENTS[6], authorName: "삼남매맘", likes: 534, saves: 201, comments: 78, tags: ["아이방", "수납", "실용"], createdAt: "2일 전", roomType: "bedroom", style: "modern" },
  { id: "p8", title: "주방 상부장 없이 넓게 쓰기", gradient: GRADIENTS[7], authorName: "미니멀키친", likes: 289, saves: 76, comments: 41, tags: ["주방", "미니멀", "오픈선반"], createdAt: "3일 전", roomType: "kitchen", style: "minimal" },
  { id: "p9", title: "화장실 건식 분리 시공 후기", gradient: GRADIENTS[8], authorName: "깔끔한집", likes: 178, saves: 52, comments: 33, tags: ["욕실", "건식분리", "시공후기"], createdAt: "3일 전", roomType: "bathroom", style: "modern" },
  { id: "p10", title: "거실 간접조명 설치 가이드", gradient: GRADIENTS[9], authorName: "조명덕후", likes: 445, saves: 156, comments: 62, tags: ["거실", "조명", "간접조명"], createdAt: "4일 전", roomType: "living", style: "modern" },
  { id: "p11", title: "북유럽 스타일 욕실 악세서리 추천", gradient: GRADIENTS[10], authorName: "스칸디맘", likes: 134, saves: 43, comments: 17, tags: ["북유럽", "욕실", "악세서리"], createdAt: "4일 전", roomType: "bathroom", style: "nordic" },
  { id: "p12", title: "20평 원룸 공간 활용 인테리어", gradient: GRADIENTS[11], authorName: "자취생활", likes: 567, saves: 189, comments: 91, tags: ["원룸", "공간활용", "20평"], createdAt: "5일 전", roomType: "living", style: "minimal", area: 66 },
  { id: "p13", title: "클래식 무드 안방 침대 배치", gradient: GRADIENTS[12], authorName: "클래식홈", likes: 201, saves: 58, comments: 25, tags: ["클래식", "안방", "가구배치"], createdAt: "5일 전", roomType: "bedroom", style: "classic" },
  { id: "p14", title: "팬트리 정리 수납 비포&애프터", gradient: GRADIENTS[13], authorName: "정리퀸", likes: 389, saves: 142, comments: 53, tags: ["주방", "팬트리", "수납"], createdAt: "6일 전", roomType: "kitchen", style: "natural" },
  { id: "p15", title: "내추럴 감성 거실 패브릭 코디", gradient: GRADIENTS[14], authorName: "패브릭러", likes: 245, saves: 87, comments: 34, tags: ["내추럴", "거실", "패브릭"], createdAt: "1주 전", roomType: "living", style: "natural" },
  { id: "p16", title: "현관 신발장 맞춤 제작 후기", gradient: GRADIENTS[15], authorName: "맞춤가구", likes: 312, saves: 94, comments: 47, tags: ["현관", "신발장", "맞춤"], createdAt: "1주 전", roomType: "entrance", style: "modern" },
];

export const MOCK_THREADS: DiscussionThread[] = [
  { id: "t1", title: "25평 리모델링 견적 3천만원 적정한가요?", content: "안녕하세요. 서울 마포구 25평 아파트 전체 리모델링 견적을 받았는데...", authorName: "견적고민", isAnonymous: true, upvotes: 45, downvotes: 3, commentCount: 67, boardSlug: "price", createdAt: "1시간 전" },
  { id: "t2", title: "LG 실크벽지 vs 신한 합지벽지 어떤게 나을까요", content: "거실 벽지를 바꾸려고 하는데 두 제품 사이에서 고민 중입니다.", authorName: "벽지고민", isAnonymous: false, upvotes: 32, downvotes: 1, commentCount: 41, boardSlug: "material", createdAt: "2시간 전" },
  { id: "t3", title: "시공업체 A사 이용 후기 (솔직 리뷰)", content: "3개월 전에 시공 완료했고, 장단점 솔직하게 공유합니다.", authorName: "익명", isAnonymous: true, upvotes: 89, downvotes: 7, commentCount: 53, boardSlug: "contractor", createdAt: "3시간 전" },
  { id: "t4", title: "욕실 방수 시공 꼭 해야하나요?", content: "20년된 아파트인데 욕실 방수를 다시 해야 하는지 궁금합니다.", authorName: "초보시공", isAnonymous: false, upvotes: 56, downvotes: 0, commentCount: 38, boardSlug: "question", createdAt: "5시간 전" },
  { id: "t5", title: "셀프 도배 도전기 (대실패 후기)", content: "유튜브 보고 셀프 도배 도전했다가 망한 이야기...", authorName: "셀프도배", isAnonymous: false, upvotes: 234, downvotes: 2, commentCount: 89, boardSlug: "free", createdAt: "8시간 전" },
  { id: "t6", title: "강마루 vs 강화마루 vs 원목마루 비교", content: "바닥재 선택이 너무 어려워서 정리해봤습니다.", authorName: "바닥전문", isAnonymous: false, upvotes: 178, downvotes: 5, commentCount: 72, boardSlug: "material", createdAt: "12시간 전" },
  { id: "t7", title: "시공 중 추가 비용 요구받았어요 ㅠㅠ", content: "계약 시 없던 항목이 시공 중에 추가되었다고 하는데...", authorName: "익명", isAnonymous: true, upvotes: 67, downvotes: 4, commentCount: 45, boardSlug: "price", createdAt: "1일 전" },
  { id: "t8", title: "타일 줄눈 색상 추천 부탁드려요", content: "화이트 타일에 어떤 줄눈 색이 잘 어울릴까요?", authorName: "타일초보", isAnonymous: false, upvotes: 23, downvotes: 0, commentCount: 19, boardSlug: "question", createdAt: "1일 전" },
  { id: "t9", title: "인테리어 완료! 입주 후 1개월 후기", content: "드디어 이사 후 한달이 지났습니다. 전체적으로 만족하고...", authorName: "새집입주", isAnonymous: false, upvotes: 312, downvotes: 1, commentCount: 94, boardSlug: "review", createdAt: "2일 전" },
  { id: "t10", title: "전기 콘센트 위치 꿀팁 공유", content: "리모델링 할 때 콘센트 위치가 정말 중요한데, 제가 배운...", authorName: "전기달인", isAnonymous: false, upvotes: 445, downvotes: 3, commentCount: 112, boardSlug: "free", createdAt: "2일 전" },
];

export const MOCK_GALLERY: GalleryItem[] = [
  { id: "g1", gradient: GRADIENTS[0], prompt: "화이트 오크 마루와 그레이 벽지의 모던한 25평 거실, 간접 조명, 미니멀 가구", style: "modern", roomType: "living", authorName: "디자이너A", remixCount: 45, likes: 234, createdAt: "3시간 전" },
  { id: "g2", gradient: GRADIENTS[1], prompt: "북유럽 감성 원목 주방, 화이트 상부장, 마블 조리대, 펜던트 조명 3개", style: "nordic", roomType: "kitchen", authorName: "AI매니아", remixCount: 32, likes: 189, createdAt: "5시간 전" },
  { id: "g3", gradient: GRADIENTS[2], prompt: "호텔식 욕실, 대리석 타일, 매립형 수전, 간접 조명, 유리 샤워부스", style: "modern", roomType: "bathroom", authorName: "욕실덕후", remixCount: 67, likes: 312, createdAt: "8시간 전" },
  { id: "g4", gradient: GRADIENTS[3], prompt: "미니멀 안방, 로우 침대 프레임, 린넨 침구, 무드등, 화이트톤 전체", style: "minimal", roomType: "bedroom", authorName: "미니멀리스트", remixCount: 28, likes: 167, createdAt: "1일 전" },
  { id: "g5", gradient: GRADIENTS[4], prompt: "클래식 거실, 크라운 몰딩, 벨벳 소파, 크리스탈 샹들리에, 다크 우드", style: "classic", roomType: "living", authorName: "클래식러버", remixCount: 19, likes: 145, createdAt: "1일 전" },
  { id: "g6", gradient: GRADIENTS[5], prompt: "내추럴 주방, 우드 톤 하부장, 타일 백스플래시, 허브 화분, 자연광", style: "natural", roomType: "kitchen", authorName: "자연인", remixCount: 41, likes: 201, createdAt: "2일 전" },
  { id: "g7", gradient: GRADIENTS[6], prompt: "아이방, 파스텔 그린 포인트 벽, 벙커침대, 놀이공간, 수납선반", style: "modern", roomType: "bedroom", authorName: "아이방전문", remixCount: 56, likes: 278, createdAt: "2일 전" },
  { id: "g8", gradient: GRADIENTS[7], prompt: "오픈형 현관, 우드 벤치, 수납형 신발장, 간접 조명, 갤러리 벽", style: "natural", roomType: "entrance", authorName: "현관매니아", remixCount: 23, likes: 134, createdAt: "3일 전" },
  { id: "g9", gradient: GRADIENTS[8], prompt: "모던 욕실, 블랙 수전, 직사각 세면대, 대형 거울, 그레이 타일", style: "modern", roomType: "bathroom", authorName: "블랙앤화이트", remixCount: 38, likes: 198, createdAt: "3일 전" },
  { id: "g10", gradient: GRADIENTS[9], prompt: "북유럽 안방, 라탄 조명, 민트 린넨, 원목 사이드테이블, 드라이플라워", style: "nordic", roomType: "bedroom", authorName: "스칸디홈", remixCount: 51, likes: 267, createdAt: "4일 전" },
  { id: "g11", gradient: GRADIENTS[10], prompt: "미니멀 주방, 매트 블랙 싱크대, 히든 수납, 화이트 조리대, LED 하부등", style: "minimal", roomType: "kitchen", authorName: "주방설계사", remixCount: 34, likes: 156, createdAt: "5일 전" },
  { id: "g12", gradient: GRADIENTS[11], prompt: "클래식 안방, 카페트, 커튼 레이어링, 골드 조명, 대리석 사이드테이블", style: "classic", roomType: "bedroom", authorName: "럭셔리홈", remixCount: 15, likes: 123, createdAt: "6일 전" },
];

export const MOCK_PROMPTS: PromptTemplate[] = [
  { id: "pr1", title: "모던 화이트 거실", prompt: "화이트 오크 마루, 그레이 실크벽지, 간접 조명이 있는 모던한 25평 거실을 디자인해주세요. 미니멀한 가구 배치와 넓은 창을 강조해주세요.", category: "거실", useCount: 1234, rating: 4.8, tags: ["모던", "화이트", "거실"] },
  { id: "pr2", title: "북유럽 감성 주방", prompt: "원목 하부장과 화이트 상부장이 조화로운 북유럽 스타일 주방을 디자인해주세요. 마블 조리대와 펜던트 조명 포함.", category: "주방", useCount: 987, rating: 4.7, tags: ["북유럽", "원목", "주방"] },
  { id: "pr3", title: "호텔식 욕실", prompt: "대리석 타일과 매립형 수전의 호텔식 욕실을 디자인해주세요. 유리 샤워부스, 간접 조명, 수납장 포함.", category: "욕실", useCount: 856, rating: 4.9, tags: ["호텔식", "대리석", "욕실"] },
  { id: "pr4", title: "미니멀 안방", prompt: "화이트톤 미니멀 안방을 디자인해주세요. 로우 침대 프레임, 린넨 침구, 무드등으로 편안한 분위기.", category: "안방", useCount: 743, rating: 4.6, tags: ["미니멀", "화이트", "안방"] },
  { id: "pr5", title: "수납 최적화 현관", prompt: "실용적인 수납 현관을 디자인해주세요. 맞춤 신발장, 우드 벤치, 열쇠/우산 수납, 전신거울 포함.", category: "현관", useCount: 621, rating: 4.5, tags: ["수납", "실용", "현관"] },
  { id: "pr6", title: "아이방 놀이공간", prompt: "파스텔 톤 아이방을 디자인해주세요. 벙커침대로 공간 활용, 놀이 공간, 수납 선반, 학습 공간 분리.", category: "안방", useCount: 534, rating: 4.7, tags: ["아이방", "파스텔", "놀이공간"] },
  { id: "pr7", title: "오픈형 주방+거실", prompt: "아일랜드 식탁이 있는 오픈형 주방과 거실을 디자인해주세요. 통일된 바닥재, 자연스러운 동선.", category: "주방", useCount: 892, rating: 4.8, tags: ["오픈형", "아일랜드", "LDK"] },
  { id: "pr8", title: "드레스룸 수납", prompt: "효율적인 드레스룸을 디자인해주세요. 행거+서랍+선반 조합, 전신거울, 조명, 악세서리 수납.", category: "안방", useCount: 445, rating: 4.4, tags: ["드레스룸", "수납", "옷장"] },
];

export const MOCK_COLLECTIONS: CollectionBoard[] = [
  { id: "c1", name: "모던 화이트 인테리어 모음", gradients: [GRADIENTS[0], GRADIENTS[1], GRADIENTS[8], GRADIENTS[5]], saveCount: 234, authorName: "인테리어맘" },
  { id: "c2", name: "욕실 리모델링 레퍼런스", gradients: [GRADIENTS[2], GRADIENTS[8], GRADIENTS[10], GRADIENTS[3]], saveCount: 178, authorName: "타일마스터" },
  { id: "c3", name: "북유럽 감성 모음집", gradients: [GRADIENTS[1], GRADIENTS[5], GRADIENTS[10], GRADIENTS[14]], saveCount: 312, authorName: "스칸디맘" },
  { id: "c4", name: "30평대 리모델링 사례", gradients: [GRADIENTS[4], GRADIENTS[0], GRADIENTS[9], GRADIENTS[6]], saveCount: 156, authorName: "30평마스터" },
  { id: "c5", name: "주방 아이디어 보드", gradients: [GRADIENTS[7], GRADIENTS[13], GRADIENTS[6], GRADIENTS[1]], saveCount: 201, authorName: "미니멀키친" },
  { id: "c6", name: "아이방 꾸미기 모음", gradients: [GRADIENTS[6], GRADIENTS[3], GRADIENTS[14], GRADIENTS[11]], saveCount: 267, authorName: "삼남매맘" },
];

export const MOCK_REGION_CASES: Record<string, RegionCase[]> = {
  seoul: [
    { id: "rc1", apartmentName: "래미안 레벤투스", area: 84, style: "모던", rating: 4.8, date: "2026.01", gradient: GRADIENTS[0] },
    { id: "rc2", apartmentName: "더샵 센트레빌", area: 59, style: "북유럽", rating: 4.6, date: "2025.12", gradient: GRADIENTS[1] },
    { id: "rc3", apartmentName: "힐스테이트 에코", area: 109, style: "클래식", rating: 4.9, date: "2025.11", gradient: GRADIENTS[4] },
  ],
  gyeonggi: [
    { id: "rc4", apartmentName: "위례 자이", area: 84, style: "미니멀", rating: 4.7, date: "2026.01", gradient: GRADIENTS[3] },
    { id: "rc5", apartmentName: "판교 푸르지오", area: 99, style: "모던", rating: 4.5, date: "2025.12", gradient: GRADIENTS[8] },
  ],
  daejeon: [
    { id: "rc6", apartmentName: "용산4블럭", area: 84, style: "모던", rating: 4.8, date: "2026.02", gradient: GRADIENTS[2] },
    { id: "rc7", apartmentName: "둔산 래미안", area: 59, style: "내추럴", rating: 4.6, date: "2025.11", gradient: GRADIENTS[5] },
  ],
  busan: [
    { id: "rc8", apartmentName: "해운대 엘시티", area: 132, style: "클래식", rating: 4.9, date: "2025.10", gradient: GRADIENTS[4] },
  ],
};
