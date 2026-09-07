import {
  AcCmColor,
  AcCmTransparency,
  AcGeArea2d,
  AcGePolyline2d,
  AcGiLineWeight,
  AcGiSubEntityTraits
} from '@mlightcad/data-model'

import { AcSvgArea } from '../src/AcSvgArea'
import { AcSvgStyleContext } from '../src/AcSvgStyleUtil'

function createTraits(
  fillType: Partial<AcGiSubEntityTraits['fillType']> = {}
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
      solidFill: true,
      patternAngle: 0,
      definitionLines: [],
      ...fillType
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
  showLineWeight: true
}

/** A 10x10 square area. */
function createSquare(): AcGeArea2d {
  const area = new AcGeArea2d()
  area.add(
    new AcGePolyline2d(
      [
        { x: 0, y: 0, bulge: 0 },
        { x: 10, y: 0, bulge: 0 },
        { x: 10, y: 10, bulge: 0 },
        { x: 0, y: 10, bulge: 0 }
      ],
      true
    )
  )
  return area
}

describe('AcSvgArea', () => {
  it('renders a solid fill as a filled path', () => {
    const svg = new AcSvgArea(createSquare(), createTraits(), ctx).svg
    expect(svg).toContain('fill="#0000ff"')
    expect(svg).toContain('fill-rule="evenodd"')
    expect(svg).toContain('stroke="none"')
  })

  it('renders a patterned hatch as stroked line work, not a filled path', () => {
    // Regression: hatch pattern definition lines were ignored on export, so
    // every patterned hatch plotted as a solid block of colour.
    const traits = createTraits({
      solidFill: false,
      definitionLines: [
        {
          angle: Math.PI / 4,
          base: { x: 0, y: 0 },
          offset: { x: 0, y: 2 },
          dashLengths: []
        }
      ]
    })
    const svg = new AcSvgArea(createSquare(), traits, ctx).svg

    expect(svg).toContain('stroke="#0000ff"')
    expect(svg).toContain('fill="none"')
    expect(svg).not.toContain('fill="#0000ff"')
    expect(svg.match(/<path/g)?.length ?? 0).toBeGreaterThan(1)
  })
})
