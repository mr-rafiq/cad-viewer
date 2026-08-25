<template>
  <ml-base-dialog
    v-model:modelValue="visible"
    :title="t('dialog.plotDlg.title')"
    :width="960"
    :auto-close="false"
    @open="handleOpen"
    @ok="handleOk"
  >
    <div class="ml-plot-dlg">
      <!-- Left column: page setup / device / paper / area / offset / scale -->
      <div class="ml-plot-dlg__col">
        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.pageSetupGroup') }}</legend>
          <div class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.layout')
            }}</label>
            <el-select
              v-model="form.layoutName"
              class="ml-plot-dlg__control"
              size="small"
              @change="handleLayoutChanged"
            >
              <el-option :label="t('dialog.plotDlg.model')" value="" />
              <el-option
                v-for="layout in layouts"
                :key="layout.name"
                :label="layout.name"
                :value="layout.name"
              />
            </el-select>
          </div>
        </fieldset>

        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.printerGroup') }}</legend>
          <div class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.deviceLabel')
            }}</label>
            <el-input
              class="ml-plot-dlg__control"
              size="small"
              :model-value="t('dialog.plotDlg.devicePdf')"
              readonly
            />
          </div>
          <div class="ml-plot-dlg__hint">
            {{ t('dialog.plotDlg.deviceHint') }}
          </div>
        </fieldset>

        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.paperGroup') }}</legend>
          <div class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.paperSize')
            }}</label>
            <el-select
              v-model="form.paperSizeKey"
              class="ml-plot-dlg__control"
              size="small"
            >
              <el-option
                v-for="size in paperSizes"
                :key="size.key"
                :label="size.label"
                :value="size.key"
              />
              <el-option
                v-if="form.layoutName"
                :label="t('dialog.plotDlg.paperFromLayout')"
                :value="fromLayoutPaperKey"
              />
              <el-option
                :label="t('dialog.plotDlg.paperCustom')"
                :value="customPaperKey"
              />
            </el-select>
          </div>

          <div
            v-if="form.paperSizeKey === customPaperKey"
            class="ml-plot-dlg__row"
          >
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.customSize')
            }}</label>
            <el-input-number
              v-model="form.customPaperWidth"
              :min="10"
              :max="5000"
              :controls="false"
              size="small"
              class="ml-plot-dlg__number"
            />
            <span class="ml-plot-dlg__x">{{
              t('dialog.plotDlg.timesSign')
            }}</span>
            <el-input-number
              v-model="form.customPaperHeight"
              :min="10"
              :max="5000"
              :controls="false"
              size="small"
              class="ml-plot-dlg__number"
            />
            <span class="ml-plot-dlg__unit">{{
              t('dialog.plotDlg.unitMm')
            }}</span>
          </div>

          <div class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.margins')
            }}</label>
            <el-input-number
              v-model="form.marginMm"
              :min="0"
              :max="100"
              :controls="false"
              size="small"
              class="ml-plot-dlg__number"
            />
            <span class="ml-plot-dlg__unit">{{
              t('dialog.plotDlg.unitMm')
            }}</span>
          </div>
        </fieldset>

        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.plotAreaGroup') }}</legend>
          <div class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.plotArea')
            }}</label>
            <el-select
              v-model="form.plotArea"
              class="ml-plot-dlg__control"
              size="small"
            >
              <el-option
                :label="t('dialog.plotDlg.areaExtents')"
                value="extents"
              />
              <el-option
                :label="t('dialog.plotDlg.areaWindow')"
                value="window"
              />
              <el-option
                v-if="form.layoutName"
                :label="t('dialog.plotDlg.areaLayout')"
                value="layout"
              />
            </el-select>
          </div>

          <div v-if="form.plotArea === 'window'" class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.windowLabel')
            }}</label>
            <span v-if="windowText" class="ml-plot-dlg__window-value">{{
              windowText
            }}</span>
            <span v-else class="ml-plot-dlg__preview-empty">{{
              t('dialog.plotDlg.windowNotSet')
            }}</span>
            <el-button size="small" :disabled="busy" @click="pickWindow">
              {{ t('dialog.plotDlg.windowPick') }}
            </el-button>
          </div>
        </fieldset>

        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.offsetGroup') }}</legend>
          <div class="ml-plot-dlg__row">
            <el-checkbox v-model="form.centerPlot">{{
              t('dialog.plotDlg.centerPlot')
            }}</el-checkbox>
          </div>
          <div class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.offsetX')
            }}</label>
            <el-input-number
              v-model="form.plotOffsetX"
              :min="-5000"
              :max="5000"
              :controls="false"
              :disabled="form.centerPlot"
              size="small"
              class="ml-plot-dlg__number"
            />
            <span class="ml-plot-dlg__unit">{{
              t('dialog.plotDlg.unitMm')
            }}</span>
            <label class="ml-plot-dlg__label ml-plot-dlg__label--inline">{{
              t('dialog.plotDlg.offsetY')
            }}</label>
            <el-input-number
              v-model="form.plotOffsetY"
              :min="-5000"
              :max="5000"
              :controls="false"
              :disabled="form.centerPlot"
              size="small"
              class="ml-plot-dlg__number"
            />
            <span class="ml-plot-dlg__unit">{{
              t('dialog.plotDlg.unitMm')
            }}</span>
          </div>
        </fieldset>

        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.scaleGroup') }}</legend>
          <div class="ml-plot-dlg__row">
            <el-checkbox v-model="fitToPaper">{{
              t('dialog.plotDlg.scaleFit')
            }}</el-checkbox>
          </div>
          <div class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.scale')
            }}</label>
            <el-input-number
              v-model="form.scaleNumerator"
              :min="1"
              :max="100000"
              :controls="false"
              :disabled="fitToPaper"
              size="small"
              class="ml-plot-dlg__number"
            />
            <span class="ml-plot-dlg__x">{{
              t('dialog.plotDlg.ratioSeparator')
            }}</span>
            <el-input-number
              v-model="form.scaleDenominator"
              :min="1"
              :max="100000"
              :controls="false"
              :disabled="fitToPaper"
              size="small"
              class="ml-plot-dlg__number"
            />
          </div>
        </fieldset>
      </div>

      <!-- Right column: plot style / options / orientation / preview -->
      <div class="ml-plot-dlg__col">
        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.plotStyleGroup') }}</legend>
          <div class="ml-plot-dlg__row">
            <el-select
              v-model="form.plotStyle"
              class="ml-plot-dlg__control"
              size="small"
            >
              <el-option :label="t('dialog.plotDlg.styleAsIs')" value="asIs" />
              <el-option
                :label="t('dialog.plotDlg.styleMono')"
                value="monochrome"
              />
              <el-option
                :label="t('dialog.plotDlg.styleGray')"
                value="grayscale"
              />
              <el-option :label="t('dialog.plotDlg.styleCtb')" value="ctb" />
            </el-select>
          </div>
          <div v-if="form.plotStyle === 'ctb'" class="ml-plot-dlg__row">
            <label class="ml-plot-dlg__label">{{
              t('dialog.plotDlg.ctbFile')
            }}</label>
            <span v-if="ctbFileName" class="ml-plot-dlg__window-value">{{
              ctbFileName
            }}</span>
            <span v-else class="ml-plot-dlg__preview-empty">{{
              t('dialog.plotDlg.ctbNotLoaded')
            }}</span>
            <el-button size="small" :disabled="busy" @click="selectCtbFile">
              {{ t('dialog.plotDlg.ctbChoose') }}
            </el-button>
            <input
              ref="ctbFileInput"
              type="file"
              accept=".ctb"
              class="ml-plot-dlg__file-input"
              @change="handleCtbFileSelected"
            />
          </div>
        </fieldset>

        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.optionsGroup') }}</legend>
          <div class="ml-plot-dlg__row ml-plot-dlg__row--checks">
            <el-checkbox v-model="form.plotTransparency">{{
              t('dialog.plotDlg.plotTransparency')
            }}</el-checkbox>
          </div>
          <template v-if="form.layoutName">
            <div class="ml-plot-dlg__row ml-plot-dlg__row--checks">
              <el-checkbox v-model="form.drawViewportContent">{{
                t('dialog.plotDlg.drawViewportContent')
              }}</el-checkbox>
            </div>
            <div class="ml-plot-dlg__row ml-plot-dlg__row--checks">
              <el-checkbox v-model="form.plotViewportBorders">{{
                t('dialog.plotDlg.plotViewportBorders')
              }}</el-checkbox>
            </div>
          </template>
        </fieldset>

        <fieldset class="ml-plot-dlg__group">
          <legend>{{ t('dialog.plotDlg.orientationGroup') }}</legend>
          <el-radio-group v-model="form.orientation">
            <el-radio value="portrait">{{
              t('dialog.plotDlg.portrait')
            }}</el-radio>
            <el-radio value="landscape">{{
              t('dialog.plotDlg.landscape')
            }}</el-radio>
          </el-radio-group>
        </fieldset>

        <fieldset class="ml-plot-dlg__group ml-plot-dlg__group--preview">
          <legend>{{ t('dialog.plotDlg.preview') }}</legend>
          <div class="ml-plot-dlg__preview-header">
            <el-button size="small" :loading="busy" @click="handlePreview">
              {{ t('dialog.plotDlg.previewRefresh') }}
            </el-button>
          </div>
          <div class="ml-plot-dlg__preview-sheet">
            <!-- eslint-disable-next-line vue/no-v-html — markup is generated locally by the plot engine -->
            <div
              v-if="previewSvg"
              class="ml-plot-dlg__svg"
              v-html="previewSvg"
            />
            <div v-else class="ml-plot-dlg__preview-empty">
              {{ t('dialog.plotDlg.previewEmpty') }}
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  </ml-base-dialog>
</template>

