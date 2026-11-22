declare module "plotly.js-dist-min" {
  export interface PlotlyTrace {
    type?: string;
    mode?: string;
    x?: (number | string | null)[];
    y?: (number | string | null)[];
    z?: (number | string | null)[];
    text?: string[];
    hovertemplate?: string;
    marker?: {
      size?: number;
      color?: string | number[];
      colorscale?: string;
      opacity?: number;
      line?: {
        width?: number;
        color?: string;
      };
    };
    name?: string;
  }

  export interface PlotlyLayout {
    title?: string | { text: string; font?: { size?: number } };
    autosize?: boolean;
    height?: number;
    margin?: { l?: number; r?: number; t?: number; b?: number };
    scene?: {
      xaxis?: { title?: string | { text: string } };
      yaxis?: { title?: string | { text: string } };
      zaxis?: { title?: string | { text: string } };
    };
    paper_bgcolor?: string;
    plot_bgcolor?: string;
  }

  export interface PlotlyConfig {
    responsive?: boolean;
    displaylogo?: boolean;
  }

  export interface PlotlyModule {
    newPlot: (
      root: HTMLElement,
      data: PlotlyTrace[],
      layout?: PlotlyLayout,
      config?: PlotlyConfig
    ) => Promise<void>;
    react: (
      root: HTMLElement,
      data: PlotlyTrace[],
      layout?: PlotlyLayout,
      config?: PlotlyConfig
    ) => Promise<void>;
    purge: (root: HTMLElement) => void;
  }

  const Plotly: PlotlyModule;
  export default Plotly;
}
