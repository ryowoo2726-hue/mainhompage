import { requireAuth } from "@/lib/auth";
import { getStudents, upsertAttendance } from "@/lib/notion";
import type { AttendanceInput } from "@/lib/types";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    return Response.json({ students: await getStudents() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to load attendance." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as Partial<AttendanceInput> | null;

  if (!body?.name || !body.date || !body.period || !body.status) {
    return Response.json({ error: "학생이름, 날짜, 교시, 상태는 필수입니다." }, { status: 400 });
  }

  if (
    (body.medicalCertificateReceived !== undefined && typeof body.medicalCertificateReceived !== "boolean") ||
    (body.absenceReportReceived !== undefined && typeof body.absenceReportReceived !== "boolean")
  ) {
    return Response.json({ error: "서류 제출 여부는 체크박스 값이어야 합니다." }, { status: 400 });
  }

  try {
    const student = await upsertAttendance(body as AttendanceInput);
    return Response.json({ student });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to update attendance." }, { status: 500 });
  }
}
