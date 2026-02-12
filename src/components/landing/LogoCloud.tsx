"use client";

const PARTNERS = [
  { name: "한국물가협회", width: 120 },
  { name: "대한건설협회", width: 120 },
  { name: "조달청", width: 80 },
  { name: "국토교통부", width: 120 },
  { name: "한국감정원", width: 120 },
  { name: "건설기술연구원", width: 130 },
];

import { useRef, useEffect, useState } from "react";

export default function LogoCloud({ title = "공식 데이터 연동 파트너" }: { title?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    let animationId: number;
    let scrollPosition = 0;

    const animate = () => {
      if (!isHovered) {
        scrollPosition += 0.5;
        if (scrollPosition >= 800) scrollPosition = 0;
        scrollContainer.style.transform = `translateX(-${scrollPosition}px)`;
      }
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isHovered]);

  const triplePartners = [...PARTNERS, ...PARTNERS, ...PARTNERS];

  return (
    <section className="py-10" style={{ backgroundColor: "#f4f2f1" }}>
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gray-200" />
          <p className="text-sm font-medium whitespace-nowrap text-gray-900">{title}</p>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="relative overflow-hidden" style={{
          maskImage: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgb(0,0,0) 12.5%, rgb(0,0,0) 87.5%, rgba(0,0,0,0) 100%)",
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgb(0,0,0) 12.5%, rgb(0,0,0) 87.5%, rgba(0,0,0,0) 100%)",
        }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
          <div ref={scrollRef} className="flex items-center gap-12" style={{ willChange: "transform" }}>
            {triplePartners.map((partner, index) => (
              <div key={`${partner.name}-${index}`} className="flex-shrink-0 h-11 flex items-center justify-center rounded-lg border border-gray-200 bg-white px-6 py-2 shadow-sm" style={{ minWidth: partner.width }}>
                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">{partner.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
