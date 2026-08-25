import type { AcApContext } from '@mlightcad/cad-simple-viewer'
import {
  AcApSettingManager,
  resolveExportDownloadName
} from '@mlightcad/cad-simple-viewer'
import { AcSvgRenderer } from '@mlightcad/cad-svg-plugin'
import type {
  AcDbBlockTableRecord,
  AcDbEntity,
  AcDbLayout,
  AcGiViewport
} from '@mlightcad/data-model'
import { AcDbViewport } from '@mlightcad/data-model'
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'

import { type AcApCtbTable, createBuiltinCtb } from './AcApCtb'
import type { ContentBox, PlotRect, PlotTransform } from './AcApPlotMath'
import {
  computeContentTransform,
  computePrintableArea,
  computeScaleFactor,
  resolveSheetSizeMm
} from './AcApPlotMath'
import type { AcApPlotOptions } from './AcApPlotOptions'
import {
  type AcApViewportComposition,
  composeSheetSvg
} from './AcApSheetComposer'
import { AcCtbSvgRenderer } from './AcCtbSvgRenderer'

/** Raw element output from one SVG render pass. */
interface RenderPassResult {
  /** Element markup in drawing coordinates (Y up). */
  markup: string
  /** Union bounds of drawable entities in drawing coordinates. */
  bbox: ContentBox
}

const EMPTY_BOX: ContentBox = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

/**
 * Minimal document source required by the plot engine. Satisfied by
 * {@link AcApContext} but also usable standalone (for example from the
 * Plot dialog without constructing a full application context).
 */
export type AcApPlotSource = {
  doc: {
    database: AcApContext['doc']['database']
    fileName?: string
    docTitle?: string
  }
}

function toContentBox(bbox: {
  isEmpty(): boolean
  min: { x: number; y: number }
  max: { x: number; y: number }
}): ContentBox {
  if (bbox.isEmpty()) return { ...EMPTY_BOX }
  return {
    minX: bbox.min.x,
    minY: bbox.min.y,
    maxX: bbox.max.x,
    maxY: bbox.max.y
  }
}

/**
 * AutoCAD-style plotting engine producing **vector** PDF sheets from the
 * SVG export pipeline (`AcSvgRenderer` → composed sheet SVG → jsPDF +
 * svg2pdf). No rasterized images are involved.
 *
 * Supports model-space and paper-space (layout) plotting with paper size,
 * orientation, margins, fit/custom scale, centering, plot styles
 * (monochrome/grayscale) and viewport composition with clipping.
 */
export class AcApPlotConvertor {
  /**
   * Builds the composed sheet SVG for inspection/preview without plotting.
   *
   * @param source - Document source providing the drawing database
   * @param options - Plot settings selected by the user
   * @returns Standalone SVG string sized in millimeters
   * @throws When no drawable content matches the requested plot area
   */
  async buildSheetSvgAsync(
    source: AcApPlotSource,
    options: AcApPlotOptions
  ): Promise<string> {
    const db = source.doc.database
    const layout = this.resolveLayout(db.objects.layout, options)

    // 'layout' plot area only applies to paper-space layouts; fall back
    // to extents when plotting model space.
    const effectiveOptions =
      !layout && options.plotArea === 'layout'
        ? { ...options, plotArea: 'extents' as const }
        : options

    const ctbTable = this.resolveCtbTable(effectiveOptions)
    // Window plot area without a picked window falls back to extents.
    const windowBox =
      effectiveOptions.plotArea === 'window'
        ? this.normalizeWindow(effectiveOptions.plotWindow)
        : undefined
    const effectiveFinal =
      effectiveOptions.plotArea === 'window' && !windowBox
        ? { ...effectiveOptions, plotArea: 'extents' as const }
        : effectiveOptions

    const sheet = resolveSheetSizeMm(
      effectiveOptions,
      layout?.canonicalMediaName,
      layout?.plotPaperSize.x,
      layout?.plotPaperSize.y
    )
    const printable = computePrintableArea(sheet, effectiveOptions.marginMm)
    const plotTransparency = effectiveOptions.plotTransparency !== false

    let contentMarkup: string | null = null
    let contentTransform: PlotTransform | null = null
    const compositions: AcApViewportComposition[] = []

    if (layout) {
      const record = this.resolveLayoutRecord(source, layout)
      const viewports = this.collectViewports(record)
      const paperPass = this.drawPaperSpace(
        source,
        record,
        // Viewport borders come from AcDbViewport.worldDraw; include them
        // in the paper pass only when the user asked for plotted borders.
        // The default full-sheet *Paper_Space viewport is never plotted.
        entity =>
          entity instanceof AcDbViewport &&
          (this.isDefaultPaperSpaceViewport(entity) ||
            !effectiveFinal.plotViewportBorders),
        ctbTable,
        plotTransparency
      )

      // One shared model-space render pass reused by every viewport.
      const modelPass = effectiveFinal.drawViewportContent
        ? this.drawModelSpace(source, ctbTable, plotTransparency)
        : null

      for (const viewport of viewports) {
        const composition =
          modelPass && this.buildComposition(viewport, modelPass)
        if (composition) {
          compositions.push(composition)
        }
      }

      const contentBox =
        effectiveFinal.plotArea === 'layout'
          ? this.unionBoxes(
              paperPass.bbox,
              ...viewports.map(viewport => this.boxOf(viewport))
            )
          : (windowBox ?? paperPass.bbox)
      const factor = this.requireFactor(contentBox, printable, effectiveFinal)
      const [offsetX, offsetY] = this.resolveOffset(effectiveFinal)
      contentTransform = computeContentTransform(
        contentBox,
        factor,
        printable,
        effectiveFinal.centerPlot,
        offsetX,
        offsetY
      )
      contentMarkup = paperPass.markup || null
      this.mapCompositionsToSheet(compositions, contentTransform)
    } else {
      const modelPass = this.drawModelSpace(source, ctbTable, plotTransparency)
      const contentBox = windowBox ?? modelPass.bbox
      const factor = this.requireFactor(contentBox, printable, effectiveFinal)
      const [offsetX, offsetY] = this.resolveOffset(effectiveFinal)
      contentTransform = computeContentTransform(
        contentBox,
        factor,
        printable,
        effectiveFinal.centerPlot,
        offsetX,
        offsetY
      )
      contentMarkup = modelPass.markup || null
    }

    const svg = composeSheetSvg({
      sheet,
      printable,
      backgroundColor: '#ffffff',
      contentMarkup,
      contentTransform,
      clipToPrintableArea: true,
      viewportCompositions: compositions
    })
    return svg
  }

