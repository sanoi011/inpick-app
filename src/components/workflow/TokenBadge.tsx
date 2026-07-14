"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Hexagon } from "lucide-react";

interface Props {
  balance: number;
  className?: string;
  onClick?: () => void;
}

export default function TokenBadge({ balance, className, onClick }: Props) {
  const [pulse, setPulse] = useState(false);
  const [last, setLast] = useState(balance);

  useEffect(() => {
    if (balance !== last) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      setLast(balance);
      return () => clearTimeout(t);
    }
  }, [balance, last]);

  const low = balance < 3;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-semibold backdrop-blur transition-colors ${
        low
          ? "border-primary-200 bg-primary-50 text-primary-700"
          : "border-black/10 bg-white text-black/65 hover:bg-black/[0.035]"
      } ${className ?? ""}`}
    >
      <Hexagon
        className={`h-3.5 w-3.5 ${pulse ? "animate-token-deduct" : ""} ${low ? "fill-primary-500 text-primary-500" : "fill-primary-500 text-primary-500"}`}
      />
      <span className={`tabular ${pulse ? "animate-token-deduct" : ""}`}>{balance}</span>
    </motion.button>
  );
}
