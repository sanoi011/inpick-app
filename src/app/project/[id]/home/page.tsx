"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    router.replace(`/project/${id}/design`);
  }, [router, id]);

  return null;
}
