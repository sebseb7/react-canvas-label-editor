import { imageSrcForStore, imageSrcSummary } from '../../utils/imageSrc'
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
  png: 'PNG',
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

function TextboxFields({ obj, onChange }) {
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
      <label className="canvas-editor-field">
        <span>Text</span>
        <textarea value={obj.text} rows={3} onChange={(e) => set('text', e.target.value)} />
      </label>
      <FieldRow className={fontSizeEnabled ? undefined : 'canvas-editor-field-row--disabled'}>
        <label className="canvas-editor-field">
          <span>Min. Schriftgröße</span>
          <input
            type="number"
            min={1}
            disabled={!fontSizeEnabled}
            value={obj.minFontSize}
            onChange={(e) => set('minFontSize', Number(e.target.value))}
          />
        </label>
        <label className="canvas-editor-field">
          <span>Max. Schriftgröße</span>
          <input
            type="number"
            min={1}
            disabled={!fontSizeEnabled}
            value={obj.maxFontSize}
            onChange={(e) => set('maxFontSize', Number(e.target.value))}
          />
        </label>
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
        <label className="canvas-editor-field">
          <span>X</span>
          <input type="number" value={obj.x} onChange={(e) => set('x', Number(e.target.value))} />
        </label>
        <label className="canvas-editor-field">
          <span>Y</span>
          <input type="number" value={obj.y} onChange={(e) => set('y', Number(e.target.value))} />
        </label>
        <label className="canvas-editor-field">
          <span>Breite</span>
          <input
            type="number"
            min={1}
            value={obj.w}
            onChange={(e) => set('w', Number(e.target.value))}
          />
        </label>
        <label className="canvas-editor-field">
          <span>Höhe</span>
          <input
            type="number"
            min={1}
            value={obj.h}
            onChange={(e) => set('h', Number(e.target.value))}
          />
        </label>
      </FieldRow>
      <FieldRow className="canvas-editor-field-row--quad">
        <label className="canvas-editor-field">
          <span>Links</span>
          <input
            type="number"
            min={0}
            value={obj.marginLeft ?? 0}
            onChange={(e) => set('marginLeft', Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label className="canvas-editor-field">
          <span>Oben</span>
          <input
            type="number"
            min={0}
            value={obj.marginTop ?? 0}
            onChange={(e) => set('marginTop', Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label className="canvas-editor-field">
          <span>Rechts</span>
          <input
            type="number"
            min={0}
            value={obj.marginRight ?? 0}
            onChange={(e) => set('marginRight', Math.max(0, Number(e.target.value)))}
          />
        </label>
        <label className="canvas-editor-field">
          <span>Unten</span>
          <input
            type="number"
            min={0}
            value={obj.marginBottom ?? 0}
            onChange={(e) => set('marginBottom', Math.max(0, Number(e.target.value)))}
          />
        </label>
      </FieldRow>
    </>
  )
}

function BarcodeFields({ obj, onChange }) {
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
      <label className="canvas-editor-field">
        <span>Code</span>
        <input type="text" value={obj.code} onChange={(e) => set('code', e.target.value)} />
      </label>
      {codeError ? (
        <p className="canvas-editor-panel__field-error" role="alert">
          {BARCODE_INVALID_MESSAGE}
        </p>
      ) : null}
      <FieldRow>
        <label className="canvas-editor-field">
          <span>X</span>
          <input type="number" value={obj.x} onChange={(e) => set('x', Number(e.target.value))} />
        </label>
        <label className="canvas-editor-field">
          <span>Y</span>
          <input type="number" value={obj.y} onChange={(e) => set('y', Number(e.target.value))} />
        </label>
      </FieldRow>
      <label className="canvas-editor-field">
        <span>Balkenhöhe</span>
        <input
          type="number"
          min={1}
          value={obj.h}
          onChange={(e) => set('h', Number(e.target.value))}
        />
      </label>
      <label className="canvas-editor-field">
        <span>Modulbreite</span>
        <input
          type="number"
          min={1}
          step={1}
          value={obj.scale}
          onChange={(e) => set('scale', Number(e.target.value))}
        />
      </label>
    </>
  )
}

function PngFields({ obj, onChange }) {
  const set = (field, value) => onChange(field, value)
  const blackpoint = obj.blackpoint ?? 128

  return (
    <>
      <FieldRow>
        <label className="canvas-editor-field">
          <span>X</span>
          <input type="number" value={obj.x} onChange={(e) => set('x', Number(e.target.value))} />
        </label>
        <label className="canvas-editor-field">
          <span>Y</span>
          <input type="number" value={obj.y} onChange={(e) => set('y', Number(e.target.value))} />
        </label>
      </FieldRow>
      <label className="canvas-editor-field">
        <span>Skalierung</span>
        <input
          type="number"
          min={PNG_SCALE_MIN}
          step={0.01}
          value={obj.scale}
          onChange={(e) => set('scale', Math.max(PNG_SCALE_MIN, Number(e.target.value)))}
        />
      </label>
      <label className="canvas-editor-field">
        <span>Schwarzpunkt ({blackpoint})</span>
        <input
          type="range"
          min={0}
          max={255}
          value={blackpoint}
          onChange={(e) => set('blackpoint', Number(e.target.value))}
        />
      </label>
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
      <p className="canvas-editor-panel__image-info">
        {localizedImageSummary(obj.src)}
      </p>
    </>
  )
}

export default function EditorPanel({ selected, onUpdate, onDelete }) {
  const activeType = selected?.type ?? null

  const objFor = (type) => (selected?.type === type ? selected : PLACEHOLDER[type])

  const onChangeFor = (type) => (field, value) => {
    if (selected?.type === type) {
      onUpdate(selected.id, { [field]: value })
    }
  }

  return (
    <aside className="canvas-editor-panel">
      <div className="canvas-editor-panel__header">
        <h3>{selected ? TYPE_LABELS[selected.type] ?? selected.type : 'Eigenschaften'}</h3>
        {selected ? (
          <button
            type="button"
            className="canvas-editor-btn canvas-editor-btn--danger"
            onClick={() => onDelete(selected.id)}
          >
            Löschen
          </button>
        ) : (
          <span className="canvas-editor-panel__header-spacer" aria-hidden="true" />
        )}
      </div>
      <div className="canvas-editor-panel__fields-stack">
        <div className={layerClass('textbox', activeType)}>
          <TextboxFields obj={objFor('textbox')} onChange={onChangeFor('textbox')} />
        </div>
        <div className={layerClass('barcode', activeType)}>
          <BarcodeFields obj={objFor('barcode')} onChange={onChangeFor('barcode')} />
        </div>
        <div className={layerClass('png', activeType)}>
          <PngFields obj={objFor('png')} onChange={onChangeFor('png')} />
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
