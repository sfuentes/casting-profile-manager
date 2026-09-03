import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './styles/index.css'
import theme from './theme.js'
import App from './App.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      {/* After the stylesheet import, so Tailwind's preflight does not land on
          top of it and undo the baseline MUI expects. */}
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
