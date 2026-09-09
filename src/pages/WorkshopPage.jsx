import React, { useState, useEffect } from 'react';
import WorkshopSection from '../components/WorkshopSection';
import ManufacturingSection from '../components/ManufacturingSection';
import TransportSection from '../components/TransportSection';
import QuoteModal from '../components/QuoteModal';

const WorkshopPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('workshop');

  const handleOpenModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  useEffect(() => {
    document.title = 'Verkstad & Smide | Hammarö Maskin & Smide';
    return () => { document.title = 'Hammarö Maskin & Smide'; };
  }, []);

  return (
    <>
      <WorkshopSection onOpenModal={() => handleOpenModal('workshop')} />
      <ManufacturingSection 
        onOpenModal={() => handleOpenModal('custom')} 
        onQuoteClick={() => handleOpenModal('workshop')}
      />
      
      <TransportSection onOpenModal={() => handleOpenModal('transport')} />
      
      <QuoteModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        preselectedType={modalType}
      />
    </>
  );
};

export default WorkshopPage;
