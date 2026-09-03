import { createTheme } from '@mui/material/styles';

/**
 * The palette the hand-rolled components already used, expressed once.
 *
 * The primitives in components/ui were Tailwind classes - blue-600 buttons,
 * red-600 for danger, the green/amber/red badges that report a sync outcome.
 * Those exact colours are kept here so the migration to MUI does not quietly
 * restyle every screen: what changes is which library draws the control, not
 * what the app looks like.
 *
 * The font stack is a system stack rather than Roboto, which MUI would
 * otherwise want downloaded. On Windows that renders as Segoe UI, on macOS as
 * San Francisco - the face the rest of the machine is already using, no
 * webfont request, no flash of unstyled text.
 *
 * It has to be stated here. `fontFamily: 'inherit'` used to sit in this spot,
 * with a comment saying index.css would set it - and index.css set the font
 * only because Tailwind's preflight was in it. Taking Tailwind out took the
 * font stack with it, and MUI then inherited the browser default: every screen
 * in the app, every heading and every button, rendered in Times New Roman.
 * Nothing failed, nothing warned, and a build cannot see it.
 */
export const theme = createTheme({
  palette: {
    primary: { main: '#2563eb' },    // blue-600
    secondary: { main: '#4b5563' },  // gray-600
    error: { main: '#dc2626' },      // red-600
    success: { main: '#16a34a' },    // green-600
    warning: { main: '#ca8a04' },    // yellow-600
    info: { main: '#2563eb' }
  },
  shape: { borderRadius: 8 },        // rounded-lg
  typography: {
    fontFamily: [
      '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto',
      '"Helvetica Neue"', 'Arial', 'sans-serif'
    ].join(','),
    button: { textTransform: 'none' } // the old buttons were not upper-cased
  }
});

export default theme;
