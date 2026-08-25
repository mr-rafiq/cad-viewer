/**
 * Bundled default plot style table: the standard AutoCAD `monochrome.ctb`
 * (nearly every AutoCAD Color Index plots black). Embedded as base64 so it
 * can be parsed at runtime without an asset loader; the raw file lives beside
 * this module at `assets/monochrome.ctb`.
 */

import { type AcApCtbTable, parseCtbFile } from './AcApCtb'

/** File name shown for the bundled default plot style table. */
export const DEFAULT_CTB_NAME = 'monochrome.ctb'

/** Base64-encoded bytes of the bundled `monochrome.ctb` container. */
export const DEFAULT_CTB_BASE64 = [
  'UElBRklMRVZFUlNJT05fMi4wLENUQlZFUjEsY29tcHJlc3MNCnBtemxpYmNvZGVjjMVT1A5JAQBGEQAAeNrtXcFu3UpyzVpfcTH7' +
    'GbCqm01yoUUQTFZZzSRrQc/WZBTIkmDLb+AE79/TRdt1ero8BxjhLZ6N2viaIi/ZPKyuU6eat+r2+fnh081fbt+8PL2//vd//Y8/' +
    '//Hq7d2HN+/vn1/unx6vf3d1++b+5uX2p4e7m9ufb+8f7H/X//mn//rj1Yc3t/2PX74pf1iu3nz88PL07ubh/vHub3f3//3Xl5u3' +
    '9x+eH24/3Xx8vH/5cL3gXP93dVFdrn/3b08PT+9vVOXq4lti+wT79OqCrb5v943DjlQcWfr21y37/+Ebix1ZcGS9uvhWtX0V+9Z+' +
    'vdUvImu/iu9d7dgVxzY71i8jrV/H9zY7tuHY7eriW5vt27Bvv7r41m77fJfdx3DLds+yVoyuj8j3Gh64yfO+DpxosW+u+GYfH0Zu' +
    'O/EE+iMQx1zsAfiApA9I/CLSL1L9LKudZRhb3+djq+fAgVTfcjSkwyF+/9IBqH5ktSPxNOxh+BWqPSrcoT1k2JSZEYBSA2q0KtuL' +
    'zdW2h4NtL061nufyTXuwK3BeDWg8Z3u0K57fag8QT7rfW/ETl37e4oMofQwF9tu/V/wixQzWx1f6+IqPp/TxFL9+6dcvfr1i13P0' +
    'SkevOF6141V9LLWPpfpYah9L9bHUPpaK+WLP3K9X+/WqX6/26wE4ww0gG8YAxnABiIYhHpY9K1iqGerq11v79Va/3mrX8/uzqYrZ' +
    'aJOx+VhaH0vzsbQ+luZjaX0szcfS+liaj6X1sTTM6T6W5mNpNqV9LK2PpflYWh9L87FsfSybj2XrY9l8LFsfy+Zj2fpYNh/L1sey' +
    '+Vi2PpbNx7KdMwNTY+9X3OBhbE7tmOCHjcDHuu22FxNw70dvfqrN5uo+TEhzT36q/fQVcA9LH//u97ab71jgSpa+vfvBu/mSBe5j' +
    '6fe3+73v5lsWuJqlb+9+8F5tL1zI0u9/d2x28wULnM9ijtEP3g2rBXe09DvC7dvd99Nhb9/G7dvdywIkzVcCdkO9nw7f7duA3VAX' +
    'wC6G++HgHIbVNrjBft3DsTrMJ+G6evpoPH6x5384WIf5GYxDbRwC0xGzncOxPAxLmJmYnR1+8GFYwiTFbPLwCx+GJcxXzH4Pv4nj' +
    '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'
].join('')

let cached: Promise<AcApCtbTable> | null = null

/**
 * Parses and caches the bundled default `monochrome.ctb` plot style table.
 *
 * @returns The parsed default plot style table (colors plot black)
 */
export function loadDefaultCtbTable(): Promise<AcApCtbTable> {
  if (!cached) {
    cached = (async () => {
      const binary = atob(DEFAULT_CTB_BASE64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return parseCtbFile(bytes)
    })()
  }
  return cached
}
