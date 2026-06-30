# react-canvas-label-editor

React class component for editing a template for a 1-bit canvas-rendered label, plus a Node.js rasterizer that produces the final PNG.

```
npm i github:sebseb7/react-canvas-label-editor#v3
```

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
        height={height}
        onHeightChange={(height) => this.setState({ height })}
        objects={objects}
        onChange={(objects) => this.setState({ objects })}
      />
    )
  }
}
```

serverside:

```js
import { renderLabel } from 'react-canvas-label-editor'

const pngBuffer = await renderLabel({ height: 200, objects })
```
