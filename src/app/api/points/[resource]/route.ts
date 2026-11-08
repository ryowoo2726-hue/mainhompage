import { onRequestGet } from "@/lib/points/api.mjs";
import { serverEnv } from "@/lib/env";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return onRequestGet({ request, env: serverEnv() });
}