  /**
   * Plots the current document to vector PDF and triggers a download.
   *
   * @param source - Document source providing the drawing database
   * @param options - Plot settings selected by the user
   * @returns The downloaded file name
   */
  async plot(
    source: AcApPlotSource,
    options: AcApPlotOptions
  ): Promise<string> {
    const svgString = await this.buildSheetSvgAsync(source, options)
    const sheet = await this.extractSheetSize(svgString)
    const downloadName = resolveExportDownloadName(
      source.doc.fileName || source.doc.docTitle,
      'pdf'
    )
    await this.downloadAsPdf(svgString, sheet.width, sheet.height, downloadName)
    return downloadName
  }

  private configureRenderer(
    renderer: AcSvgRenderer,
    source: AcApPlotSource,
    plotTransparency: boolean
  ) {
    const db = source.doc.database
    renderer.ltscale = db.ltscale
    renderer.celtscale = db.celtscale
    renderer.showLineWeight = !!db.lwdisplay
    renderer.setFontMapping(AcApSettingManager.instance.fontMapping)
    // Plots always use white paper with black foreground so ACI 7
    // resolves correctly regardless of canvas theme.
    renderer.currentBackgroundColor = 0xffffff
    renderer.changeForeground(0x000000)
    // AutoCAD's "Plot transparency" defaults off; honor the option so
    // geometry can be forced fully opaque.
    renderer.plotTransparency = plotTransparency
  }

  /**
   * Resolves the plot offset in millimeters. Centering ignores the manual
   * offset, matching AutoCAD (the X/Y fields are read-only when centered).
   */
  private resolveOffset(
    options: Pick<AcApPlotOptions, 'centerPlot' | 'plotOffsetX' | 'plotOffsetY'>
  ): [number, number] {
    if (options.centerPlot) return [0, 0]
    return [options.plotOffsetX ?? 0, options.plotOffsetY ?? 0]
  }

  /**
   * Renders model-space entities through a fresh SVG render pass.
   */
  private drawModelSpace(
    source: AcApPlotSource,
    ctbTable: AcApCtbTable | null,
    plotTransparency: boolean
  ): RenderPassResult {
    const renderer = this.createRenderer(source, ctbTable, plotTransparency)
    const entities =
      source.doc.database.tables.blockTable.modelSpace.newIterator()
    for (const entity of entities) {
      entity.worldDraw(renderer)
    }
    return this.splitExport(renderer)
  }

