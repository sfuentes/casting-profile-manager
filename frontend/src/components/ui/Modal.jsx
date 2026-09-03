import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import { X } from 'lucide-react';

/**
 * A dialog.
 *
 * The behaviour the hand-rolled version had to spell out - cap the height at
 * the viewport and scroll the body, so a long dialog does not push its own
 * confirm and cancel buttons off the bottom of the screen - is what Dialog with
 * `scroll="paper"` does by itself. The import dialog, which lists every field a
 * platform returned, is the one that needs it.
 *
 * `maxWidth="sm"` matches the old `max-w-md` closely enough that the dialogs
 * keep their proportions.
 */
const Modal = ({ isOpen, onClose, title, children }) => (
  <Dialog
    open={Boolean(isOpen)}
    onClose={onClose}
    scroll="paper"
    fullWidth
    maxWidth="sm"
  >
    <DialogTitle
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: 1, borderColor: 'divider', fontSize: '1.25rem', fontWeight: 600
      }}
    >
      {title}
      <IconButton onClick={onClose} size="small" aria-label="Schließen">
        <X size={20} />
      </IconButton>
    </DialogTitle>
    <DialogContent dividers={false} sx={{ pt: 3 }}>
      {children}
    </DialogContent>
  </Dialog>
);

export default Modal;
