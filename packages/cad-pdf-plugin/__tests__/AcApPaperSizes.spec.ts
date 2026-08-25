import {
  ACAP_PAPER_SIZES,
  CUSTOM_PAPER_KEY,
  findPaperSize,
  FROM_LAYOUT_PAPER_KEY,
  parseCanonicalMediaName
} from '../src/plot/AcApPaperSizes'
import { resolveSheetSizeMm } from '../src/plot/AcApPlotMath'

describe('AcApPaperSizes', () => {
  describe('findPaperSize', () => {
    it('finds ISO A4 by key', () => {
      const size = findPaperSize('ISO_A4')
      expect(size).not.toBeNull()
      expect(size!.width).toBe(210)
      expect(size!.height).toBe(297)
    })

    it('returns null for unknown keys', () => {
      expect(findPaperSize('NOPE')).toBeNull()
      expect(findPaperSize(undefined)).toBeNull()
    })

    it('catalog stores portrait dimensions', () => {
      for (const size of ACAP_PAPER_SIZES) {
        expect(size.width).toBeLessThan(size.height)
        expect(size.width).toBeGreaterThan(0)
      }
    })
  })

  describe('parseCanonicalMediaName', () => {
    it('parses millimeter media names', () => {
      expect(parseCanonicalMediaName('ISO_A4_(210.00_x_297.00_MM)')).toEqual({
        width: 210,
        height: 297
      })
    })

    it('parses inch media names into millimeters', () => {
      const parsed = parseCanonicalMediaName(
        'ANSI_full_bleed_D_(34.00_x_44.00_Inches)'
      )
      expect(parsed).not.toBeNull()
      expect(parsed!.width).toBeCloseTo(34 * 25.4, 6)
      expect(parsed!.height).toBeCloseTo(44 * 25.4, 6)
    })

    it('returns null for names without sizes', () => {
      expect(parseCanonicalMediaName('UserDefinedMetric')).toBeNull()
      expect(parseCanonicalMediaName(undefined)).toBeNull()
      expect(parseCanonicalMediaName('')).toBeNull()
    })
  })
})

describe('resolveSheetSizeMm', () => {
  it('resolves catalog sizes with orientation swap', () => {
    const portrait = resolveSheetSizeMm(
      { paperSizeKey: 'ISO_A4', orientation: 'portrait' },
      null,
      null,
      null
    )
    expect(portrait).toEqual({ x: 0, y: 0, width: 210, height: 297 })

    const landscape = resolveSheetSizeMm(
      { paperSizeKey: 'ISO_A4', orientation: 'landscape' },
      null,
      null,
      null
    )
    expect(landscape).toEqual({ x: 0, y: 0, width: 297, height: 210 })
  })

  it('resolves custom dimensions', () => {
    const sheet = resolveSheetSizeMm(
      {
        paperSizeKey: CUSTOM_PAPER_KEY,
        customPaperWidth: 500,
        customPaperHeight: 300,
        orientation: 'landscape'
      },
      null,
      null,
      null
    )
    expect(sheet.width).toBe(300)
    expect(sheet.height).toBe(500)
  })

  it('prefers canonical media name for fromLayout', () => {
    const sheet = resolveSheetSizeMm(
      { paperSizeKey: FROM_LAYOUT_PAPER_KEY, orientation: 'portrait' },
      'ISO_A3_(297.00_x_420.00_MM)',
      123,
      456
    )
    expect(sheet.width).toBe(297)
    expect(sheet.height).toBe(420)
  })

  it('falls back to stored plotPaperSize when name does not parse', () => {
    const sheet = resolveSheetSizeMm(
      { paperSizeKey: FROM_LAYOUT_PAPER_KEY, orientation: 'portrait' },
      undefined,
      400,
      600
    )
    expect(sheet.width).toBe(400)
    expect(sheet.height).toBe(600)
  })
})
