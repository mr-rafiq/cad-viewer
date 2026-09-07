import {
  AcCmColor,
  AcCmTransparency,
  AcGiHatchPatternLine,
  AcGiLineWeight,
  AcGiSubEntityTraits
} from '@mlightcad/data-model'

import {
  buildHatchPatternSvg,
  isPatternedHatch
} from '../src/AcSvgHatchPattern'
import { AcSvgStyleContext } from '../src/AcSvgStyleUtil'

/** Unit square, counter-clockwise, as `AcGeArea2d.getPoints()` would yield. */
const UNIT_SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
]

function createTraits(
  definitionLines: AcGiHatchPatternLine[],
  overrides: Partial<AcGiSubEntityTraits['fillType']> = {}
): AcGiSubEntityTraits {
  return {
    color: (() => {
      const color = new AcCmColor()
      color.setRGB(0, 0, 255)
      return color
    })(),
    lineType: {
      type: 'ByLayer',
      name: 'Continuous',
      standardFlag: 0,
      description: 'Solid line',
      totalPatternLength: 0
    },
    lineTypeScale: 1,
    lineWeight: AcGiLineWeight.LineWeight013,
    fillType: {
      solidFill: false,
      patternAngle: 0,
      definitionLines,
      ...overrides
    },
    transparency: new AcCmTransparency(),
    thickness: 0,
    layer: '0',
    drawOrder: -1
  }
}

const ctx: AcSvgStyleContext = {
  ltscale: 1,
  celtscale: 1,
  backgroundColor: 0xffffff,
  foregroundColor: 0x000000,
  showLineWeight: true,
  defaultLineWeightMm: 0.25
}

/** Horizontal lines every 2 units, continuous. */
function horizontalLines(
  overrides: Partial<AcGiHatchPatternLine> = {}
): AcGiHatchPatternLine {
  return {
    angle: 0,
    base: { x: 0, y: 0 },
    offset: { x: 0, y: 2 },
    dashLengths: [],
    ...overrides
  }
}

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
  attrs: string
}

function parseSegments(svg: string): Segment[] {
  const pattern =
    /<path d="M(-?[\d.]+),(-?[\d.]+) L(-?[\d.]+),(-?[\d.]+)"([^/]*)\/>/g
  const segments: Segment[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(svg)) !== null) {
    segments.push({
      x1: Number(match[1]),
      y1: Number(match[2]),
      x2: Number(match[3]),
      y2: Number(match[4]),
      attrs: match[5]
    })
  }
  return segments
}

describe('isPatternedHatch', () => {
  it('is false for a solid fill', () => {
    expect(isPatternedHatch(createTraits([]))).toBe(false)
  })

  it('is false for a gradient even when definition lines exist', () => {
    const traits = createTraits([horizontalLines()], {
      gradient: {
        name: 'LINEAR',
        angle: 0,
        shift: 0,
        oneColorMode: false,
        shadeTintValue: 0
      }
    })
    expect(isPatternedHatch(traits)).toBe(false)
  })

  it('is true for definition lines without a gradient', () => {
    expect(isPatternedHatch(createTraits([horizontalLines()]))).toBe(true)
  })
})

