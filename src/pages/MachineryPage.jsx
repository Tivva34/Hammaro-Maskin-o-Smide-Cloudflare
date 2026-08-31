import React, { useState, useEffect } from 'react';
import MachinerySection from '../components/MachinerySection';
import BuySellSection from '../components/BuySellSection';
import TransportSection from '../components/TransportSection';
import QuoteModal from '../components/QuoteModal';

const MachineryPage = () => {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    document.title = 'Begagnade maskiner | Hammarö Maskin & Smide';
    return () => { document.title = 'Hammarö Maskin & Smide'; };
  }, []);

  return (
    <>
      <MachinerySection />
      <BuySellSection onOpenModal={() => setModalOpen(true)} />
      <TransportSection onOpenModal={() => setModalOpen(true)} />
      <QuoteModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        preselectedType="sell_machine" 
      />
    </>
  );
};

export default MachineryPage;
