import { createSessionCookie, verifyPasscode } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { passcode?: string } | null;
  const passcode = typeof body?.passcode === "string" ? body.passcode.trim() : "";

  if (!/^\d{4,6}$/.test(passcode)) {
    return Response.json({ error: "Passcode must be 4 to 6 digits." }, { status: 400 });
  }

  if (!(await verifyPasscode(passcode))) {
    return Response.json({ error: "Invalid passcode." }, { status: 401 });
  }

  await createSessionCookie();
  return Response.json({ ok: true });
}
