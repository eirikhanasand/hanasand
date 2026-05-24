export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export function apiError(code: string, message: string, status = 400, details?: Record<string, unknown>): Response {
  const body: ApiErrorBody = { error: { code, message, details } };
  return json(body, status);
}
