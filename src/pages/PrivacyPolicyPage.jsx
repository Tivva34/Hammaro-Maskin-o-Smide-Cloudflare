import React, { useEffect } from 'react';
import { useLang } from '../contexts/LanguageContext';

const PrivacyPolicyPage = () => {
  const { t } = useLang();

  useEffect(() => {
    document.title = "Integritetspolicy | Hammarö Maskin & Smide";
  }, []);

  return (
    <div className="container section">
      <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'var(--bg-surface)', padding: '3rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
        <h1 style={{ marginBottom: '2rem' }}>Integritetspolicy</h1>
        <p className="eyebrow" style={{ marginBottom: '2rem' }}>Senast uppdaterad: [DATUM]</p>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>1. Personuppgiftsansvarig</h2>
          <p>
            <strong>[FÖRETAGETS JURIDISKA NAMN]</strong><br />
            Org.nr: [ORGANISATIONSNUMMER]<br />
            [POSTADRESS]<br />
            E-post: [OFFICIELL E-POSTADRESS]
          </p>
          <p>
            Ovanstående företag är personuppgiftsansvarig för de personuppgifter som samlas in och behandlas på denna webbplats.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>2. Vilka personuppgifter vi behandlar</h2>
          <p>Vi samlar in och behandlar följande uppgifter när du använder våra tjänster:</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            <li><strong>Kontaktförfrågningar:</strong> Namn, e-postadress, telefonnummer, ärende och eventuella uppgifter du lämnar i fritext.</li>
            <li><strong>Offertförfrågningar:</strong> Namn, företagsnamn, e-postadress, telefonnummer, ärende, fritextmeddelande och eventuella bilagor du bifogar (bilder/dokument).</li>
            <li><strong>Administratörskonton:</strong> För intern personal och administratörer lagras e-postadress, namn (förnamn/efternamn), telefonnummer och yrkesroll.</li>
            <li><strong>Enhetsuppgifter (Push-notiser):</strong> Om en administratör aktiverar push-notiser lagras webbläsarens enhetsidentifierare (endpoint), autentiseringsnycklar (p256dh, auth) samt användaragent (user_agent).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>3. Ändamål och rättslig grund</h2>
          <p>Dina personuppgifter behandlas för följande ändamål:</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            <li><strong>Hantera förfrågningar:</strong> För att kunna svara på dina frågor och administrera offerter. Den rättsliga grunden för detta är <em>[RÄTTSLIG GRUND, t.ex. Berättigat intresse / Fullgörande av avtal]</em>.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>4. Lagringstid</h2>
          <p>
            Dina personuppgifter sparas inte längre än vad som är nödvändigt för de ändamål de samlades in för. 
            Förfrågningar och tillhörande korrespondens sparas i normalfallet under <strong>[FASTSTÄLLD LAGRINGSTID]</strong> efter att ärendet har avslutats, såvida inte lag (t.ex. bokföringslagen) kräver en längre lagringstid.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>5. Mottagare av personuppgifter</h2>
          <p>
            Vi kan komma att dela dina personuppgifter med våra personuppgiftsbiträden som tillhandahåller system och tjänster (t.ex. databashantering, e-posttjänster och hosting). 
            Dessa leverantörer behandlar endast data å våra vägnar och enligt våra instruktioner.
          </p>
          <p>
            <em>[EXTERNAL VERIFICATION REQUIRED: Specificera eventuella överföringar till tredje land, ex. om Supabase/Cloudflare överför data utanför EU/EES].</em>
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>6. Cookies och lokal lagring</h2>
          <p>
            För information om hur vi använder lokal lagring (local storage och session storage) för att webbplatsen ska fungera säkert, vänligen läs vår <a href="/cookies" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Information om Cookies & Lokal lagring</a>.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>7. Datasäkerhet</h2>
          <p>
            Vi vidtar lämpliga tekniska och organisatoriska säkerhetsåtgärder för att skydda dina personuppgifter mot obehörig åtkomst, ändring och radering. 
            Kommunikationen med vår databas är krypterad och åtkomst är strikt begränsad.
          </p>
        </section>

        <section style={{ marginBottom: '2.5rem' }}>
          <h2>8. Dina rättigheter</h2>
          <p>Du har rätt att när som helst begära:</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            <li>Ett utdrag av vilka uppgifter vi har sparade om dig.</li>
            <li>Att felaktiga uppgifter rättas.</li>
            <li>Att dina uppgifter raderas (förutsatt att det inte finns ett lagstadgat krav att behålla dem).</li>
          </ul>
          <p>
            Om du vill utöva dina rättigheter, kontakta oss på <strong>[OFFICIELL E-POSTADRESS]</strong>.
          </p>
        </section>

        <section>
          <h2>9. Klagomål</h2>
          <p>
            Om du anser att vi behandlar dina personuppgifter i strid med gällande dataskyddslagstiftning har du rätt att lämna in ett klagomål till <strong>Integritetsskyddsmyndigheten (IMY)</strong>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
