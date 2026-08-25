/**
 * AutoCAD CTB (color-dependent plot style table) support.
 *
 * A CTB maps each AutoCAD Index Color (ACI 1-255) to plotted properties:
 * output color, lineweight, screening (ink percentage) and grayscale/dither
 * flags. This module parses real `.ctb` files (binary container with a
 * zlib-compressed text body, format identical to ezdxf's `acadctb`
 * reader/writer) and provides built-in `monochrome` / `grayscale` tables.
 *
 * Binary container layout:
 * ```
 * "PIAFILEVERSION_2.0,CTBVER1,compress\r\n"  (37 bytes)
 * "pmzlibcodec"                               (11 bytes)
 * uint32 LE adler32(zlib data)
 * uint32 LE uncompressed length
 * uint32 LE compressed length
 * zlib deflate stream                         (offset 60)
 * ```
 * The decompressed body is a line-oriented text format ending with a NUL:
 * ```
 * description="..."
 * aci_table_available=TRUE
 * custom_lineweight_table{
 *  0=0.00
 *  ...
 * }
 * aci_table{            ; some writers emit plot_style{ instead
 *  0{
 *   name="Color_1
 *   color=-1            ; -1 / -1006632961 = use object color
 *   mode_color=...
 *   color_policy=1      ; bit flags: 1 dither, 2 grayscale, 4 named color
 *   screen=100
 *   linetype=31         ; 31 = use object linetype
 *   lineweight=0        ; index into custom_lineweight_table, 0 = object
 *   ...
 *  }
 *  ...
 * }
 * ```
 */

/** Output color of one CTB entry. */
export type AcApCtbColor =
  /** Draw with the object's own color. */
  | { kind: 'object' }
  /** Draw with a fixed RGB output color. */
  | { kind: 'rgb'; r: number; g: number; b: number }
  /** Draw with a fixed AutoCAD index color. */
  | { kind: 'aci'; index: number }

/** One ACI entry of a CTB table. */
export interface AcApCtbEntry {
  /** Output color for this ACI. */
  color: AcApCtbColor
  /** Ink coverage percentage, 0-100 (100 = solid). */
  screen: number
  /** Convert output color to grayscale. */
  grayscale: boolean
  /** Dither flag from the file (informational for vector output). */
  dither: boolean
  /**
   * Plotted lineweight in millimeters, or `null` to use the object's
   * own lineweight.
   */
  lineweightMm: number | null
}

/** Parsed CTB plot style table. */
export interface AcApCtbTable {
  /** Table description from the file header. */
  description: string
  /** Custom lineweight table in millimeters, index 0 is the object default. */
  lineweights: number[]
  /** Entries for ACI 1-255 (index 0 unused). */
  styles: (AcApCtbEntry | undefined)[]
  /**
   * Returns the entry for an AutoCAD Color Index, or `undefined` when the
   * index is out of range or the entry is missing.
   */
  getStyle(aci: number): AcApCtbEntry | undefined
}

/**
 * One parsed block from the CTB text body: a name→value map whose values
 * are either scalar strings or nested blocks (the format nests arbitrarily
 * deep, e.g. `aci_table{ 0{ ... } }`).
 */
type CtbBlock = { [key: string]: string | CtbBlock }

const OBJECT_COLOR = -1
const OBJECT_COLOR2 = -1006632961
const COLOR_TYPE_RGB = 0xc2
const COLOR_TYPE_ACI = 0xc3

const POLICY_DITHER = 1
const POLICY_GRAYSCALE = 2

/**
 * Parses the decompressed CTB text body into a table.
 *
 * Tolerates the quirks of real AutoCAD output: string values start with
 * `"` and are not closed, numeric values can carry a ` (junk)` appendix,
 * and the style section is emitted as `aci_table` or `plot_style`.
 *
 * @param text - Decompressed CTB text body
 * @returns Parsed plot style table
 */
