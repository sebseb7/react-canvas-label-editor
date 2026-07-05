# react-canvas-label-editor

React class component for editing a template for a 1-bit canvas-rendered label, plus a Node.js rasterizer that produces the final PNG.

```
npm i github:sebseb7/react-canvas-label-editor#v9.0.0
```

## Todo

- Allow the button, textfield, and slider components to be passed in as props so consumers can supply their own (e.g. MUI) components.
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

serverside:

```js
import { renderLabel } from 'react-canvas-label-editor'

const pngBuffer = await renderLabel({ height: 200, width: 448, objects })
```

`width` is optional on `renderLabel` too and defaults to `CANVAS_WIDTH` when omitted.