describe('buildHatchPatternSvg', () => {
  it('returns null for a solid fill so the caller keeps the filled path', () => {
    expect(
      buildHatchPatternSvg([UNIT_SQUARE], createTraits([]), ctx)
    ).toBeNull()
  })

  it('draws parallel lines at the definition spacing, clipped to the boundary', () => {
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([horizontalLines()]),
      ctx
    )
    const segments = parseSegments(svg!)

    // y = 0, 2, 4, 6 and 8 cross the square's interior. y = 10 lies exactly on
    // the top edge, where the half-open crossing test counts no transition —
    // the standard scanline convention that keeps a shared edge from being
    // hatched twice when two regions meet along it.
    expect(segments.map(s => s.y1)).toEqual([0, 2, 4, 6, 8])
    for (const segment of segments) {
      expect(segment.y1).toBe(segment.y2)
      expect(segment.x1).toBe(0)
      expect(segment.x2).toBe(10)
    }
  })

  it('rotates lines by the definition angle', () => {
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([horizontalLines({ angle: Math.PI / 4 })]),
      ctx
    )
    const segments = parseSegments(svg!)
    expect(segments.length).toBeGreaterThan(2)
    for (const segment of segments) {
      const degrees =
        (Math.round(
          (Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1) * 180) /
            Math.PI
        ) +
          360) %
        180
      expect(degrees).toBe(45)
    }
  })

  it('adds the hatch pattern angle on top of the definition angle', () => {
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([horizontalLines()], { patternAngle: Math.PI / 2 }),
      ctx
    )
    const segments = parseSegments(svg!)
    expect(segments.length).toBeGreaterThan(2)
    for (const segment of segments) {
      // A horizontal definition rotated by 90 degrees runs vertically.
      expect(Math.abs(segment.x2 - segment.x1)).toBeLessThan(1e-6)
      expect(Math.abs(segment.y2 - segment.y1)).toBeGreaterThan(1)
    }
  })

  it('skips the interior of a hole using the even-odd rule', () => {
    // Square with a concentric square hole; lines must break across the hole.
    const hole = [
      { x: 3, y: 3 },
      { x: 7, y: 3 },
      { x: 7, y: 7 },
      { x: 3, y: 7 }
    ]
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE, hole],
      createTraits([horizontalLines()]),
      ctx
    )
    const segments = parseSegments(svg!)

    const atY4 = segments.filter(s => s.y1 === 4)
    expect(atY4).toHaveLength(2)
    expect(atY4[0]).toMatchObject({ x1: 0, x2: 3 })
    expect(atY4[1]).toMatchObject({ x1: 7, x2: 10 })

    // A line clear of the hole stays in one piece.
    expect(segments.filter(s => s.y1 === 0)).toHaveLength(1)
  })

  it('emits the dash pattern as stroke-dasharray with a phased offset', () => {
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([horizontalLines({ dashLengths: [3, -1] })]),
      ctx
    )
    const segments = parseSegments(svg!)
    expect(segments.length).toBeGreaterThan(0)
    for (const segment of segments) {
      expect(segment.attrs).toContain('stroke-dasharray="3 1"')
      expect(segment.attrs).toContain('stroke-dashoffset=')
    }
  })

  it('starts a gap-first pattern with a zero-length dash so SVG keeps the phase', () => {
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([horizontalLines({ dashLengths: [-1, 3] })]),
      ctx
    )
    expect(svg).toContain('stroke-dasharray="0 1 3 0"')
  })

  it('phases the dash pattern by the per-line offset shift', () => {
    // offset.x shifts each successive line along its own direction.
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([
        horizontalLines({ offset: { x: 1, y: 2 }, dashLengths: [3, -1] })
      ]),
      ctx
    )
    const segments = parseSegments(svg!)
    const offsets = segments.map(
      s => /stroke-dashoffset="([-\d.]+)"/.exec(s.attrs)![1]
    )
    // Line k starts its pattern at (0 - k) mod 4, so consecutive lines differ.
    expect(new Set(offsets).size).toBeGreaterThan(1)
  })

  it('carries the resolved stroke colour and lineweight', () => {
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([horizontalLines()]),
      ctx
    )
    expect(svg).toContain('stroke="#0000ff"')
    // The entity lineweight (0.13 mm) wins over the context default.
    expect(svg).toContain('stroke-width="0.13"')
    expect(svg).toContain('fill="none"')
  })

  it('falls back to the solid fill when a definition line is unusable', () => {
    const broken = {
      angle: Number.NaN,
      base: { x: 0, y: 0 },
      offset: { x: 0, y: 2 },
      dashLengths: []
    } as AcGiHatchPatternLine
    expect(
      buildHatchPatternSvg([UNIT_SQUARE], createTraits([broken]), ctx)
    ).toBeNull()
  })

  it('falls back to the solid fill when the pattern has no perpendicular spacing', () => {
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([horizontalLines({ offset: { x: 1, y: 0 } })]),
      ctx
    )
    expect(svg).toBeNull()
  })

  it('falls back to the solid fill when the pattern is too dense to plot', () => {
    // 10 units of boundary at 1e-4 spacing describes 100k lines.
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([horizontalLines({ offset: { x: 0, y: 1e-4 } })]),
      ctx
    )
    expect(svg).toBeNull()
  })

  it('draws every definition line of a cross-hatch', () => {
    const svg = buildHatchPatternSvg(
      [UNIT_SQUARE],
      createTraits([
        horizontalLines({ angle: Math.PI / 4 }),
        horizontalLines({ angle: -Math.PI / 4 })
      ]),
      ctx
    )
    const segments = parseSegments(svg!)
    const angles = new Set(
      segments.map(
        s =>
          (Math.round((Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180) / Math.PI) +
            360) %
          180
      )
    )
    expect(angles).toEqual(new Set([45, 135]))
  })
})
