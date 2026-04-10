# Sistema di Documentazione: Intent-Based Specs

**Data:** 26 Marzo 2026  
**Scopo:** Definire standard per documentazione comportamentale distribuita, senza numerazione rigida, con struttura flessibile

---

## 1. Il Concetto: Intent-Based Development

L'umano scrive **intenti** (cosa vuole che succeda), l'AI implementa (come farlo succedere).

- **Documento = Intent** (singolo intento comportamentale)
- **Cartella = intents/** (dove risiedono gli intenti umani)
- **Approccio = Descrittivo, non prescrittivo**

---

## 2. Struttura Cartelle

### 2.1 Location

```
project-root/
├── intents/                 # ← Directory principale (nome scelto: intents)
│   ├── _schema.yaml        # Schema validazione
│   ├── _templates/         # Template per nuovi intenti
│   └── [area]/             # ← Sotto-cartelle per area
│       └── [nome-intento].md
```

**Perché `intents/`:**

- Comunica che sono **intenti umani**, non specifiche tecniche
- Diverso da `docs/` (documentazione), `specs/` (specifiche rigide)
- Corto, memorabile, evocativo
- Alternativa: `wants/`, `asks/`, `behaviors/`

### 2.2 Nomi File (Prefisso EXP-)

**Formato:** `EXP-{descrizione-breve}.md`

- **Prefisso fisso**: `EXP-` (Expectation/Intent)
- **NO numeri**: Niente EXP-001, EXP-042 (solo nome descrittivo)
- **Descrizione chiara**: kebab-case, leggibile
- **Estensione**: `.md`

**Esempi:**

```
EXP-header-dynamic-title.md
EXP-sidebar-navigation-menu.md
EXP-pages-creation-flow.md
EXP-api-components-structure.md
EXP-auth-session-cookie.md
EXP-site-structure-drag-drop.md
```

**Perché il prefisso EXP-:**

- Distingue gli intenti da altri file nella cartella (README, schema, etc.)
- Ordinamento: tutti gli intenti raggruppati in ls/alfabetico
- Estensibile: puoi aggiungere altri tipi (DOC-*, RULE-*, etc.)
- Chiaro: un colpo d'occhio capisci cosa è un intento implementabile

**Perché senza numeri:**

- Non serve ordinare globalmente (usiamo cartelle)
- Facile da rinominare senza rompere referenze
- Ordine alfabetico è sufficiente dentro ogni cartella
- Niente "buchi" nella numerazione

### 2.3 Organizzazione Cartelle

**Per Area Funzionale** (consigliato):

```
intents/
├── _schema.yaml
├── _templates/
├── auth/
│   ├── EXP-login.md
│   ├── EXP-session-management.md
│   └── EXP-password-reset.md
├── navigation/
│   ├── EXP-header-dynamic-title.md
│   ├── EXP-sidebar-menu.md
│   ├── EXP-site-structure-reorder.md
│   └── EXP-breadcrumbs.md
├── content/
│   ├── EXP-pages-list.md
│   ├── EXP-pages-creation-flow.md
│   ├── EXP-pages-editor.md
│   ├── EXP-components-api.md
│   └── EXP-collections-management.md
├── media/
│   ├── EXP-file-upload.md
│   └── EXP-image-gallery.md
└── settings/
    ├── EXP-site-settings.md
    └── EXP-user-management.md
```

### 2.4 Cartelle Base Standard

Per mantenere coerenza tra progetti diversi, si raccomanda di creare queste cartelle base in ogni progetto:

```
intents/
├── _schema.yaml              # Schema di validazione
├── _templates/               # Template per tipi diversi
│   ├── ui.md
│   ├── api.md
│   ├── logic.md
│   └── security.md
├── auth/                     # Autenticazione e autorizzazione
├── navigation/               # Navigazione, menu, header, footer
├── content/                  # Gestione contenuti principali
├── settings/                 # Configurazioni e impostazioni
└── integrations/             # Integrazioni con servizi esterni
```

**Descrizione cartelle base:**

| Cartella | Scopo | Esempi tipici |
|----------|-------|---------------|
| `auth/` | Login, logout, sessioni, permessi | `EXP-login.md`, `EXP-session-management.md`, `EXP-password-reset.md` |
| `navigation/` | Header, sidebar, menu, breadcrumb | `EXP-header-dynamic-title.md`, `EXP-sidebar-menu.md`, `EXP-breadcrumbs.md` |
| `content/` | CRUD contenuti principali | `EXP-pages-list.md`, `EXP-page-creation.md`, `EXP-media-library.md` |
| `settings/` | Configurazioni utente e sistema | `EXP-user-profile.md`, `EXP-site-settings.md`, `EXP-preferences.md` |
| `integrations/` | Servizi esterni, API terze | `EXP-stripe-payments.md`, `EXP-sendgrid-emails.md`, `EXP-oauth-google.md` |

**Note:**

- Queste sono cartelle *suggerite*, non obbligatorie. Adatta alla tua applicazione.
- Puoi aggiungere cartelle specifiche del dominio (es. `ecommerce/`, `analytics/`, `reports/`)
- Per progetti piccoli, puoi usare struttura flat (tutto in `intents/`)

**Per Tipo** (alternativa):

```
intents/
├── ui/
├── api/
├── logic/
└── security/
```

**Flat** (progetti piccoli):

```
intents/
├── EXP-header-dynamic-title.md
├── EXP-sidebar-navigation.md
└── EXP-login.md
```

---

## 3. Schema di Validazione

File: `intents/_schema.yaml`

```yaml
# intents/_schema.yaml
# Schema per validare documenti intent

intent:
  # Metadati nel frontmatter
  required:
    - type
  
  properties:
    type:
      type: string
      enum:
        - ui          # Interfaccia utente
        - api         # Endpoint REST/GraphQL
        - logic       # Logica di business
        - security    # Auth, permessi
        - performance # Ottimizzazioni
        - integration # Servizi esterni
      description: "Tipo di intento"
    
    priority:
      type: string
      enum: [critical, high, medium, low]
      default: medium
    
    area:
      type: string
      description: "Area funzionale (per raggruppare in cartelle)"
    
    tags:
      type: array
      items:
        type: string
      description: "Tag opzionali"
  
  # Sezioni richieste nel markdown
  sections:
    title:
      required: true
      pattern: "^# "
      description: "Titolo H1"
    
    purpose:
      required: true
      pattern: "^## Scopo"
      description: "Perché esiste questo intento"
    
    behavior:
      required: true
      pattern: "^## Comportamento"
      description: "Descrizione comportamento atteso"
    
    criteria:
      required: true
      pattern: "^## Criteri"
      description: "Checklist criteri di accettazione"
  
  min_criteria: 3
```

---

## 4. Template per `_templates/`

La cartella `_templates/` contiene template predefiniti per diversi tipi di intenti. Ogni template è ottimizzato per il tipo specifico.

### 4.1 Template UI (`_templates/ui.md`)

```markdown
---
type: ui
priority: medium
area: 
tags: []
---

# [Nome Componente/Feature UI]

## Scopo
[Descrivi perché esiste questa UI. Cosa risolve per l'utente?]

## Esperienza Utente
[Descrivi l'esperienza narrativamente. Cosa vede? Cosa fa?]

## Comportamento

### Stati Visuali
- **Default**: [stato normale]
- **Hover**: [quando mouse sopra]
- **Active/Selected**: [quando selezionato]
- **Disabled**: [quando disabilitato]
- **Loading**: [durante caricamento]
- **Error**: [quando c'è errore]
- **Empty**: [quando non ci sono dati]

### Interazioni
- **Click**: [cosa succede al click]
- **Doppio click**: [se applicabile]
- **Hover**: [se applicabile]
- **Keyboard**: [tasti scorciatoia, tab navigation]

### Responsive
- **Desktop**: [comportamento su schermi grandi]
- **Tablet**: [comportamento su tablet]
- **Mobile**: [comportamento su mobile]

### Casi Edge
- [Caso limite 1]: [comportamento atteso]
- [Caso limite 2]: [comportamento atteso]

## Criteri di Accettazione

- [ ] [Criterio visivo/esperienziale 1]
- [ ] [Criterio visivo/esperienziale 2]
- [ ] [Criterio visivo/esperienziale 3]
- [ ] Responsive funziona su tutti i breakpoint
- [ ] Accessibile (contrasto, ARIA labels, keyboard navigation)

## Note
- [Eventuali note sul design system da usare]
- [Animazioni o transizioni desiderate]
- [Requisiti di branding/stile]
```

### 4.2 Template API (`_templates/api.md`)

```markdown
---
type: api
priority: medium
area: 
tags: []
---

# [Nome Endpoint/API]

## Scopo
[Descrivi cosa fa questa API e perché esiste]

## Esperienza Developer
[Descrivi come un developer usa questa API]

## Endpoint

### [Nome Operazione]
**Metodo**: `GET|POST|PUT|DELETE|PATCH`  
**Path**: `/api/v1/...`

#### Request
```json
{
  "field1": "type (required|optional) - descrizione",
  "field2": "type (required|optional) - descrizione"
}
```

#### Response Success (200)

```json
{
  "field1": "tipo - descrizione",
  "field2": "tipo - descrizione"
}
```

#### Response Errori

- `400 Bad Request`: [quando si verifica]
- `401 Unauthorized`: [quando si verifica]
- `403 Forbidden`: [quando si verifica]
- `404 Not Found`: [quando si verifica]
- `500 Internal Error`: [quando si verifica]

#### Rate Limiting

- [Descrizione limiti se applicabili]

### [Altra Operazione se necessaria]

...

## Comportamento

### Validazione

- [Regole di validazione input]
- [Formati attesi]
- [Constraints]

### Business Logic

- [Logica applicativa]
- [Side effects]
- [Eventi triggerati]

### Casi Edge

## Criteri di Accettazione

- [ ] Endpoint risponde con formato corretto
- [ ] Validazione input funziona
- [ ] Errori HTTP appropriati
- [ ] Documentazione OpenAPI/Swagger aggiornata
- [ ] Rate limiting implementato (se applicabile)
- [ ] Logging appropriato

## Note

- [Considerazioni su autenticazione/autorizzazione]
- [Performance considerations]
- [Backward compatibility se applicabile]

```

### 4.3 Template Logic (`_templates/logic.md`)

```markdown
---
type: logic
priority: medium
area: 
tags: []
---

# [Nome Logica/Algoritmo]

## Scopo
[Descrivi cosa calcola o processa questa logica]

## Esperienza
[In che contesto viene usata questa logica?]

## Input e Output

### Input
- `param1` (tipo): [descrizione, constraints]
- `param2` (tipo): [descrizione, constraints]

### Output
- `result` (tipo): [descrizione, possibili valori]

## Comportamento

### Algoritmo
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

### Regole Business
- [Regola 1]: [descrizione]
- [Regola 2]: [descrizione]

### Casi Edge
- [Input edge case 1]: [risultato atteso]
- [Input edge case 2]: [risultato atteso]

## Performance
- **Complessità temporale**: [O(n), O(log n), etc.]
- **Complessità spaziale**: [O(n), O(1), etc.]
- **Limiti**: [max input size, timeout]

## Criteri di Accettazione

- [ ] Logica produce output corretto per input validi
- [ ] Gestisce correttamente tutti i casi edge
- [ ] Performance accettabile (specificare metriche)
- [ ] Unit test coprono tutti i casi
- [ ] Codice documentato

## Note
- [Considerazioni su scalabilità]
- [Dipendenze da altre logiche]
- [Requisiti di thread-safety se applicabile]
```

### 4.4 Template Security (`_templates/security.md`)

```markdown
---
type: security
priority: high
area: 
tags: []
---

# [Nome Feature Sicurezza]

## Scopo
[Descrivi cosa protegge e perché è importante]

## Minaccia
[Descrivi la minaccia/vulnerabilità che mitighi]

## Esperienza Utente
[L'utente come interagisce con questa protezione?]

## Comportamento

### Caso Base (Utente Legittimo)
1. [Passo 1]
2. [Passo 2]
3. [Successo: cosa succede]

### Caso Negativo (Attacco/Accesso Non Autorizzato)
1. [Tentativo]
2. [Sistema blocca/detecta]
3. [Conseguenza: cosa succede]

### Rate Limiting / Throttling
- [Limiti imposti]
- [Comportamento al superamento limiti]

### Audit e Logging
- [Cosa viene loggato]
- [Dove vengono salvati i log]
- [Quanto tempo vengono conservati]

## Requisiti Tecnici
- [ ] Crittografia (specificare algoritmo e key size)
- [ ] Hashing (specificare algoritmo: Argon2id, bcrypt, etc.)
- [ ] HTTPS/TLS obbligatorio
- [ ] Headers di sicurezza (CSP, HSTS, etc.)
- [ ] Sanitizzazione input
- [ ] Output encoding

## Casi Edge
- [Attacco specifico 1]: [mitigazione]
- [Attacco specifico 2]: [mitigazione]
- [Race condition]: [gestione]

## Criteri di Accettazione

- [ ] Protezione attiva contro [minaccia specifica]
- [ ] Nessun false positive per utenti legittimi
- [ ] Audit trail completo
- [ ] Penetration test passati
- [ ] Compliance (GDPR, SOC2, etc. se applicabile)

## Note
- [Considerazioni su key management]
- [Secrets rotation]
- [Incident response plan]
```

### 4.5 Template Generico (Default)

```markdown
---
type: ui
priority: medium
area: 
tags: []
---

# Titolo dell'intento

## Scopo
Descrivi brevemente perché esiste questa funzionalità. Qual è il valore per l'utente?

## Esperienza Utente
Descrivi l'esperienza narrativamente. Cosa vede l'utente? Cosa fa? Cosa succede?

## Comportamento

### Caso Base
Descrivi il comportamento principale, quello che succede nella maggior parte dei casi.

### Casi Specifici
Elenca varianti o comportamenti specifici per contesti diversi.

### Casi Edge
Descrivi cosa succede in casi limite (dati mancanti, errori, stati particolari).

## Criteri di Accettazione

- [ ] Criterio 1: descrizione verificabile
- [ ] Criterio 2: descrizione verificabile
- [ ] Criterio 3: descrizione verificabile

## Note
Suggerimenti, vincoli tecnici, o considerazioni per chi implementa.
```

---

## 5. Agente Helper: Intent Writer

### 5.1 Prompt di Sistema

```markdown
# Role: Intent Writer Agent

Sei un agente che aiuta gli umani a scrivere documenti di **intento** per software.

## Il tuo compito
Trasformare idee/features in documenti strutturati nella cartella `intents/`.

## Regole fondamentali

1. **Descrittivo, non prescrittivo**
   - L'umano descrive COSA vuole, non COME farlo
   - Non suggerire file specifici, hook, o librerie
   - Focus sull'esperienza utente, non sull'implementazione

2. **Guida l'utente attraverso le sezioni**
   - Scopo: perché esiste questa feature?
   - Esperienza: cosa vede/fa l'utente?
   - Comportamento: come si comporta il sistema?
   - Criteri: checklist verificabile

3. **Valida la struttura**
   - Frontmatter con type valido
   - Almeno 3 criteri di accettazione
   - Sezioni required presenti

4. **Nomi file con prefisso EXP-**
   - Formato: `EXP-nome-descrittivo.md`
   - NO numeri dopo EXP- (es. `EXP-header.md`, non `EXP-001-header.md`)
   - kebab-case, nome che descriva chiaramente l'intento

## Flusso di lavoro

1. L'utente descrive una feature
2. Tu fai domande chiarificatrici se necessario
3. Suggerisci nome file appropriato
4. Proponi bozza di documento
5. Itera in base al feedback

## Output

Genera documenti in questo formato:

```yaml
---
type: [ui|api|logic|security|performance|integration]
priority: [critical|high|medium|low]
area: [nome-area]
tags: [tag1, tag2]
---

# [Titolo leggibile]

## Scopo
...

## Esperienza Utente
...

## Comportamento
...

## Criteri di Accettazione
- [ ] ...
```

## Comandi

- "Valida questo intento": controlla struttura
- "Dove salvarlo?": suggerisci cartella e nome file
- "Trova simili": cerca intenti correlati

```

### 5.2 Esempio Conversazione

**Utente:**
```

Voglio che l'header del CMS mostri sempre il titolo della pagina in cui sono.
Tipo se sono su Dashboard mostra "DiggoCMS - Dashboard", se sono su Pages
mostra "DiggoCMS - Pages", ecc.

```

**Agente:**
```

Ottimo! Stai descrivendo un header dinamico.

Proposta per il file: `intents/navigation/EXP-header-dynamic-title.md`

Ecco la bozza:

```yaml
---
type: ui
priority: high
area: navigation
tags: [header, dynamic-title]
---

# Header dinamico con titolo pagina

## Scopo
Aiutare l'utente a capire sempre in quale sezione del CMS si trova, 
mostrando il contesto corrente nell'header.

## Esperienza Utente
Navigando nel CMS, l'utente vede sempre in alto il nome della sezione 
corrente. Il titolo cambia immediatamente quando cambia pagina, 
senza bisogno di refresh.

## Comportamento

### Caso Base
- L'header mostra il formato: "DiggoCMS - [Nome Sezione]"
- Il nome si aggiorna istantaneamente al cambio pagina
- Visibile in tutte le pagine dell'area admin

### Titoli per Sezione
- Dashboard → "DiggoCMS - Dashboard"
- Pages (lista) → "DiggoCMS - Pages"
- Pages / Nuova → "DiggoCMS - New Page"
- Pages / Modifica → "DiggoCMS - Edit Page"
- Site Structure → "DiggoCMS - Site Structure"
- Settings → "DiggoCMS - Settings"

### Casi Edge
- Se la pagina non ha titolo specifico → solo "DiggoCMS"
- Durante caricamento → mostra "DiggoCMS"

## Criteri di Accettazione

- [ ] Header visibile in tutte le pagine admin
- [ ] Formato sempre "DiggoCMS - [Nome]"
- [ ] Cambio istantaneo al cambio pagina
- [ ] Nessun refresh richiesto
- [ ] Funziona con tutte le route (anche dinamiche)

## Note
- Considerare che alcune pagine hanno parametri (es. /pages/[id]/edit)
- Il titolo potrebbe venire da diverse fonti (router, stato, props)
```

Ti va bene? Vuoi modificare qualcosa?

```

---

## 6. Tooling CLI (Opzionale)

```bash
# Inizializza sistema intents
intents init
# Crea intents/, _schema.yaml, _templates/

# Crea nuovo intento
intents new --type ui --area navigation
# Chiede titolo, crea file con nome appropriato

# Valida singolo file
intents validate navigation/header.md

# Valida tutto
intents validate-all

# Lista intenti
intents list
# Output:
# auth/
#   - login.md
#   - session.md
# navigation/
#   - header.md
#   - sidebar.md

# Cerca
intents search "password"
# Cerca in titoli, scopo, tags

# Export per AI
intents export navigation/header navigation/sidebar > context.md
```

---

## 7. Confronto: Vecchio vs Nuovo Approccio

### ❌ Vecchio (Numerato)

```
expectations/
├── EXP-001-header.md
├── EXP-002-sidebar.md
├── EXP-003-login.md
└── EXP-004-session.md
```

**Problemi:**

- Numerazione globale impossibile da mantenere
- Dove metto EXP-005? Dopo EXP-004, ma se ho 100 file?
- Rinominare EXP-001 in EXP-045 = rompo tutti i riferimenti

### ✅ Nuovo (Descrittivo con prefisso)

```
intents/
├── auth/
│   ├── EXP-login.md
│   └── EXP-session-management.md
└── navigation/
    ├── EXP-header-dynamic-title.md
    └── EXP-sidebar-navigation.md
```

**Vantaggi:**

- Nomi parlanti, auto-documentanti
- Facile trovare quello che cerchi
- Rinominare non rompe nulla (non ci sono riferimenti numerici)
- Ordine alfabetico naturale dentro ogni cartella

---

## 8. Workflow

### Step 1: Setup

```bash
mkdir -p intents/{auth,navigation,content,settings}/_templates
touch intents/_schema.yaml
```

### Step 2: Nuovo Intento

```bash
# Manuale
cat > intents/navigation/EXP-header-dynamic-title.md << 'EOF'
---
type: ui
priority: high
---

# Header dinamico
...
EOF

# Oppure con agente
# "Crea intento per header dinamico"
```

### Step 3: Sviluppo

```
Umano: Descrive comportamento in intents/navigation/EXP-header-dynamic-title.md
       (cosa vuole, non come farlo)

AI:     Legge intents/navigation/EXP-header-dynamic-title.md
        Sceglie implementazione (Header.tsx? useRouter? Zustand?)
        Implementa
        Verifica contro criteri
```

---

## 9. Conclusioni

**Intent-Based Specs:**

- ✅ **Prefisso EXP-** (distingue dagli altri file)
- ✅ **Nomi descrittivi** (no numeri)
- ✅ **Cartella `intents/`** (chiaro, evocativo)
- ✅ **Struttura standard** (cartelle base consistenti)
- ✅ **Descrittivo** (cosa, non come)
- ✅ **Validabile** (schema YAML)
- ✅ **Template specializzati** (ui, api, logic, security)

---

## Appendice: Confronto Nomi Cartella

| Nome | Pro | Contro |
|------|-----|--------|
| `intents/` | ✓ Chiaro (intenti umani) <br>✓ Distintivo | ? Meno comune |
| `wants/` | ✓ Colloquiale <br>✓ Diverso | ? Informale |
| `asks/` | ✓ Richieste umane | ? Poco usato |
| `behaviors/` | ✓ Comportamenti attesi | ? Lungo |
| `specs/` | ✓ Standard | ? Generico |
| `requirements/` | ✓ Classico | ? Troppo formale |

**Scelta:** `intents/` - Bilancia chiarezza, distintività, professionalità.
