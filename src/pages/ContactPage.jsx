import React, { useEffect } from 'react';
import ContactSection from '../components/ContactSection';

const ContactPage = () => {
  useEffect(() => {
    document.title = 'Kontakt | Hammarö Maskin & Smide';
    return () => { document.title = 'Hammarö Maskin & Smide'; };
  }, []);

  return (
    <>
      <ContactSection />
    </>
  );
};

export default ContactPage;
