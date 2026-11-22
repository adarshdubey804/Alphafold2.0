import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "./config";
import {
  detectPockets,
  dockBatch,
  filterAdmet,
  prepareLibrary,
  prepareStructure,
  rankAndExport,
  rescorePoses,
} from "./stages";
import type { PipelineConfig, SummaryPayload } from "./types";

export function runPipeline(
  config: PipelineConfig,
  outputDir: string,
  dryRun = false
): SummaryPayload {
  mkdirSync(outputDir, { recursive: true });

  const structureInfo = prepareStructure(config.target);
  const pockets = detectPockets(config.pocket_detection);
  const compounds = prepareLibrary(config.library);
  const docked = dockBatch(compounds, config.docking);
  const rescored = rescorePoses(docked, config.rescoring);
  const passed = filterAdmet(rescored, config.admet);
  const ranked = rankAndExport(passed, config.ranking, outputDir);

  const summary: SummaryPayload = {
    target: config.target.name,
    target_pdb_id: config.target.pdb_id,
    structure: structureInfo as unknown as Record<string, unknown>,
    pockets,
    hits: ranked,
    mode: dryRun ? "dry-run" : "standard",
  };

  const summaryPath = path.join(outputDir, "summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

  return summary;
}

export function discoverSummaryPaths(rootDir: string): string[] {
  const outputsDir = path.join(rootDir, "outputs");
  if (!existsSync(outputsDir)) {
    return [];
  }

  const results: string[] = [];

  function walk(currentDir: string) {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === "summary.json") {
        const rel = path.relative(rootDir, fullPath).split(path.sep).join("/");
        results.push(rel);
      }
    }
  }

  walk(outputsDir);
  return results.sort();
}

export function ensureDemoOutput(rootDir: string): string[] {
  const existing = discoverSummaryPaths(rootDir);
  if (existing.length > 0) {
    return existing;
  }

  const configPath = path.join(rootDir, "configs", "pipeline.yaml");
  if (existsSync(configPath)) {
    const config = loadConfig(configPath);
    const demoDir = path.join(rootDir, "outputs", "demo");
    runPipeline(config, demoDir, true);
  }

  return discoverSummaryPaths(rootDir);
}

export function resolveSafeJsonPath(rootDir: string, requestedPath: string): string | null {
  const trimmed = requestedPath.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedRoot = path.resolve(rootDir);
  const candidate = path.resolve(normalizedRoot, trimmed);

  if (
    candidate !== normalizedRoot &&
    !candidate.startsWith(normalizedRoot + path.sep)
  ) {
    return null;
  }

  if (!candidate.toLowerCase().endsWith(".json")) {
    return null;
  }

  if (!existsSync(candidate) || !statSync(candidate).isFile()) {
    return null;
  }

  return candidate;
}
