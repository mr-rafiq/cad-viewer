import { AcApContext, AcEdCommand } from '@mlightcad/cad-simple-viewer'

import { useDialogManager } from '../composable'

/**
 * Opens the Plot dialog (`plot`, alias `print`).
 *
 * The dialog collects AutoCAD-style page setup options (layout, paper
 * size, orientation, plot area, scale, plot style) with a live preview and
 * runs the vector PDF plotting engine on OK. Headless plotting without a
 * dialog is available via `-plot`.
 */
export class AcApPlotDlgCmd extends AcEdCommand {
  async execute(_context: AcApContext) {
    const { toggleDialog } = useDialogManager()
    toggleDialog('PlotDlg', true)
  }
}