  /**
   * Renders paper-space entities through a fresh SVG render pass.
   *
   * @param source - Document source providing the drawing database
   * @param record - Layout block table record or `undefined` when missing
   * @param skip - Predicate for entities to exclude from the pass
   * @param ctbTable - Active CTB table or `null` for as-is colors
   */
  private drawPaperSpace(
    source: AcApPlotSource,
    record: AcDbBlockTableRecord | undefined,
    skip: (entity: AcDbEntity) => boolean,
    ctbTable: AcApCtbTable | null,
    plotTransparency: boolean
  ): RenderPassResult {
    if (!record) {
      return { markup: '', bbox: { ...EMPTY_BOX } }
    }
    const renderer = this.createRenderer(source, ctbTable, plotTransparency)
    for (const entity of record.newIterator()) {
      if (skip(entity)) continue
      entity.worldDraw(renderer)
    }
    return this.splitExport(renderer)
  }

  /**
   * Creates the SVG renderer for a render pass. When a CTB table is
   * active, a CTB-aware renderer applies output color, lineweight,
   * screening and grayscale per ACI at draw time ("plot with plot
   * styles").
   */
  private createRenderer(
    source: AcApPlotSource,
    ctbTable: AcApCtbTable | null,
    plotTransparency: boolean
  ): AcSvgRenderer {
    const renderer = ctbTable
      ? new AcCtbSvgRenderer(ctbTable)
      : new AcSvgRenderer()
    this.configureRenderer(renderer, source, plotTransparency)
    return renderer
  }

  /**
   * Resolves the CTB table for the selected plot style. Built-in
   * monochrome/grayscale styles map to generated tables; `'ctb'` uses the
   * user-supplied parsed table.
   */
  private resolveCtbTable(options: AcApPlotOptions): AcApCtbTable | null {
    if (options.plotStyle === 'monochrome') {
      return createBuiltinCtb(false)
    }
    if (options.plotStyle === 'grayscale') {
      return createBuiltinCtb(true)
    }
    if (options.plotStyle === 'ctb') {
      if (!options.ctbTable) {
        throw new Error('No CTB plot style table loaded.')
      }
      return options.ctbTable
    }
    return null
  }

  /**
   * Validates and normalizes a picked plot window. Returns `null` when the
   * window is missing, inverted, or degenerate.
   */
  private normalizeWindow(window?: AcApPlotOptions['plotWindow']) {
    if (!window) {
      return null
    }
    const minX = Math.min(window.minX, window.maxX)
    const maxX = Math.max(window.minX, window.maxX)
    const minY = Math.min(window.minY, window.maxY)
    const maxY = Math.max(window.minY, window.maxY)
    if (maxX - minX <= 0 || maxY - minY <= 0) {
      return null
    }
    return { minX, minY, maxX, maxY }
  }

  private splitExport(renderer: AcSvgRenderer): RenderPassResult {
    const { markup, bbox } = renderer.exportElements()
    return { markup, bbox: toContentBox(bbox) }
  }

  private requireFactor(
    content: ContentBox,
    printable: PlotRect,
    options: AcApPlotOptions
  ) {
    const factor = computeScaleFactor(content, printable, options)
    if (factor == null || !Number.isFinite(factor) || factor <= 0) {
      throw new Error('Nothing to plot in the selected area.')
    }
    return factor
  }

