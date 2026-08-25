/**
 * Composes the final sheet SVG for a plot.
 *
 * The sheet is a millimeter-based SVG (`viewBox="0 0 W H"` with
 * `width="{W}mm"` / `height="{H}mm"`) so jsPDF can emit a vector PDF at
 * exactly the requested physical media size. Content markup produced by
 * {@link AcSvgRenderer.exportElements} is placed with the transform from
 * {@link computeContentTransform}; model-space content shown through
 * paper-space viewports is embedded as nested `<svg>` elements clipped to
 * each viewport rectangle (nested SVG clips overflow by default).
 */

import type { PlotRect, PlotTransform } from './AcApPlotMath'

/** Model-space content to show through one paper-space viewport. */
export interface AcApViewportComposition {
  /**
   * Viewport rectangle on the sheet in millimeters, already mapped from
   * paper-space drawing units by the caller.
   */
  rect: PlotRect
  /**
   * Model-space region visible through this viewport, in model drawing
   * units: `width = viewHeight * rect.width / rect.height`,
   * `height = viewHeight`, centered at the (twist-applied) DCS center.
   */
  viewBox: PlotRect
  /** View twist angle in radians; 0 when the view is not rotated. */
  twistAngle: number
  /** Model-space element markup (drawing coordinates, Y up). */
  markup?: string | null
}

/** Parameters for {@link composeSheetSvg}. */
export interface AcApSheetComposerParams {
  /** Full sheet size in millimeters. */
  sheet: PlotRect
  /** Printable area inside the sheet in millimeters. */
  printable: PlotRect
  /** Sheet background color as CSS color (defaults to white). */
  backgroundColor?: string
  /**
   * Drawing-space element markup (Y up) placed with `contentTransform`.
   * `null` produces an empty (but still valid) sheet.
   */
  contentMarkup?: string | null
  /** Transform from drawing space onto sheet space; required with content. */
  contentTransform?: PlotTransform | null
  /** Clips main content to the printable area when true (default). */
  clipToPrintableArea?: boolean
  /**
   * Optional extra clip rectangle (sheet millimeters) applied to the main
   * content group only — used by window plots so geometry outside the
   * picked window is cropped instead of bleeding into the sheet margins.
   */
  contentClipRect?: PlotRect | null
  /** Per-viewport model-space compositions (layout plots only). */
  viewportCompositions?: AcApViewportComposition[]
}

/**
 * Formats an SVG coordinate number compactly (drops trailing zeros) so
 * generated sheets stay small.
 */
function fmt(value: number): string {
  return String(Math.round(value * 1e6) / 1e6)
}

/**
 * Removes `<image>` / `<use>` elements whose href points outside the
 * document. Mirrors {@link AcSvgExportUtil.sanitizeExternalReferences} from
 * the SVG plugin without importing the plugin bundle (the plot engine only
 * needs this one pure helper, and keeping it local avoids loading the
 * WebGL-dependent package in non-browser contexts).
 */
function sanitizeExternalReferences(markup: string): string {
  return markup.replace(
    /<(?:image|use)\b[^>]*\s(?:xlink:)?href="(?!data:|#)[^"]*"[^>]*\/?>\s*/gi,
    ''
  )
}

/**
 * Builds the matrix attribute string for a {@link PlotTransform}.
 */
export function toMatrixAttribute(transform: PlotTransform): string {
  return `matrix(${fmt(transform.a)},${fmt(transform.b)},${fmt(
    transform.c
  )},${fmt(transform.d)},${fmt(transform.e)},${fmt(transform.f)})`
}

/**
 * Builds one nested `<svg>` viewport composition showing model space
 * through a clipped paper-space window.
 *
 * @param composition - Viewport placement and visible model region
 * @returns SVG markup fragment
 */
