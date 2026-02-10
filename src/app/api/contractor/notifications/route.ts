import { NextRequest, NextResponse } from "next/server";

// MVP: 목 알림 생성 (향후 실제 DB 테이블로 교체)
export async function GET(req: NextRequest) {
  const contractorId = req.nextUrl.searchParams.get("contractorId");
  if (!contractorId) {
    return NextResponse.json({ error: "contractorId 필요" }, { status: 400 });
  }

  const now = new Date();
  const notifications = [
    {
      id: "n1",
      contractorId,
      type: "BID_NEW",
      title: "새 입찰 공고",
      message: "강남구 아파트 인테리어 견적이 등록되었습니다",
      priority: "MEDIUM",
      isRead: false,
      link: "/contractor/bids",
      createdAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "n2",
      contractorId,
      type: "SYSTEM",
      title: "프로필 완성도",
      message: "포트폴리오를 추가하면 입찰 선정 확률이 높아집니다",
      priority: "LOW",
      isRead: false,
      link: "/contractor/profile",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "n3",
      contractorId,
      type: "SCHEDULE_CONFLICT",
      title: "일정 확인",
      message: "이번 주 예정된 현장 방문이 있습니다",
      priority: "MEDIUM",
      isRead: true,
      link: "/contractor/schedule",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
    },
  ];

  return NextResponse.json({ notifications });
}
