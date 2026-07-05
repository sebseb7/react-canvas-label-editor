// Default native-HTML implementations of the injectable Button / TextField /
// Slider controls. Consumers can override any of these via the `components`
// prop on `CanvasEditor` (e.g. to supply MUI equivalents) without needing to
// re-implement the ones they don't care about.

const VARIANT_CLASS = {
  default: '',
  primary: 'canvas-editor-btn--primary',
  danger: 'canvas-editor-btn--danger',
}

export function DefaultButton({
  type = 'button',
  variant = 'default',
  disabled = false,
  onClick,
  children,
  className,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={['canvas-editor-btn', VARIANT_CLASS[variant], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}

export function DefaultTextField({
  label,
  value,
  onChange,
  type = 'text',
  multiline = false,
  rows,
  min,
  max,
  step,
  disabled = false,
  placeholder,
  className = 'canvas-editor-field',
}) {
  const handleChange = (e) => {
    onChange(type === 'number' ? Number(e.target.value) : e.target.value)
  }

  return (
    <label className={className}>
      {label ? <span>{label}</span> : null}
      {multiline ? (
        <textarea
          value={value}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handleChange}
        />
      ) : (
        <input
          type={type}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handleChange}
        />
      )}
    </label>
  )
}

export function DefaultSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled = false,
  className = 'canvas-editor-field',
}) {
  return (
    <label className={className}>
      {label ? <span>{label}</span> : null}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

export const DEFAULT_COMPONENTS = {
  Button: DefaultButton,
  TextField: DefaultTextField,
  Slider: DefaultSlider,
}
