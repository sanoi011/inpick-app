"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function BidsRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/project/${params.id}/rfq`);
  }, [params.id, router]);

  return null;
}
