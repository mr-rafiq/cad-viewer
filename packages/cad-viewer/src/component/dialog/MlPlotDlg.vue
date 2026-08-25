<template>
  <ml-base-dialog
    v-model:modelValue="visible"
    :title="t('dialog.plotDlg.title')"
    :width="880"
    :auto-close="false"
    @open="handleOpen"
    @ok="handleOk"
  >
    <div class="ml-plot-dlg">
      <div class="ml-plot-dlg__settings">
        <div class="ml-plot-dlg__row">
          <label class="ml-plot-dlg__label">{{
            t('dialog.plotDlg.layout')
          }}</label>
          <el-select
            v-model="form.layoutName"
            class="ml-plot-dlg__control"
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

        <div class="ml-plot-dlg__row">
          <label class="ml-plot-dlg__label">{{
            t('dialog.plotDlg.paperSize')
          }}</label>
          <el-select v-model="form.paperSizeKey" class="ml-plot-dlg__control">
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
            class="ml-plot-dlg__number"
          />
          <span class="ml-plot-dlg__unit">{{
            t('dialog.plotDlg.unitMm')
          }}</span>
        </div>

        <div class="ml-plot-dlg__row">
          <label class="ml-plot-dlg__label">{{
            t('dialog.plotDlg.orientation')
          }}</label>
          <el-radio-group v-model="form.orientation">
            <el-radio value="portrait">{{
              t('dialog.plotDlg.portrait')
            }}</el-radio>
            <el-radio value="landscape">{{
              t('dialog.plotDlg.landscape')
            }}</el-radio>
          </el-radio-group>
        </div>

        <div class="ml-plot-dlg__row">
          <label class="ml-plot-dlg__label">{{
            t('dialog.plotDlg.plotArea')
          }}</label>
          <el-radio-group v-model="form.plotArea">
            <el-radio value="extents">{{
              t('dialog.plotDlg.areaExtents')
            }}</el-radio>
            <el-radio value="window">{{
              t('dialog.plotDlg.areaWindow')
            }}</el-radio>
            <el-radio v-if="form.layoutName" value="layout">{{
              t('dialog.plotDlg.areaLayout')
            }}</el-radio>
          </el-radio-group>
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
          <el-button
            size="small"
            :disabled="busy"
            @click="pickWindow"
          >
            {{ t('dialog.plotDlg.windowPick') }}
          </el-button>
        </div>

        <div class="ml-plot-dlg__row">
          <label class="ml-plot-dlg__label">{{
            t('dialog.plotDlg.scale')
          }}</label>
          <el-radio-group v-model="form.scaleMode">
            <el-radio value="fit">{{ t('dialog.plotDlg.scaleFit') }}</el-radio>
            <el-radio value="custom">{{
              t('dialog.plotDlg.scaleCustom')
            }}</el-radio>
          </el-radio-group>
          <template v-if="form.scaleMode === 'custom'">
            <el-input-number
              v-model="form.scaleNumerator"
              :min="1"
              :max="100000"
              :controls="false"
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
              class="ml-plot-dlg__number"
            />
          </template>
        </div>

        <div class="ml-plot-dlg__row">
          <label class="ml-plot-dlg__label">{{
            t('dialog.plotDlg.plotStyle')
          }}</label>
          <el-radio-group v-model="form.plotStyle">
            <el-radio value="asIs">{{
              t('dialog.plotDlg.styleAsIs')
            }}</el-radio>
            <el-radio value="monochrome">{{
              t('dialog.plotDlg.styleMono')
            }}</el-radio>
            <el-radio value="grayscale">{{
              t('dialog.plotDlg.styleGray')
            }}</el-radio>
            <el-radio value="ctb">{{
              t('dialog.plotDlg.styleCtb')
            }}</el-radio>
          </el-radio-group>
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
          <el-button
            size="small"
            :disabled="busy"
            @click="selectCtbFile"
          >
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

        <div class="ml-plot-dlg__row">
          <label class="ml-plot-dlg__label">{{
            t('dialog.plotDlg.margins')
          }}</label>
          <el-input-number
            v-model="form.marginMm"
            :min="0"
            :max="100"
            :controls="false"
            class="ml-plot-dlg__number"
          />
          <span class="ml-plot-dlg__unit">{{
            t('dialog.plotDlg.unitMm')
          }}</span>
          <el-checkbox v-model="form.centerPlot" class="ml-plot-dlg__check">{{
            t('dialog.plotDlg.centerPlot')
          }}</el-checkbox>
        </div>

        <template v-if="form.layoutName">
          <div class="ml-plot-dlg__section-title">
            {{ t('dialog.plotDlg.viewportSection') }}
          </div>
          <div class="ml-plot-dlg__row ml-plot-dlg__row--checks">
            <el-checkbox v-model="form.drawViewportContent">{{
              t('dialog.plotDlg.drawViewportContent')
            }}</el-checkbox>
            <el-checkbox v-model="form.plotViewportBorders">{{
              t('dialog.plotDlg.plotViewportBorders')
            }}</el-checkbox>
          </div>
        </template>
      </div>

      <div class="ml-plot-dlg__preview-pane">
        <div class="ml-plot-dlg__preview-header">
          <span>{{ t('dialog.plotDlg.preview') }}</span>
          <el-button size="small" :loading="busy" @click="handlePreview">
            {{ t('dialog.plotDlg.previewRefresh') }}
          </el-button>
        </div>
        <div class="ml-plot-dlg__preview-sheet">
          <!-- eslint-disable-next-line vue/no-v-html — markup is generated locally by the plot engine -->
          <div v-if="previewSvg" class="ml-plot-dlg__svg" v-html="previewSvg" />
          <div v-else class="ml-plot-dlg__preview-empty">
            {{ t('dialog.plotDlg.previewEmpty') }}
          </div>
        </div>
      </div>
    </div>
  </ml-base-dialog>