<script setup lang="ts">
/**
 * AutoCAD-style Plot dialog (`plot` / `print`): collects page setup
 * options (layout, paper size, orientation, plot area, offset, scale, plot
 * style) with a live sheet preview and runs the vector PDF plotting engine
 * on OK. Headless plotting without this UI is available via `-plot`.
 */
import type {
  AcApCtbTable,
  AcApPaperSize,
  AcApPlotConvertor as AcApPlotConvertorType,
  AcApPlotOptions
} from '@mlightcad/cad-pdf-plugin'
import {
  AcApDocManager,
  AcEdPromptBoxOptions,
  AcEdPromptStatus
} from '@mlightcad/cad-simple-viewer'
import {
  ElButton,
  ElCheckbox,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElOption,
  ElRadio,
  ElRadioGroup,
  ElSelect
} from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MlBaseDialog from '../common/MlBaseDialog.vue'

interface LayoutEntry {
  name: string
  tabOrder: number
}

const CUSTOM_PAPER_KEY = 'custom'
const FROM_LAYOUT_PAPER_KEY = 'fromLayout'

/** Placeholder catalog used before the plugin chunk loads (labels only). */
const FALLBACK_PAPER_SIZES: AcApPaperSize[] = [
  { key: 'ISO_A4', label: 'ISO A4 (210 x 297 mm)', width: 210, height: 297 },
  { key: 'ISO_A3', label: 'ISO A3 (297 x 420 mm)', width: 297, height: 420 },
  { key: 'ISO_A2', label: 'ISO A2 (420 x 594 mm)', width: 420, height: 594 },
  { key: 'ISO_A1', label: 'ISO A1 (594 x 841 mm)', width: 594, height: 841 },
  { key: 'ISO_A0', label: 'ISO A0 (841 x 1189 mm)', width: 841, height: 1189 },
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
    key: 'ARCH_D',
    label: 'Arch D (24 x 36 in)',
    width: 609.6,
    height: 914.4
  }
]

