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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold backdrop-blur transition-colors ${
        low
          ? "border-danger-text/30 bg-danger-bg text-danger-text"
          : "border-token-200 bg-token-50 text-token-400"
      } ${className ?? ""}`}
    >
      <Hexagon
        className={`h-3.5 w-3.5 ${pulse ? "animate-token-deduct" : ""} ${low ? "fill-danger-text" : "fill-token-400"}`}
      />
      <span className={`tabular ${pulse ? "animate-token-deduct" : ""}`}>{balance}</span>
    </motion.button>
  );
}
