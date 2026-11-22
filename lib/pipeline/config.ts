import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { PipelineConfig } from "./types";

export function loadConfig(configPath: string): PipelineConfig {
  const resolved = path.resolve(configPath);
  const rawText = readFileSync(resolved, "utf-8");
  const parsed = yaml.load(rawText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected mapping in config file: ${configPath}`);
  }
  return parsed as PipelineConfig;
}
