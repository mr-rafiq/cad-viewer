/**
 * Plot option types shared by the plot engine, the headless `-plot`
 * command, and the full Plot dialog UI.
 */

import type { AcApCtbTable } from './AcApCtb'

/** Which portion of the drawing to plot. */
export type AcApPlotArea =
  /** Everything drawn in the target space (bounding box of all entities). */
  | 'extents'
  /** A user-picked window rectangle in drawing units. */
  | 'window'
  /** The paper sheet itself: viewports plus paper-space entities (layouts only). */
  | 'layout'

/** How entity colors are converted at plot time. */
export type AcApPlotStyle = 'asIs' | 'monochrome' | 'grayscale' | 'ctb'

/** Sheet orientation relative to the portrait media dimensions. */
export type AcApPlotOrientation = 'portrait' | 'landscape'

/**
 * Complete set of user-selectable plot settings.
 *
 * Mirrors the subset of `AcDbPlotSettings` that a browser PDF plot can
 * honor. Paper dimensions are always resolved to millimeters before
 * plotting.
 */
export interface AcApPlotOptions {
  /**
   * Name of the layout (paper space) to plot, or `undefined`/`'Model'` to
   * plot model space.
   */
  layoutName?: string
  /**
   * Paper size key from the paper catalog, `fromLayout` to use the
   * layout's stored page setup media, or `custom`.
   */
  paperSizeKey: string
  /** Custom paper width in millimeters (used when `paperSizeKey` is `custom`). */
  customPaperWidth?: number
  /** Custom paper height in millimeters (used when `paperSizeKey` is `custom`). */
  customPaperHeight?: number
  /** Sheet orientation; swaps the portrait media dimensions when `landscape`. */
  orientation: AcApPlotOrientation
  /** Portion of the drawing to plot. */
  plotArea: AcApPlotArea
  /**
   * Window rectangle in drawing units (min/max corners) used when
   * `plotArea` is `'window'`.
   */
  plotWindow?: { minX: number; minY: number; maxX: number; maxY: number }
  /**
   * `fit` scales content to fill the printable area; `custom` uses
   * `scaleNumerator:scaleDenominator` (paper units : drawing units).
   */
  scaleMode: 'fit' | 'custom'
  /** Numerator of the custom plot scale (paper units). */
  scaleNumerator: number
  /** Denominator of the custom plot scale (drawing units). */
  scaleDenominator: number
  /** Color conversion applied to plotted geometry. */
  plotStyle: AcApPlotStyle
  /**
   * Parsed CTB table applied when `plotStyle` is `'ctb'`. Produced by
   * `parseCtbFile` / `parseCtbText` in the caller.
   */
  ctbTable?: AcApCtbTable
  /** Unprintable margin applied on every sheet edge, in millimeters. */
  marginMm: number
  /** Centers the plotted content inside the printable area. */
  centerPlot: boolean
  /** Horizontal plot offset in millimeters (ignored when `centerPlot`). */
  plotOffsetX?: number
  /** Vertical plot offset in millimeters, positive = up (ignored when `centerPlot`). */
  plotOffsetY?: number
  /**
   * Plots object transparency. When `false`, geometry is plotted fully
   * opaque (AutoCAD's default "Plot transparency" off). Defaults to `true`.
   */
  plotTransparency?: boolean
  /**
   * For layout plots: renders model space through each paper-space viewport,
   * clipped to the viewport rectangle.
   */
  drawViewportContent: boolean
  /** For layout plots: draws a visible border rectangle for each viewport. */
  plotViewportBorders: boolean
}

/** Default options used by the headless `-plot` command and the Plot dialog. */
export const DEFAULT_PLOT_OPTIONS: AcApPlotOptions = {
  layoutName: undefined,
  paperSizeKey: 'ISO_A4',
  orientation: 'landscape',
  plotArea: 'extents',
  scaleMode: 'fit',
  scaleNumerator: 1,
  scaleDenominator: 1,
  plotStyle: 'monochrome',
  marginMm: 5,
  centerPlot: true,
  plotOffsetX: 0,
  plotOffsetY: 0,
  plotTransparency: true,
  drawViewportContent: true,
  plotViewportBorders: false
}
