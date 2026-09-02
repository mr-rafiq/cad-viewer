import {
  AcCmColor,
  AcCmTransparency,
  AcDbEntity,
  AcDbRenderingCache,
  AcGeArea2d,
  AcGeBox2d,
  AcGeCircArc3d,
  AcGeEllipseArc3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGiContext,
  AcGiFontMapping,
  AcGiImageStyle,
  AcGiLineWeight,
  AcGiMTextData,
  AcGiPointStyle,
  AcGiRenderer,
  AcGiShapeData,
  AcGiSubEntityTraits,
  AcGiTextStyle
} from '@mlightcad/data-model'

import { AcSvgArea } from './AcSvgArea'
import { AcSvgCircArc } from './AcSvgCircArc'
import { AcTrEllipticalArc } from './AcSvgEllipticalArc'
import { AcSvgEntity } from './AcSvgEntity'
import { AcSvgExportUtil } from './AcSvgExportUtil'
import { AcSvgGroup } from './AcSvgGroup'
import { AcSvgImage } from './AcSvgImage'
import { AcSvgLine } from './AcSvgLine'
import { AcSvgLineSegments } from './AcSvgLineSegments'
import { AcSvgMText } from './AcSvgMText'
import { AcSvgPoint } from './AcSvgPoint'
import { AcSvgShape } from './AcSvgShape'
import { AcSvgStyleContext, AcSvgStyleUtil } from './AcSvgStyleUtil'

export class AcSvgRenderer implements AcGiRenderer<AcSvgEntity> {
  /**
   * Clears the shared block rendering cache before SVG/PDF export.
   *
   * The cache stores drawable objects from the last renderer that populated it
   * (typically Three.js). Reusing those entries during export causes failures
   * such as `renderSvg is not a function` when dimensions or block references
   * are resolved from cache.
   */
  static prepareExport(): void {
    AcDbRenderingCache.instance.clear()
  }

  private _entities: AcSvgEntity[]
  private _bbox: AcGeBox2d
  private _subEntityTraits: AcGiSubEntityTraits
  private _fontMapping: AcGiFontMapping
  private _ltscale = 1
  private _celtscale = 1
  private _currentBackgroundColor = 0x000000
  private _foregroundColor = 0x000000
  private _showLineWeight = false
  private _plotTransparency = true
  private _resolveLayerLineWeight?: (
    layerName: string
  ) => AcGiLineWeight | undefined
  private _defaultLineWeightMm?: number
  private _pendingImages: Promise<void>[]

  constructor() {
    this._entities = []
    this._bbox = new AcGeBox2d()
    this._fontMapping = {}
    this._pendingImages = []
    this._subEntityTraits = {
      color: new AcCmColor(),
      lineType: {
        type: 'ByLayer',
        name: 'Continuous',
        standardFlag: 0,
        description: 'Solid line',
        totalPatternLength: 0
      },
      lineTypeScale: 1,
      lineWeight: AcGiLineWeight.ByLayer,
      fillType: {
        solidFill: true,
        patternAngle: 0,
        definitionLines: []
      },
      transparency: new AcCmTransparency(),
      thickness: 0,
      layer: '0',
      drawOrder: 0
    }
  }

  /**
   * @inheritdoc
   */
  get subEntityTraits() {
    return this._subEntityTraits
  }

  /**
   * @inheritdoc
   */
  get context(): AcGiContext {
    return AcGiContext.fromBackgroundColor(this._currentBackgroundColor)
  }

  /**
   * @inheritdoc
   */
  setFontMapping(mapping: AcGiFontMapping) {
    this._fontMapping = mapping
  }

  /**
   * Sets global ltscale for linetype dash scaling.
   */
  set ltscale(scale: number) {
    this._ltscale = scale
  }

  /**
   * Sets global celtscale for linetype dash scaling.
   */
  set celtscale(scale: number) {
    this._celtscale = scale
  }

  /**
   * Canvas background colour tracked for ACI 7 resolution and SVG export.
   *
   * Mirrors {@link AcTrRenderer.currentBackgroundColor}.
   */
  get currentBackgroundColor(): number {
    return this._currentBackgroundColor
  }

  set currentBackgroundColor(value: number) {
    this._currentBackgroundColor = value
  }

  /**
   * Foreground colour used when resolving ACI 7 linework and patterned hatches.
   * Mirrors {@link AcTrRenderer.changeForeground}.
   */
  changeForeground(color: number) {
    this._foregroundColor = color
  }

  /**
   * Whether lineweights are rendered. Mirrors the LWDISPLAY system variable.
   */
  get showLineWeight(): boolean {
    return this._showLineWeight
  }

