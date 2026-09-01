import React, { useState, useEffect } from 'react';
import MachinerySection from '../components/MachinerySection';
import BuySellSection from '../components/BuySellSection';
import TransportSection from '../components/TransportSection';
import QuoteModal from '../components/QuoteModal';

const MachineryPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('sell_machine');

  useEffect(() => {
    document.title = 'Begagnade maskiner | Hammarö Maskin & Smide';
    return () => { document.title = 'Hammarö Maskin & Smide'; };
  }, []);

  return (
    <>
      <MachinerySection />
      <BuySellSection onOpenModal={() => { setModalType('sell_machine'); setModalOpen(true); }} />
      <TransportSection onOpenModal={() => { setModalType('transport'); setModalOpen(true); }} />
      <QuoteModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        preselectedType={modalType} 
      />
    </>
  );
};

export default MachineryPage;
