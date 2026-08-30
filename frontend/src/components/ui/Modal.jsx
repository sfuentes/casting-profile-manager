import React from 'react';
import {X} from 'lucide-react';

const Modal = ({isOpen, onClose, title, children}) => {
    if (!isOpen) return null;

    // The body scrolls and the whole dialog is capped at the viewport height:
    // a long dialog (the profile import lists every field it found) otherwise
    // grows past the bottom of the screen and takes its own confirm and cancel
    // buttons with it, leaving no way to finish.
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-full flex flex-col">
                <div className="flex justify-between items-center p-6 border-b shrink-0">
                    <h3 className="text-xl font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
};

export default Modal;