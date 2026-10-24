import type { NextFunction, Request, Response } from "express";

/** Wrap every JSON API response in the same public response shape. */
export function apiResponseEnvelope(_req: Request, res: Response, next: NextFunction): void {
  const sendJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    const successful = res.statusCode >= 200 && res.statusCode < 400;

    if (body && typeof body === "object" && !Array.isArray(body)) {
      const payload = body as Record<string, unknown>;
      if (typeof payload.status === "boolean" && typeof payload.message === "string" && "data" in payload) {
        return sendJson(body);
      }

      if (typeof payload.message === "string") {
        const { message, ...data } = payload;
        return sendJson({ status: successful, message, data });
      }
    }

    return sendJson({
      status: successful,
      message: successful ? "Request successful" : "Request failed",
      data: body ?? {}
    });
  }) as Response["json"];

  next();
}
