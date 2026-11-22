export interface TargetConfig {
  name: string;
  pdb_id: string;
  structure_source?: string;
  structure_path?: string;
  predictor?: string;
}

export interface PocketDetectionConfig {
  tools?: string[];
  top_n?: number;
}

export interface LibraryConfig {
  actives_source?: string;
  decoys_source?: string;
  zinc_decoy_count?: number;
}

export interface DockingConfig {
  engine?: string;
  alternatives?: string[];
  exhaustiveness?: number;
  num_modes?: number;
}

export interface RescoringConfig {
  model_type?: string;
  feature_set?: string;
  model_path?: string;
}

export interface AdmetConfig {
  max_mw?: number;
  max_logp?: number;
  max_hbd?: number;
  max_hba?: number;
  pains_filter?: boolean;
  external_tools?: string[];
}

export interface RankingConfig {
  top_k?: number;
  export_csv?: boolean;
  export_sdf?: boolean;
}

export interface PipelineConfig {
  project?: {
    name?: string;
    version?: string;
  };
  target: TargetConfig;
  pocket_detection: PocketDetectionConfig;
  library: LibraryConfig;
  docking: DockingConfig;
  rescoring: RescoringConfig;
  admet: AdmetConfig;
  ranking: RankingConfig;
}

export interface StructureInfo {
  source: string;
  predictor: string;
  structure_path: string;
  supported_predictors: string[];
}

export interface PocketRecord {
  id: string;
  tool: string;
  score: number;
  [key: string]: unknown;
}

export interface RfScoreFeatures {
  hbonds: number;
  hydrophobics: number;
  metal_contacts: number;
}

export interface CompoundRecord {
  compound_id: string;
  smiles: string;
  mw: number;
  logp: number;
  hbd: number;
  hba: number;
  pains: boolean;
  docking_score?: number;
  rf_score_features?: RfScoreFeatures;
  ml_rescore?: number;
  [key: string]: unknown;
}

export interface SummaryPayload {
  target?: string;
  target_pdb_id?: string;
  structure?: Record<string, unknown>;
  pockets: Record<string, unknown>[];
  hits: Record<string, unknown>[];
  mode?: string;
  [key: string]: unknown;
}
