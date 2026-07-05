import { useState } from 'react'
import { imageSrcForStore, imageSrcFormat, imageSrcSummary } from '../../utils/imageSrc'
import { BARCODE_INVALID_MESSAGE, getBarcodeValidationError } from '../../utils/barcode'
import {
  DEFAULT_TEXTBOX_FONT,
  isTtfTextboxFont,
  TEXTBOX_FONT_OPTIONS,
} from '../../utils/textboxFonts'
import {
  TEXTBOX_HALIGN_LABELS,
  TEXTBOX_HALIGNS,
  TEXTBOX_VALIGN_LABELS,
  TEXTBOX_VALIGNS,
} from '../../utils/textboxStyle'
import { PNG_SCALE_MIN } from './constants'

const TYPE_LABELS = {
  textbox: 'Textfeld',
  barcode: 'Barcode',
  png: 'Image',
}

function localizedImageSummary(src) {
  if (!src?.trim()) return 'Kein Bild'
  const summary = imageSrcSummary(src)
  if (summary === 'No image') return 'Kein Bild'
  return summary.replace(/\((\d+) chars\)/, '($1 Zeichen)')
}

const PLACEHOLDER = {
  textbox: {
    type: 'textbox',
    text: 'Beispieltext',
    font: DEFAULT_TEXTBOX_FONT,
    blackpoint: 128,
    minFontSize: 14,
    maxFontSize: 36,
    halign: 'left',
    valign: 'top',
    invert: false,
    cornerRadius: 0,
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

function TextboxFields({ obj, onChange, components }) {
  const { TextField } = components
  const set = (field, value) => onChange(field, value)
  const font = obj.font ?? DEFAULT_TEXTBOX_FONT
  const fontSizeEnabled = isTtfTextboxFont(font)
  const invert = Boolean(obj.invert)

  return (
    <>
      <label className="canvas-editor-field">
        <span>Schriftart</span>
        <select value={font} onChange={(e) => set('font', e.target.value)}>
          {TEXTBOX_FONT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <TextField
        label="Text"
        multiline
        rows={3}
        value={obj.text}
        onChange={(value) => set('text', value)}
      />
      <FieldRow className={fontSizeEnabled ? undefined : 'canvas-editor-field-row--disabled'}>
        <TextField
          label="Min. Schriftgröße"
          type="number"
          min={1}
          disabled={!fontSizeEnabled}
          value={obj.minFontSize}
          onChange={(value) => set('minFontSize', value)}
        />
        <TextField
          label="Max. Schriftgröße"
          type="number"
          min={1}
          disabled={!fontSizeEnabled}
          value={obj.maxFontSize}
          onChange={(value) => set('maxFontSize', value)}
        />
      </FieldRow>
      <FieldRow>
        <label className="canvas-editor-field">
          <span>Horizontal</span>
          <select value={obj.halign ?? 'left'} onChange={(e) => set('halign', e.target.value)}>
            {TEXTBOX_HALIGNS.map((id) => (
              <option key={id} value={id}>
                {TEXTBOX_HALIGN_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="canvas-editor-field">
          <span>Vertikal</span>
          <select value={obj.valign ?? 'top'} onChange={(e) => set('valign', e.target.value)}>
            {TEXTBOX_VALIGNS.map((id) => (
              <option key={id} value={id}>
                {TEXTBOX_VALIGN_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </FieldRow>
      <FieldRow>
        <label className="canvas-editor-field canvas-editor-field--checkbox">
          <span>Farben invertieren</span>
          <input
            type="checkbox"
            checked={invert}
            onChange={(e) => set('invert', e.target.checked)}
          />
        </label>
        <label
          className={[
            'canvas-editor-field',
            invert ? '' : 'canvas-editor-field--disabled',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span>Eckenradius</span>
          <input
            type="number"
            min={0}
            disabled={!invert}
            value={obj.cornerRadius ?? 0}
            onChange={(e) => set('cornerRadius', Math.max(0, Number(e.target.value)))}
          />
        </label>
      </FieldRow>
      <FieldRow className="canvas-editor-field-row--quad">
        <TextField label="X" type="number" value={obj.x} onChange={(value) => set('x', value)} />
        <TextField label="Y" type="number" value={obj.y} onChange={(value) => set('y', value)} />
        <TextField
          label="Breite"
          type="number"
          min={1}
          value={obj.w}
          onChange={(value) => set('w', value)}
        />
        <TextField
          label="Höhe"
          type="number"
          min={1}
          value={obj.h}
          onChange={(value) => set('h', value)}
        />
      </FieldRow>
      <FieldRow className="canvas-editor-field-row--quad">
        <TextField
          label="Links"
          type="number"
          min={0}
          value={obj.marginLeft ?? 0}
          onChange={(value) => set('marginLeft', Math.max(0, value))}
        />
        <TextField
          label="Oben"
          type="number"
          min={0}
          value={obj.marginTop ?? 0}
          onChange={(value) => set('marginTop', Math.max(0, value))}
        />
        <TextField
          label="Rechts"
          type="number"
          min={0}
          value={obj.marginRight ?? 0}
          onChange={(value) => set('marginRight', Math.max(0, value))}
        />
        <TextField
          label="Unten"
          type="number"
          min={0}
          value={obj.marginBottom ?? 0}
          onChange={(value) => set('marginBottom', Math.max(0, value))}
        />
      </FieldRow>
    </>
  )
}

function BarcodeFields({ obj, onChange, components }) {
  const { TextField } = components
  const set = (field, value) => onChange(field, value)
  const codeError = getBarcodeValidationError(obj.code)

  return (
    <>
      <label className="canvas-editor-field">
        <span>Format</span>
        <select value={obj.format || 'EAN13'} onChange={(e) => set('format', e.target.value)}>
          <option value="EAN13">EAN-13</option>
          <option value="EAN8">EAN-8</option>
        </select>
      </label>
      <TextField label="Code" value={obj.code} onChange={(value) => set('code', value)} />
      {codeError ? (
        <p className="canvas-editor-panel__field-error" role="alert">
          {BARCODE_INVALID_MESSAGE}
        </p>
      ) : null}
      <FieldRow>
        <TextField label="X" type="number" value={obj.x} onChange={(value) => set('x', value)} />
        <TextField label="Y" type="number" value={obj.y} onChange={(value) => set('y', value)} />
      </FieldRow>
      <TextField
        label="Balkenhöhe"
        type="number"
        min={1}
        value={obj.h}
        onChange={(value) => set('h', value)}
      />
      <TextField
        label="Modulbreite"
        type="number"
        min={1}
        step={1}
        value={obj.scale}
        onChange={(value) => set('scale', value)}
      />
    </>
  )
}

function SvgEditDialog({ initialValue, onSave, onClose, components }) {
  const { Button, TextField } = components
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
        aria-label="SVG bearbeiten"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="canvas-editor-modal__title">SVG bearbeiten</h4>
        <TextField
          className="canvas-editor-field canvas-editor-modal__textarea-field"
          multiline
          rows={14}
          value={draft}
          onChange={setDraft}
          placeholder="<svg>...</svg>"
        />
        <div className="canvas-editor-modal__actions">
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" onClick={() => onSave(draft)}>
            Übernehmen
          </Button>
        </div>
      </div>
    </div>
  )
}

function PngFields({ obj, onChange, components }) {
  const { Button, TextField, Slider } = components
  const set = (field, value) => onChange(field, value)
  const blackpoint = obj.blackpoint ?? 128
  const format = imageSrcFormat(obj.src)
  const canEditSvg = format === 'svg' || !format
  const [svgDialogOpen, setSvgDialogOpen] = useState(false)

  return (
    <>
      <FieldRow>
        <TextField label="X" type="number" value={obj.x} onChange={(value) => set('x', value)} />
        <TextField label="Y" type="number" value={obj.y} onChange={(value) => set('y', value)} />
      </FieldRow>
      <TextField
        label="Skalierung"
        type="number"
        min={PNG_SCALE_MIN}
        step={0.01}
        value={obj.scale}
        onChange={(value) => set('scale', Math.max(PNG_SCALE_MIN, value))}
      />
      <Slider
        label={`Schwarzpunkt (${blackpoint})`}
        min={0}
        max={255}
        value={blackpoint}
        onChange={(value) => set('blackpoint', value)}
      />
      <label className="canvas-editor-field">
        <span>Bild</span>
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
          {localizedImageSummary(obj.src)}
        </p>
        {canEditSvg ? (
          <Button onClick={() => setSvgDialogOpen(true)}>SVG bearbeiten</Button>
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
}) {
  const { Button } = components
  const activeType = selected?.type ?? null

  const objFor = (type) => (selected?.type === type ? selected : PLACEHOLDER[type])

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
        <h3>{selected ? TYPE_LABELS[selected.type] ?? selected.type : 'Eigenschaften'}</h3>
        {hasActions ? (
          <div className="canvas-editor-panel__header-actions">
            {showPaste ? (
              <Button onClick={() => onPaste?.(clipboard)}>Einfügen</Button>
            ) : null}
            {selected ? (
              <>
                <Button onClick={() => onCopy?.(selected)}>Kopie</Button>
                <Button variant="danger" onClick={() => onDelete(selected.id)}>
                  Löschen
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
          <TextboxFields obj={objFor('textbox')} onChange={onChangeFor('textbox')} components={components} />
        </div>
        <div className={layerClass('barcode', activeType)}>
          <BarcodeFields obj={objFor('barcode')} onChange={onChangeFor('barcode')} components={components} />
        </div>
        <div className={layerClass('png', activeType)}>
          <PngFields obj={objFor('png')} onChange={onChangeFor('png')} components={components} />
        </div>
      </div>
      {!selected ? (
        <p className="canvas-editor-panel__hint">
          Klicke auf ein Objekt, um es zu bearbeiten, oder erstelle ein neues Objekt.
        </p>
      ) : null}
    </aside>
  )
}