export interface MlPlotDlgProps {
  modelValue: boolean
}

export type MlPlotDlgEmits = {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<MlPlotDlgProps>()
const emit = defineEmits<MlPlotDlgEmits>()

const { t } = useI18n()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
})

const customPaperKey = CUSTOM_PAPER_KEY
const fromLayoutPaperKey = FROM_LAYOUT_PAPER_KEY

const paperSizes = ref<AcApPaperSize[]>(FALLBACK_PAPER_SIZES)

const layouts = ref<LayoutEntry[]>([])
const busy = ref(false)
const previewSvg = ref('')
const plotWindow = ref<{
  minX: number
  minY: number
  maxX: number
  maxY: number
} | null>(null)
const ctbTable = ref<AcApCtbTable | null>(null)
const ctbFileName = ref('')
const ctbFileInput = ref<HTMLInputElement | null>(null)

type PlotForm = Required<
  Pick<
    AcApPlotOptions,
    | 'paperSizeKey'
    | 'orientation'
    | 'plotArea'
    | 'scaleMode'
    | 'scaleNumerator'
    | 'scaleDenominator'
    | 'plotStyle'
    | 'marginMm'
    | 'centerPlot'
    | 'plotOffsetX'
    | 'plotOffsetY'
    | 'plotTransparency'
    | 'drawViewportContent'
    | 'plotViewportBorders'
  >
