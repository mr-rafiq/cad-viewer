import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturePath = path.resolve(
  currentDir,
  '..',
  'fixtures',
  'visible-lwpolylines.dxf'
)

type CanvasBox = { x: number; y: number; width: number; height: number }

async function uploadFixture(page: Page) {
  const fileInput = page.locator('input[type="file"]').first()
  await expect(fileInput).toBeAttached()
  await fileInput.setInputFiles(fixturePath)
}

async function loadDrawing(page: Page) {
  await page.goto('/')
  await uploadFixture(page)
  await expect(page.locator('.ml-cad-container')).toBeVisible({
    timeout: 30000
  })
  await page.waitForTimeout(1500)
}

async function runPlotCommand(page: Page) {
  const commandInput = page.getByRole('textbox', { name: 'Type command' })
  await commandInput.click()
  await commandInput.fill('plot')
  await commandInput.press('Enter')
}

/**
 * Opens the Plot dialog with "What to plot" set to Window, so the "Pick <"
 * button is available.
 *
 * The dialog lazily imports `@mlightcad/cad-pdf-plugin`, which makes the Vite
 * dev server re-optimize dependencies and force a full page reload the first
 * time. That is done once up front so the assertions below run on a stable page.
 */
async function openPlotDialogWithWindowArea(page: Page): Promise<CanvasBox> {
  await loadDrawing(page)
  await runPlotCommand(page)
  await page.waitForTimeout(8000)

  await loadDrawing(page)
  const canvas = page.locator('.ml-cad-container canvas').first()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box is unavailable')

  await runPlotCommand(page)
  const dlg = page.locator('.ml-plot-dlg')
  await expect(dlg).toBeVisible({ timeout: 20000 })
  await page.waitForTimeout(1000)

  const areaRow = dlg.locator('.ml-plot-dlg__row', {
    has: page.locator('.ml-plot-dlg__label', { hasText: 'What to plot:' })
  })
  await areaRow.locator('.el-select').click()
  await page.waitForTimeout(600)
  // Extents -> Window. Driven by keyboard because the teleported dropdown
  // renders underneath the dialog overlay.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)

  await expect(dlg.getByRole('button', { name: 'Pick <' })).toBeVisible()
  return box
}

/**
 * Runs one "Pick <" round trip and returns the window summary the dialog shows
 * once it reopens. Throws if the dialog never comes back, which is what a stuck
 * corner prompt looks like from the user's side.
 */
async function pickWindow(
  page: Page,
  box: CanvasBox,
  corners: [number, number, number, number],
  options: { drag?: boolean } = {}
) {
  const dlg = page.locator('.ml-plot-dlg')
  await dlg.getByRole('button', { name: 'Pick <' }).click()
  await page.waitForTimeout(500)

  const x1 = box.x + box.width * corners[0]
  const y1 = box.y + box.height * corners[1]
  const x2 = box.x + box.width * corners[2]
  const y2 = box.y + box.height * corners[3]

  await page.mouse.move(x1, y1)
  await page.waitForTimeout(150)

  if (options.drag) {
    await page.mouse.down()
    await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 8 })
    await page.mouse.move(x2, y2, { steps: 8 })
    await page.mouse.up()
  } else {
    await page.mouse.click(x1, y1)
    await page.waitForTimeout(300)
    await page.mouse.move(x2, y2, { steps: 5 })
    await page.waitForTimeout(150)
    await page.mouse.click(x2, y2)
  }

  await expect(dlg).toBeVisible({ timeout: 10000 })
  return dlg.locator('.ml-plot-dlg__window-value').first().textContent()
}

/**
 * Regression: press-drag-release used to commit only the first corner and leave
 * the prompt waiting behind the hidden Plot dialog, which read as a hang.
 */
test('plot window can be picked by dragging as well as by two clicks', async ({
  page
}) => {
  const box = await openPlotDialogWithWindowArea(page)

  const dragged = await pickWindow(page, box, [0.3, 0.3, 0.7, 0.7], {
    drag: true
  })
  const clicked = await pickWindow(page, box, [0.3, 0.3, 0.7, 0.7])

  // Both gestures describe the same two corners, so they must agree.
  expect(dragged).toBeTruthy()
  expect(dragged).toBe(clicked)
})

test('plot window can be picked repeatedly', async ({ page }) => {
  const box = await openPlotDialogWithWindowArea(page)

  const first = await pickWindow(page, box, [0.3, 0.3, 0.7, 0.7])
  const second = await pickWindow(page, box, [0.25, 0.35, 0.65, 0.75])
  const third = await pickWindow(page, box, [0.2, 0.4, 0.6, 0.8], {
    drag: true
  })

  expect(first).toBeTruthy()
  expect(second).not.toBe(first)
  expect(third).not.toBe(second)
})
