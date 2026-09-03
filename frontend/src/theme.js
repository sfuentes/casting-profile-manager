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
 * Tailwind is still in the build and still lays the views out. The two coexist
 * on purpose: moving the primitives first means every screen renders MUI
 * controls without 3,900 lines of view markup being rewritten in one go.
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
    fontFamily: 'inherit',           // keep whatever index.css already sets
    button: { textTransform: 'none' } // the old buttons were not upper-cased
  }
});

export default theme;