function buildViewportSvg(composition: AcApViewportComposition): string {
  const { rect, viewBox, twistAngle } = composition
  if (rect.width <= 0 || rect.height <= 0 || viewBox.width <= 0) {
    return ''
  }
  const cx = viewBox.x + viewBox.width / 2
  const cy = viewBox.y + viewBox.height / 2
  // Nested svg user space is Y-down; content is Y-up, so flip first and
  // apply the view twist rotation about the model-space view center.
  const deg = (Number.isFinite(twistAngle) ? -twistAngle : 0) * (180 / Math.PI)
  const rotate =
    deg === 0 ? '' : `<g transform="rotate(${fmt(deg)} ${fmt(cx)} ${fmt(cy)})">`
  const rotateClose = deg === 0 ? '' : '</g>'
  return `  <svg x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(
    rect.width
  )}" height="${fmt(rect.height)}" viewBox="${fmt(viewBox.x)} ${fmt(
    -(viewBox.y + viewBox.height)
  )} ${fmt(viewBox.width)} ${fmt(viewBox.height)}" preserveAspectRatio="none">
    <g transform="matrix(1,0,0,-1,0,0)">${rotate}
${composition.markup ?? ''}
${rotateClose}
    </g>
  </svg>`
}

/**
 * Composes the complete sheet SVG document.
 *
 * @param params - Sheet geometry, content markup, and viewport compositions
 * @returns Complete standalone SVG string sized in millimeters
 */
export function composeSheetSvg(params: AcApSheetComposerParams): string {
  const {
    sheet,
    printable,
    backgroundColor = '#ffffff',
    contentMarkup,
    contentTransform,
    clipToPrintableArea = true,
    contentClipRect,
    viewportCompositions = []
  } = params

  const clipId = 'ml-plot-area'
  const windowClipId = 'ml-plot-window'
  const hasWindowClip =
    contentClipRect != null &&
    contentClipRect.width > 0 &&
    contentClipRect.height > 0
  const clipOpen =
    clipToPrintableArea && printable.width > 0 && printable.height > 0
      ? `<g clip-path="url(#${clipId})">`
      : '<g>'

  const parts: string[] = []
  parts.push(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"
  viewBox="${fmt(sheet.x)} ${fmt(sheet.y)} ${fmt(sheet.width)} ${fmt(
    sheet.height
  )}"
  width="${fmt(sheet.width)}mm" height="${fmt(sheet.height)}mm">
  <defs>
    <clipPath id="${clipId}"><rect x="${fmt(printable.x)}" y="${fmt(
      printable.y
    )}" width="${fmt(printable.width)}" height="${fmt(printable.height)}"/></clipPath>${
      hasWindowClip
        ? `\n    <clipPath id="${windowClipId}"><rect x="${fmt(
            contentClipRect!.x
          )}" y="${fmt(contentClipRect!.y)}" width="${fmt(
            contentClipRect!.width
          )}" height="${fmt(contentClipRect!.height)}"/></clipPath>`
        : ''
    }
  </defs>
  <rect x="${fmt(sheet.x)}" y="${fmt(sheet.y)}" width="${fmt(
    sheet.width
  )}" height="${fmt(sheet.height)}" fill="${backgroundColor}"/>`)

  parts.push(clipOpen)

  let hasContent = false
  if (contentMarkup && contentTransform) {
    const contentGroup = `  <g transform="${toMatrixAttribute(
      contentTransform
    )}">\n${contentMarkup}\n  </g>`
    parts.push(
      hasWindowClip
        ? `  <g clip-path="url(#${windowClipId})">\n${contentGroup}\n  </g>`
        : contentGroup
    )
    hasContent = true
  }

  viewportCompositions.forEach(composition => {
    const svg = buildViewportSvg(composition)
    if (svg) {
      hasContent = true
      parts.push(svg)
    }
  })

  if (!hasContent) {
    // Keep the sheet structurally valid even when nothing is drawable.
    parts.push('  <g/>')
  }

  parts.push('</g>')
  parts.push('</svg>')

  return sanitizeExternalReferences(parts.join('\n'))
}
