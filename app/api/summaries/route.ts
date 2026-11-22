import { NextResponse } from "next/server";
import { ensureDemoOutput } from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const paths = ensureDemoOutput(process.cwd());
    return NextResponse.json({ paths });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to discover summary paths";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
