import { loadDefaultCtbTable } from '../src/plot/AcApDefaultCtb'

describe('loadDefaultCtbTable', () => {
  it('plots every AutoCAD Color Index solid black at the object lineweight', async () => {
    // Regression: the table shipped here was a customised one wearing the
    // monochrome name. ACI 2 — the colour drawings typically use for
    // dimensions — carried screen=60, so dimension lines and arrowheads
    // plotted at 60% ink (mid grey) and at a pen width of 0.13 mm instead of
    // black at the drawing's own lineweight.
    const table = await loadDefaultCtbTable()

    for (let aci = 1; aci <= 255; aci++) {
      const entry = table.getStyle(aci)
      expect(entry).toBeDefined()
      expect(entry!.color).toEqual({ kind: 'rgb', r: 0, g: 0, b: 0 })
      expect(entry!.screen).toBe(100)
      expect(entry!.grayscale).toBe(false)
      expect(entry!.lineweightMm).toBeNull()
    }
  })

  it('is cached across calls', async () => {
    expect(await loadDefaultCtbTable()).toBe(await loadDefaultCtbTable())
  })
})