  set showLineWeight(value: boolean) {
    this._showLineWeight = value
  }

  /**
   * Whether entity transparency is emitted. When `false`, geometry is drawn
   * fully opaque, mirroring AutoCAD's "Plot transparency" option (off by
   * default there). Defaults to `true` so on-screen SVG matches the drawing.
   */
  get plotTransparency(): boolean {
    return this._plotTransparency
  }

  set plotTransparency(value: boolean) {
    this._plotTransparency = value
  }

  /**
   * Looks up a layer's lineweight so `ByLayer` geometry resolves to a real
   * width. `AcDbEntity.lineWeight` returns the `ByLayer` sentinel rather
   * than the layer's value, so without this nearly every entity would fall
   * through to the SVG default width.
   */
  set resolveLayerLineWeight(
    resolver: ((layerName: string) => AcGiLineWeight | undefined) | undefined
  ) {
    this._resolveLayerLineWeight = resolver
  }

  /**
   * Width in millimeters for geometry whose lineweight resolves to nothing,
   * mirroring AutoCAD's LWDEFAULT. Leave unset to emit no width at all.
   */
  set defaultLineWeightMm(value: number | undefined) {
    this._defaultLineWeightMm = value
  }

  private get styleContext(): AcSvgStyleContext {
    return {
      ltscale: this._ltscale,
      celtscale: this._celtscale,
      backgroundColor: this._currentBackgroundColor,
      foregroundColor: this._foregroundColor,
      showLineWeight: this._showLineWeight,
      plotTransparency: this._plotTransparency,
      resolveLayerLineWeight: this._resolveLayerLineWeight,
      defaultLineWeightMm: this._defaultLineWeightMm
    }
  }

  private pushEntity(entity: AcSvgEntity) {
    this._entities.push(entity)
    return entity
  }

  /**
   * Draws one top-level database entity and records its graphic result.
   *
   * `worldDraw` does not always route its final result back through this
   * renderer. Block references resolve through the shared
   * {@link AcDbRenderingCache}, which returns a cached clone this renderer
   * never saw (cache hit) or a clone of the group it did see (cache miss) —
   * in both cases the block transform and the attribute children live on
   * the returned graphic, not on whatever landed in the accumulator. So the
   * accumulator is rewound to what the entity contributed and the returned
   * graphic is stored in its place. Every `subWorldDraw` returns the single
   * graphic covering everything it drew, so nothing is lost by rewinding.
   *
   * @param entity - Database entity to draw
   * @returns The graphic recorded for the entity, if it drew anything
   */
  drawEntity(entity: AcDbEntity): AcSvgEntity | undefined {
    const mark = this._entities.length
    const drawn = entity.worldDraw(this)
    this._entities.length = mark
    if (drawn instanceof AcSvgEntity) {
      return this.pushEntity(drawn)
    }
    return undefined
  }

  private removeEntities(entities: AcSvgEntity[]) {
    for (const entity of entities) {
      const index = this._entities.indexOf(entity)
      if (index >= 0) {
        this._entities.splice(index, 1)
      }
    }
  }

  /**
   * @inheritdoc
   */
  group(entities: AcSvgEntity[]) {
    this.removeEntities(entities)
    return this.pushEntity(new AcSvgGroup(entities))
  }

  /**
   * @inheritdoc
   */
  point(point: AcGePoint3d, style: AcGiPointStyle) {
    return this.pushEntity(
      new AcSvgPoint(point, style, this._subEntityTraits, this.styleContext)
    )
  }

  /**
   * @inheritdoc
   */
  circularArc(arc: AcGeCircArc3d) {
    return this.pushEntity(
      new AcSvgCircArc(arc, this._subEntityTraits, this.styleContext)
    )
  }

  /**
   * @inheritdoc
   */
  ellipticalArc(ellipseArc: AcGeEllipseArc3d) {
    return this.pushEntity(
      new AcTrEllipticalArc(
        ellipseArc,
        this._subEntityTraits,
        this.styleContext
      )
    )
  }

  /**
   * @inheritdoc
   */
  lines(points: AcGePoint3dLike[]) {
    return this.pushEntity(
      new AcSvgLine(points, this._subEntityTraits, this.styleContext)
    )
  }

  /**
   * @inheritdoc
   */
  lineSegments(array: Float32Array, itemSize: number, indices: Uint16Array) {
    return this.pushEntity(
      new AcSvgLineSegments(
        array,
        itemSize,
        indices,
        this._subEntityTraits,
        this.styleContext
      )
    )
  }

  /**
   * @inheritdoc
   */
  area(area: AcGeArea2d) {
    return this.pushEntity(
      new AcSvgArea(area, this._subEntityTraits, this.styleContext)
    )
  }

