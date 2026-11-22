import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { loadConfig } from "@/lib/pipeline/config";
import { discoverSummaryPaths, runPipeline } from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      outputName?: string;
      dryRun?: boolean;
    };

    const rawName = typeof body.outputName === "string" ? body.outputName.trim() : "demo";
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, "") || "demo";
    const dryRun = body.dryRun !== false;

    const rootDir = process.cwd();
    const configPath = path.join(rootDir, "configs", "pipeline.yaml");
    const outputDir = path.join(rootDir, "outputs", safeName);

    const config = loadConfig(configPath);
    const summary = runPipeline(config, outputDir, dryRun);
    const paths = discoverSummaryPaths(rootDir);

    return NextResponse.json({
      path: `outputs/${safeName}/summary.json`,
      summary,
      paths,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to execute pipeline.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