> & {
  layoutName: string
  customPaperWidth: number
  customPaperHeight: number
}

const form = reactive<PlotForm>({
  layoutName: '',
  paperSizeKey: 'ISO_A4',
  customPaperWidth: 210,
  customPaperHeight: 297,
  orientation: 'landscape',
  plotArea: 'extents',
  scaleMode: 'fit',
  scaleNumerator: 1,
  scaleDenominator: 1,
  plotStyle: 'ctb',
  marginMm: 5,
  centerPlot: true,
  plotOffsetX: 0,
  plotOffsetY: 0,
  plotTransparency: true,
  drawViewportContent: true,
  plotViewportBorders: false
})

/** AutoCAD "Fit to paper" checkbox maps onto the fit/custom scale mode. */
const fitToPaper = computed({
  get: () => form.scaleMode === 'fit',
  set: (value: boolean) => {
    form.scaleMode = value ? 'fit' : 'custom'
  }
})

async function loadCatalog() {
  try {
    const plugin = await import('@mlightcad/cad-pdf-plugin')
    paperSizes.value = [...plugin.ACAP_PAPER_SIZES]
  } catch {
    // Keep fallback catalog when the plugin chunk cannot be loaded.
  }
}

function resetForm() {
  form.layoutName = ''
  form.paperSizeKey = 'ISO_A4'
  form.orientation = 'landscape'
  form.plotArea = 'extents'
  form.scaleMode = 'fit'
  form.scaleNumerator = 1
  form.scaleDenominator = 1
  form.plotStyle = 'ctb'
  form.marginMm = 5
  form.centerPlot = true
  form.plotOffsetX = 0
  form.plotOffsetY = 0
  form.plotTransparency = true
  form.drawViewportContent = true
  form.plotViewportBorders = false
  plotWindow.value = null
  ctbTable.value = null
  ctbFileName.value = ''
  previewSvg.value = ''
}

function refreshLayouts() {
  const document = AcApDocManager.instance.curDocument
  layouts.value = []
  if (!document?.database) return
  for (const layout of document.database.objects.layout.newIterator()) {
    if (layout.tabOrder > 0) {
      layouts.value.push({
        name: layout.layoutName,
        tabOrder: layout.tabOrder
      })
    }
  }
  layouts.value.sort((a, b) => a.tabOrder - b.tabOrder)
}

// The base dialog emits `open` on every show. `pickWindow` hides then
// re-shows the dialog to let the user pick corners on the canvas; that
// re-show must NOT reset the form (which would wipe the just-picked window
// and force the preview back to extents).
let suppressReopenReset = false

function handleOpen() {
  if (suppressReopenReset) {
    suppressReopenReset = false
    return
  }
  resetForm()
  refreshLayouts()
  void loadCatalog()
  void loadDefaultCtb()
}

/**
 * Loads the bundled default `monochrome.ctb` plot style table so the dialog
 * opens ready to plot monochrome. A user-picked CTB (or another plot style)
 * overrides it.
 */
