import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "INPICK - AI 인테리어 견적 플랫폼";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a5f 0%, #111827 50%, #1e1b4b 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-2px",
            marginBottom: 16,
          }}
        >
          INPICK
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 500,
            background: "linear-gradient(90deg, #60a5fa, #a78bfa, #f472b6)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 24,
          }}
        >
          AI 인테리어 견적 플랫폼
        </div>
        <div
          style={{
            fontSize: 20,
            color: "#9ca3af",
            maxWidth: 600,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          주소만 입력하면, AI가 실시간 단가로 정확한 견적을 만들어 드립니다.
        </div>
      </div>
    ),
    { ...size }
  );
}
