import {
  AcGiContext,
  AcGiLineTypePatternElement,
  AcGiLineWeight,
  AcGiSubEntityTraits
} from '@mlightcad/data-model'

/** Runtime style options passed from {@link AcSvgRenderer}. */
export interface AcSvgStyleContext {
  ltscale: number
  celtscale: number
  /** Canvas / export background (24-bit RGB). Used for ACI 7 solid hatches. */
  backgroundColor: number
  /** Resolved foreground colour for ACI 7 linework (24-bit RGB). */
  foregroundColor: number
  /** Mirrors LWDISPLAY: when false, lineweights are not rendered. */
  showLineWeight: boolean
  /**
   * When explicitly `false`, entity transparency is dropped and geometry is
   * drawn fully opaque (AutoCAD "Plot transparency" off). Defaults to on.
   */
  plotTransparency?: boolean
  /**
   * Resolves a layer's lineweight for entities that carry `ByLayer` (the
   * overwhelming majority — `AcDbEntity.lineWeight` does not resolve it).
   * Without this, ByLayer geometry gets no width at all and falls back to
   * the SVG default of one user unit.
   */
  resolveLayerLineWeight?: (layerName: string) => AcGiLineWeight | undefined
  /**
   * Fallback stroke width in millimeters when neither the entity nor its
   * layer names a lineweight, mirroring AutoCAD's LWDEFAULT. Left unset on
   * screen exports, where an unresolved lineweight emits no width.
   */
  defaultLineWeightMm?: number
}

export type AcSvgPrimitiveKind = 'line' | 'fill' | 'text' | 'point'

/**
 * Thinnest stroke width in millimeters, used for lineweight 0. AutoCAD
 * plots 0.00 mm as the thinnest line the device can draw; 0.05 mm is a
 * conventional hairline that stays visible in a PDF.
 */
const MIN_STROKE_WIDTH_MM = 0.05

/**
 * Valid AutoCAD lineweights in hundredths of a millimeter.
 *
 * Anything outside this set is not a real lineweight: negative values are
 * the ByLayer / ByBlock / Default sentinels, and `AcDbLayerTableRecord`
 * leaves `lineWeight` at 1 when a DXF layer omits group code 370. Treating
 * that placeholder as a 0.01 mm pen plotted whole drawings as invisible
 * hairlines, so unrecognised values fall through to the default instead.
 */
const LINE_WEIGHT_STEPS: ReadonlySet<number> = new Set([
  0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106,
  120, 140, 158, 200, 211
])

/**
 * Converts entity traits and export context into SVG presentation attributes.
 */
