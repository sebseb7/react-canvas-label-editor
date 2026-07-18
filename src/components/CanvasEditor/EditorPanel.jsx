import { useState } from 'react'
import { imageSrcForStore, imageSrcFormat } from '../../utils/imageSrc'
import { getBarcodeValidationError } from '../../utils/barcode'
import {
  DEFAULT_TEXTBOX_FONT,
  isTtfTextboxFont,
  TEXTBOX_FONT_OPTIONS,
} from '../../utils/textboxFonts'
import { TEXTBOX_HALIGNS, TEXTBOX_VALIGNS } from '../../utils/textboxStyle'
import { PNG_SCALE_MIN, TEXTBOX_ROTATIONS } from './constants'
import { snapRotation } from './geometry'

function imageSummary(src, labels) {
  if (!src?.trim()) return labels.png.noImage
  const format = imageSrcFormat(src)
  if (!format) return labels.png.noImage
  return labels.png.imageSummary(format.toUpperCase(), src.trim().length)
}

const PLACEHOLDER = {
  textbox: {
    type: 'textbox',
    text: 'Sample text',
    font: DEFAULT_TEXTBOX_FONT,
    blackpoint: 128,
    minFontSize: 14,
    maxFontSize: 36,
    halign: 'left',
    valign: 'top',
    invert: false,
    cornerRadius: 0,
    rotation: 0,
    marginLeft: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    x: 0,
    y: 0,
    w: 200,
    h: 80,
  },
  barcode: {
    type: 'barcode',
    format: 'EAN13',
    code: '4006381333931',
    x: 0,
    y: 0,
    h: 60,
    scale: 2,
  },
  png: {
    type: 'png',
    x: 0,
    y: 0,
    scale: 1,
    src: ' ',
    blackpoint: 128,
  },
}