</template>

<script setup lang="ts">
/**
 * AutoCAD-style Plot dialog (`plot` / `print`): collects page setup
 * options (layout, paper size, orientation, plot area, scale, plot style)
 * with a live sheet preview and runs the vector PDF plotting engine on OK.
 * Headless plotting without this UI is available via `-plot`.
 */
import type {
  AcApPaperSize,
  AcApPlotOptions,
  AcApPlotConvertor as AcApPlotConvertorType,
  AcApCtbTable
} from '@mlightcad/cad-pdf-plugin'
import {
  AcApDocManager,
  AcEdPromptPointOptions,
  AcEdPromptStatus
} from '@mlightcad/cad-simple-viewer'
import {
  ElButton,
  ElCheckbox,
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
const plotWindow = ref<
  { minX: number; minY: number; maxX: number; maxY: number } | null
>(null)
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
  plotStyle: 'asIs',
  marginMm: 5,
  centerPlot: true,
  drawViewportContent: true,
  plotViewportBorders: false
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
  form.plotStyle = 'asIs'
  form.marginMm = 5
  form.centerPlot = true
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

function handleOpen() {
  resetForm()
  refreshLayouts()
  void loadCatalog()
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
 * Hides the dialog, lets the user pick two opposite corners in the
 * drawing view (like AutoCAD's "Window <" plot area), then reopens the
 * dialog with the window set.
 */
async function pickWindow() {
  const editor = AcApDocManager.instance.editor
  visible.value = false
  try {
    const firstPrompt = new AcEdPromptPointOptions(
      t('dialog.plotDlg.pickFirstCorner')
    )
    const firstResult = await editor.getPoint(firstPrompt)
    if (firstResult.status !== AcEdPromptStatus.OK || !firstResult.value) {
      return
    }
    const secondPrompt = new AcEdPromptPointOptions(
      t('dialog.plotDlg.pickSecondCorner')
    )
    secondPrompt.useDashedLine = true
    secondPrompt.useBasePoint = true
    secondPrompt.basePoint = firstResult.value
    const secondResult = await editor.getPoint(secondPrompt)
    if (secondResult.status !== AcEdPromptStatus.OK || !secondResult.value) {
      return
    }
    plotWindow.value = {
      minX: Math.min(firstResult.value.x, secondResult.value.x),
      minY: Math.min(firstResult.value.y, secondResult.value.y),
      maxX: Math.max(firstResult.value.x, secondResult.value.x),
      maxY: Math.max(firstResult.value.y, secondResult.value.y)
    }
    form.plotArea = 'window'
    await handlePreview()
  } finally {
    visible.value = true
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
      message: t('dialog.plotDlg.ctbLoaded').replace(
        '{name}',
        file.name
      ),
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
  min-height: 360px;
}

.ml-plot-dlg__settings {
  flex: 0 0 340px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  flex: 0 0 88px;
  font-size: var(--ml-dialog-font-size, 12px);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.ml-plot-dlg__control {
  flex: 1 1 auto;
  min-width: 180px;
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

.ml-plot-dlg__check {
  margin-left: auto;
}

.ml-plot-dlg__section-title {
  font-size: var(--ml-dialog-font-size, 12px);
  font-weight: 600;
  color: var(--el-text-color-secondary);
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
}

.ml-plot-dlg__preview-pane {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.ml-plot-dlg__preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--ml-dialog-font-size, 12px);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.ml-plot-dlg__preview-sheet {
  flex: 1 1 auto;
  min-height: 280px;
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
