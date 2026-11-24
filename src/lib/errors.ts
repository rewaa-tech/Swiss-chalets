export class AppError extends Error {
  constructor(public status: number, message: string, public code = "error", public field?: string) {
    super(message);
  }
}
export const notFound = (msg = "غير موجود") => new AppError(404, msg, "not_found");
export const forbidden = (msg = "لا تملك صلاحية لهذا الإجراء") => new AppError(403, msg, "forbidden");
export const bad = (msg: string, field?: string, code = "invalid") => new AppError(400, msg, code, field);
export const conflict = (msg: string, code = "conflict") => new AppError(409, msg, code);

export function problem(e: unknown): Response {
  if (e instanceof AppError) {
    return Response.json(
      { type: "about:blank", title: e.message, status: e.status, code: e.code, field: e.field },
      { status: e.status, headers: { "Content-Type": "application/problem+json" } },
    );
  }
  console.error(e);
  return Response.json(
    { type: "about:blank", title: "حدث خطأ غير متوقع، حاول مرة أخرى", status: 500 },
    { status: 500, headers: { "Content-Type": "application/problem+json" } },
  );
}
