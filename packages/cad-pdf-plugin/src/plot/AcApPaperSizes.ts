/**
 * Standard paper (media) sizes for the plot engine.
 *
 * All dimensions are stored portrait-oriented in millimeters, matching
 * `AcDbPlotSettings.plotPaperSize` semantics. Landscape orientation swaps
 * width/height at plot time.
 */

/** One standard paper size entry in the plot paper catalog. */
export interface AcApPaperSize {
  /** Stable identifier used by plot options (for example `ISO_A4`). */
  key: string
  /** Human-readable label shown in the plot dialog. */
  label: string
  /** Portrait sheet width in millimeters. */
  width: number
  /** Portrait sheet height in millimeters. */
  height: number
}

/** Paper size option that reads media dimensions from the layout's stored page setup. */
export const FROM_LAYOUT_PAPER_KEY = 'fromLayout'

/** Paper size option for user-supplied custom media dimensions. */
export const CUSTOM_PAPER_KEY = 'custom'

/** Catalog of standard paper sizes supported by the plot engine. */
export const ACAP_PAPER_SIZES: readonly AcApPaperSize[] = [
  { key: 'ISO_A4', label: 'ISO A4 (210 x 297 mm)', width: 210, height: 297 },
  { key: 'ISO_A3', label: 'ISO A3 (297 x 420 mm)', width: 297, height: 420 },
  { key: 'ISO_A2', label: 'ISO A2 (420 x 594 mm)', width: 420, height: 594 },
  { key: 'ISO_A1', label: 'ISO A1 (594 x 841 mm)', width: 594, height: 841 },
  {
    key: 'ISO_A0',
    label: 'ISO A0 (841 x 1189 mm)',
    width: 841,
    height: 1189
  },
  {
    key: 'ANSI_A',
    label: 'ANSI A (8.5 x 11 in / Letter)',
    width: 215.9,
    height: 279.4
  },
  {
    key: 'ANSI_B',
    label: 'ANSI B (11 x 17 in / Tabloid)',
    width: 279.4,
    height: 431.8
  },
  {
    key: 'ANSI_C',
    label: 'ANSI C (17 x 22 in)',
    width: 431.8,
    height: 558.8
  },
  {
    key: 'ANSI_D',
    label: 'ANSI D (22 x 34 in)',
    width: 558.8,
    height: 863.6
  },
  {
    key: 'ANSI_E',
    label: 'ANSI E (34 x 44 in)',
    width: 863.6,
    height: 1117.6
  },
  {
    key: 'ARCH_A',
    label: 'Arch A (9 x 12 in)',
    width: 228.6,
    height: 304.8
  },
  {
    key: 'ARCH_B',
    label: 'Arch B (12 x 18 in)',
    width: 304.8,
    height: 457.2
  },
  {
    key: 'ARCH_C',
    label: 'Arch C (18 x 24 in)',
    width: 457.2,
    height: 609.6
  },
  {
    key: 'ARCH_D',
    label: 'Arch D (24 x 36 in)',
    width: 609.6,
    height: 914.4
  },
  {
    key: 'ARCH_E',
    label: 'Arch E (36 x 48 in)',
    width: 914.4,
    height: 1219.2
  }
]

/**
 * Finds a paper size by its stable key.
 *
 * @param key - Paper size key such as `ISO_A4`, or `undefined`
 * @returns The matching catalog entry or `undefined` when not found
 */
export function findPaperSize(key: string | undefined): AcApPaperSize | null {
  if (!key) return null
  return ACAP_PAPER_SIZES.find(size => size.key === key) ?? null
}

/**
 * Result of parsing a canonical media name from a DWG/DXF page setup.
 */
export interface ParsedCanonicalMedia {
  /** Media width in millimeters as encoded in the canonical name. */
  width: number
  /** Media height in millimeters as encoded in the canonical name. */
  height: number
}

const CANONICAL_MEDIA_PATTERN =
  /\((\d+(?:\.\d+)?)_x_(\d+(?:\.\d+)?)_(MM|Inches|INCHES)\)/

/**
 * Parses an AutoCAD canonical media name such as
 * `ISO_A4_(210.00_x_297.00_MM)` or `ANSI_full_bleed_D_(34.00_x_44.00_Inches)`
 * into physical millimeter dimensions.
 *
 * @param name - Canonical media name from `AcDbPlotSettings.canonicalMediaName`
 * @returns Parsed dimensions, or `null` when the name does not encode a size
 */
export function parseCanonicalMediaName(
  name: string | undefined | null
): ParsedCanonicalMedia | null {
  if (!name) return null
  const match = CANONICAL_MEDIA_PATTERN.exec(name)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null
  }
  const unit = match[3].toLowerCase()
  if (unit === 'inches') {
    return { width: width * 25.4, height: height * 25.4 }
  }
  return { width, height }
}
