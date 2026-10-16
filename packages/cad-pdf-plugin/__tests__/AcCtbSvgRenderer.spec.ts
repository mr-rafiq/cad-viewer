import { AcCmColor, AcGiLineWeight } from '@mlightcad/data-model'

// Exercise the source renderer, independent of previously built bundles.
jest.mock('@mlightcad/cad-svg-plugin', () =>
  jest.requireActual('../../cad-svg-plugin/src/AcSvgRenderer')
)

import { createBuiltinCtb, parseCtbText } from '../src/plot/AcApCtb'
import { AcCtbSvgRenderer } from '../src/plot/AcCtbSvgRenderer'
import { scaleStrokeWidths } from '../src/plot/AcApPlotMath'

const points = [
  { x: 0, y: 0, z: 0 },
  { x: 100, y: 0, z: 0 }
]

function aciColor(index: number) {
  const color = new AcCmColor()
  color.colorIndex = index
  return color
}

function plotRenderer() {
  const table = parseCtbText(
    [
      'plot_style{',
      ' 0{',
      '  color=-1023410176',
      '  lineweight=1',
      ' }',
      ' 1{',
      '  color=-1023410176',
      '  lineweight=2',
      ' }',
      ' 6{',
      '  color=-1023410176',
      '  lineweight=3',
      ' }',
      '}',
      'custom_lineweight_table{',
      ' 0=0',
      ' 1=0.13',
      ' 2=0.50',
      ' 3=0.25',
      '}'
    ].join('\n')
  )
  const renderer = new AcCtbSvgRenderer(table)
  renderer.showLineWeight = true
  renderer.defaultLineWeightMm = 0.25
  return renderer
}

describe('CTB plotted lineweights', () => {
  it.each([0.1, 0.37, 0.025])('prints an exact custom CTB width of %s mm without rounding to an enum', (width) => {
    const table = createBuiltinCtb()
    table.getStyle(1)!.lineweightMm = width
    const renderer = new AcCtbSvgRenderer(table)
    renderer.showLineWeight = true
    renderer.subEntityTraits.color = aciColor(1)
    expect(renderer.lines(points).svg).toContain(`stroke-width="${width}"`)
    expect(renderer.lineWeightOverrideMm).toBeUndefined()
    renderer.subEntityTraits.color = aciColor(2)
    renderer.subEntityTraits.lineWeight = AcGiLineWeight.LineWeight050
    expect(renderer.lines(points).svg).toContain('stroke-width="0.5"')
  })

  it('preserves different pen widths through rendering and sheet scaling', () => {
    const renderer = plotRenderer()
    renderer.subEntityTraits.color = aciColor(1)
    const thin = renderer.lines(points).svg
    renderer.subEntityTraits.color = aciColor(2)
    const thick = renderer.lines(points).svg
    expect(thin).toContain('stroke-width="0.13"')
    expect(thick).toContain('stroke-width="0.5"')
    // A 1:100 plot must still print 0.13 mm and 0.50 mm strokes.
    expect(scaleStrokeWidths(thin + thick, 0.01)).toContain('stroke-width="13"')
    expect(scaleStrokeWidths(thin + thick, 0.01)).toContain('stroke-width="50"')
  })

  it('uses the original pen for every primitive of a multi-part entity', () => {
    const renderer = plotRenderer()
    const color = aciColor(1)
    renderer.subEntityTraits.color = color
    renderer.subEntityTraits.lineWeight = AcGiLineWeight.ByLayer
    const first = renderer.lines(points).svg
    const second = renderer.lines(points).svg
    expect(first).toContain('stroke-width="0.13"')
    expect(second).toContain('stroke-width="0.13"')
    expect(renderer.subEntityTraits.color).toBe(color)
    expect(renderer.subEntityTraits.lineWeight).toBe(AcGiLineWeight.ByLayer)
  })

  it('keeps layer and explicit object widths when the CTB uses object width', () => {
    const renderer = new AcCtbSvgRenderer(createBuiltinCtb())
    renderer.showLineWeight = true
    renderer.defaultLineWeightMm = 0.25
    renderer.resolveLayerLineWeight = () => AcGiLineWeight.LineWeight050
    renderer.subEntityTraits.lineWeight = AcGiLineWeight.ByLayer
    expect(renderer.lines(points).svg).toContain('stroke-width="0.5"')
    renderer.subEntityTraits.lineWeight = AcGiLineWeight.LineWeight013
    expect(renderer.lines(points).svg).toContain('stroke-width="0.13"')
  })
})
