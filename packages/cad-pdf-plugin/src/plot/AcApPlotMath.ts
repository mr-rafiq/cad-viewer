/**
 * Pure plot math: paper size resolution, scale factor computation, and
 * drawing-space → sheet-space transform derivation.
 *
 * Everything in this module is side-effect free so it can be unit tested
 * and reused by both the convertor and the dialog preview.
 */

import {
  type AcApPaperSize,
  CUSTOM_PAPER_KEY,
  findPaperSize,
  FROM_LAYOUT_PAPER_KEY,
  parseCanonicalMediaName
} from './AcApPaperSizes'
import type { AcApPlotOptions } from './AcApPlotOptions'

/** A simple axis-aligned rectangle in millimeters or drawing units. */
export interface PlotRect {
  x: number
  y: number
  width: number
  height: number
}

/** Content bounds expressed as min/max corners (drawing units). */
export interface ContentBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * SVG `matrix(a,b,c,d,e,f)` parameters mapping drawing space (Y up) onto
 * sheet space (Y down, origin top-left, millimeters).
 */
export interface PlotTransform {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

/**
 * Rescales `stroke-width` attributes from millimeters into the coordinate
 * system of the group the markup is placed in.
 *
 * {@link AcSvgStyleUtil} emits lineweights as physical millimeters, but plot
 * markup is drawn in drawing units inside a group that scales those units
 * onto the sheet, so every stroke would otherwise be multiplied by that
 * scale. The sheet scale is only known after the render pass has produced a
 * bounding box, hence the rescale happens here rather than at draw time.
 *
 * Block references wrap their geometry in a scaled `<g transform="matrix(…)">`,
 * and SVG multiplies `stroke-width` by *every* enclosing transform. Without
 * compensation a 0.25 mm lineweight inside a block inserted at scale 3 plots
 * at 0.75 mm. AutoCAD lineweights are scale-invariant, so this walk tracks
 * the cumulative scale of the nested groups each stroke sits in and divides
 * it out as well.
 *
 * @param markup - Element markup in drawing coordinates
 * @param mmPerUnit - Sheet millimeters per drawing unit (the plot scale)
 * @returns The markup with stroke widths expressed in drawing units
 */
export function scaleStrokeWidths(markup: string, mmPerUnit: number): string {
  if (!markup || !Number.isFinite(mmPerUnit) || mmPerUnit <= 0) {
    return markup
  }
  const token = /<g\b[^>]*>|<\/g>|stroke-width="([0-9.eE+-]+)"/g
  const groupScales: number[] = []
  let cumulative = mmPerUnit
  let out = ''
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = token.exec(markup)) !== null) {
    out += markup.slice(cursor, match.index)
    cursor = match.index + match[0].length
    const text = match[0]
    if (text === '</g>') {
      cumulative /= groupScales.pop() ?? 1
      out += text
    } else if (text[1] === 'g') {
      const scale = text.endsWith('/>') ? null : groupTransformScale(text)
      if (scale != null) {
        groupScales.push(scale)
        cumulative *= scale
      }
      out += text
    } else {
      const widthMm = Number(match[1])
      out +=
        Number.isFinite(widthMm) && cumulative > 0
          ? `stroke-width="${Math.round((widthMm / cumulative) * 1e6) / 1e6}"`
          : text
    }
  }
  return out + markup.slice(cursor)
}

/**
 * Uniform scale factor of a `<g transform="matrix(a,b,c,d,…)">` opening tag,
 * taken as `sqrt(|ad - bc|)` (the area scale) so pure rotations and
 * translations resolve to 1. Returns 1 when no matrix transform is present.
 */
