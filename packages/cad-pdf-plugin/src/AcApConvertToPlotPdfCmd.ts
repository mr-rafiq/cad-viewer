import { AcApContext, AcEdCommand } from '@mlightcad/cad-simple-viewer'

import { AcApPlotConvertor } from './plot'
import { DEFAULT_PLOT_OPTIONS } from './plot'

/**
 * Headless AutoCAD-style plot command (`-plot`).
 *
 * Plots model space to a fit-to-paper vector PDF using
 * {@link DEFAULT_PLOT_OPTIONS} without any dialog. The interactive Plot
 * dialog lives in the full viewer UI and drives the same engine via
 * {@link AcApPlotConvertor.plot}.
 */
export class AcApConvertToPlotPdfCmd extends AcEdCommand {
  /**
   * Plots model space extents to PDF with default page setup.
   *
   * @param context - Application context for the active document
   */
  async execute(context: AcApContext) {
    const convertor = new AcApPlotConvertor()
    await convertor.plot(context, { ...DEFAULT_PLOT_OPTIONS })
  }
}
