import {
  AcGeBox2d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGiEntity
} from '@mlightcad/data-model'

import { AcSvgMatrixUtil } from './AcSvgMatrixUtil'

/**
 * Represent the display object of one drawing entity.
 */
export class AcSvgEntity implements AcGiEntity {
  private _objectId: string
  private _ownerId: string
  private _layerName: string
  private _visible: boolean
  private _userData: object
  protected _box: AcGeBox2d
  protected _localSvg: string
  protected _children: AcSvgEntity[]
  private _matrix?: AcGeMatrix3d
  protected _basePoint?: AcGePoint3d

  constructor() {
    this._objectId = ''
    this._ownerId = ''
    this._layerName = ''
    this._visible = true
    this._userData = {}
    this._box = new AcGeBox2d()
    this._localSvg = ''
    this._children = []
  }

  /**
   * The bounding box of this object in world coordinates (includes transforms).
   */
  get box() {
    return this._box
  }
  set box(value: AcGeBox2d) {
    this._box.copy(value)
  }

  get basePoint() {
    return this._basePoint
  }
  set basePoint(value: AcGePoint3d | undefined) {
    if (value == null) {
      this._basePoint = value
    } else {
      this._basePoint = this._basePoint
        ? this._basePoint.copy(value)
        : new AcGePoint3d(value)
    }
  }

  /**
   * SVG markup including any transforms applied via {@link applyMatrix}.
   */
  get svg() {
    return this.renderSvg()
  }
  set svg(value: string) {
    this._localSvg = value
  }

  /**
   * Local SVG markup without wrapping transforms.
   */
  getLocalSvg(): string {
    return this._localSvg
  }

  /**
   * Final SVG fragment with accumulated transforms applied.
   */
  renderSvg(): string {
    const parts: string[] = []
    if (this._localSvg) {
      parts.push(this._localSvg)
    }
    for (const child of this._children) {
      const childSvg = child.renderSvg()
      if (childSvg) {
        parts.push(childSvg)
      }
    }
    if (parts.length === 0) {
      return ''
    }
    const inner = parts.join('\n')
    if (!this._matrix) {
      return inner
    }
    const transform = AcSvgMatrixUtil.toSvgTransform(this._matrix)
    return `<g transform="${transform}">\n${inner}\n</g>`
  }

  get objectId() {
    return this._objectId
  }
  set objectId(value: string) {
    this._objectId = value
  }

  get ownerId() {
    return this._ownerId
  }
  set ownerId(value: string) {
    this._ownerId = value
  }

  get layerName() {
    return this._layerName
  }
  set layerName(value: string) {
    this._layerName = value
  }

  get visible() {
    return this._visible
  }
  set visible(value: boolean) {
    this._visible = value
  }

  get userData(): object {
    return this._userData
  }
  set userData(value: object) {
    this._userData = value
  }

  /**
   * @inheritdoc
   */
  applyMatrix(matrix: AcGeMatrix3d) {
    if (!this._matrix) {
      this._matrix = matrix.clone()
    } else {
      this._matrix = matrix.clone().multiply(this._matrix)
    }
    AcSvgMatrixUtil.transformBox(this._box, matrix)
  }

  recomputeBoundingBox() {
    // Bounding boxes are maintained during draw and applyMatrix.
  }

  highlight() {
    // Do nothing
  }

  unhighlight() {
    // Do nothing
  }

  /**
   * Returns an independent copy of this node.
   *
   * {@link AcDbRenderingCache} keeps the first draw of a block as a shared
   * template and hands every later INSERT a clone to place. Returning
   * `this` made all of them the same object, so each INSERT stacked another
   * transform onto the one already on the sheet and only one instance
   * survived. Children are cloned too, so placing one instance cannot move
   * another.
   */
  fastDeepClone(): this {
    const clone = Object.create(Object.getPrototypeOf(this)) as this
    Object.assign(clone, this)
    clone._box = this._box.clone()
    clone._matrix = this._matrix?.clone()
    clone._basePoint = this._basePoint
      ? new AcGePoint3d(this._basePoint)
      : undefined
    clone._userData = { ...this._userData }
    clone._children = this._children.map(child => child.fastDeepClone())
    return clone
  }

  /**
   * Appends a child node, growing this node's bounding box to cover it.
   *
   * Block references attach their attribute graphics this way. While this
   * was a no-op the attributes kept the inverse block transform applied by
   * {@link AcDbRenderingCache} and were drawn in block-local coordinates
   * instead of at the insertion point.
   */
  addChild(entity: AcGiEntity) {
    if (!(entity instanceof AcSvgEntity)) {
      return
    }
    this._children.push(entity)
    this._box.union(entity.box)
  }
}
