import {
  AcCmColor,
  AcCmTransparency,
  AcGiLineWeight,
  AcGiSubEntityTraits
} from '@mlightcad/data-model'

import { AcSvgStyleContext, AcSvgStyleUtil } from '../src/AcSvgStyleUtil'

function createTraits(
  overrides: Partial<AcGiSubEntityTraits> = {}
): AcGiSubEntityTraits {
  return {
    color: (() => {
      const c = new AcCmColor()
      c.setRGB(255, 0, 0)
      return c
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
      definitionLines: []
    },
    transparency: new AcCmTransparency(),
    thickness: 0,
    layer: '0',
    drawOrder: 0,
    ...overrides
  }
}

const ctx: AcSvgStyleContext = {
  ltscale: 1,
  celtscale: 2,
  backgroundColor: 0xffffff,
  foregroundColor: 0x000000,
  showLineWeight: false
}

describe('AcSvgStyleUtil', () => {
  it('converts rgb to hex', () => {
    expect(AcSvgStyleUtil.rgbToHex(0xff8040)).toBe('#ff8040')
  })

  it('keeps ByLayer transparency opaque', () => {
    // DXF group code 440 for ByLayer is 0x01000000: the alpha byte is 0,
    // which used to be emitted verbatim as opacity and erased the entity.
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({
        transparency: AcCmTransparency.deserialize(0x01000000)
      }),
      ctx
    )
    expect(attrs['stroke-opacity']).toBeUndefined()
  })

  it('scales a ByAlpha value from 0-255 onto SVG opacity', () => {
    const transparency = new AcCmTransparency()
    transparency.percentage = 50
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({ transparency }),
      ctx
    )
    expect(Number(attrs['stroke-opacity'])).toBeCloseTo(0.5, 2)
  })

  it('drops transparency when plot transparency is off', () => {
    const transparency = new AcCmTransparency()
    transparency.percentage = 50
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({ transparency }),
      { ...ctx, plotTransparency: false }
    )
    expect(attrs['stroke-opacity']).toBeUndefined()
  })

  it('applies entity stroke colour from traits', () => {
    const attrs = AcSvgStyleUtil.strokeAttributes(createTraits(), ctx)
    expect(attrs.stroke).toBe('#ff0000')
    expect(attrs.fill).toBe('none')
  })

  it('uses foreground colour for ACI 7 linework', () => {
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({
        color: new AcCmColor().setForeground()
      }),
      ctx
    )
    expect(attrs.stroke).toBe('#000000')
  })

  it('uses background colour for ACI 7 solid hatch fills', () => {
    const attrs = AcSvgStyleUtil.fillAttributes(
      createTraits({
        color: new AcCmColor().setForeground(),
        drawOrder: -1,
        fillType: {
          solidFill: true,
          patternAngle: 0,
          definitionLines: []
        }
      }),
      ctx
    )
    expect(attrs.fill).toBe('#ffffff')
  })

  it('uses non-scaling hairline when showLineWeight is false', () => {
    const attrs = AcSvgStyleUtil.strokeAttributes(createTraits(), ctx)
    expect(attrs['stroke-width']).toBe('1')
    expect(attrs['vector-effect']).toBe('non-scaling-stroke')
  })

  it('applies stroke-width when showLineWeight is true', () => {
    const attrs = AcSvgStyleUtil.strokeAttributes(createTraits(), {
      ...ctx,
      showLineWeight: true
    })
    expect(attrs['stroke-width']).toBe('0.13')
    expect(attrs['vector-effect']).toBeUndefined()
  })

  it('resolves a ByLayer lineweight from the layer', () => {
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({ lineWeight: AcGiLineWeight.ByLayer, layer: 'Frame' }),
      {
        ...ctx,
        showLineWeight: true,
        resolveLayerLineWeight: name =>
          name === 'Frame' ? AcGiLineWeight.LineWeight050 : undefined
      }
    )
    expect(attrs['stroke-width']).toBe('0.5')
  })

  it('falls back to the default lineweight when nothing resolves', () => {
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({ lineWeight: AcGiLineWeight.ByLayer }),
      { ...ctx, showLineWeight: true, defaultLineWeightMm: 0.25 }
    )
    expect(attrs['stroke-width']).toBe('0.25')
  })

  it('never leaves an unresolved lineweight to the SVG default width', () => {
    // Without a default the attribute is omitted, which on a millimeter
    // sheet would inherit a one-unit (1 mm) stroke.
    const withDefault = AcSvgStyleUtil.strokeAttributes(
      createTraits({ lineWeight: AcGiLineWeight.ByBlock }),
      { ...ctx, showLineWeight: true, defaultLineWeightMm: 0.25 }
    )
    expect(Number(withDefault['stroke-width'])).toBeLessThan(1)
  })

  it('plots lineweight 0 as the thinnest available hairline', () => {
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({ lineWeight: AcGiLineWeight.LineWeight000 }),
      { ...ctx, showLineWeight: true, defaultLineWeightMm: 0.25 }
    )
    expect(attrs['stroke-width']).toBe('0.05')
  })

  it('ignores a layer lineweight that is not a real AutoCAD step', () => {
    // AcDbLayerTableRecord leaves lineWeight at 1 when the DXF layer omits
    // group code 370; reading that as 0.01 mm plotted invisible hairlines.
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({ lineWeight: AcGiLineWeight.ByLayer, layer: 'PLATE' }),
      {
        ...ctx,
        showLineWeight: true,
        resolveLayerLineWeight: () => 1 as AcGiLineWeight,
        defaultLineWeightMm: 0.25
      }
    )
    expect(attrs['stroke-width']).toBe('0.25')
  })

  it('builds stroke-dasharray from linetype pattern', () => {
    const attrs = AcSvgStyleUtil.strokeAttributes(
      createTraits({
        lineType: {
          type: 'ByLayer',
          name: 'Dashed',
          standardFlag: 0,
          description: 'Dash',
          totalPatternLength: 10,
          pattern: [
            { elementLength: 5, elementTypeFlag: 0 },
            { elementLength: -3, elementTypeFlag: 0 }
          ]
        }
      }),
      ctx
    )
    expect(attrs['stroke-dasharray']).toBe('10 6')
  })

  it('renders path tags with attributes', () => {
    const tag = AcSvgStyleUtil.tag('path', { d: 'M0,0 L1,1', stroke: '#000' })
    expect(tag).toContain('d="M0,0 L1,1"')
    expect(tag).toContain('stroke="#000"')
  })
})
