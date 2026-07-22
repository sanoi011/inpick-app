import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { LockedDesignRequestError, registerLockedDesign } from "./service";
import type { LockedDeliveryRequest } from "./contracts";

export type { LockedDeliveryRequest } from "./contracts";

export interface PreparedLockedDelivery {
  userId: string;
  request: LockedDeliveryRequest;
}

const REQUIRED = [
  "projectId",
  "projectMode",
  "targetType",
  "targetId",
  "targetName",
  "renderKind",
] as const;

export async function prepareLockedDelivery(
  value: unknown,
): Promise<PreparedLockedDelivery | null> {
  if (value == null) return null;
  if (typeof value !== "object") {
    throw new LockedDesignRequestError("INVALID_LOCKED_DELIVERY", 400);
  }
  const request = value as Record<string, unknown>;
  for (const key of REQUIRED) {
    if (typeof request[key] !== "string" || request[key] === "") {
      throw new LockedDesignRequestError("INVALID_LOCKED_DELIVERY", 400);
    }
  }
  if (request.unlockCost !== 1) {
    throw new LockedDesignRequestError("INVALID_UNLOCK_COST", 400);
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new LockedDesignRequestError("UNAUTHENTICATED", 401);

  return {
    userId: user.id,
    request: request as unknown as LockedDeliveryRequest,
  };
}

export async function completeLockedDelivery(
  prepared: PreparedLockedDelivery,
  imageSource: string,
  prompt?: string,
) {
  return registerLockedDesign(createAdminClient(), prepared.userId, {
    ...prepared.request,
    imageSource,
    prompt: prompt || prepared.request.prompt,
  });
}
