import { AcGeArea2d, AcGiSubEntityTraits } from '@mlightcad/data-model'

import { AcSvgEntity } from './AcSvgEntity'
import { buildHatchPatternSvg } from './AcSvgHatchPattern'
import { AcSvgStyleContext, AcSvgStyleUtil } from './AcSvgStyleUtil'

/** Segments per arc when approximating curves in area loops. */
const ARC_SEGMENTS = 32

/**
 * SVG area entity: renders an `AcGeArea2d` as a filled `<path>` element.
 * Uses even-odd fill rule so inner loops (holes) render as transparent cutouts.
 *
 * A hatch whose traits carry pattern definition lines is drawn as that line
 * pattern instead; only solid and gradient fills become a filled path.
 */
export class AcSvgArea extends AcSvgEntity {
  constructor(
    area: AcGeArea2d,
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ) {
    super()
    const loopPointArrays = area.getPoints(ARC_SEGMENTS)
    let d = ''

    for (const loop of loopPointArrays) {
      if (loop.length === 0) continue
      const [first, ...rest] = loop
      d += `M${first.x},${first.y}`
      for (const pt of rest) {
        d += ` L${pt.x},${pt.y}`
      }
      d += ' Z'
      for (const pt of loop) {
        this._box.expandByPoint(pt)
      }
    }

    if (!d) return

    // Patterned hatches plot as line work. Anything else — solid fills,
    // gradients, and patterns too dense or malformed to draw — keeps the
    // filled path.
    const pattern = buildHatchPatternSvg(loopPointArrays, traits, ctx)
    if (pattern) {
      this.svg = pattern
      return
    }

    const attrs = {
      d,
      'fill-rule': 'evenodd',
      ...AcSvgStyleUtil.fillAttributes(traits, ctx)
    }
    this.svg = AcSvgStyleUtil.tag('path', attrs)
  }
}
