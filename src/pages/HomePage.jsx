import React, { useEffect } from 'react';
import Hero from '../components/Hero';
import TrustSection from '../components/TrustSection';

const HomePage = () => {
  useEffect(() => {
    document.title = 'Hammarö Maskin & Smide | Lantbruksmaskiner, verkstad & smide';
  }, []);

  return (
    <>
      <Hero />
      <TrustSection />
    </>
  );
};

export default HomePage;
