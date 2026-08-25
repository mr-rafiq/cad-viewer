import {
  computeContentTransform,
  computePrintableArea,
  computeScaleFactor,
  resolveSheetSizeMm
} from '../src/plot/AcApPlotMath'
import { DEFAULT_PLOT_OPTIONS } from '../src/plot/AcApPlotOptions'
import { convertColorForPlotStyle } from '../src/plot/AcApPlotStyleProcessor'
import {
  composeSheetSvg,
  toMatrixAttribute
} from '../src/plot/AcApSheetComposer'

describe('computeScaleFactor', () => {
  const printable = { x: 0, y: 0, width: 200, height: 100 }

  it('fits content to the printable area', () => {
    const factor = computeScaleFactor(
      { minX: 0, minY: 0, maxX: 400, maxY: 400 },
      printable,
      { scaleMode: 'fit', scaleNumerator: 1, scaleDenominator: 1 }
    )
    expect(factor).toBeCloseTo(100 / 400, 10)
  })

  it('returns null for empty content', () => {
    const factor = computeScaleFactor(
      { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      printable,
      { scaleMode: 'fit', scaleNumerator: 1, scaleDenominator: 1 }
    )
    expect(factor).toBeNull()
  })

  it('computes custom scale as paper units per drawing unit', () => {
    const factor = computeScaleFactor(
      { minX: 0, minY: 0, maxX: 1000, maxY: 500 },
      printable,
      { scaleMode: 'custom', scaleNumerator: 1, scaleDenominator: 10 }
    )
    expect(factor).toBeCloseTo(0.1, 10)
  })

  it('falls back to fit when the custom ratio is invalid', () => {
    const factor = computeScaleFactor(
      { minX: 0, minY: 0, maxX: 1000, maxY: 500 },
      printable,
      { scaleMode: 'custom', scaleNumerator: 0, scaleDenominator: 10 }
    )
    expect(factor).toBeCloseTo(0.2, 10)
  })
})

describe('computeContentTransform', () => {
  const printable = { x: 5, y: 5, width: 200, height: 100 }

  it('centers content inside the printable area with Y flip', () => {
    const transform = computeContentTransform(
      { minX: -50, minY: -25, maxX: 50, maxY: 25 },
      2,
      printable,
      true
    )
    // Center of the drawing must map to the center of the printable area.
    const cx = (-50 + 50) / 2
    const cy = (-25 + 25) / 2
    const x = transform.a * cx + transform.c * cy + transform.e
    const y = transform.b * cx + transform.d * cy + transform.f
    expect(x).toBeCloseTo(printable.x + printable.width / 2, 10)
    expect(y).toBeCloseTo(printable.y + printable.height / 2, 10)
    // Y axis must be flipped and scaled.
    expect(transform.a).toBe(2)
    expect(transform.d).toBe(-2)
  })

  it('aligns the content top-left to the printable area when not centered', () => {
    const transform = computeContentTransform(
      { minX: 0, minY: 0, maxX: 100, maxY: 50 },
      1,
      printable,
      false
    )
    // Drawing (maxX, maxY) maps to the printable area's bottom-left in
    // sheet space; sheet Y grows downward so maxY lands at printable.y.
    const topY = transform.d * 50 + transform.f
    expect(topY).toBeCloseTo(printable.y, 10)
    const leftX = transform.a * 0 + transform.e
    expect(leftX).toBeCloseTo(printable.x, 10)
  })
})

describe('computePrintableArea', () => {
  it('applies margins on every edge', () => {
    const area = computePrintableArea(
      { x: 0, y: 0, width: 210, height: 297 },
      5
    )
    expect(area).toEqual({ x: 5, y: 5, width: 200, height: 287 })
  })

  it('clamps to non-negative extents', () => {
    const area = computePrintableArea({ x: 0, y: 0, width: 10, height: 10 }, 50)
    expect(area.width).toBe(0)
    expect(area.height).toBe(0)
  })
})

describe('composeSheetSvg', () => {
  const sheet = resolveSheetSizeMm(DEFAULT_PLOT_OPTIONS, null, null, null)

  it('produces a millimeter-sized standalone SVG document', () => {
    const svg = composeSheetSvg({
      sheet,
      printable: { x: 0, y: 0, width: sheet.width, height: sheet.height },
      backgroundColor: '#ffffff',
      contentMarkup: '<path d="M0 0 L10 10"/>',
      contentTransform: computeContentTransform(
        { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        1,
        { x: 0, y: 0, width: sheet.width, height: sheet.height },
        true
      )
    })
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain(`width="${sheet.width}mm"`)
    expect(svg).toContain(`height="${sheet.height}mm"`)
    expect(svg).toContain('<path d="M0 0 L10 10"/>')
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
  })

  it('embeds viewport compositions as clipped nested SVGs', () => {
    const svg = composeSheetSvg({
      sheet,
      printable: { x: 0, y: 0, width: sheet.width, height: sheet.height },
      contentMarkup: null,
      viewportCompositions: [
        {
          rect: { x: 10, y: 20, width: 30, height: 40 },
          viewBox: { x: -15, y: -20, width: 30, height: 40 },
          twistAngle: 0,
          markup: '<circle r="1"/>'
        }
      ]
    })
    expect(svg).toContain('<svg x="10" y="20" width="30" height="40"')
    expect(svg).toContain('<circle r="1"/>')
    // Nested SVG user space is flipped relative to model space.
    expect(svg).toContain('matrix(1,0,0,-1,0,0)')
    // Model viewBox is emitted in flipped coordinates.
    expect(svg).toContain('"-15 -20 30 40"')
  })

  it('clips the content group to the window rect when provided', () => {
    const svg = composeSheetSvg({
      sheet,
      printable: { x: 0, y: 0, width: sheet.width, height: sheet.height },
      contentMarkup: '<path d="M0 0 L10 10"/>',
      contentTransform: { a: 1, b: 0, c: 0, d: -1, e: 0, f: 100 },
      contentClipRect: { x: 20, y: 30, width: 40, height: 50 }
    })
    // A dedicated window clip path is defined and applied to content.
    expect(svg).toContain('id="ml-plot-window"')
    expect(svg).toContain('clip-path="url(#ml-plot-window)"')
    expect(svg).toContain('x="20" y="30" width="40" height="50"')
  })

  it('omits the window clip when no rect is provided', () => {
    const svg = composeSheetSvg({
      sheet,
      printable: { x: 0, y: 0, width: sheet.width, height: sheet.height },
      contentMarkup: '<path d="M0 0 L10 10"/>',
      contentTransform: { a: 1, b: 0, c: 0, d: -1, e: 0, f: 100 }
    })
    expect(svg).not.toContain('ml-plot-window')
  })

  it('keeps the sheet valid when there is nothing to draw', () => {
    const svg = composeSheetSvg({
      sheet,
      printable: { x: 0, y: 0, width: sheet.width, height: sheet.height }
    })
    expect(svg).toContain('<g/>')
  })
})

describe('toMatrixAttribute', () => {
  it('formats compact matrix attributes', () => {
    expect(
      toMatrixAttribute({ a: 1.5, b: 0, c: 0, d: -1.5, e: 3.25, f: 0 })
    ).toBe('matrix(1.5,0,0,-1.5,3.25,0)')
  })
})

describe('convertColorForPlotStyle', () => {
  it('keeps colors unchanged for asIs', () => {
    expect(convertColorForPlotStyle('#123abc', 'asIs')).toBe('#123abc')
  })

  it('forces black for monochrome including rgb() input', () => {
    expect(convertColorForPlotStyle('#ff0000', 'monochrome')).toBe('#000000')
    expect(convertColorForPlotStyle('rgb(255, 0, 255)', 'monochrome')).toBe(
      '#000000'
    )
  })

  it('desaturates by luminance for grayscale', () => {
    // Pure red: luma = 0.299 * 255 ≈ 76 = 0x4C.
    expect(convertColorForPlotStyle('red', 'grayscale')).toBe('#4c4c4c')
    // White stays white, black stays black.
    expect(convertColorForPlotStyle('#ffffff', 'grayscale')).toBe('#ffffff')
    expect(convertColorForPlotStyle('#000000', 'grayscale')).toBe('#000000')
  })
})
