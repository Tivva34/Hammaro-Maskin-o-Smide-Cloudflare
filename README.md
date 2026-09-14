# Hammarö Maskin & Smide – Digital Affärsplattform

Projektet är en skräddarsydd, webbaserad digital affärsplattform för Hammarö Maskin & Smide AB. Målet med lösningen är att samla företagets digitala försäljning, kundförfrågningar, kunddialog och interna administration i ett enda, sammanhängande system.

Plattformen utgörs av två huvudsakliga delar som drivs av samma backend, databas och affärslogik:
1. **En publik webbplats** för kunder och besökare.
2. **Ett separat administrativt verksamhetssystem** (CRM) för personalen.

Genom denna arkitektur ersätts tidigare isolerade system (separata hemsidor, e-postklienter och kalkylblad) med ett kontextdrivet flöde där all information hänger ihop – från första sökning på Google till avslutad affär.

---

## 1. Publik Webbplats & Företagsyta

Den publika webbplatsen är företagets digitala yta mot kunder och besökare. Systemet är byggt för att fungera sömlöst över dator, mobil och surfplatta, med ett tydligt fokus på responsiv design, tillgänglighet och konvertering.

**Innehåller bland annat:**
- Startsida och Företagsinformation.
- Maskinförsäljning och Maskinlistningar (inkl. detaljsidor).
- Presentation av Yttre lösöre.
- Specifika sektioner för Verkstad och Smide.
- Transportrelaterade kontaktflöden.
- Smarta, kontextuella kontaktfunktioner och en direkt "Ring oss"-funktion för mobila enheter.

---

## 2. Försäljning: Maskiner & Yttre Lösöre

Försäljningen är integrerad direkt i plattformen, vilket innebär att personalen kan hantera lagret via administrationen utan att behöva redigera källkod. Det som publiceras internt speglas omedelbart externt.

- **Detaljsidor:** Varje maskin och lösöre har sin egen sida med bilder, modell, årsmodell, drifttimmar, pris, specifikationer och unika kontaktmöjligheter.
- **Lagerhantering:** Administratören kan skapa, redigera, ta bort, publicera/avpublicera objekt, samt ändra priser och hantera status.
- **Bilder:** Smidig hantering av bildgalleri kopplat till varje specifikt försäljningsobjekt.

---

## 3. Kunddialog & Kontextbaserade Förfrågningar

Ett centralt koncept i plattformen är att alla förfrågningar kopplas till rätt sammanhang.

- **Smarta formulär:** Om en kund tittar på en specifik maskin och skickar en förfrågan (t.ex. angående transport eller köp), kopplar systemet automatiskt ihop kunden, meddelandet och maskinen i ett och samma ärende. Kunden behöver inte manuellt specificera vilken maskin det gäller.
- **Verkstad & Smide:** Förfrågningar för smidesarbete, svetsning, reparationer, specialtillverkning och släp separeras automatiskt från maskinförsäljningen så att de hamnar hos rätt avdelning.
- **E-postintegration:** E-postkommunikation är helt integrerad. När personalen svarar på en förfrågan från systemet, och kunden svarar via sin e-post, kopplas meddelandena tillbaka in i plattformens centrala kunddialog.

---

## 4. Administrativt Verksamhetssystem (CRM)

Det interna administrationssystemet är byggt som en separat applikation (Progressive Web App - PWA) för hantering av all affärsdata.

**Huvudfunktioner i admin:**
- **Ärende- och Statushantering:** Följ ett ärende från "Ny", till "Pågående", "Kontaktad", "Offert" och slutligen "Avslutad".
- **Kunddialog:** Öppna ärenden, läs tidigare meddelanden och svara kunder med komplett historik på ett ställe.
- **Sökning & Filtrering:** Hitta snabbt bland kunder, maskiner, objekt, ärenden och statusar.
- **Användare & Behörigheter:** Inloggning, roller (RBAC), skyddade systemdelar och separering av åtkomst säkerställer att rätt person ser rätt information.
- **PWA-stöd:** Systemet kan installeras som en riktig app (Web App Manifest, Service Worker) på dator, laptop, mobil och surfplatta, med push-notiser, cachehantering och automatisk uppdatering.

---

## 5. Realtime & Notifieringar

För att underlätta snabb ärendehantering använder systemet avancerad realtidsfunktionalitet.

- **Omedelbara uppdateringar:** Databasförändringar, nya inkommande kundförfrågningar och ärendeuppdateringar synkas i realtid på skärmen utan krav på sidomladdning (drivet av Supabase Realtime).
- **Individuella Notifieringar:** Personliga inställningar styr vem som får vilken notis. Till exempel kan säljare notifieras om maskinförfrågningar, medan verkstadspersonal endast får notiser gällande reparationer.
- **Teknik:** Backend-baserade notifieringar hanteras via Web Push och Service Workers för att nå ut även när appen är i bakgrunden.

---

## 6. Teknisk Arkitektur & Databas

Projektet är utvecklat med en modern, webbaserad teknikstack, uppdelad i tydliga ansvarsområden:

**Frontend:**
- **React & Vite:** För snabb utveckling och optimerade produktionsbyggen.
- **PWA-teknik:** För app-liknande beteenden i administrationssystemet.
- **Responsivitet:** Optimerat för alla enheter.

**Backend & Databas (Supabase):**
- **PostgreSQL:** En robust relationell databas som binder samman användare, ärenden, maskiner och konversationer.
- **Authentication:** Säker inloggning och rollhantering.
- **Row Level Security (RLS):** Säkerställer på databasnivå att administrativ data aldrig kan nås från den publika webbplatsen.
- **Edge Functions & Database Triggers:** För att hantera bakgrundsjobb, automation och realtidsflöden.

---

## 7. Prestanda & SEO

Den publika upplevelsen är finslipad för att ranka högt i sökmotorer och ladda blixtsnabbt.

- **Sökmotoroptimering (SEO):** Dynamiska SEO-titlar, meta descriptions, canonical URLs, robots-konfiguration, och generering av sitemap.
- **Strukturerad Data:** `LocalBusiness`-data och maskininformation struktureras så att Google enkelt förstår innehållet. Lösningen styr noga över vad som indexeras (admin hålls strikt utanför).
- **Prestanda:** Användning av WebP-bilder, cachehantering och optimerad resursladdning ger systemet toppbetyg i Lighthouse (Performance, Accessibility, Best Practices, SEO).

---

## 8. Deployment & Produktion

Driftsmiljön bygger på en stabil CI/CD-pipeline med moderna verktyg:
- **Git & GitHub:** Versionshantering.
- **Cloudflare Pages:** Blixtsnabb, global publicering av webbplatsen och webbappen.
- **Byggen & Miljöer:** Tydlig struktur för utveckling och produktionsmiljöer (`npm run build`, `npm run dev`), samt hantering av databasmigreringar direkt mot Supabase.

---

## Den Sammanhängande Kundresan

Genom att väva samman dessa funktioner elimineras glappet mellan system. Den optimala kundresan i plattformen ser ut så här:

`Google` → `Hammarös webbplats` → `Maskin / Tjänst` → `Detaljsida` → `Kontaktförfrågan` → `Automatiskt kopplat ärende` → `Notifiering till rätt personal (via PWA)` → `Svar inifrån CRM (e-post integrerad)` → `Uppföljning och avslut.`

All historik, data och kontext finns kvar, sökbar och knuten till rätt objekt. Resultatet är en komplett, säker och framtidssäkrad digital plattform för Hammarö Maskin & Smide.
