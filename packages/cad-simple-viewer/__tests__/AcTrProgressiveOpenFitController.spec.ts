import { AcGeBox2d } from '@mlightcad/data-model'

import { AcTrProgressiveOpenFitController } from '../src/view/AcTrProgressiveOpenFitController'

describe('AcTrProgressiveOpenFitController', () => {
  it('throttles bounds scans when new entities do not expand the fitted area', () => {
    let now = 1000
    const clock = jest.spyOn(performance, 'now').mockImplementation(() => now)
    try {
      const zoom = jest.fn()
      const controller = new AcTrProgressiveOpenFitController(zoom)
      const bounds = jest.fn(
        () => new AcGeBox2d({ x: 0, y: 0 }, { x: 100, y: 100 })
      )
      controller.begin(10000)
      controller.afterGeometryBatch(bounds)
      expect(bounds).toHaveBeenCalledTimes(1)
      expect(zoom).toHaveBeenCalledTimes(1)

      now += 500
      for (let i = 0; i < 10000; i++) controller.afterGeometryBatch(bounds)
      expect(bounds).toHaveBeenCalledTimes(2)
      expect(zoom).toHaveBeenCalledTimes(1)

      now += 500
      controller.afterGeometryBatch(bounds)
      expect(bounds).toHaveBeenCalledTimes(3)
      controller.applyFinalFit(bounds)
      expect(bounds).toHaveBeenCalledTimes(4)
      expect(zoom).toHaveBeenCalledTimes(2)
    } finally {
      clock.mockRestore()
    }
  })

  it('throttles bounds scans while the scene still has no drawable bounds', () => {
    const clock = jest.spyOn(performance, 'now').mockReturnValue(1000)
    try {
      const controller = new AcTrProgressiveOpenFitController(jest.fn())
      const bounds = jest.fn(() => undefined)
      controller.begin(10000)
      for (let i = 0; i < 10000; i++) controller.afterGeometryBatch(bounds)
      expect(bounds).toHaveBeenCalledTimes(1)
    } finally {
      clock.mockRestore()
    }
  })

  it('refreshes pending threshold on re-begin without resetting fit state', () => {
    const zooms: AcGeBox2d[] = []
    const controller = new AcTrProgressiveOpenFitController(box => {
      zooms.push(box.clone())
    })

    controller.begin(0)
    expect(controller.isActive).toBe(true)

    // Simulate geometry landing before db.read finishes.
    for (let i = 0; i < 500; i++) {
      controller.afterGeometryBatch(
        () => new AcGeBox2d({ x: 0, y: 0 }, { x: 10 + i, y: 10 + i })
      )
    }

    const zoomsBeforeRefresh = zooms.length
    expect(zoomsBeforeRefresh).toBeGreaterThan(0)

    controller.begin(20000)
    expect(controller.isActive).toBe(true)

    // Re-begin must not clear prior fit / force an immediate re-zoom.
    expect(zooms.length).toBe(zoomsBeforeRefresh)
  })

  it('stops auto-fit after a user view change', () => {
    const zooms: AcGeBox2d[] = []
    const controller = new AcTrProgressiveOpenFitController(box => {
      zooms.push(box.clone())
    })

    controller.begin(1000)
    controller.afterGeometryBatch(
      () => new AcGeBox2d({ x: 0, y: 0 }, { x: 100, y: 100 })
    )
    const afterFirst = zooms.length

    controller.onLayoutViewChanged()
    expect(controller.isActive).toBe(false)

    controller.afterGeometryBatch(
      () => new AcGeBox2d({ x: 0, y: 0 }, { x: 1000, y: 1000 })
    )
    expect(zooms.length).toBe(afterFirst)
  })
})
