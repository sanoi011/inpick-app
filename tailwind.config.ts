import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 메인 오렌지-레드 (jeton 시그너처 #f73b20)
        primary: {
          50: "#FFF6F5",
          100: "#FEE9E6",
          200: "#FDD6CE",
          300: "#F5B1A3",
          400: "#FA8270",
          500: "#F73B20",
          600: "#DC3636",
          700: "#A21906",
          800: "#7A2912",
          900: "#360802",
        },
        peach: {
          100: "#FEE9E6",
          200: "#FDCBC4",
          300: "#F5B1A3",
        },
        apricot: {
          50: "#FFF6F5",
          100: "#FEE9E6",
          200: "#FDD6CE",
          300: "#FDCBC4",
          400: "#F5B1A3",
        },
        offwhite: "#FFF6F5",
        ink: {
          DEFAULT: "#1A0908",
          60: "rgba(26,9,8,0.6)",
          40: "rgba(26,9,8,0.4)",
          12: "rgba(26,9,8,0.12)",
          6: "rgba(26,9,8,0.06)",
        },
        wine: {
          500: "#7A2739",
          600: "#6B3843",
          700: "#360802",
        },
        burgundy: "#360802",
        sky: {
          400: "#4984EF",
          500: "#105DF1",
        },
        // 토큰 시스템 컬러 (앰버) — 헤더 토큰 배지·차감 모션
        token: {
          50: "#FFF8EE",
          100: "#FCE8C2",
          200: "#FAC775",
          300: "#E0A347",
          400: "#BA7517",
          500: "#854F0B",
          600: "#5C370A",
        },
        // 뉴트럴 (배경·텍스트)
        neutral: {
          0: "#FFFFFF",
          50: "#FAFBFC",
          100: "#F4F6F8",
          200: "#E8EBEE",
          300: "#D4D7DB",
          400: "#A8ACB1",
          500: "#6E7378",
          600: "#4A4E53",
          700: "#2E3236",
          800: "#1A1F2E",
          900: "#0F1419",
        },
        // 시맨틱
        success: { bg: "#EAF3DE", text: "#3B6D11" },
        warning: { bg: "#FAEEDA", text: "#854F0B" },
        danger: { bg: "#FCEBEB", text: "#A32D2D" },
        // 레거시 호환 (이전 컴포넌트들이 참조)
        accent: {
          50: "#FFF6F5",
          100: "#FEE9E6",
          200: "#FDD6CE",
          300: "#F5B1A3",
          400: "#FA8270",
          500: "#F73B20",
          600: "#DC3636",
          700: "#A21906",
          800: "#7A2912",
          900: "#360802",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard",
          "var(--font-geist-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          "sans-serif",
        ],
        display: [
          "Pretendard",
          "var(--font-geist-sans)",
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.025em",
        tight: "-0.015em",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,20,25,0.04), 0 8px 24px -8px rgba(15,20,25,0.08)",
        "card-hover": "0 1px 2px rgba(15,20,25,0.04), 0 16px 40px -12px rgba(255,107,53,0.18)",
        cta: "0 8px 24px -6px rgba(255,107,53,0.45)",
      },
      keyframes: {
        "bounce-down": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(0.4rem)" },
        },
        "bounce-up": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-0.4rem)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(255,107,53,0.4)" },
          "50%": { boxShadow: "0 0 0 14px rgba(255,107,53,0)" },
        },
        "pulse-token": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.08)" },
        },
        "token-deduct": {
          "0%": { transform: "scale(1)", color: "#BA7517" },
          "50%": { transform: "scale(1.3)", color: "#A32D2D" },
          "100%": { transform: "scale(1)", color: "#BA7517" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "bounce-down": "bounce-down 1.4s ease-in-out infinite",
        "bounce-up": "bounce-up 1.4s ease-in-out infinite",
        "pulse-glow": "pulse-glow 1.8s ease-out infinite",
        "pulse-token": "pulse-token 1.6s ease-in-out infinite",
        "token-deduct": "token-deduct 0.6s ease-in-out",
        marquee: "marquee 40s linear infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
