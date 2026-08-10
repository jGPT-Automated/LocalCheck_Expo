export interface PushTokenRef {
  id: string;
}

export interface ExpoTicket {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ReceiptAttemptRef {
  attemptId: string;
  tokenId: string;
  ticketId: string;
}

export interface ExpoReceipt {
  status?: string;
  message?: string;
  details?: { error?: string };
}

export function retryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(3_600_000, 30_000 * (4 ** (safeAttempt - 1)));
}

export function isRetryableExpoError(error: string | null | undefined): boolean {
  return error === "MessageRateExceeded";
}

export function classifyExpoTickets(tokens: PushTokenRef[], tickets: ExpoTicket[]) {
  const accepted: Array<{ tokenId: string; ticketId: string }> = [];
  const errors: Array<{ tokenId: string; error: string; response: ExpoTicket }> = [];
  const invalidTokenIds: string[] = [];

  tokens.forEach((token, index) => {
    const ticket = tickets[index] ?? {};
    if (ticket.status === "ok" && typeof ticket.id === "string" && ticket.id) {
      accepted.push({ tokenId: token.id, ticketId: ticket.id });
      return;
    }
    const error = ticket.details?.error ?? ticket.message ?? "Missing Expo push ticket";
    errors.push({ tokenId: token.id, error, response: ticket });
    if (error === "DeviceNotRegistered") invalidTokenIds.push(token.id);
  });

  return { accepted, errors, invalidTokenIds };
}

export function classifyExpoReceipts(
  attempts: ReceiptAttemptRef[],
  receipts: Record<string, ExpoReceipt>,
) {
  const okAttemptIds: string[] = [];
  const errorAttempts: Array<{ attemptId: string; tokenId: string; error: string; response: ExpoReceipt }> = [];
  const missingAttemptIds: string[] = [];
  const invalidTokenIds: string[] = [];

  for (const attempt of attempts) {
    const receipt = receipts[attempt.ticketId];
    if (!receipt) {
      missingAttemptIds.push(attempt.attemptId);
      continue;
    }
    if (receipt.status === "ok") {
      okAttemptIds.push(attempt.attemptId);
      continue;
    }
    const error = receipt.details?.error ?? receipt.message ?? "Unknown Expo receipt error";
    errorAttempts.push({
      attemptId: attempt.attemptId,
      tokenId: attempt.tokenId,
      error,
      response: receipt,
    });
    if (error === "DeviceNotRegistered") invalidTokenIds.push(attempt.tokenId);
  }

  return { okAttemptIds, errorAttempts, missingAttemptIds, invalidTokenIds };
}