export class AcSvgStyleUtil {
  static rgbToHex(rgb: number): string {
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = rgb & 0xff
    return `#${r.toString(16).padStart(2, '0')}${g
      .toString(16)
      .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  static resolveRgb(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext,
    kind: AcSvgPrimitiveKind
  ): number {
    if (
      kind === 'fill' &&
      traits.color.isForeground &&
      this.isSolidBackgroundHatch(traits)
    ) {
      return ctx.backgroundColor
    }
    return AcGiContext.fromBackgroundColor(
      ctx.backgroundColor
    ).resolveSubEntityTraitsRgb(traits)
  }

  static strokeAttributes(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ): Record<string, string> {
    const color = this.rgbToHex(this.resolveRgb(traits, ctx, 'line'))
    const attrs: Record<string, string> = {
      stroke: color,
      fill: 'none'
    }

    if (!ctx.showLineWeight) {
      // LWDISPLAY=0: 1 device-pixel hairlines (matches three-renderer LineBasicMaterial).
      attrs['stroke-width'] = '1'
      attrs['vector-effect'] = 'non-scaling-stroke'
    } else {
      const width = this.resolveStrokeWidth(traits, ctx)
      if (width != null) {
        attrs['stroke-width'] = String(width)
      }
    }

    const opacity = this.resolveOpacity(traits, ctx)
    if (opacity != null && opacity < 1) {
      attrs['stroke-opacity'] = String(opacity)
    }

    const dasharray = this.strokeDasharray(traits, ctx)
    if (dasharray) {
      attrs['stroke-dasharray'] = dasharray
    }

    return attrs
  }

  /**
   * Stroke attributes for hatch pattern lines.
   *
   * Colour, width, and opacity resolve exactly as for ordinary linework, but
   * the entity's linetype dash pattern is dropped: a patterned hatch supplies
   * its own `stroke-dasharray`, and the two would otherwise fight.
   */
  static patternStrokeAttributes(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ): Record<string, string> {
    const attrs = this.strokeAttributes(traits, ctx)
    delete attrs['stroke-dasharray']
    return attrs
  }

  static fillAttributes(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ): Record<string, string> {
    const color = this.rgbToHex(this.resolveRgb(traits, ctx, 'fill'))
    const attrs: Record<string, string> = {
      fill: color,
      stroke: 'none'
    }

    const opacity = this.resolveOpacity(traits, ctx)
    if (opacity != null && opacity < 1) {
      attrs['fill-opacity'] = String(opacity)
    }

    return attrs
  }

  static textAttributes(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ): Record<string, string> {
    const color = this.rgbToHex(this.resolveRgb(traits, ctx, 'text'))
    const attrs: Record<string, string> = {
      fill: color,
      stroke: 'none'
    }

    const opacity = this.resolveOpacity(traits, ctx)
    if (opacity != null && opacity < 1) {
      attrs['fill-opacity'] = String(opacity)
    }

    return attrs
  }

  static pointAttributes(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ): Record<string, string> {
    return this.textAttributes(traits, ctx)
  }

  static formatAttributes(attrs: Record<string, string>): string {
    return Object.entries(attrs)
      .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
      .join(' ')
  }

  static tag(
    name: string,
    attrs: Record<string, string>,
    inner?: string
  ): string {
    const attrStr = this.formatAttributes(attrs)
    if (inner == null) {
      return `<${name} ${attrStr}/>`
    }
    return `<${name} ${attrStr}>${inner}</${name}>`
  }

  private static isSolidBackgroundHatch(traits: AcGiSubEntityTraits): boolean {
    if ((traits.drawOrder ?? 0) >= 0) {
      return false
    }
    const style = traits.fillType
    if (style.gradient) {
      return false
    }
    return !style.definitionLines || style.definitionLines.length === 0
  }

  /**
   * Resolves an entity's plotted stroke width.
   *
   * AutoCAD resolves a lineweight as entity -> layer -> LWDEFAULT. Negative
   * values are the `ByLayer` / `ByBlock` / `Default` sentinels, not widths,
   * so they are looked up rather than used directly.
   *
   * @returns Width in millimeters, or `null` when nothing resolves and no
   *   default was supplied. Consumers that place the markup inside a scaling
   *   group must rescale it (see `scaleStrokeWidths` in the plot engine).
   */
  private static resolveStrokeWidth(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ): number | null {
    // AutoCAD lineweights are in hundredths of a millimeter.
    if (LINE_WEIGHT_STEPS.has(traits.lineWeight)) {
      return Math.max(MIN_STROKE_WIDTH_MM, traits.lineWeight / 100)
    }
    const layerWeight = ctx.resolveLayerLineWeight?.(traits.layer)
    if (layerWeight != null && LINE_WEIGHT_STEPS.has(layerWeight)) {
      return Math.max(MIN_STROKE_WIDTH_MM, layerWeight / 100)
    }
    if (ctx.defaultLineWeightMm == null) {
      return null
    }
    return Math.max(MIN_STROKE_WIDTH_MM, ctx.defaultLineWeightMm)
  }

  private static resolveOpacity(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ): number | null {
    if (ctx.plotTransparency === false) {
      return null
    }
    const transparency = traits.transparency
    // Only an explicit ByAlpha value carries a meaningful alpha. For
    // ByLayer / ByBlock the alpha field holds the raw low byte of DXF group
    // code 440 (0 for the ByLayer encoding 0x01000000), which would erase
    // the geometry; those entities plot opaque instead.
    if (!transparency || !transparency.isByAlpha) {
      return null
    }
    const alpha = transparency.alpha
    if (alpha == null || Number.isNaN(alpha)) {
      return null
    }
    // AcCmTransparency alpha is 0-255 (0 = clear, 255 = opaque); SVG
    // opacity is 0-1.
    return Math.min(1, Math.max(0, alpha / 255))
  }

  private static strokeDasharray(
    traits: AcGiSubEntityTraits,
    ctx: AcSvgStyleContext
  ): string | undefined {
    const pattern = traits.lineType.pattern
    if (!pattern || pattern.length === 0) {
      return undefined
    }

    const scale = ctx.ltscale * ctx.celtscale * traits.lineTypeScale
    const segments = this.patternToDashSegments(pattern, scale)
    if (segments.length === 0) {
      return undefined
    }
    return segments.join(' ')
  }

  private static patternToDashSegments(
    pattern: AcGiLineTypePatternElement[],
    scale: number
  ): number[] {
    const segments: number[] = []

    for (const element of pattern) {
      let len = element.elementLength
      if (len < 0 && element.elementTypeFlag !== 0) {
        len = Math.abs(len)
      }
      len *= scale
      if (len === 0) {
        len = 0.5 * scale
      }
      segments.push(Math.abs(len))
    }

    return segments
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}