  private unionBoxes(...boxes: ContentBox[]): ContentBox {
    const result: ContentBox = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }
    for (const box of boxes) {
      if (
        !Number.isFinite(box.minX) ||
        box.maxX <= box.minX ||
        box.maxY <= box.minY
      ) {
        continue
      }
      result.minX = Math.min(result.minX, box.minX)
      result.minY = Math.min(result.minY, box.minY)
      result.maxX = Math.max(result.maxX, box.maxX)
      result.maxY = Math.max(result.maxY, box.maxY)
    }
    if (!Number.isFinite(result.minX)) {
      return { ...EMPTY_BOX }
    }
    return result
  }

  private boxOf(viewport: AcGiViewport): ContentBox {
    const box = viewport.box
    return {
      minX: box.min.x,
      minY: box.min.y,
      maxX: box.max.x,
      maxY: box.max.y
    }
  }

  private buildComposition(
    viewport: AcGiViewport,
    modelPass: RenderPassResult
  ): AcApViewportComposition | null {
    const paperBox = viewport.box
    const paperW = paperBox.max.x - paperBox.min.x
    const paperH = paperBox.max.y - paperBox.min.y
    const viewHeight = viewport.viewHeight
    if (
      paperW <= 0 ||
      paperH <= 0 ||
      !Number.isFinite(viewHeight) ||
      viewHeight <= 0
    ) {
      return null
    }

    const twist = Number.isFinite(viewport.viewTwistAngle)
      ? viewport.viewTwistAngle
      : 0
    const cos = Math.cos(twist)
    const sin = Math.sin(twist)
    // WCS center of the model view: viewTarget + rotate(viewCenter, twist).
    const cx =
      viewport.viewTarget.x +
      (viewport.viewCenter.x * cos - viewport.viewCenter.y * sin)
    const cy =
      viewport.viewTarget.y +
      (viewport.viewCenter.x * sin + viewport.viewCenter.y * cos)

    // AutoCAD maps the viewport's model view height onto the paper rect;
    // width follows from the paper aspect so nothing is distorted.
    const height = viewHeight
    const width = (height * paperW) / paperH

    return {
      rect: {
        x: paperBox.min.x,
        y: paperBox.min.y,
        width: paperW,
        height: paperH
      },
      viewBox: { x: cx - width / 2, y: cy - height / 2, width, height },
      twistAngle: twist,
      markup: modelPass.markup
    }
  }

  /**
   * Maps viewport rectangles from paper-space drawing units onto sheet
   * millimeters using the same affine transform applied to paper content.
   */
  private mapCompositionsToSheet(
    compositions: AcApViewportComposition[],
    transform: PlotTransform
  ) {
    for (const composition of compositions) {
      const { rect } = composition
      composition.rect = {
        x: transform.a * rect.x + transform.e,
        y: transform.d * (rect.y + rect.height) + transform.f,
        width: transform.a * rect.width,
        height: -transform.d * rect.height
      }
    }
  }

  private resolveLayout(
    layouts: { newIterator(): Iterable<AcDbLayout> },
    options: Pick<AcApPlotOptions, 'layoutName'>
  ): AcDbLayout | undefined {
    const name = options.layoutName
    if (!name || name === 'Model') return undefined
    for (const layout of layouts.newIterator()) {
      if (layout.layoutName === name) return layout
    }
    throw new Error(`Layout "${name}" not found.`)
  }

  private resolveLayoutRecord(
    source: AcApPlotSource,
    layout: AcDbLayout
  ): AcDbBlockTableRecord | undefined {
    const record = source.doc.database.getObjectById(layout.blockTableRecordId)
    return record as unknown as AcDbBlockTableRecord | undefined
  }

  private collectViewports(
    record: AcDbBlockTableRecord | undefined
  ): AcGiViewport[] {
    const viewports: AcGiViewport[] = []
    if (!record) return viewports
    for (const entity of record.newIterator()) {
      if (!(entity instanceof AcDbViewport)) continue
      // Skip the default paper-space viewport (*Paper_Space): it looks at
      // itself (paper center == model view center) or carries the broken
      // LibreDWG fingerprint (origin center, 1:1 heights, zero target).
      if (this.isDefaultPaperSpaceViewport(entity)) continue
      viewports.push(entity.toGiViewport())
    }
    return viewports
  }

  /**
   * Structural fingerprint of the default `*Paper_Space` viewport, mirroring
   * {@link AcTrViewportView.isDefaultPaperSpaceViewport} without pulling the
   * three-renderer dependency into the PDF plugin.
   */
  private isDefaultPaperSpaceViewport(viewport: AcDbViewport): boolean {
    const eps = 1e-6
    const center = viewport.centerPoint
    const viewCenter = viewport.viewCenter
    if (
      Math.abs(center.x - viewCenter.x) < eps &&
      Math.abs(center.y - viewCenter.y) < eps
    ) {
      return true
    }
    if (Math.abs(center.x) >= eps || Math.abs(center.y) >= eps) return false
    const height = viewport.height
    const viewHeight = viewport.viewHeight
    if (
      height == null ||
      viewHeight == null ||
      !Number.isFinite(height) ||
      !Number.isFinite(viewHeight) ||
      Math.abs(viewHeight - height) >= eps
    ) {
      return false
    }
    const target = viewport.viewTarget
    if (!target) return true
    return Math.abs(target.x) < eps && Math.abs(target.y) < eps
  }

  private async extractSheetSize(
    svg: string
  ): Promise<{ width: number; height: number }> {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
    const svgEl = svgDoc.documentElement as unknown as SVGSVGElement
    const vb = svgEl.getAttribute('viewBox')?.split(' ').map(Number)
    const width = vb && vb.length === 4 ? Math.abs(vb[2]) : 210
    const height = vb && vb.length === 4 ? Math.abs(vb[3]) : 297
    return { width, height }
  }

  private async downloadAsPdf(
    svgString: string,
    width: number,
    height: number,
    downloadName: string
  ) {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgEl = svgDoc.documentElement as unknown as SVGSVGElement

    const pdf = new jsPDF({
      orientation: width >= height ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [width, height]
    })

    await svg2pdf(svgEl, pdf, {
      x: 0,
      y: 0,
      width,
      height
    })

    pdf.save(downloadName)
  }
}
