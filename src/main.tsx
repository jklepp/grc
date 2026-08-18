import './index.css'
import { createRoot } from 'react-dom/client'
import App from './App'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Unable to start the application: root element not found.')
}

createRoot(rootElement).render(<App />)
