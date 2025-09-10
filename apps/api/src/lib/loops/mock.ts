import { LoopsPayload, LoopsResponse } from "@/services/email.service.js";

export async function updateContactMock(
  payload: LoopsPayload,
): Promise<LoopsResponse> {
  // Always succeed in test mode by default
  return { success: true, id: payload.userId };
}