export function parseCtbText(text: string): AcApCtbTable {
  const lines = text.split('\n').map(line => line.replace(/\r$/, ''))
  const table: AcApCtbTable = {
    description: '',
    lineweights: [],
    styles: [],
    getStyle(aci: number) {
      return this.styles[aci]
    }
  }

  let index = 0
  const isBlockStart = (line: string) => line.trimEnd().endsWith('{')
  const nameOf = (line: string) =>
    line.endsWith('{') ? line.slice(0, -1).trim() : line.split('=', 1)[0].trim()

  function parseBlock(): CtbBlock {
    const data: CtbBlock = {}
    index++ // skip the "{..." line
    while (index < lines.length && !lines[index]!.trimEnd().endsWith('}')) {
      const line = lines[index]!
      if (line.trim() === '') {
        index++
        continue
      }
      const name = nameOf(line)
      if (isBlockStart(line)) {
        data[name] = parseBlock()
      } else {
        data[name] = sanitizeValue(line.split('=').slice(1).join('='))
        index++
      }
    }
    index++ // skip the closing "}"
    return data
  }

  while (index < lines.length) {
    const line = lines[index]!
    if (line.trim() === '') {
      index++
      continue
    }
    const name = nameOf(line)
    if (isBlockStart(line)) {
      const block = parseBlock()
      if (name === 'custom_lineweight_table') {
        table.lineweights = Object.entries(block)
          .map(([key, value]) => [Number(key), Number(value)] as const)
          .sort((a, b) => a[0] - b[0])
          .map(([, value]) => value)
      } else if (name === 'aci_table' || name === 'plot_style') {
        table.styles = parseStyleEntries(block, table.lineweights)
      }
    } else {
      if (name === 'description') {
        // description="Comment — strip the leading quote.
        table.description = sanitizeValue(line.split('=').slice(1).join('='))
      }
      index++
    }
  }

  return table
}

/**
 * Parses style entries from the `aci_table` / `plot_style` block.
 */
function parseStyleEntries(
  block: CtbBlock,
  lineweights: number[]
): (AcApCtbEntry | undefined)[] {
  const styles: (AcApCtbEntry | undefined)[] = []
  for (const [key, value] of Object.entries(block)) {
    if (typeof value === 'string') continue
    const aci = Number(key) + 1 // table index 0 == ACI 1
    if (!(aci >= 1 && aci <= 255)) continue
    styles[aci] = toEntry(value, lineweights)
  }
  return styles
}

/**
 * Converts one raw style record into a typed entry.
 */
function toEntry(record: CtbBlock, lineweights: number[]): AcApCtbEntry {
  const colorValue = Number(record['color'] ?? OBJECT_COLOR)
  const modeColorValue =
    record['mode_color'] != null ? Number(record['mode_color']) : colorValue
  const policy = Number(record['color_policy'] ?? 0)
  const screen = clamp(Number(record['screen'] ?? 100), 0, 100)
  const lineweightIndex = Number(record['lineweight'] ?? 0)

  return {
    color: unpackColor(colorValue, modeColorValue),
    screen,
    grayscale: (policy & POLICY_GRAYSCALE) !== 0,
    dither: (policy & POLICY_DITHER) !== 0,
    lineweightMm:
      lineweightIndex > 0 ? (lineweights[lineweightIndex] ?? null) : null
  }
}

/**
 * Unpacks the CTB packed color integers into a typed output color.
 */
