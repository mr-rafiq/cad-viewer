import { createBuiltinCtb, parseCtbText } from '../src/plot/AcApCtb'

/** Minimal CTB text body with a lineweight table and one ACI entry. */
function ctbBody(entryLines: string[]): string {
  return [
    'description="Test',
    'custom_lineweight_table{',
    ' 0=0.00',
    ' 1=0.05',
    ' 2=0.09',
    ' 3=0.10',
    ' 4=0.13',
    ' 5=0.15',
    '}',
    'aci_table{',
    ' 0{',
    ...entryLines.map(line => '  ' + line),
    ' }',
    '}'
  ].join('\n')
}

describe('parseCtbText color decoding', () => {
  it('decodes a ByACI (0xC3) black entry as RGB black (monochrome.ctb case)', () => {
    // 0xC3000000 = -1023410176: ByACI method byte, RGB payload 00,00,00.
    const table = parseCtbText(
      ctbBody([
        'name="Color_1',
        'color=-1023410176',
        'mode_color=-1023410176',
        'color_policy=5',
        'screen=100',
        'lineweight=5'
      ])
    )
    const entry = table.getStyle(1)
    expect(entry).toBeDefined()
    // Must be black RGB, NOT { kind: 'aci', index: 0 } (the old bug).
    expect(entry!.color).toEqual({ kind: 'rgb', r: 0, g: 0, b: 0 })
    expect(entry!.lineweightMm).toBeCloseTo(0.15, 6)
  })

  it('decodes a colored ByACI entry (0xC3FF0000) as red RGB', () => {
    // 0xC3FF0000 = -1006698496.
    const table = parseCtbText(
      ctbBody([
        'color=-1006698496',
        'mode_color=-1006698496',
        'color_policy=1',
        'screen=100',
        'lineweight=0'
      ])
    )
    expect(table.getStyle(1)!.color).toEqual({
      kind: 'rgb',
      r: 255,
      g: 0,
      b: 0
    })
  })

  it('keeps object color for entries that use the object color sentinel', () => {
    const table = parseCtbText(
      ctbBody(['color=-1', 'mode_color=-1', 'screen=100', 'lineweight=0'])
    )
    expect(table.getStyle(1)!.color).toEqual({ kind: 'object' })
  })
})

describe('createBuiltinCtb', () => {
  it('plots every ACI black at full ink', () => {
    const table = createBuiltinCtb(false)
    for (const aci of [1, 7, 100, 255]) {
      const entry = table.getStyle(aci)!
      expect(entry.color).toEqual({ kind: 'rgb', r: 0, g: 0, b: 0 })
      expect(entry.screen).toBe(100)
    }
  })
})
