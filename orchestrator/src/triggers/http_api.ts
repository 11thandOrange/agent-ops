// Backing handler for POST /trigger — the Postman/curl entry point (§4.1).
// Auth (sharedSecretAuth) runs as Express middleware before this ever executes.
import type { Request, Response } from "express";
import { z } from "zod";
import { dispatchImplement, type DispatchDeps } from "../jobs/implement_ticket.js";
import { dispatchPlan } from "../jobs/plan_ticket.js";
import { logger, newCorrelationId } from "../logging.js";

const TriggerBody = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/, "expected \"owner/repo\""),
  issueNumber: z.number().int().positive(),
  action: z.enum(["plan", "implement"]),
  requestedBy: z.string().min(1),
});

export function handleHttpTrigger(deps: DispatchDeps) {
  return async (req: Request, res: Response) => {
    const parsed = TriggerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid request body", details: parsed.error.flatten() });
      return;
    }

    const payload = {
      ...parsed.data,
      source: "curl" as const,
      correlationId: newCorrelationId(),
    };

    try {
      if (payload.action === "plan") {
        await dispatchPlan(deps, payload);
      } else {
        await dispatchImplement(deps, payload);
      }
      res.status(202).json({ correlationId: payload.correlationId, status: "dispatched" });
    } catch (err) {
      logger.error("trigger dispatch failed", { correlationId: payload.correlationId, error: String(err) });
      res.status(502).json({ error: "dispatch failed", correlationId: payload.correlationId });
    }
  };
}
