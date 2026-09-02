import { scaleStrokeWidths } from '../src/plot/AcApPlotMath'

describe('scaleStrokeWidths', () => {
  it('converts millimeter widths into drawing units for the sheet scale', () => {
    // A drawing plotted at 0.25 sheet mm per drawing unit needs a 0.25 mm
    // pen to be 1 drawing unit wide so it survives the content transform.
    const scaled = scaleStrokeWidths('<path stroke-width="0.25"/>', 0.25)
    expect(scaled).toBe('<path stroke-width="1"/>')
  })

  it('rescales every stroke width in the markup', () => {
    const scaled = scaleStrokeWidths(
      '<path stroke-width="0.5"/><path stroke-width="0.25"/>',
      0.5
    )
    expect(scaled).toBe('<path stroke-width="1"/><path stroke-width="0.5"/>')
  })

  it('leaves markup untouched for a unit scale', () => {
    const markup = '<path stroke-width="0.35"/>'
    expect(scaleStrokeWidths(markup, 1)).toBe(markup)
  })

  it('ignores a non-positive or non-finite scale', () => {
    const markup = '<path stroke-width="0.35"/>'
    expect(scaleStrokeWidths(markup, 0)).toBe(markup)
    expect(scaleStrokeWidths(markup, Number.NaN)).toBe(markup)
  })

  it('does not disturb other attributes', () => {
    const markup = '<path stroke="#000000" stroke-width="0.5" fill="none"/>'
    expect(scaleStrokeWidths(markup, 0.5)).toBe(
      '<path stroke="#000000" stroke-width="1" fill="none"/>'
    )
  })
})
