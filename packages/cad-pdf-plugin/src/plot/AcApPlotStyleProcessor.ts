/**
 * Plot style processing: converts entity colors in a composed sheet SVG
 * according to the selected plot style (as-is, monochrome, grayscale).
 */

import type { AcApPlotStyle } from './AcApPlotOptions'

/** Common SVG color keywords resolved for plot style conversion. */
const NAMED_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  gray: '#808080',
  grey: '#808080'
}

/**
 * Normalizes any CSS color the SVG pipeline emits into `#rrggbb` form.
 * Supports hex (3/6 digits), `rgb()` / `rgba()`, and common keywords.
 *
 * @param color - Input CSS color string
 * @returns Normalized lowercase hex color or `null` when unparseable
 */
export function normalizeCssColor(color: string): string | null {
  const value = color.trim().toLowerCase()
  if (!value) return null
  if (NAMED_COLORS[value]) return NAMED_COLORS[value]
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    }
    if (hex.length === 6 || hex.length === 8) {
      return `#${hex.slice(0, 6)}`
    }
    return null
  }
  const rgbMatch = /^rgba?\(([^)]+)\)$/.exec(value)
  if (rgbMatch) {
    const channels = rgbMatch[1].split(/[\s,/]+/).filter(Boolean)
    if (channels.length >= 3) {
      const parsed = channels
        .slice(0, 3)
        .map(channel =>
          channel.endsWith('%')
            ? Math.round((Number.parseFloat(channel) / 100) * 255)
            : Math.round(Number.parseFloat(channel))
        )
      if (
        parsed.every(
          channel => Number.isFinite(channel) && channel >= 0 && channel <= 255
        )
      ) {
        return (
          '#' +
          parsed.map(channel => channel.toString(16).padStart(2, '0')).join('')
        )
      }
    }
  }
  return null
}

/**
 * Converts one normalized color according to the target plot style.
 *
 * @param normalizedColor - Color already passed through {@link normalizeCssColor}
 * @param style - Target plot style
 * @returns Converted hex color
 */
export function convertColor(
  normalizedColor: string,
  style: AcApPlotStyle
): string {
  if (style === 'monochrome') return '#000000'
  const r = Number.parseInt(normalizedColor.slice(1, 3), 16)
  const g = Number.parseInt(normalizedColor.slice(3, 5), 16)
  const b = Number.parseInt(normalizedColor.slice(5, 7), 16)
  // Rec. 601 luma, matching how CAD viewers typically desaturate plots.
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  const hex = gray.toString(16).padStart(2, '0')
  return `#${hex}${hex}${hex}`
}

/**
 * Converts an arbitrary CSS color for plotting.
 *
 * @param color - Input CSS color string
 * @param style - Target plot style; `asIs` returns the input unchanged
 * @returns Converted color string or the original input when unparseable
 */
export function convertColorForPlotStyle(
  color: string,
  style: AcApPlotStyle
): string {
  if (style === 'asIs') return color
  const normalized = normalizeCssColor(color)
  if (!normalized) return color
  return convertColor(normalized, style)
}