function groupTransformScale(openingTag: string): number {
  const m =
    /transform="[^"]*\bmatrix\(\s*([-0-9.eE]+)[\s,]+([-0-9.eE]+)[\s,]+([-0-9.eE]+)[\s,]+([-0-9.eE]+)/.exec(
      openingTag
    )
  if (!m) {
    return 1
  }
  const a = Number(m[1])
  const b = Number(m[2])
  const c = Number(m[3])
  const d = Number(m[4])
  const scale = Math.sqrt(Math.abs(a * d - b * c))
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/**
 * Resolves the sheet dimensions in millimeters for the given options.
 *
 * Landscape orientation swaps the portrait media dimensions. When the key
 * is `fromLayout`, stored page setup values take precedence in order:
 * canonical media name, then explicit `plotPaperSize`. Falls back to
 * `fallback` when nothing resolves.
 *
 * @param options - Plot options holding paper selection and orientation
 * @param canonicalMediaName - Layout's canonical media name when available
 * @param layoutPaperWidth - Layout's stored paper width in millimeters
 * @param layoutPaperHeight - Layout's stored paper height in millimeters
 * @param fallback - Dimensions used when nothing else resolves
 * @returns Sheet width/height in millimeters after orientation
 */
export function resolveSheetSizeMm(
  options: Pick<AcApPlotOptions, 'paperSizeKey' | 'orientation'> & {
    customPaperWidth?: number
    customPaperHeight?: number
  },
  canonicalMediaName?: string | null,
  layoutPaperWidth?: number | null,
  layoutPaperHeight?: number | null,
  fallback?: AcApPaperSize
): PlotRect {
  let width = 0
  let height = 0

  if (options.paperSizeKey === CUSTOM_PAPER_KEY) {
    width = options.customPaperWidth ?? 0
    height = options.customPaperHeight ?? 0
  } else if (options.paperSizeKey === FROM_LAYOUT_PAPER_KEY) {
    const parsed = parseCanonicalMediaName(canonicalMediaName)
    if (parsed) {
      width = parsed.width
      height = parsed.height
    } else if (
      layoutPaperWidth &&
      layoutPaperHeight &&
      layoutPaperWidth > 0 &&
      layoutPaperHeight > 0
    ) {
      width = layoutPaperWidth
      height = layoutPaperHeight
    }
  } else {
    const size = findPaperSize(options.paperSizeKey)
    if (size) {
      width = size.width
      height = size.height
    }
  }

  if ((!width || !height) && fallback) {
    width = fallback.width
    height = fallback.height
  }
  if (!width || !height) {
    const isoA4 = findPaperSize('ISO_A4')!
    width = isoA4.width
    height = isoA4.height
  }

  if (options.orientation === 'landscape') {
    return { x: 0, y: 0, width: height, height: width }
  }
  return { x: 0, y: 0, width, height }
}

/**
 * Computes the plot scale factor in millimeters per drawing unit.
 *
 * - `fit`: largest factor such that the content fits inside the printable
 *   area (`null` when content is empty).
 * - `custom`: numerator / denominator (AutoCAD semantics where the ratio
 *   expresses paper units : drawing units); falls back to fit when the
 *   ratio is not positive/finite.
 *
 * @param content - Content bounding box in drawing units
 * @param printable - Printable area rect on the sheet in millimeters
 * @param options - Scale settings from the plot options
 * @returns Millimeters per drawing unit, or `null` when unresolvable
 */
export function computeScaleFactor(
  content: ContentBox,
  printable: PlotRect,
  options: Pick<
    AcApPlotOptions,
    'scaleMode' | 'scaleNumerator' | 'scaleDenominator'
  >
): number | null {
  const contentW = content.maxX - content.minX
  const contentH = content.maxY - content.minY

  if (options.scaleMode === 'custom') {
    const ratio = options.scaleNumerator / options.scaleDenominator
    if (Number.isFinite(ratio) && ratio > 0 && contentW > 0 && contentH > 0) {
      // Guard against pathological ratios producing infinite sheets: clamp
      // so plotted content never exceeds 100 sheets wide/tall.
      const maxFactor = Math.min(
        (printable.width * 100) / contentW,
        (printable.height * 100) / contentH
      )
      return Math.min(ratio, maxFactor)
    }
  }

  if (contentW <= 0 || contentH <= 0) return null
  return Math.min(printable.width / contentW, printable.height / contentH)
}

/**
 * Builds the SVG matrix mapping drawing coordinates onto sheet coordinates.
 *
 * The transform flips Y (drawing space is Y-up; the sheet is Y-down),
 * scales by `factor`, and positions the content according to
 * `centerPlot`:
 * - centered: content center lands at the printable area center;
 * - not centered: content top-left lands at the printable area origin.
 *
 * An optional plot offset shifts the positioned content on the sheet
 * (AutoCAD "Plot offset"): `offsetX` moves it right, `offsetY` moves it up.
 * The sheet is Y-down, so a positive `offsetY` subtracts from the vertical
 * translation.
 *
 * @param content - Content bounding box in drawing units
 * @param factor - Scale factor in millimeters per drawing unit
 * @param printable - Printable area rect on the sheet in millimeters
 * @param centerPlot - Whether to center content inside the printable area
 * @param offsetX - Horizontal plot offset in millimeters (default 0)
 * @param offsetY - Vertical plot offset in millimeters, positive = up (default 0)
 * @returns SVG matrix parameters
 */
export function computeContentTransform(
  content: ContentBox,
  factor: number,
  printable: PlotRect,
  centerPlot: boolean,
  offsetX = 0,
  offsetY = 0
): PlotTransform {
  const cx = (content.minX + content.maxX) / 2
  const cy = (content.minY + content.maxY) / 2
  let e: number
  let f: number
  if (centerPlot) {
    e = printable.x + printable.width / 2 - factor * cx
    f = printable.y + printable.height / 2 + factor * cy
  } else {
    // Content bottom-left corner lands at the printable area bottom-left.
    // Y is flipped, so drawing maxY maps to the printable area's top edge:
    //   -factor * maxY + f = printable.y
    f = printable.y + factor * content.maxY
    e = printable.x - factor * content.minX
  }
  const dx = Number.isFinite(offsetX) ? offsetX : 0
  const dy = Number.isFinite(offsetY) ? offsetY : 0
  return { a: factor, b: 0, c: 0, d: -factor, e: e + dx, f: f - dy }
}

/**
 * Computes the printable area of a sheet after applying margins.
 *
 * @param sheet - Full sheet rect in millimeters
 * @param marginMm - Unprintable margin on every edge in millimeters
 * @returns Printable area clamped to non-negative extents
 */
export function computePrintableArea(
  sheet: PlotRect,
  marginMm: number
): PlotRect {
  const margin = Number.isFinite(marginMm) ? Math.max(0, marginMm) : 0
  return {
    x: sheet.x + margin,
    y: sheet.y + margin,
    width: Math.max(0, sheet.width - margin * 2),
    height: Math.max(0, sheet.height - margin * 2)
  }
}
