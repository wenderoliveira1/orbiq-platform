export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      service: "orbiq-web",
      status: "healthy",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
      status: 200,
    },
  );
}
