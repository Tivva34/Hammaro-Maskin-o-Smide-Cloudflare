import React, { useEffect } from 'react';
import { useLang } from '../contexts/LanguageContext';

const CookiesPage = () => {
  const { t } = useLang();

  useEffect(() => {
    document.title = "Cookies & Lokal lagring | Hammarö Maskin & Smide";
  }, []);

  return (
    <div className="container section">
      <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'var(--bg-surface)', padding: '3rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <h1 style={{ marginBottom: '2rem' }}>Cookies & Lokal lagring</h1>
        <p className="eyebrow" style={{ marginBottom: '2rem' }}>Senast uppdaterad: [DATUM]</p>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>Så använder vi lagringstekniker</h2>
          <p>
            Vår webbplats strävar efter att vara så integritetsvänlig som möjligt. 
            Vi använder <strong>inga spårningscookies</strong>, analysverktyg (som Google Analytics) eller marknadsföringspixlar (som Meta Pixel).
          </p>
          <p>
            Vi använder endast s.k. "Local Storage" och "Session Storage" i din webbläsare. 
            Webbplatsen använder de lagringstekniker som beskrivs nedan för funktionalitet, säkerhet och sessionshantering. Någon analys- eller marknadsföringsspårning har inte identifierats i den nuvarande implementationen.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>Vilka lagringsmekanismer vi använder</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-primary)' }}>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Namn / Nyckel</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Typ</th>
                  <th style={{ padding: '0.75rem', fontWeight: 600 }}>Syfte</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}><code>theme</code></td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Local Storage</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Sparar ditt val av utseende (ljust eller mörkt tema).</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}><code>language_preference</code> (eller motsvarande)</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Local Storage</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Sparar ditt språkval.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}><code>last_contact_submit</code> / <code>last_quote_submit</code></td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Session Storage</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Används för att skydda formulären mot spam och dubbelklick (Rate-limiting). Rensas när du stänger webbläsaren.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}><code>sb-*</code> (Supabase Auth)</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Local / Session Storage</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>Hanterar säkra inloggningssessioner. Används endast av administratörer.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Mer information</h2>
          <p>
            Vill du veta mer om hur vi hanterar dina personuppgifter? Läs vår <a href="/integritetspolicy" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Integritetspolicy</a>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default CookiesPage;
