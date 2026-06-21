import { NextRequest, NextResponse } from "next/server";

// Only allow fetching from our Tigris storage — prevents SSRF
const ALLOWED_HOST_SUFFIX = ".t3.storageapi.dev";

export async function GET(request: NextRequest) {
  const presignedUrl = request.nextUrl.searchParams.get("url");

  if (!presignedUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(presignedUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  if (!parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const s3Res = await fetch(presignedUrl);
  if (!s3Res.ok) {
    return new NextResponse("Storage fetch failed", { status: s3Res.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/zip");
  const contentLength = s3Res.headers.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);

  return new NextResponse(s3Res.body, { headers });
}
