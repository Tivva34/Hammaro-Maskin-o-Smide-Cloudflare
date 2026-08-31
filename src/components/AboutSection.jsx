import React from 'react';
import { useLang } from '../contexts/LanguageContext';

const AboutSection = () => {
  const { t } = useLang();
  
  // Note: if t('about.highlights') is somehow undefined, we provide a fallback
  const highlights = t('about.highlights') || [
    { title: "Erfarenhet", desc: "Sedan 2002" },
    { title: "Personlig service", desc: "Direkt kontakt med rätt person" },
    { title: "Maskiner & verkstad", desc: "Försäljning, reparation och tillverkning" },
    { title: "Lokalt", desc: "Hallersrudsvägen 36, 663 42 Hammarö" }
  ];

  return (
    <section id="om-oss" className="section">
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '4rem',
        }}
          className="about-grid"
        >
          <div>
            <span className="eyebrow">Om Hammarö Maskin & Smide</span>
            <h2 style={{ marginBottom: '1.5rem' }}>Ett maskinföretag med praktisk erfarenhet</h2>
            <p style={{ fontSize: '1.25rem', marginBottom: '2rem', maxWidth: '600px' }}>
              Hammarö Maskin & Smide har erfarenhet av lantbruk och entreprenadmaskiner. Vi hjälper kunder med både maskinköp, reparationer och specialtillverkning. För oss är det viktigt att erbjuda utrustning och lösningar som vi själva vet fungerar i det praktiska arbetet.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '2rem'
            }}>
              {highlights.map((item, idx) => (
                <div key={idx} style={{
                  paddingLeft: '1.5rem',
                  borderLeft: '2px solid var(--accent-primary)'
                }}>
                  <h4 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--text-primary)' }}>{item.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.9375rem', marginTop: '0.25rem', whiteSpace: 'pre-line' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            position: 'relative',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            minHeight: '400px',
            backgroundColor: '#fff', // White background so the logo text is visible (assuming it's a traditional logo)
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}>
            <img
              src="/images/logo.gif"
              alt="Hammarö Maskin och Smide Logotyp"
              style={{
                width: '100%',
                maxWidth: '280px',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      </div>
      <style>{`
        @media (min-width: 1024px) {
          .about-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </section>
  );
};

export default AboutSection;
