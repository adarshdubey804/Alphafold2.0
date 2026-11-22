"use client";

import { useEffect, useRef } from "react";

interface Scatter3DChartProps {
  rows: Record<string, unknown>[];
}

export default function Scatter3DChart({ rows }: Scatter3DChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    let plotlyModule: typeof import("plotly.js-dist-min").default | null = null;
    const node = containerRef.current;

    if (!node) {
      return;
    }

    async function renderPlot() {
      const mod = await import("plotly.js-dist-min");
      if (!active || !node) {
        return;
      }
      plotlyModule = mod.default;

      const xVals = rows.map((row) =>
        typeof row.docking_score === "number"
          ? row.docking_score
          : Number(row.docking_score)
      );
      const yVals = rows.map((row) =>
        typeof row.ml_rescore === "number"
          ? row.ml_rescore
          : Number(row.ml_rescore)
      );
      const zVals = rows.map((_, idx) => idx + 1);
      const labels = rows.map((row, idx) =>
        row.compound_id !== undefined && row.compound_id !== null
          ? String(row.compound_id)
          : `Row ${idx + 1}`
      );

      const trace = {
        type: "scatter3d",
        mode: "markers",
        x: xVals,
        y: yVals,
        z: zVals,
        text: labels,
        hovertemplate:
          "<b>%{text}</b><br>docking_score: %{x}<br>ml_rescore: %{y}<br>rank: %{z}<extra></extra>",
        marker: {
          size: 7,
          color: "#2563eb",
          opacity: 0.9,
          line: {
            width: 1,
            color: "#ffffff",
          },
        },
      };

      const layout = {
        title: { text: "Pose ranking (3D view)", font: { size: 16 } },
        autosize: true,
        height: 480,
        margin: { l: 0, r: 0, t: 48, b: 0 },
        scene: {
          xaxis: { title: { text: "docking_score" } },
          yaxis: { title: { text: "ml_rescore" } },
          zaxis: { title: { text: "rank" } },
        },
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
      };

      await plotlyModule.react(node, [trace], layout, {
        responsive: true,
        displaylogo: false,
      });
    }

    renderPlot();

    return () => {
      active = false;
      if (plotlyModule && node) {
        plotlyModule.purge(node);
      }
    };
  }, [rows]);

  return (
    <div
      ref={containerRef}
      className="w-full min-h-[480px] rounded border border-slate-200 bg-white"
    />
  );
}
