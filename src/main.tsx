import './index.css'
import { createRoot } from 'react-dom/client'
import Boot from './Boot'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Unable to start the application: root element not found.')
}

// Boot, not App: the dataset loads asynchronously now, and App must not be
// imported until it has. See src/Boot.tsx.
createRoot(rootElement).render(<Boot />)
