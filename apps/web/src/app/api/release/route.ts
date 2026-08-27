import { getReleaseInfo } from "@/lib/release-info";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(getReleaseInfo(), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
    status: 200,
  });
}
