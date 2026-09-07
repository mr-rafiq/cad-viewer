import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.resolve(currentDir, '..', 'fixtures', 'sheet_0.dxf')

async function loadDrawing(page: Page) {
  await page.goto('/')
  const fileInput = page.locator('input[type="file"]').first()
  await expect(fileInput).toBeAttached()
  await fileInput.setInputFiles(fixturePath)
  await expect(page.locator('.ml-cad-container')).toBeVisible({
    timeout: 60000
  })
  await page.waitForTimeout(4000)
}

/**
 * Fires a burst of wheel ticks, one per animation frame, and returns how long
 * the whole burst took in milliseconds.
 */
async function wheelBurst(
  page: Page,
  x: number,
  y: number,
  ticks: number,
  deltaY: number
) {
  await page.mouse.move(x, y)
  return page.evaluate(
    async ({ x, y, ticks, deltaY }) => {
      const canvas = document.querySelector('.ml-cad-container canvas')
      if (!canvas) throw new Error('canvas not found')
      const start = performance.now()
      for (let i = 0; i < ticks; i++) {
        canvas.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true
          })
        )
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)))
      }
      return Math.round(performance.now() - start)
    },
    { x, y, ticks, deltaY }
  )
}

/**
 * Regression: an active point prompt keeps acquired-centre osnap ticks on
 * screen and repositions them on every view change. Repositioning used to read
 * `getBoundingClientRect()` per marker in between style writes, so each marker
 * forced its own synchronous re-layout — zooming with a few hundred ticks
 * visible froze the page for tens of seconds.
 */
test('zooming stays responsive while a point prompt holds osnap markers', async ({
  page
}) => {
  test.setTimeout(300000)
  await loadDrawing(page)

  const canvas = page.locator('.ml-cad-container canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box is unavailable')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  const idle = await wheelBurst(page, cx, cy, 25, -240)

  const commandInput = page.getByRole('textbox', { name: 'Type command' })
  await commandInput.click()
  await commandInput.fill('line')
  await commandInput.press('Enter')
  await page.waitForTimeout(500)

  // Zoom out, then sweep the cursor so acquired-centre ticks pile up.
  await wheelBurst(page, cx, cy, 25, 240)
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(
      cx + Math.cos(i / 3) * box.width * 0.3,
      cy + Math.sin(i / 3) * box.height * 0.3
    )
  }
  await page.mouse.move(cx, cy)

  const markers = await page.locator('.ml-marker').count()
  const prompted = await wheelBurst(page, cx, cy, 25, -240)
  console.log(`idle=${idle}ms prompted=${prompted}ms markers=${markers}`)

  // The sweep must actually leave markers behind, or this proves nothing.
  expect(markers).toBeGreaterThan(50)
  // Generous bound: the bug made this ~30x slower, a healthy run is ~1.7x.
  expect(prompted).toBeLessThan(idle * 5)

  await page.keyboard.press('Escape')
})
