import { readFileSync } from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { resolveSafeJsonPath } from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedPath = request.nextUrl.searchParams.get("path") ?? "";
  if (!requestedPath.trim()) {
    return NextResponse.json({ error: "Missing path parameter." }, { status: 400 });
  }

  const safePath = resolveSafeJsonPath(process.cwd(), requestedPath);
  if (!safePath) {
    return NextResponse.json({ error: "Summary file not found." }, { status: 404 });
  }

  try {
    const rawText = readFileSync(safePath, "utf-8");
    const parsed = JSON.parse(rawText);
    return NextResponse.json({ data: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse summary JSON.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
