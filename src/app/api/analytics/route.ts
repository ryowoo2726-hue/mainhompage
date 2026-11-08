import { requireAuth } from "@/lib/auth";
import { getAnalytics } from "@/lib/notion";

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    return Response.json({ analytics: await getAnalytics() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to load analytics." }, { status: 500 });
  }
}
