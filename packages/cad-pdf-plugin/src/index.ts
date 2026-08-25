/**
 * PDF export, plotting and import plugin for cad-simple-viewer.
 *
 * @packageDocumentation
 */

export { AcApConvertToPdfCmd } from './AcApConvertToPdfCmd'
export { AcApImportPdfCmd } from './AcApImportPdfCmd'
export { AcApPdfConvertor } from './AcApPdfConvertor'
export { AcApPdfImportConvertor } from './AcApPdfImportConvertor'
export { createPdfPlugin } from './createPdfPlugin'
export {
  ACAP_PAPER_SIZES,
  CUSTOM_PAPER_KEY,
  findPaperSize,
  FROM_LAYOUT_PAPER_KEY,
  parseCanonicalMediaName,
  type AcApPaperSize
} from './plot/AcApPaperSizes'
export {
  computeContentTransform,
  computePrintableArea,
  computeScaleFactor,
  resolveSheetSizeMm,
  type ContentBox,
  type PlotRect,
  type PlotTransform
} from './plot/AcApPlotMath'
export {
  DEFAULT_PLOT_OPTIONS,
  type AcApPlotArea,
  type AcApPlotOptions,
  type AcApPlotOrientation,
  type AcApPlotStyle
} from './plot/AcApPlotOptions'
export { AcApPlotConvertor } from './plot/AcApPlotConvertor'
export {
  composeSheetSvg,
  toMatrixAttribute,
  type AcApSheetComposerParams,
  type AcApViewportComposition
} from './plot/AcApSheetComposer'
export {
  convertColor,
  convertColorForPlotStyle,
  normalizeCssColor
} from './plot/AcApPlotStyleProcessor'
export { PDF_PLUGIN_NAME, PDF_PLUGIN_TRIGGERS } from './register'
