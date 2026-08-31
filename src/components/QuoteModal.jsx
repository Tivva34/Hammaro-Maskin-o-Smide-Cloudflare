import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import QuoteRequestForm from './QuoteRequestForm';

const QuoteModal = ({ isOpen, onClose, preselectedType, machine, inventoryItem }) => {
  const [formStatus, setFormStatus] = React.useState('idle');

  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setFormStatus('idle'); // Reset status on open
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {formStatus !== 'success' && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
          >
            <X size={20} />
          </button>
        )}
        
        <QuoteRequestForm
          preselectedType={preselectedType}
          machine={machine}
          inventoryItem={inventoryItem}
          onClose={onClose}
          onSuccess={() => {
            // Can choose to auto-close after success if desired, but QuoteRequestForm handles success state nicely.
          }}
          onStatusChange={setFormStatus}
        />
      </div>
    </div>
  );
};

export default QuoteModal;
