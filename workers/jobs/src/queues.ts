import { z } from "zod";

/** Every background job type. Payloads carry IDs only; handlers re-load and re-authorize from the database. */
export const QUEUES = {
  "system.ping": {
    payload: z.object({ note: z.string().max(200).optional() }),
    options: { retryLimit: 0, expireInSeconds: 30 },
  },
  "council.execute": {
    payload: z.object({ executionId: z.string().min(1), organizationId: z.string().min(1) }),
    // Long-running AI work. One retry max: agent runs are costly and handlers must be resumable/idempotent.
    options: { retryLimit: 1, retryDelay: 30, retryBackoff: true, expireInSeconds: 60 * 20 },
    singletonBy: "executionId",
    policy: "exclusive" as const, // at most one queued-or-active job per execution
  },
  "document.process": {
    payload: z.object({ documentId: z.string().min(1), organizationId: z.string().min(1) }),
    options: { retryLimit: 3, retryDelay: 15, retryBackoff: true, expireInSeconds: 60 * 10 },
    singletonBy: "documentId",
    policy: "exclusive" as const,
  },
  "email.send": {
    payload: z.object({ kind: z.enum(["enquiry-ack", "admin-notify", "newsletter-confirm", "application-ack", "other"]), outboxId: z.string().min(1) }),
    options: { retryLimit: 5, retryDelay: 20, retryBackoff: true, expireInSeconds: 120 },
    singletonBy: "outboxId",
    policy: "exclusive" as const,
  },
  "provider.healthcheck": {
    payload: z.object({ providerKey: z.string().min(1) }),
    options: { retryLimit: 1, retryDelay: 10, expireInSeconds: 60 },
  },
  "retention.purge": {
    payload: z.object({ scope: z.enum(["documents", "sessions", "rate-limits"]) }),
    options: { retryLimit: 2, retryDelay: 60, retryBackoff: true, expireInSeconds: 60 * 10 },
  },
} as const;

export type QueueName = keyof typeof QUEUES;
export const QUEUE_NAMES = Object.keys(QUEUES) as QueueName[];
export type Payload<Q extends QueueName> = z.infer<(typeof QUEUES)[Q]["payload"]>;
export const deadLetterName = (q: QueueName) => `${q}.dead`;
