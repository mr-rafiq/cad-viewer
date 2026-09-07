import {
  DEFAULT_LINE_WEIGHT_MM,
  DEFAULT_PLOT_OPTIONS
} from '../src/plot/AcApPlotOptions'

describe('default lineweight', () => {
  it('matches AutoCAD LWDEFAULT', () => {
    expect(DEFAULT_LINE_WEIGHT_MM).toBe(0.25)
  })

  it('is carried by the default plot options', () => {
    // Drawings that leave every layer on "Default" plot entirely at this
    // width, so it decides how heavy the whole sheet reads. It is a plot
    // option rather than a constant so a house standard can plot finer.
    expect(DEFAULT_PLOT_OPTIONS.defaultLineWeightMm).toBe(
      DEFAULT_LINE_WEIGHT_MM
    )
  })
})
