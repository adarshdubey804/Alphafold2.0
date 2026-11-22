import { readFileSync } from "node:fs";
import Dashboard from "@/components/Dashboard";
import { ensureDemoOutput, resolveSafeJsonPath } from "@/lib/pipeline/runner";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const rootDir = process.cwd();
  const detectedPaths = ensureDemoOutput(rootDir);
  const initialSelectedPath = detectedPaths[0] ?? "";

  let initialRawData: unknown | null = null;
  if (initialSelectedPath) {
    const safePath = resolveSafeJsonPath(rootDir, initialSelectedPath);
    if (safePath) {
      try {
        initialRawData = JSON.parse(readFileSync(safePath, "utf-8"));
      } catch {
        initialRawData = null;
      }
    }
  }

  return (
    <Dashboard
      initialPaths={detectedPaths}
      initialSelectedPath={initialSelectedPath}
      initialRawData={initialRawData}
    />
  );
}
