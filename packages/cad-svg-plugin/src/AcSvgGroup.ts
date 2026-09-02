import { AcSvgEntity } from './AcSvgEntity'

/**
 * SVG group entity: wraps child SVG markup inside a `<g>` element.
 */
export class AcSvgGroup extends AcSvgEntity {
  constructor(entities: AcSvgEntity[]) {
    super()
    for (const entity of entities) {
      this.addChild(entity)
    }
  }

  /**
   * Number of child entities in this group.
   *
   * Satisfies {@link AcGiEntity.childCount} for cache heuristics.
   */
  get childCount() {
    return this._children.length
  }
}