async function loadDefaultCtb() {
  try {
    const { loadDefaultCtbTable, DEFAULT_CTB_NAME } =
      await import('@mlightcad/cad-pdf-plugin')
    const table = await loadDefaultCtbTable()
    // Only apply if the user has not already loaded/selected something else.
    if (form.plotStyle === 'ctb' && !ctbTable.value) {
      ctbTable.value = table
      ctbFileName.value = DEFAULT_CTB_NAME
    }
  } catch {
    // Bundled CTB unavailable: leave the CTB unselected (user can pick one).
  }
}

/**
 * Guarantees a CTB table is available when the `ctb` plot style is active,
 * falling back to the bundled default. Prevents a race where the user clicks
 * Plot before the default finished loading.
 */
async function ensureCtbLoaded() {
  if (form.plotStyle !== 'ctb' || ctbTable.value) return
  const { loadDefaultCtbTable, DEFAULT_CTB_NAME } =
    await import('@mlightcad/cad-pdf-plugin')
  ctbTable.value = await loadDefaultCtbTable()
  ctbFileName.value = DEFAULT_CTB_NAME
}

function handleLayoutChanged() {
  if (!form.layoutName && form.plotArea === 'layout') {
    form.plotArea = 'extents'
  }
}

/** Human-readable summary of the picked plot window. */
const windowText = computed(() => {
  const win = plotWindow.value
  if (!win) return ''
  const fmt = (value: number) => Math.round(value * 1000) / 1000
  return `X ${fmt(win.minX)} → ${fmt(win.maxX)}, Y ${fmt(win.minY)} → ${fmt(
    win.maxY
  )}`
})

/**
 * Hides the dialog, lets the user drag a rectangular window in the drawing
 * view (like AutoCAD's "Window <" plot area), then reopens the dialog with
 * the window set. Uses the editor's rectangular box rubber-band rather than
 * a line so the selection reads as a window.
 */
async function pickWindow() {
  const editor = AcApDocManager.instance.editor
  visible.value = false
  try {
    const boxPrompt = new AcEdPromptBoxOptions(
      t('dialog.plotDlg.pickFirstCorner'),
      t('dialog.plotDlg.pickSecondCorner')
    )
    boxPrompt.useBasePoint = false
    boxPrompt.useDashedLine = false
    const boxResult = await editor.getBox(boxPrompt)
    if (boxResult.status !== AcEdPromptStatus.OK || !boxResult.value) {
      return
    }
    const box = boxResult.value
    plotWindow.value = {
      minX: Math.min(box.min.x, box.max.x),
      minY: Math.min(box.min.y, box.max.y),
      maxX: Math.max(box.min.x, box.max.x),
      maxY: Math.max(box.min.y, box.max.y)
    }
    form.plotArea = 'window'
  } finally {
    // Re-show without resetting the form, then refresh the preview so it
    // reflects the newly picked window instead of the extents.
    suppressReopenReset = true
    visible.value = true
  }
  if (plotWindow.value) {
    await handlePreview()
  }
}

/** Opens the hidden file input for CTB selection. */
function selectCtbFile() {
  ctbFileInput.value?.click()
}

/**
 * Reads and parses the selected `.ctb` file. Real AutoCAD CTB files are
 * a compressed binary container handled by `parseCtbFile`.
 */
async function handleCtbFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const { parseCtbFile } = await import('@mlightcad/cad-pdf-plugin')
    const bytes = new Uint8Array(await file.arrayBuffer())
    ctbTable.value = await parseCtbFile(bytes)
    ctbFileName.value = file.name
    form.plotStyle = 'ctb'
    ElMessage({
      message: t('dialog.plotDlg.ctbLoaded').replace('{name}', file.name),
      grouping: true,
      type: 'success'
    })
  } catch {
    ctbTable.value = null
    ctbFileName.value = ''
    ElMessage({
      message: t('dialog.plotDlg.ctbInvalid'),
      grouping: true,
      type: 'error'
    })
  }
}

