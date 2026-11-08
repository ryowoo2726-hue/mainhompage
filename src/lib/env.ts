import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Read secrets when handling a request, so Cloudflare secrets never enter browser bundles.
export function serverEnv(): Record<string, string | undefined> {
  try {
    return getCloudflareContext().env as unknown as Record<string, string | undefined>;
  } catch {
    // next start and Node tests do not have a Workers context.
    return process.env;
  }
}
