"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Scatter3DChart from "@/components/Scatter3DChart";
import {
  formatCellValue,
  normalizeHitsTable,
  normalizeSummaryData,
  PLACEHOLDER_VALUE,
  sortHitsRows,
} from "@/lib/summary";
import type { SummaryPayload } from "@/lib/pipeline/types";

interface DashboardProps {
  initialPaths: string[];
  initialSelectedPath: string;
  initialRawData: unknown | null;
}

export default function Dashboard({
  initialPaths,
  initialSelectedPath,
  initialRawData,
}: DashboardProps) {
  const [detectedPaths, setDetectedPaths] = useState<string[]>(initialPaths);
  const [selectedPath, setSelectedPath] = useState<string>(initialSelectedPath);
  const [manualPath, setManualPath] = useState<string>(initialSelectedPath);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const [rawData, setRawData] = useState<unknown | null>(initialRawData);
  const [missingPath, setMissingPath] = useState<boolean>(
    initialRawData === null && !uploadedFileName
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingPath, setIsLoadingPath] = useState<boolean>(false);
  const [isRunningPipeline, setIsRunningPipeline] = useState<boolean>(false);

  const [topN, setTopN] = useState<number>(25);
  const [sortCol, setSortCol] = useState<string>("docking_score");
  const [ascending, setAscending] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchSummaryFromPath = useCallback(async (targetPath: string) => {
    const trimmed = targetPath.trim();
    if (!trimmed) {
      setRawData(null);
      setMissingPath(true);
      setLoadError(null);
      return;
    }

    setIsLoadingPath(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/summary?path=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" }
      );
      if (response.status === 404) {
        setRawData(null);
        setMissingPath(true);
        return;
      }
      const payload = (await response.json()) as {
        data?: unknown;
        error?: string;
      };
      if (!response.ok) {
        setRawData(null);
        setMissingPath(false);
        setLoadError(payload.error ?? "Failed to load summary JSON.");
        return;
      }
      setRawData(payload.data ?? null);
      setMissingPath(false);
    } catch {
      setRawData(null);
      setMissingPath(false);
      setLoadError("Unable to read summary JSON from the server.");
    } finally {
      setIsLoadingPath(false);
    }
  }, []);

  const handleSelectChange = (nextPath: string) => {
    setSelectedPath(nextPath);
    setManualPath(nextPath);
    if (!uploadedFileName) {
      void fetchSummaryFromPath(nextPath);
    }
  };

  const handleManualPathChange = (nextPath: string) => {
    setManualPath(nextPath);
    if (!uploadedFileName) {
      void fetchSummaryFromPath(nextPath);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setLoadError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      setUploadedFileName(file.name);
      setRawData(parsed);
      setMissingPath(false);
    } catch {
      setUploadedFileName(file.name);
      setRawData(null);
      setMissingPath(false);
      setLoadError("Invalid JSON file. Please upload a valid summary JSON.");
    }
  };

  const handleClearUpload = () => {
    setUploadedFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    void fetchSummaryFromPath(manualPath);
  };

  const handleRunDemoPipeline = async () => {
    setIsRunningPipeline(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputName: "demo", dryRun: true }),
      });
      const payload = (await response.json()) as {
        path?: string;
        summary?: unknown;
        paths?: string[];
        error?: string;
      };
      if (!response.ok) {
        setLoadError(payload.error ?? "Failed to run demo pipeline.");
        return;
      }
      if (Array.isArray(payload.paths)) {
        setDetectedPaths(payload.paths);
      }
      if (payload.path) {
        setSelectedPath(payload.path);
        setManualPath(payload.path);
      }
      setUploadedFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setRawData(payload.summary ?? null);
      setMissingPath(false);
    } catch {
      setLoadError("Unable to run demo pipeline.");
    } finally {
      setIsRunningPipeline(false);
    }
  };

  const normalizedResult = useMemo<{
    data: SummaryPayload | null;
    error: string | null;
  }>(() => {
    if (rawData === null) {
      return { data: null, error: null };
    }
    try {
      return { data: normalizeSummaryData(rawData), error: null };
    } catch (err) {
      return {
        data: null,
        error:
          err instanceof Error
            ? err.message
            : "Unsupported JSON format. Upload a summary object or a list of hit objects.",
      };
    }
  }, [rawData]);

  const data = normalizedResult.data;
  const activeError = loadError ?? normalizedResult.error;

  const pockets = useMemo(() => data?.pockets ?? [], [data]);
  const hits = useMemo(() => data?.hits ?? [], [data]);

  const pocketColumns = useMemo(() => {
    const keys = new Set<string>();
    for (const pocket of pockets) {
      for (const k of Object.keys(pocket)) {
        keys.add(k);
      }
    }
    return Array.from(keys);
  }, [pockets]);

  const { columns: hitColumns, rows: hitRows } = useMemo(
    () => normalizeHitsTable(hits),
    [hits]
  );

  useEffect(() => {
    if (hitRows.length === 0 || hitColumns.length === 0) {
      return;
    }
    const defaultCol = hitColumns.includes("docking_score")
      ? "docking_score"
      : hitColumns[0];
    setSortCol(defaultCol);
    setAscending(defaultCol === "docking_score" || defaultCol === "ml_rescore");
    setTopN(Math.min(25, hitRows.length));
  }, [hitColumns, hitRows.length]);

  const handleSortColChange = (nextCol: string) => {
    setSortCol(nextCol);
    setAscending(nextCol === "docking_score" || nextCol === "ml_rescore");
  };

  const effectiveSortCol = hitColumns.includes(sortCol)
    ? sortCol
    : hitColumns[0] ?? "";

  const effectiveTopN =
    hitRows.length <= 1 ? hitRows.length : Math.min(Math.max(1, topN), hitRows.length);

  const filteredRows = useMemo(() => {
    if (!effectiveSortCol || hitRows.length === 0) {
      return [];
    }
    return sortHitsRows(hitRows, effectiveSortCol, ascending).slice(
      0,
      effectiveTopN
    );
  }, [hitRows, effectiveSortCol, ascending, effectiveTopN]);

  const has3DColumns =
    hitColumns.includes("docking_score") && hitColumns.includes("ml_rescore");

  const handleDownloadJson = () => {
    const content = JSON.stringify(filteredRows, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hits.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white text-slate-900">
      {/* Sidebar — faithful to Streamlit sidebar */}
      <aside className="w-full md:w-80 shrink-0 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 p-6 flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-slate-900">Data source</h2>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="summary-upload"
            className="text-sm font-medium text-slate-700"
          >
            Upload summary JSON
          </label>
          <input
            ref={fileInputRef}
            id="summary-upload"
            type="file"
            accept=".json,application/json"
            onChange={handleFileUpload}
            className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-slate-300 file:text-xs file:font-medium file:bg-white file:text-slate-700 hover:file:bg-slate-100 cursor-pointer"
          />
          {uploadedFileName && (
            <div className="flex items-center justify-between text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 mt-1">
              <span className="truncate text-slate-700">{uploadedFileName}</span>
              <button
                type="button"
                onClick={handleClearUpload}
                className="ml-2 text-slate-500 hover:text-slate-900 font-medium"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="detected-paths"
            className="text-sm font-medium text-slate-700"
          >
            Detected run outputs
          </label>
          <select
            id="detected-paths"
            value={selectedPath}
            onChange={(e) => handleSelectChange(e.target.value)}
            title="Choose a generated run output at outputs/<run>/summary.json"
            className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value=""></option>
            {detectedPaths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Choose a generated run output at outputs/&lt;run&gt;/summary.json
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="manual-path"
            className="text-sm font-medium text-slate-700"
          >
            Or enter summary JSON path
          </label>
          <input
            id="manual-path"
            type="text"
            value={manualPath}
            onChange={(e) => handleManualPathChange(e.target.value)}
            placeholder="outputs/demo/summary.json"
            className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={handleRunDemoPipeline}
            disabled={isRunningPipeline}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isRunningPipeline ? "Running pipeline..." : "Run demo pipeline (dry-run)"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-6 md:p-10 max-w-7xl mx-auto w-full flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          AlphaFold-guided virtual screening dashboard
        </h1>

        {isLoadingPath && (
          <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Loading summary data...
          </div>
        )}

        {activeError && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {activeError}
          </div>
        )}

        {!activeError && !isLoadingPath && missingPath && !data && (
          <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Run the pipeline first and point this app to a real summary JSON, e.g.{" "}
            <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">
              alphafold-vs run --config configs/pipeline.yaml --output outputs/run_01
            </code>{" "}
            then use{" "}
            <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">
              outputs/run_01/summary.json
            </code>
            .
          </div>
        )}

        {!activeError && data && (
          <>
            {/* Run Summary */}
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Run summary</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded border border-slate-200 p-4 bg-white">
                  <div className="text-xs font-medium text-slate-500">Target</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900 break-words">
                    {String(data.target ?? PLACEHOLDER_VALUE)}
                  </div>
                </div>
                <div className="rounded border border-slate-200 p-4 bg-white">
                  <div className="text-xs font-medium text-slate-500">PDB ID</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {String(data.target_pdb_id ?? PLACEHOLDER_VALUE)}
                  </div>
                </div>
                <div className="rounded border border-slate-200 p-4 bg-white">
                  <div className="text-xs font-medium text-slate-500">Pocket count</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {pockets.length}
                  </div>
                </div>
                <div className="rounded border border-slate-200 p-4 bg-white">
                  <div className="text-xs font-medium text-slate-500">Hit count</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-900">
                    {hits.length}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Run mode: {String(data.mode ?? PLACEHOLDER_VALUE)}
              </p>
            </section>

            {/* Pocket Summary */}
            {pockets.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold text-slate-900">
                  Pocket summary
                </h2>
                <div className="overflow-x-auto rounded border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {pocketColumns.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {pockets.map((pocket, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-50">
                          {pocketColumns.map((col) => (
                            <td
                              key={col}
                              className="px-4 py-2 text-slate-800 whitespace-nowrap"
                            >
                              {formatCellValue(pocket[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Interactive Hit Database */}
            {hits.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-xl font-semibold text-slate-900">
                  Interactive hit database
                </h2>

                {hitRows.length === 0 ? (
                  <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    No tabular hit rows are available to display.
                  </div>
                ) : (
                  <>
                    {/* 3-column Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="flex flex-col gap-1.5">
                        {hitRows.length === 1 ? (
                          <p className="text-xs text-slate-500 py-2">
                            Rows to display: 1
                          </p>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                              <label htmlFor="rows-slider">Rows to display</label>
                              <span className="text-xs font-mono text-slate-600">
                                {effectiveTopN}
                              </span>
                            </div>
                            <input
                              id="rows-slider"
                              type="range"
                              min={1}
                              max={hitRows.length}
                              value={effectiveTopN}
                              onChange={(e) => setTopN(Number(e.target.value))}
                              className="w-full accent-blue-600 cursor-pointer"
                            />
                          </>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="sort-by"
                          className="text-sm font-medium text-slate-700"
                        >
                          Sort by
                        </label>
                        <select
                          id="sort-by"
                          value={effectiveSortCol}
                          onChange={(e) => handleSortColChange(e.target.value)}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {hitColumns.map((col) => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2.5 pb-1.5">
                        <input
                          id="sort-ascending"
                          type="checkbox"
                          checked={ascending}
                          onChange={(e) => setAscending(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label
                          htmlFor="sort-ascending"
                          className="text-sm font-medium text-slate-700 cursor-pointer"
                        >
                          Sort ascending
                        </label>
                      </div>
                    </div>

                    {/* Hit Table */}
                    <div className="overflow-x-auto rounded border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            {hitColumns.map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 whitespace-nowrap"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {filteredRows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-slate-50">
                              {hitColumns.map((col) => (
                                <td
                                  key={col}
                                  className="px-3 py-2 text-slate-800 whitespace-nowrap font-mono text-xs"
                                >
                                  {formatCellValue(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* 3D Scatter Plot */}
                    {has3DColumns ? (
                      <Scatter3DChart rows={filteredRows} />
                    ) : (
                      <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                        3D ranking view requires{" "}
                        <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">
                          docking_score
                        </code>{" "}
                        and{" "}
                        <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">
                          ml_rescore
                        </code>{" "}
                        columns.
                      </div>
                    )}

                    {/* Download Button */}
                    <div>
                      <button
                        type="button"
                        onClick={handleDownloadJson}
                        className="inline-flex items-center rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        Download filtered hits (JSON)
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