function layerClass(type, activeType) {
  return [
    'canvas-editor-panel__fields-layer',
    activeType === type ? 'canvas-editor-panel__fields-layer--active' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function FieldRow({ children, className }) {
  return (
    <div className={['canvas-editor-field-row', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

function TextboxFields({ obj, onChange, components, labels }) {
  const { TextField } = components
  const t = labels.textbox
  const set = (field, value) => onChange(field, value)
  const font = obj.font ?? DEFAULT_TEXTBOX_FONT
  const fontSizeEnabled = isTtfTextboxFont(font)
  const invert = Boolean(obj.invert)

  return (
    <>
      <label className="canvas-editor-field">
        <span>{t.font}</span>
        <select value={font} onChange={(e) => set('font', e.target.value)}>
          {TEXTBOX_FONT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label={t.text}
        multiline
        rows={3}
        value={obj.text}
        onChange={(value) => set('text', value)}
      />
      <FieldRow className={fontSizeEnabled ? undefined : 'canvas-editor-field-row--disabled'}>
        <TextField
          label={t.minFontSize}
          type="number"
          min={1}
          disabled={!fontSizeEnabled}
          value={obj.minFontSize}
          onChange={(value) => set('minFontSize', value)}
        />
        <TextField
          label={t.maxFontSize}
          type="number"
          min={1}
          disabled={!fontSizeEnabled}
          value={obj.maxFontSize}
          onChange={(value) => set('maxFontSize', value)}
        />
      </FieldRow>
      <FieldRow>
        <label className="canvas-editor-field">
          <span>{t.horizontal}</span>
          <select value={obj.halign ?? 'left'} onChange={(e) => set('halign', e.target.value)}>
            {TEXTBOX_HALIGNS.map((id) => (
              <option key={id} value={id}>
                {t.halign[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="canvas-editor-field">
          <span>{t.vertical}</span>
          <select value={obj.valign ?? 'top'} onChange={(e) => set('valign', e.target.value)}>
            {TEXTBOX_VALIGNS.map((id) => (
              <option key={id} value={id}>
                {t.valign[id]}
              </option>
            ))}
          </select>
        </label>
      </FieldRow>
      <FieldRow className="canvas-editor-field-row--triple">
        <label className="canvas-editor-field canvas-editor-field--checkbox">
          <span>{t.invertColors}</span>
          <span className="canvas-editor-field__control">
            <input
              type="checkbox"
              checked={invert}
              onChange={(e) => set('invert', e.target.checked)}
            />
          </span>
        </label>
        <label
          className={[
            'canvas-editor-field',
            invert ? '' : 'canvas-editor-field--disabled',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span>{t.cornerRadius}</span>
          <input
            type="number"
            min={0}
            disabled={!invert}
            value={obj.cornerRadius ?? 0}
            onChange={(e) => set('cornerRadius', Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label className="canvas-editor-field">
          <span>{t.rotation}</span>
          <select
            value={String(snapRotation(obj.rotation ?? 0))}
            onChange={(e) => {
              const next = Number(e.target.value)
              if (snapRotation(obj.rotation ?? 0) === next) return
              set('rotation', next)
            }}
          >
            {TEXTBOX_ROTATIONS.map((deg) => (
              <option key={deg} value={String(deg)}>
                {deg}°
              </option>
            ))}
          </select>
        </label>
      </FieldRow>
      <FieldRow className="canvas-editor-field-row--quad">
        <TextField label={t.x} type="number" value={obj.x} onChange={(value) => set('x', value)} />
        <TextField label={t.y} type="number" value={obj.y} onChange={(value) => set('y', value)} />
        <TextField
          label={t.width}
          type="number"
          min={1}
          value={obj.w}
          onChange={(value) => set('w', value)}
        />
        <TextField
          label={t.height}
          type="number"
          min={1}
          value={obj.h}
          onChange={(value) => set('h', value)}
        />
      </FieldRow>
      <FieldRow className="canvas-editor-field-row--quad">
        <TextField
          label={t.marginLeft}
          type="number"
          min={0}
          value={obj.marginLeft ?? 0}
          onChange={(value) => set('marginLeft', Math.max(0, value))}
        />
        <TextField
          label={t.marginTop}
          type="number"
          min={0}
          value={obj.marginTop ?? 0}
          onChange={(value) => set('marginTop', Math.max(0, value))}
        />
        <TextField
          label={t.marginRight}
          type="number"
          min={0}
          value={obj.marginRight ?? 0}
          onChange={(value) => set('marginRight', Math.max(0, value))}
        />
        <TextField
          label={t.marginBottom}
          type="number"
          min={0}
          value={obj.marginBottom ?? 0}
          onChange={(value) => set('marginBottom', Math.max(0, value))}
        />
      </FieldRow>
    </>
  )
}

function BarcodeFields({ obj, onChange, components, labels }) {
  const { TextField } = components
  const t = labels.barcode
  const set = (field, value) => onChange(field, value)
  const codeError = getBarcodeValidationError(obj.code, t.invalidCode, obj.format || 'EAN13')

  return (
    <>
      <label className="canvas-editor-field">
        <span>{t.format}</span>
        <select value={obj.format || 'EAN13'} onChange={(e) => set('format', e.target.value)}>
          <option value="EAN13">EAN-13</option>
          <option value="EAN8">EAN-8</option>
          <option value="CODE128">Code 128</option>
          <option value="QR">QR</option>
        </select>
      </label>
      <TextField label={t.code} value={obj.code} onChange={(value) => set('code', value)} />
      {codeError ? (
        <p className="canvas-editor-panel__field-error" role="alert">
          {codeError}
        </p>
      ) : null}
      <FieldRow>
        <TextField label={t.x} type="number" value={obj.x} onChange={(value) => set('x', value)} />
        <TextField label={t.y} type="number" value={obj.y} onChange={(value) => set('y', value)} />
      </FieldRow>
      {obj.format === 'QR' ? null : (
        <TextField
          label={t.barHeight}
          type="number"
          min={1}
          value={obj.h}
          onChange={(value) => set('h', value)}
        />
      )}
      <TextField
        label={t.moduleWidth}
        type="number"
        min={1}
        step={1}
        value={obj.scale}
        onChange={(value) => set('scale', value)}
      />
    </>
  )
}

function SvgEditDialog({ initialValue, onSave, onClose, components, labels }) {
  const { Button, TextField } = components
  const t = labels.png
  const [draft, setDraft] = useState(initialValue)

  return (
    <div
      className="canvas-editor-modal-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="canvas-editor-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t.editSvgTitle}
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="canvas-editor-modal__title">{t.editSvgTitle}</h4>
        <TextField
          className="canvas-editor-field canvas-editor-modal__textarea-field"
          multiline
          rows={14}
          value={draft}
          onChange={setDraft}
          placeholder={t.svgPlaceholder}
        />
        <div className="canvas-editor-modal__actions">
          <Button onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" onClick={() => onSave(draft)}>
            {t.apply}
          </Button>
        </div>
      </div>
    </div>
  )
}

function PngFields({ obj, onChange, components, labels }) {
  const { Button, TextField, Slider } = components
  const t = labels.png
  const set = (field, value) => onChange(field, value)
  const blackpoint = obj.blackpoint ?? 128
  const format = imageSrcFormat(obj.src)
  const canEditSvg = format === 'svg' || !format
  const [svgDialogOpen, setSvgDialogOpen] = useState(false)

  return (
    <>
      <FieldRow>
        <TextField label={t.x} type="number" value={obj.x} onChange={(value) => set('x', value)} />
        <TextField label={t.y} type="number" value={obj.y} onChange={(value) => set('y', value)} />
      </FieldRow>
      <TextField
        label={t.scale}
        type="number"
        min={PNG_SCALE_MIN}
        step={0.01}
        value={obj.scale}
        onChange={(value) => set('scale', Math.max(PNG_SCALE_MIN, value))}
      />
      <Slider
        label={t.blackpoint(blackpoint)}
        min={0}
        max={255}
        value={blackpoint}
        onChange={(value) => set('blackpoint', value)}
      />
      <label className="canvas-editor-field">
        <span>{t.image}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,.svg"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              set('src', imageSrcForStore(String(reader.result ?? '')))
              e.target.value = ''
            }
            const isSvg =
              file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')
            if (isSvg) {
              reader.readAsText(file)
            } else {
              reader.readAsDataURL(file)
            }
          }}
        />
      </label>
      <div className="canvas-editor-field-row canvas-editor-field-row--info">
        <p className="canvas-editor-panel__image-info">
          {imageSummary(obj.src, labels)}
        </p>
        {canEditSvg ? (
          <Button onClick={() => setSvgDialogOpen(true)}>{t.editSvg}</Button>
        ) : null}
      </div>
      {svgDialogOpen ? (
        <SvgEditDialog
          initialValue={format === 'svg' ? obj.src : ''}
          onClose={() => setSvgDialogOpen(false)}
          onSave={(svg) => {
            set('src', imageSrcForStore(svg))
            setSvgDialogOpen(false)
          }}
          components={components}
          labels={labels}
        />
      ) : null}
    </>
  )
}

export default function EditorPanel({
  selected,
  onUpdate,
  onDelete,
  onCopy,
  clipboard,
  onPaste,
  components,
  labels,
}) {
  const { Button } = components
  const activeType = selected?.type ?? null

  const objFor = (type) => {
    if (selected?.type === type) return selected
    if (type === 'textbox') {
      return { ...PLACEHOLDER.textbox, text: labels.textbox.placeholderText }
    }
    return PLACEHOLDER[type]
  }

  const onChangeFor = (type) => (field, value) => {
    if (selected?.type === type) {
      onUpdate(selected.id, { [field]: value })
    }
  }

  const showPaste = Boolean(clipboard)
  const hasActions = Boolean(selected) || showPaste

  return (
    <aside className="canvas-editor-panel">
      <div className="canvas-editor-panel__header">
        <h3>{selected ? labels.panel.titles[selected.type] ?? selected.type : labels.panel.titles.default}</h3>
        {hasActions ? (
          <div className="canvas-editor-panel__header-actions">
            {showPaste ? (
              <Button onClick={() => onPaste?.(clipboard)}>{labels.panel.paste}</Button>
            ) : null}
            {selected ? (
              <>
                <Button onClick={() => onCopy?.(selected)}>{labels.panel.copy}</Button>
                <Button variant="danger" onClick={() => onDelete(selected.id)}>
                  {labels.panel.delete}
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <span className="canvas-editor-panel__header-spacer" aria-hidden="true" />
        )}
      </div>
      <div className="canvas-editor-panel__fields-stack">
        <div className={layerClass('textbox', activeType)}>
          <TextboxFields obj={objFor('textbox')} onChange={onChangeFor('textbox')} components={components} labels={labels} />
        </div>
        <div className={layerClass('barcode', activeType)}>
          <BarcodeFields obj={objFor('barcode')} onChange={onChangeFor('barcode')} components={components} labels={labels} />
        </div>
        <div className={layerClass('png', activeType)}>
          <PngFields obj={objFor('png')} onChange={onChangeFor('png')} components={components} labels={labels} />
        </div>
      </div>
      {!selected ? (
        <p className="canvas-editor-panel__hint">
          {labels.panel.hint}
        </p>
      ) : null}
    </aside>
  )
}
