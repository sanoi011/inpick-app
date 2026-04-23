import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type EventType = "swap" | "dwell" | "confirm" | "impression" | "reject" | "emotion_feedback";

interface UserMaterialEventInput {
  userId?:         string | null;
  anonId?:         string | null;
  sessionId:       string;
  projectId?:      string | null;
  eventType:       EventType;
  seq:             number;

  emotionQuery?:   string | null;
  detectedMoods?:  string[];
  paletteId?:      string | null;

  roomType?:       string | null;
  categoryCode?:   string | null;
  materialFrom?:   unknown;
  materialTo?:     unknown;
  materialFinal?:  unknown;

  dwellMs?:        number | null;
  timeSinceStartMs?: number | null;

  emotionSignal?:  "positive" | "neutral" | "negative" | null;
  emotionScore?:   number | null;
  feedbackText?:   string | null;
  clientMeta?:     Record<string, unknown> | null;
}

const ALLOWED_TYPES: EventType[] = ["swap","dwell","confirm","impression","reject","emotion_feedback"];

// POST /api/user-events  — 단일 또는 배열 이벤트 수집
export async function POST(req: NextRequest) {
  const supabase = createClient();
  let body: UserMaterialEventInput | UserMaterialEventInput[] = await req.json().catch(() => ({} as UserMaterialEventInput));
  if (!Array.isArray(body)) body = [body];

  const rows = [];
  for (const ev of body) {
    if (!ev?.sessionId || !ev?.eventType || !ALLOWED_TYPES.includes(ev.eventType)) continue;
    rows.push({
      user_id:              ev.userId || null,
      anon_id:              ev.anonId || null,
      session_id:           ev.sessionId,
      project_id:           ev.projectId || null,
      event_type:           ev.eventType,
      seq:                  Math.max(0, Number(ev.seq) || 0),
      emotion_query:        ev.emotionQuery || null,
      detected_moods:       ev.detectedMoods || [],
      palette_id:           ev.paletteId || null,
      room_type:            ev.roomType || null,
      category_code:        ev.categoryCode || null,
      material_from:        ev.materialFrom ?? null,
      material_to:          ev.materialTo ?? null,
      material_final:       ev.materialFinal ?? null,
      dwell_ms:             ev.dwellMs ?? null,
      time_since_start_ms:  ev.timeSinceStartMs ?? null,
      emotion_signal:       ev.emotionSignal || null,
      emotion_score:        ev.emotionScore ?? null,
      feedback_text:        ev.feedbackText || null,
      client_meta:          ev.clientMeta || null,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "유효 이벤트 없음" }, { status: 400 });
  }

  const { error } = await supabase.from("user_material_events").insert(rows);
  if (error) {
    return NextResponse.json({ error: "이벤트 저장 실패", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ inserted: rows.length });
}
