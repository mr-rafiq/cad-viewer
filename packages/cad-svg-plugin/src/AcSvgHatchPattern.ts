import {
  AcGiHatchPatternLine,
  AcGiSubEntityTraits
} from '@mlightcad/data-model'

import { AcSvgStyleContext, AcSvgStyleUtil } from './AcSvgStyleUtil'

/** Minimal 2D point, matching what `AcGeArea2d.getPoints()` yields. */
interface AcSvgPoint2d {
  x: number
  y: number
}

/** One boundary loop, flattened to a polyline. */
export type AcSvgHatchLoop = readonly AcSvgPoint2d[]

/** Tolerance for degenerate spacings, spans, and pattern lengths. */
const EPSILON = 1e-9

/**
 * Upper bound on pattern lines emitted for a single hatch area.
 *
 * A fine pattern over a large boundary can describe millions of lines, which
 * no plot would resolve and no PDF should carry. Past this budget the hatch
 * falls back to the solid fill, the same output produced before patterns were
 * supported at all.
 */
const MAX_PATTERN_LINES = 20000

/**
 * Length substituted for a zero-length dash, as a fraction of the pattern's
 * total length. Mirrors `AcTrFillMaterialManager`, which cannot draw a true
 * dot either and emits a short dash instead.
 */
const RATIO_FOR_DOT_PATTERN = 0.05
const RATIO_FOR_NONDOT_PATTERN = 0.005

/** Rounds coordinates so dense hatches do not bloat the document. */
function fmt(value: number): string {
  return String(Math.round(value * 1e4) / 1e4)
}

function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function isFinitePoint(point: unknown): point is AcSvgPoint2d {
  const candidate = point as AcSvgPoint2d | null
  return (
    !!candidate && Number.isFinite(candidate.x) && Number.isFinite(candidate.y)
  )
}

/**
 * Whether these traits describe a hatch drawn as a line pattern rather than a
 * solid or gradient fill.
 *
 * Matches `AcTrPolygon.isPatternedHatch()` so the plot agrees with the screen.
 */
export function isPatternedHatch(traits: AcGiSubEntityTraits): boolean {
  const style = traits.fillType
  return !style.gradient && !!style.definitionLines?.length
}

/** A validated definition line with everything resolved to finite numbers. */
interface NormalizedDefinitionLine {
  angle: number
  base: AcSvgPoint2d
  offset: AcSvgPoint2d
  dashLengths: number[]
}

/**
 * Validates one definition line, rejecting anything the geometry below cannot
 * use. Mirrors `AcTrFillMaterialManager.isValidDefinitionLine()`.
 */
function normalizeDefinitionLine(
  line: AcGiHatchPatternLine
): NormalizedDefinitionLine | null {
  if (!line || typeof line !== 'object') return null
  if (!Array.isArray(line.dashLengths)) return null
  if (!isFinitePoint(line.base) || !isFinitePoint(line.offset)) return null
  if (!Number.isFinite(line.angle)) return null
  if (!line.dashLengths.every(value => Number.isFinite(value))) return null

  return {
    angle: line.angle,
    base: { x: line.base.x, y: line.base.y },
    offset: { x: line.offset.x, y: line.offset.y },
    dashLengths: [...line.dashLengths]
  }
}

/** SVG dash pattern derived from a definition line's dash lengths. */
interface DashPattern {
  /** `stroke-dasharray` values, always starting with a dash and even in count. */
  values: number[]
  /** Total pattern length, used to wrap `stroke-dashoffset`. */
  length: number
}

/**
 * Converts AutoCAD dash lengths (positive = dash, negative = gap) into an SVG
 * `stroke-dasharray`.
 *
 * SVG always reads the array as dash, gap, dash, gap…, so a pattern that opens
 * with a gap gets a leading zero-length dash, and an odd-length array gets a
 * trailing zero-length gap — without either, SVG's implicit repetition would
 * swap dashes and gaps on alternate passes. Neither padding value changes the
 * pattern length.
 *
 * @returns The dash pattern, or `null` when the line has no usable dashes and
 *   should be drawn as a continuous line instead
 */
function buildDashPattern(dashLengths: number[]): DashPattern | null {
  if (dashLengths.length === 0) return null

  let total = 0
  let isDotPattern = true
  for (const value of dashLengths) {
    if (value > 0) isDotPattern = false
    total += Math.abs(value)
  }
  if (!(total > EPSILON)) return null

  const ratio = isDotPattern ? RATIO_FOR_DOT_PATTERN : RATIO_FOR_NONDOT_PATTERN
  const resolved = dashLengths.map(value =>
    value === 0 ? ratio * total : value
  )

  const values: number[] = []
  if (resolved[0] < 0) values.push(0)
  for (const value of resolved) values.push(Math.abs(value))
  if (values.length % 2 === 1) values.push(0)

  const length = values.reduce((sum, value) => sum + value, 0)
  if (!(length > EPSILON)) return null
  return { values, length }
}

/**
 * Renders a patterned hatch as the line work AutoCAD would plot.
 *
 * The screen renderer paints the same pattern with a fragment shader
 * (`AcTrHatchPatternShaders`), which a vector export cannot reuse, so this
 * reproduces that shader's geometry:
 *
 * - the pattern lives in a frame rotated by `definitionLine.angle` plus the
 *   hatch's `patternAngle` and translated to the definition line's base point;
 * - within that frame the lines run parallel to the local X axis, spaced by the
 *   rotated offset's Y component, with each successive line shifted along X by
 *   the offset's X component;
 * - each line carries the definition's dash pattern, phased by that shift.
 *
 * Rather than clipping with an SVG `<clipPath>` — which not every PDF converter
 * honours — each pattern line is intersected with the boundary loops directly,
 * and only the spans inside the even-odd interior are emitted.
 *
 * @param loops - Boundary loops, already flattened to polylines
 * @param traits - Entity traits carrying the hatch's `fillType`
 * @param ctx - Style context used to resolve colour and lineweight
 * @returns SVG markup for the pattern, or `null` when the hatch is not
 *   patterned or the pattern is not renderable, in which case the caller should
 *   fall back to a solid fill
 */
