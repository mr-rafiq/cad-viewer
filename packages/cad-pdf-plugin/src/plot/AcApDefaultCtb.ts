/**
 * Default plot style table: AutoCAD's `monochrome.ctb` behaviour, where every
 * AutoCAD Color Index plots solid black at the object's own lineweight.
 *
 * The table is built in code rather than parsed from a bundled CTB container.
 * The file that used to be embedded here was a *customised* table wearing the
 * monochrome name: six pens carried screening below 100% — ACI 2, which this
 * and most drawings use for dimensions, plotted at 60% ink, i.e. mid grey —
 * nine replaced the object lineweight with a fixed pen width, and seven kept a
 * saturated output colour. Dimension lines and arrowheads therefore came out
 * washed out and at the wrong weight instead of matching the drawing.
 */

import { type AcApCtbTable, createBuiltinCtb } from './AcApCtb'

/** File name shown for the default plot style table. */
export const DEFAULT_CTB_NAME = 'monochrome.ctb'

let cached: AcApCtbTable | null = null

/**
 * Returns the cached default monochrome plot style table.
 *
 * @returns The default plot style table (every ACI plots solid black)
 */
export function loadDefaultCtbTable(): Promise<AcApCtbTable> {
  if (!cached) {
    cached = createBuiltinCtb()
  }
  return Promise.resolve(cached)
}