function buildOptions(): AcApPlotOptions {
  return {
    layoutName: form.layoutName || undefined,
    paperSizeKey: form.paperSizeKey,
    customPaperWidth: form.customPaperWidth,
    customPaperHeight: form.customPaperHeight,
    orientation: form.orientation,
    plotArea: form.plotArea,
    plotWindow: plotWindow.value ?? undefined,
    scaleMode: form.scaleMode,
    scaleNumerator: form.scaleNumerator,
    scaleDenominator: form.scaleDenominator,
    plotStyle: form.plotStyle,
    ctbTable: ctbTable.value ?? undefined,
    marginMm: form.marginMm,
    centerPlot: form.centerPlot,
    plotOffsetX: form.plotOffsetX,
    plotOffsetY: form.plotOffsetY,
    plotTransparency: form.plotTransparency,
    drawViewportContent: form.drawViewportContent,
    plotViewportBorders: form.plotViewportBorders
  }
}

async function withConvertor(
  run: (
    convertor: AcApPlotConvertorType,
    options: AcApPlotOptions
  ) => Promise<void>
) {
  const docManager = AcApDocManager.instance
  try {
    const loaded = await docManager.pluginManager.loadByTrigger('-plot')
    if (!loaded) {
      throw new Error(
        'PDF plot engine is not available. Install @mlightcad/cad-pdf-plugin.'
      )
    }
    const { AcApPlotConvertor } = await import('@mlightcad/cad-pdf-plugin')
    busy.value = true
    await ensureCtbLoaded()
    await run(new AcApPlotConvertor(), buildOptions())
  } catch (error) {
    const message =
      error instanceof Error ? error.message : (error as string)?.toString()
    ElMessage({
      message: `${t('dialog.plotDlg.plotFailed')}: ${message}`,
      grouping: true,
      type: 'error'
    })
  } finally {
    busy.value = false
  }
}

async function handlePreview() {
  await withConvertor(async (convertor, options) => {
    previewSvg.value = await convertor.buildSheetSvgAsync(plotSource(), options)
  })
}

/**
 * Minimal document source for the plot engine; avoids constructing a full
 * {@link AcApContext} which would bind database event listeners.
 */
function plotSource() {
  return { doc: AcApDocManager.instance.curDocument }
}

async function handleOk() {
  await withConvertor(async (convertor, options) => {
    await convertor.plot(plotSource(), options)
    visible.value = false
  })
}
</script>

<style scoped>
.ml-plot-dlg {
  display: flex;
  gap: 16px;
  min-height: 420px;
  align-items: flex-start;
}

.ml-plot-dlg__col {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ml-plot-dlg__group {
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 10px 12px 12px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ml-plot-dlg__group > legend {
  padding: 0 6px;
  font-size: var(--ml-dialog-font-size, 12px);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.ml-plot-dlg__group--preview {
  flex: 1 1 auto;
}

.ml-plot-dlg__row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ml-plot-dlg__row--checks {
  gap: 16px;
}

.ml-plot-dlg__label {
  flex: 0 0 78px;
  font-size: var(--ml-dialog-font-size, 12px);
  color: var(--el-text-color-primary);
}

.ml-plot-dlg__label--inline {
  flex: 0 0 auto;
  margin-left: 8px;
}

.ml-plot-dlg__control {
  flex: 1 1 auto;
  min-width: 160px;
}

.ml-plot-dlg__number {
  width: 84px;
}

.ml-plot-dlg__x {
  color: var(--el-text-color-secondary);
}

.ml-plot-dlg__unit {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.ml-plot-dlg__hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.ml-plot-dlg__preview-header {
  display: flex;
  justify-content: flex-end;
}

.ml-plot-dlg__preview-sheet {
  flex: 1 1 auto;
  min-height: 260px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 8px;
}

.ml-plot-dlg__svg {
  width: 100%;
  max-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
}

.ml-plot-dlg__svg :deep(svg) {
  width: 100%;
  height: auto;
  max-height: 420px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(0, 0, 0, 0.06);
}

.ml-plot-dlg__window-value {
  font-size: 11px;
  color: var(--el-text-color-regular);
  font-family: var(--el-font-family, monospace);
  word-break: break-all;
}

.ml-plot-dlg__file-input {
  display: none;
}

.ml-plot-dlg__preview-empty {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
