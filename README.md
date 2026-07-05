# react-canvas-label-editor

React class component for editing a template for a 1-bit canvas-rendered label, plus a Node.js rasterizer that produces the final PNG.

```
npm i github:sebseb7/react-canvas-label-editor#v10.0.0
```

## Todo

- Make all displayed text configurable via a props object.


## Usage

```jsx
import { Component } from 'react'
import { CanvasEditor, CANVAS_HEIGHT_DEFAULT, renderLabel } from 'react-canvas-label-editor'
import 'react-canvas-label-editor/style.css'

class App extends Component {
  state = {
    height: CANVAS_HEIGHT_DEFAULT,
    objects: [
      {
        id: '1',
        type: 'textbox',
        text: 'Hello',
        font: 'outfit',
        x: 24,
        y: 24,
        w: 200,
        h: 80,
      },
    ],
  }

  render() {
    const { height, objects } = this.state

    return (
      <CanvasEditor
        width={448}
        height={height}
        onHeightChange={(height) => this.setState({ height })}
        minHeight={80}
        maxHeight={300}
        objects={objects}
        onChange={(objects) => this.setState({ objects })}
        clipboard={clipboard}
        onCopy={(object) => this.setState({ clipboard: object })}
      />
    )
  }
}
```

`width`, `minHeight` and `maxHeight` are all optional and default to the library's built-in label size (`CANVAS_WIDTH`, `CANVAS_HEIGHT_MIN`, `CANVAS_HEIGHT_MAX`, also exported by the package).

### Custom button, textfield, and slider components

`CanvasEditor` renders its buttons, text/number inputs, and sliders through an optional `components` prop. Any component you don't override falls back to the built-in native-HTML implementation, so you only need to supply the ones you want to replace (e.g. with MUI):

```jsx
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Slider from '@mui/material/Slider'

const muiComponents = {
  Button: ({ variant, disabled, onClick, children }) => (
    <Button
      variant={variant === 'primary' ? 'contained' : 'outlined'}
      color={variant === 'danger' ? 'error' : 'primary'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  ),
  TextField: ({ label, value, onChange, type, multiline, rows, min, max, step, disabled, placeholder }) => (
    <TextField
      label={label}
      value={value}
      type={multiline ? undefined : type}
      multiline={multiline}
      rows={rows}
      disabled={disabled}
      placeholder={placeholder}
      inputProps={{ min, max, step }}
      onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
    />
  ),
  Slider: ({ label, value, onChange, min, max, step, disabled }) => (
    <div>
      {label ? <span>{label}</span> : null}
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(_, newValue) => onChange(newValue)}
      />
    </div>
  ),
}

// <CanvasEditor ... components={muiComponents} />
```

## Serverside:

```js
import { renderLabel } from 'react-canvas-label-editor'

const pngBuffer = await renderLabel({ height: 200, width: 448, objects })
```

`width` is optional on `renderLabel` too and defaults to `CANVAS_WIDTH` when omitted.
