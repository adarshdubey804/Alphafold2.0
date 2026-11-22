import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type {
  AdmetConfig,
  CompoundRecord,
  DockingConfig,
  LibraryConfig,
  PocketDetectionConfig,
  PocketRecord,
  RankingConfig,
  RescoringConfig,
  StructureInfo,
  TargetConfig,
} from "./types";

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function prepareStructure(targetCfg: TargetConfig): StructureInfo {
  return {
    source: targetCfg.structure_source ?? "provided",
    predictor: targetCfg.predictor ?? "colabfold",
    structure_path: targetCfg.structure_path ?? "data/raw/6LU7.pdb",
    supported_predictors: ["alphafold2", "esmfold", "colabfold"],
  };
}

export function detectPockets(cfg: PocketDetectionConfig): PocketRecord[] {
  const tools = cfg.tools ?? [];
  return tools.map((tool, index) => ({
    id: `P${index + 1}`,
    tool,
    score: roundTo(0.9 - index * 0.1, 2),
  }));
}

export function prepareLibrary(_cfg: LibraryConfig): CompoundRecord[] {
  return [
    {
      compound_id: "CHEMBL_A1",
      smiles: "CCO",
      mw: 46.1,
      logp: -0.3,
      hbd: 1,
      hba: 1,
      pains: false,
    },
    {
      compound_id: "CHEMBL_A2",
      smiles: "CCN(CC)CC",
      mw: 101.2,
      logp: 1.3,
      hbd: 0,
      hba: 1,
      pains: false,
    },
    {
      compound_id: "ZINC_D1",
      smiles: "c1ccccc1",
      mw: 78.1,
      logp: 2.1,
      hbd: 0,
      hba: 0,
      pains: false,
    },
  ];
}

function deterministicScore(compoundId: string, base = -6.0, spread = 4.0): number {
  const digest = createHash("sha256").update(compoundId, "utf-8").digest("hex");
  const fraction = parseInt(digest.slice(0, 8), 16) / 0xffffffff;
  return roundTo(base - fraction * spread, 3);
}

export function dockBatch(
  compounds: CompoundRecord[],
  _cfg: DockingConfig
): CompoundRecord[] {
  return compounds.map((item) => ({
    ...item,
    docking_score: deterministicScore(item.compound_id),
  }));
}

export function rescorePoses(
  compounds: CompoundRecord[],
  _cfg: RescoringConfig
): CompoundRecord[] {
  return compounds.map((item) => ({
    ...item,
    rf_score_features: { hbonds: 1, hydrophobics: 2, metal_contacts: 0 },
    ml_rescore: roundTo((item.docking_score ?? 0) * 1.15, 3),
  }));
}

export function filterAdmet(
  compounds: CompoundRecord[],
  cfg: AdmetConfig
): CompoundRecord[] {
  const maxMw = cfg.max_mw ?? 500;
  const maxLogp = cfg.max_logp ?? 5;
  const maxHbd = cfg.max_hbd ?? 5;
  const maxHba = cfg.max_hba ?? 10;
  const painsFilter = cfg.pains_filter ?? true;

  return compounds.filter((item) => {
    if (item.mw > maxMw) return false;
    if (item.logp > maxLogp) return false;
    if (item.hbd > maxHbd) return false;
    if (item.hba > maxHba) return false;
    if (painsFilter && item.pains) return false;
    return true;
  });
}

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function rankAndExport(
  compounds: CompoundRecord[],
  cfg: RankingConfig,
  outputDir: string
): CompoundRecord[] {
  const topK = cfg.top_k ?? 100;
  const ranked = [...compounds]
    .sort((a, b) => (a.ml_rescore ?? 0) - (b.ml_rescore ?? 0))
    .slice(0, Math.min(topK, compounds.length));

  const csvHeader = ["compound_id", "smiles", "docking_score", "ml_rescore"];
  const csvLines = [
    csvHeader.join(","),
    ...ranked.map((row) =>
      csvHeader.map((key) => escapeCsvCell(row[key])).join(",")
    ),
  ];
  writeFileSync(path.join(outputDir, "hits.csv"), `${csvLines.join("\n")}\n`, "utf-8");

  if (cfg.export_sdf ?? true) {
    const sdfBlocks = ranked.map(
      (row) =>
        `${row.compound_id}\n  alphafold-vs-pipeline\n\n>  <SMILES>\n${row.smiles}\n\n>  <ML_RESCORE>\n${row.ml_rescore}\n\n$$$$\n`
    );
    writeFileSync(path.join(outputDir, "hits.sdf"), sdfBlocks.join(""), "utf-8");
  }

  return ranked;
}