function unpackColor(color: number, modeColor: number): AcApCtbColor {
  if (color === OBJECT_COLOR || color === OBJECT_COLOR2) {
    return { kind: 'object' }
  }
  const value = modeColor >>> 0
  const colorType = (value >>> 24) & 0xff
  const r = (value >>> 16) & 0xff
  const g = (value >>> 8) & 0xff
  const b = value & 0xff
  // AutoCAD stores the resolved output color in the low 24 bits of
  // `mode_color` for both true-color (0xC2) and ACI (0xC3) plot styles — the
  // 0xC3 method byte does *not* mean "blue byte is an ACI index". A real
  // monochrome.ctb, for example, encodes black as 0xC3000000.
  if (colorType === COLOR_TYPE_RGB || colorType === COLOR_TYPE_ACI) {
    return { kind: 'rgb', r, g, b }
  }
  // COLOR_BY_LAYER / COLOR_BY_BLOCK and anything unknown: draw as-is.
  return { kind: 'object' }
}

/**
 * Sanitizes one `name=value` payload: strips the leading quote of string
 * values and the ` (junk)` appendix AutoCAD appends to some floats.
 */
function sanitizeValue(value: string): string {
  let result = value.trim()
  if (result.startsWith('"')) {
    return result.slice(1)
  }
  if (result.endsWith(')')) {
    result = result.split(' ')[0]!
  }
  return result
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
}

/**
 * Parses a `.ctb` file from its raw bytes.
 *
 * Handles the standard compressed container (`PIAFILEVERSION` header +
 * zlib body) as well as plain-text bodies. Decompression uses the native
 * `DecompressionStream('deflate')` API.
 *
 * @param bytes - Raw file content
 * @returns Parsed plot style table
 * @throws When the container header is invalid or decompression fails
 */
export async function parseCtbFile(bytes: Uint8Array): Promise<AcApCtbTable> {
  const header = new TextDecoder('latin1').decode(bytes.slice(0, 14))
  if (header !== 'PIAFILEVERSION') {
    // Not a compressed container: try to parse as plain text.
    return parseCtbText(new TextDecoder('utf-8').decode(bytes))
  }

  const zlibData = bytes.slice(60)
  const stream = new Blob([zlibData as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
  const text = await new Response(stream).text()
  // The body is terminated by a trailing NUL byte.
  return parseCtbText(text.replace(/\0+$/, ''))
}

/**
 * Creates a built-in table equivalent to AutoCAD's `monochrome.ctb`:
 * every ACI plots black with the object's lineweight at full ink.
 *
 * @param grayscale - When true, produces `grayscale.ctb` behavior instead
 * @returns Built-in plot style table
 */
export function createBuiltinCtb(grayscale = false): AcApCtbTable {
  const styles: (AcApCtbEntry | undefined)[] = []
  for (let aci = 1; aci <= 255; aci++) {
    styles[aci] = {
      color: { kind: 'rgb', r: 0, g: 0, b: 0 },
      screen: 100,
      grayscale,
      dither: false,
      lineweightMm: null
    }
  }
  return {
    description: grayscale ? 'Grayscale (built-in)' : 'Monochrome (built-in)',
    lineweights: [],
    styles,
    getStyle(aci: number) {
      return this.styles[aci]
    }
  }
}

/**
 * Blends an RGB color toward white according to the CTB screening value,
 * mimicking reduced ink coverage on white paper.
 *
 * @param rgb - Input color channels 0-255
 * @param screen - Ink percentage 0-100
 * @returns Screened color channels
 */
export function applyScreening(
  rgb: { r: number; g: number; b: number },
  screen: number
): { r: number; g: number; b: number } {
  const factor = clamp(screen, 0, 100) / 100
  const mix = (channel: number) =>
    Math.round(channel * factor + 255 * (1 - factor))
  return { r: mix(rgb.r), g: mix(rgb.g), b: mix(rgb.b) }
}

/**
 * Desaturates an RGB color using Rec. 601 luma.
 */
export function toGrayscale(rgb: { r: number; g: number; b: number }): {
  r: number
  g: number
  b: number
} {
  const gray = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b)
  return { r: gray, g: gray, b: gray }
}

/**
 * Converts RGB channels to a `#rrggbb` CSS color string.
 */
export function rgbToCss(rgb: { r: number; g: number; b: number }): string {
  const hex = (channel: number) =>
    clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`
}
