export { default as CanvasEditor } from './components/CanvasEditor/index.js'
export * from './components/CanvasEditor/constants.js'
import './components/CanvasEditor/CanvasEditor.css'
import './fonts/editorFonts.css'

/** @returns {never} */
export function renderLabel() {
  throw new Error(
    'renderLabel is only available in Node.js. Import it from server-side code.',
  )
}