  /**
   * @inheritdoc
   */
  mtext(mtext: AcGiMTextData, style: AcGiTextStyle, _delay?: boolean) {
    const mappedFont = this._fontMapping[style.font] ?? style.font
    const resolvedStyle: AcGiTextStyle =
      mappedFont !== style.font ? { ...style, font: mappedFont } : style
    return this.pushEntity(
      new AcSvgMText(
        mtext,
        resolvedStyle,
        this._subEntityTraits,
        this.styleContext
      )
    )
  }

  /**
   * @inheritdoc
   */
  shape(shape: AcGiShapeData, style: AcGiTextStyle, _delay?: boolean) {
    const mappedFont = this._fontMapping[style.font] ?? style.font
    const resolvedStyle: AcGiTextStyle =
      mappedFont !== style.font ? { ...style, font: mappedFont } : style
    return this.pushEntity(
      new AcSvgShape(
        shape,
        resolvedStyle,
        this._subEntityTraits,
        this.styleContext
      )
    )
  }

  /**
   * @inheritdoc
   */
  image(blob: Blob, style: AcGiImageStyle) {
    const traits = { ...this._subEntityTraits }
    const ctx = this.styleContext
    const pending = AcSvgImage.fromBlob(blob, style, traits, ctx).then(entity =>
      this.pushEntity(entity)
    )
    this._pendingImages.push(pending.then(() => undefined))
    return _tempEntity
  }

  /**
   * Exports raw SVG element markup for all accumulated entities without the
   * enclosing `<svg>` wrapper, background rect, or Y-flip group.
   *
   * Elements are emitted in drawing coordinates (Y up), so consumers that
   * compose sheets (for example the plot/PDF engine) must apply their own
   * `matrix(f,0,0,-f,tx,ty)` transform to map drawing space onto a
   * top-down sheet.
   *
   * @returns The joined element markup and the union bounding box (in
   * drawing coordinates). The box is empty when nothing was drawable.
   */
  exportElements(): { markup: string; bbox: AcGeBox2d } {
    const parts: string[] = []
    const bbox = new AcGeBox2d()
    for (const entity of this._entities) {
      const svg = entity.renderSvg()
      if (svg) {
        parts.push(svg)
        bbox.union(entity.box)
      }
    }
    this._bbox = bbox
    return { markup: parts.join('\n'), bbox }
  }

  /**
   * Exports accumulated SVG markup. Awaits any pending raster images first.
   */
  async exportAsync(): Promise<string> {
    await Promise.all(this._pendingImages)
    return this.export()
  }

  /**
   * Synchronous export. Raster images added via {@link image} may be missing
   * unless {@link exportAsync} is used.
   */
  export() {
    const parts: string[] = []
    const bbox = new AcGeBox2d()
    for (const entity of this._entities) {
      const svg = entity.renderSvg()
      if (svg) {
        parts.push(svg)
        bbox.union(entity.box)
      }
    }
    this._bbox = bbox
    const elements = parts.join('\n')
    const padding = this._bbox.isEmpty()
      ? 0
      : Math.max(
          this._bbox.max.x - this._bbox.min.x,
          this._bbox.max.y - this._bbox.min.y
        ) * 0.02
    const viewBox = this._bbox.isEmpty()
      ? {
          x: 0,
          y: 0,
          width: 0,
          height: 0
        }
      : {
          x: this._bbox.min.x - padding,
          y: -(this._bbox.max.y + padding),
          width: this._bbox.max.x - this._bbox.min.x + padding * 2,
          height: this._bbox.max.y - this._bbox.min.y + padding * 2
        }
    const width = Math.max(viewBox.width, 1)
    const height = Math.max(viewBox.height, 1)
    const backgroundRect = this.buildBackgroundRect(viewBox)
    const svgMarkup = AcSvgExportUtil.sanitizeExternalReferences(
      `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1"
  preserveAspectRatio="xMinYMin meet"
  viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}"
  width="${width}" height="${height}">
${backgroundRect}
  <g transform="matrix(1,0,0,-1,0,0)">
${elements}
  </g>
</svg>`
    )
    return svgMarkup
  }

  private buildBackgroundRect(viewBox: {
    x: number
    y: number
    width: number
    height: number
  }): string {
    const fill = AcSvgStyleUtil.rgbToHex(this._currentBackgroundColor)
    const width = Math.max(viewBox.width, 1)
    const height = Math.max(viewBox.height, 1)
    return `  <rect x="${viewBox.x}" y="${viewBox.y}" width="${width}" height="${height}" fill="${fill}"/>`
  }
}

const _tempEntity = /*@__PURE__*/ new AcSvgEntity()
