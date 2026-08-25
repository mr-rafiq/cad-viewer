import { AcApContext, AcEdCommand } from '@mlightcad/cad-simple-viewer'

import { AcApPlotConvertor, DEFAULT_PLOT_OPTIONS } from './plot'
import { loadDefaultCtbTable } from './plot/AcApDefaultCtb'

/**
 * Headless AutoCAD-style plot command (`-plot`).
 *
 * Plots model space to a fit-to-paper vector PDF using
 * {@link DEFAULT_PLOT_OPTIONS} and the bundled default `monochrome.ctb`
 * plot style table, without any dialog. The interactive Plot dialog lives in
 * the full viewer UI and drives the same engine via
 * {@link AcApPlotConvertor.plot}.
 */
export class AcApConvertToPlotPdfCmd extends AcEdCommand {
  /**
   * Plots model space extents to PDF with default page setup and the
   * bundled monochrome plot style table.
   *
   * @param context - Application context for the active document
   */
  async execute(context: AcApContext) {
    const convertor = new AcApPlotConvertor()
    const ctbTable = await loadDefaultCtbTable()
    await convertor.plot(context, {
      ...DEFAULT_PLOT_OPTIONS,
      plotStyle: 'ctb',
      ctbTable
    })
  }
}