export function buildHatchPatternSvg(
  loops: readonly AcSvgHatchLoop[],
  traits: AcGiSubEntityTraits,
  ctx: AcSvgStyleContext
): string | null {
  if (!isPatternedHatch(traits)) return null

  const style = traits.fillType
  const patternAngle = Number.isFinite(style.patternAngle)
    ? style.patternAngle
    : 0

  const usableLoops = loops.filter(loop => loop.length >= 3)
  if (usableLoops.length === 0) return null

  const attrs = AcSvgStyleUtil.patternStrokeAttributes(traits, ctx)
  const parts: string[] = []
  let budget = MAX_PATTERN_LINES

  for (const rawLine of style.definitionLines) {
    const line = normalizeDefinitionLine(rawLine)
    // One unusable definition line means the pattern cannot be trusted; fall
    // back to the solid fill wholesale, as the screen renderer does.
    if (!line) return null

    const alpha = line.angle + patternAngle
    const cosAlpha = Math.cos(alpha)
    const sinAlpha = Math.sin(alpha)

    // Base is rotated by the hatch angle only; the offset by the definition
    // line's own angle. Both mirror the shader exactly.
    const cosPattern = Math.cos(patternAngle)
    const sinPattern = Math.sin(patternAngle)
    const baseX = cosPattern * line.base.x - sinPattern * line.base.y
    const baseY = sinPattern * line.base.x + cosPattern * line.base.y

    const cosLine = Math.cos(-line.angle)
    const sinLine = Math.sin(-line.angle)
    const offsetX = cosLine * line.offset.x - sinLine * line.offset.y
    const offsetY = sinLine * line.offset.x + cosLine * line.offset.y

    // Parallel lines with no perpendicular spacing would repeat forever in
    // place; the shader skips them too.
    if (Math.abs(offsetY) < EPSILON) continue

    const dash = buildDashPattern(line.dashLengths)
    // Continuous lines space by the offset's full length and do not skew;
    // dashed ones space by its Y component and shift along X per line.
    const step = dash ? offsetY : Math.hypot(offsetX, offsetY)
    const skew = dash ? offsetX : 0
    if (!(Math.abs(step) > EPSILON)) continue

    // Project the boundary into the pattern's local frame once.
    let minLocalY = Number.POSITIVE_INFINITY
    let maxLocalY = Number.NEGATIVE_INFINITY
    const localLoops: AcSvgPoint2d[][] = []
    for (const loop of usableLoops) {
      const localLoop: AcSvgPoint2d[] = []
      for (const point of loop) {
        const dx = point.x - baseX
        const dy = point.y - baseY
        const localY = -sinAlpha * dx + cosAlpha * dy
        localLoop.push({ x: cosAlpha * dx + sinAlpha * dy, y: localY })
        if (localY < minLocalY) minLocalY = localY
        if (localY > maxLocalY) maxLocalY = localY
      }
      localLoops.push(localLoop)
    }
    if (!Number.isFinite(minLocalY) || !Number.isFinite(maxLocalY)) return null

    const firstIndex = Math.ceil(Math.min(minLocalY / step, maxLocalY / step))
    const lastIndex = Math.floor(Math.max(minLocalY / step, maxLocalY / step))
    const lineCount = lastIndex - firstIndex + 1
    if (lineCount <= 0) continue
    if (lineCount > budget) return null
    budget -= lineCount

    const crossings: number[] = []
    for (let index = firstIndex; index <= lastIndex; index++) {
      const localY = index * step
      crossings.length = 0

      for (const localLoop of localLoops) {
        const count = localLoop.length
        for (let i = 0; i < count; i++) {
          const a = localLoop[i]!
          const b = localLoop[(i + 1) % count]!
          // Half-open comparison counts each vertex once, so loops that touch
          // the scan line do not produce doubled crossings.
          if (a.y <= localY === b.y <= localY) continue
          const t = (localY - a.y) / (b.y - a.y)
          crossings.push(a.x + t * (b.x - a.x))
        }
      }

      if (crossings.length < 2) continue
      crossings.sort((first, second) => first - second)

      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const startX = crossings[i]!
        const endX = crossings[i + 1]!
        if (endX - startX < EPSILON) continue

        const x1 = cosAlpha * startX - sinAlpha * localY + baseX
        const y1 = sinAlpha * startX + cosAlpha * localY + baseY
        const x2 = cosAlpha * endX - sinAlpha * localY + baseX
        const y2 = sinAlpha * endX + cosAlpha * localY + baseY

        const lineAttrs: Record<string, string> = {
          d: `M${fmt(x1)},${fmt(y1)} L${fmt(x2)},${fmt(y2)}`,
          ...attrs
        }
        if (dash) {
          lineAttrs['stroke-dasharray'] = dash.values.join(' ')
          // The dash phase is measured from the definition line's origin, so a
          // span starting mid-pattern must start mid-dash too.
          lineAttrs['stroke-dashoffset'] = fmt(
            mod(startX - index * skew, dash.length)
          )
        }
        parts.push(AcSvgStyleUtil.tag('path', lineAttrs))
      }
    }
  }

  if (parts.length === 0) return null
  return parts.join('\n')
}
