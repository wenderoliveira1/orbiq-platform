import { getPublicEnvironment } from "@/lib/public-environment";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
};

export function GET() {
  try {
    getPublicEnvironment();

    return Response.json(
      {
        service: "orbiq-web",
        status: "ready",
      },
      { headers },
    );
  } catch {
    return Response.json(
      {
        service: "orbiq-web",
        status: "not_ready",
      },
      {
        headers,
        status: 503,
      },
    );
  }
}
