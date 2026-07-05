// Default English text for everything the editor UI displays. Consumers can
// override any of these via the `labels` prop on `CanvasEditor` (e.g. to
// localize the editor) without needing to re-specify the ones they don't
// care about — `mergeLabels` deep-merges overrides onto these defaults.

export const DEFAULT_LABELS = {
  toolbar: {
    addTextbox: '+ Text',
    addBarcode: '+ Barcode',
    addImage: '+ Image',
    height: (height) => `Height ${height}`,
  },
  panel: {
    titles: {
      textbox: 'Textbox',
      barcode: 'Barcode',
      png: 'Image',
      default: 'Properties',
    },
    paste: 'Paste',
    copy: 'Copy',
    delete: 'Delete',
    hint: 'Click an object to edit it, or create a new object.',
  },
  textbox: {
    font: 'Font',
    text: 'Text',
    minFontSize: 'Min font size',
    maxFontSize: 'Max font size',
    horizontal: 'Horizontal',
    vertical: 'Vertical',
    invertColors: 'Invert colors',
    cornerRadius: 'Corner radius',
    x: 'X',
    y: 'Y',
    width: 'Width',
    height: 'Height',
    marginLeft: 'Left',
    marginTop: 'Top',
    marginRight: 'Right',
    marginBottom: 'Bottom',
    halign: {
      left: 'Left',
      center: 'Center',
      right: 'Right',
    },
    valign: {
      top: 'Top',
      middle: 'Middle',
      bottom: 'Bottom',
    },
    placeholderText: 'Sample text',
    defaultText: 'Sample text',
  },
  barcode: {
    format: 'Format',
    code: 'Code',
    x: 'X',
    y: 'Y',
    barHeight: 'Bar height',
    moduleWidth: 'Module width',
    invalidCode: 'Invalid barcode',
  },
  png: {
    x: 'X',
    y: 'Y',
    scale: 'Scale',
    blackpoint: (value) => `Black point (${value})`,
    image: 'Image',
    noImage: 'No image',
    imageSummary: (format, chars) => `${format} (${chars} chars)`,
    editSvg: 'Edit SVG',
    editSvgTitle: 'Edit SVG',
    svgPlaceholder: '<svg>...</svg>',
    cancel: 'Cancel',
    apply: 'Apply',
  },
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function mergeLabels(base, overrides) {
  if (!isPlainObject(overrides)) return base
  const result = { ...base }
  for (const key of Object.keys(overrides)) {
    const value = overrides[key]
    result[key] = isPlainObject(value) && isPlainObject(base[key])
      ? mergeLabels(base[key], value)
      : value
  }
  return result
}
