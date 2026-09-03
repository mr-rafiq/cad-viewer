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

  it('divides out the scale of an enclosing block transform group', () => {
    // A 0.25 mm pen inside a block inserted at scale 3, plotted at 0.25 sheet
    // mm per drawing unit: the group multiplies the stroke by 3, so the
    // attribute must be pre-divided by 3 as well to keep it 0.25 mm on paper.
    const markup =
      '<g transform="matrix(3,0,0,3,10,20)"><path stroke-width="0.25"/></g>'
    expect(scaleStrokeWidths(markup, 0.25)).toBe(
      '<g transform="matrix(3,0,0,3,10,20)"><path stroke-width="0.333333"/></g>'
    )
  })

  it('multiplies nested block scales and restores them on close', () => {
    const markup =
      '<g transform="matrix(2,0,0,2,0,0)">' +
      '<path stroke-width="0.4"/>' +
      '<g transform="matrix(5,0,0,5,0,0)"><path stroke-width="0.4"/></g>' +
      '</g>' +
      '<path stroke-width="0.4"/>'
    expect(scaleStrokeWidths(markup, 1)).toBe(
      '<g transform="matrix(2,0,0,2,0,0)">' +
        '<path stroke-width="0.2"/>' +
        '<g transform="matrix(5,0,0,5,0,0)"><path stroke-width="0.04"/></g>' +
        '</g>' +
        '<path stroke-width="0.4"/>'
    )
  })

  it('treats rotation and translation groups as unit scale', () => {
    const markup =
      '<g transform="matrix(0,1,-1,0,5,5)"><path stroke-width="0.25"/></g>' +
      '<g transform="matrix(1,0,0,1,9,9)"><path stroke-width="0.25"/></g>'
    expect(scaleStrokeWidths(markup, 1)).toBe(markup)
  })
})
