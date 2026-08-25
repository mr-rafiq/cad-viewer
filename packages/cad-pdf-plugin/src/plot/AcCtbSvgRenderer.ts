import type {
  AcGeArea2d,
  AcGeCircArc3d,
  AcGeEllipseArc3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGiLineWeight,
  AcGiMTextData,
  AcGiPointStyle,
  AcGiShapeData,
  AcGiSubEntityTraits,
  AcGiTextStyle
} from '@mlightcad/data-model'
import {
  AcCmColor,
  AcCmColorUtil
} from '@mlightcad/data-model'
import { AcSvgRenderer } from '@mlightcad/cad-svg-plugin'

import {
  applyScreening,
  toGrayscale,
  type AcApCtbEntry,
  type AcApCtbTable
} from './AcApCtb'

/**
 * Standard AutoCAD lineweights in hundredths of a millimeter, mirroring
 * {@link AcGiLineWeight}. CTB lineweights are snapped to the nearest entry.
 */
const LINEWEIGHT_STEPS = [
  0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 45, 50, 53, 60, 65, 70, 80, 90, 100,
  106, 120, 140, 158, 200, 211
]

/**
 * An {@link AcSvgRenderer} that applies a CTB plot style table at draw
 * time: entity colors are resolved through the table (output color,
 * screening, grayscale) and lineweights are overridden per the table
 * entry, mirroring AutoCAD's "Plot with plot styles" behavior.
 *
 * Entities snapshot their traits when the draw call happens, so mutating
 * `subEntityTraits` immediately before delegating each primitive call is
 * sufficient — no post-processing of the generated SVG is needed.
 */
export class AcCtbSvgRenderer extends AcSvgRenderer {
  private readonly ctb: AcApCtbTable

  constructor(ctb: AcApCtbTable) {
    super()
    this.ctb = ctb
  }

  /**
   * Applies the CTB entry for the current trait color to the traits
   * object, right before a primitive is emitted.
   */
  private applyCtbToTraits(): void {
    const traits: AcGiSubEntityTraits = this.subEntityTraits
    const aci = this.resolveAci(traits.color)
    const entry = aci != null ? this.ctb.getStyle(aci) : undefined
    if (!entry) {
      return
    }
    this.applyEntryColor(traits, entry, aci)
    this.applyEntryLineweight(traits, entry)
  }

  /**
   * Resolves the ACI index for CTB lookup from the trait color.
   *
   * ACI colors use their index directly; true-color objects are mapped to
   * the nearest AutoCAD palette index (matching AutoCAD's behavior for
   * color-dependent plot styles). ByLayer/ByBlock colors that were not
   * resolved upstream fall back to ACI 7.
   */
  private resolveAci(color: AcCmColor): number | undefined {
    if (color.isByACI) {
      const index = color.colorIndex
      return index != null && index >= 1 && index <= 255 ? index : 7
    }
    if (color.isByLayer || color.isByBlock) {
      return 7
    }
    const rgb = color.RGB
    if (rgb != null) {
      const index = AcCmColorUtil.getIndexByColor(rgb)
      if (index != null && index >= 1 && index <= 255) {
        return index
      }
    }
    return 7
  }

  /**
   * Writes the CTB output color (with screening and grayscale applied)
   * into the traits.
   */
  private applyEntryColor(
    traits: AcGiSubEntityTraits,
    entry: AcApCtbEntry,
    aci: number | undefined
  ): void {
    let rgb: { r: number; g: number; b: number } | null = null

    if (entry.color.kind === 'rgb') {
      rgb = { r: entry.color.r, g: entry.color.g, b: entry.color.b }
    } else if (entry.color.kind === 'aci') {
      const value = AcCmColorUtil.getColorByIndex(entry.color.index)
      if (value != null) {
        rgb = {
          r: (value >>> 16) & 0xff,
          g: (value >>> 8) & 0xff,
          b: value & 0xff
        }
      }
    } else if (entry.grayscale || entry.screen < 100) {
      // Object color with screening/grayscale: resolve the trait color to
      // RGB so the effect can be applied.
      const resolved =
        aci != null ? AcCmColorUtil.getColorByIndex(aci) : undefined
      if (resolved != null) {
        rgb = {
          r: (resolved >>> 16) & 0xff,
          g: (resolved >>> 8) & 0xff,
          b: resolved & 0xff
        }
      }
    }

    if (!rgb) {
      return
    }
    if (entry.grayscale) {
      rgb = toGrayscale(rgb)
    }
    if (entry.screen < 100) {
      rgb = applyScreening(rgb, entry.screen)
    }
    // Entities snapshot traits at draw time; hand each primitive its own
    // color instance so later mutations cannot leak between entities.
    const color = new AcCmColor()
    color.setRGB(rgb.r, rgb.g, rgb.b)
    traits.color = color
  }

  /**
   * Overrides the trait lineweight with the CTB lineweight (in hundredths
   * of a millimeter, snapped to the nearest standard value). Only applied
   * when lineweight display is enabled, mirroring LWDISPLAY behavior.
   */
  private applyEntryLineweight(
    traits: AcGiSubEntityTraits,
    entry: AcApCtbEntry
  ): void {
    if (entry.lineweightMm == null || !this.showLineWeight) {
      return
    }
    const hundredths = entry.lineweightMm * 100
    const snapped = LINEWEIGHT_STEPS.reduce((best, step) =>
      Math.abs(step - hundredths) < Math.abs(best - hundredths) ? step : best
    )
    traits.lineWeight = snapped as AcGiLineWeight
  }

  /**
   * @inheritdoc
   */
  override lines(points: AcGePoint3dLike[]) {
    this.applyCtbToTraits()
    return super.lines(points)
  }

  /**
   * @inheritdoc
   */
  override lineSegments(
    array: Float32Array,
    itemSize: number,
    indices: Uint16Array
  ) {
    this.applyCtbToTraits()
    return super.lineSegments(array, itemSize, indices)
  }

  /**
   * @inheritdoc
   */
  override circularArc(arc: AcGeCircArc3d) {
    this.applyCtbToTraits()
    return super.circularArc(arc)
  }

  /**
   * @inheritdoc
   */
  override ellipticalArc(ellipseArc: AcGeEllipseArc3d) {
    this.applyCtbToTraits()
    return super.ellipticalArc(ellipseArc)
  }

  /**
   * @inheritdoc
   */
  override area(area: AcGeArea2d) {
    this.applyCtbToTraits()
    return super.area(area)
  }

  /**
   * @inheritdoc
   */
  override point(point: AcGePoint3d, style: AcGiPointStyle) {
    this.applyCtbToTraits()
    return super.point(point, style)
  }

  /**
   * @inheritdoc
   */
  override mtext(
    mtext: AcGiMTextData,
    style: AcGiTextStyle,
    delay?: boolean
  ) {
    this.applyCtbToTraits()
    return super.mtext(mtext, style, delay)
  }

  /**
   * @inheritdoc
   */
  override shape(
    shape: AcGiShapeData,
    style: AcGiTextStyle,
    delay?: boolean
  ) {
    this.applyCtbToTraits()
    return super.shape(shape, style, delay)
  }
}
