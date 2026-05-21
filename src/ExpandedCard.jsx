import React from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cap(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function fmt(n) {
  if (n == null) return "—";
  return typeof n === "number" ? n.toFixed(2).replace(".", ",") : String(n);
}

function lataLabel(n) {
  if (n === 1) return "rok";
  if (n >= 2 && n <= 4) return "lata";
  return "lat";
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="7.25" y="7" width="1.5" height="5" rx="0.75" fill="#9ca3af" />
      <rect x="7.25" y="4.5" width="1.5" height="1.5" rx="0.75" fill="#9ca3af" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6 1C4.067 1 2.5 2.567 2.5 4.5C2.5 7.1 6 11 6 11C6 11 9.5 7.1 9.5 4.5C9.5 2.567 7.933 1 6 1Z" stroke="#6b7280" strokeWidth="1.2" />
      <circle cx="6" cy="4.5" r="1.1" fill="#6b7280" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10.5 8.75C10.5 8.75 9.4 8.2 8.8 8.2C8.35 8.2 7.95 8.55 7.5 9C6.5 8.45 5.55 7.5 5 6.5C5.45 6.05 5.8 5.65 5.8 5.2C5.8 4.6 5.25 3.5 5.25 3.5C5.25 2.67 4.58 2 3.75 2H3C2.17 2 1.5 2.67 1.5 3.5C1.5 7.09 4.41 10 8 10C8.83 10 9.5 9.33 9.5 8.5V8.75H10.5Z" stroke="#6b7280" strokeWidth="1.1" />
    </svg>
  );
}

function WheelchairIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6" cy="2" r="1" fill="#6b7280" />
      <path d="M4.5 4.5L5.5 8H7.5" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 5.5L3 7" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="7.5" cy="10" r="1.5" stroke="#6b7280" strokeWidth="1.1" />
    </svg>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ text, children }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1f2937",
          color: "#fff",
          fontSize: 12,
          fontWeight: 500,
          lineHeight: "18px",
          padding: "6px 10px",
          borderRadius: 6,
          width: 260,
          zIndex: 100,
          pointerEvents: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubjectCol({ title, titleStyle, items, emptyLabel }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, alignSelf: "stretch", minWidth: 0 }}>
      <div style={{ fontSize: 14, lineHeight: "20px", wordBreak: "break-word", ...titleStyle }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
        {items && items.length > 0
          ? items.map((item) => (
              <li key={item} style={{ fontSize: 14, fontWeight: 500, color: "#000", lineHeight: "20px" }}>
                {cap(item)}
              </li>
            ))
          : (
              <li style={{ fontSize: 14, fontWeight: 500, color: "#9ca3af", lineHeight: "20px", listStyle: "none", marginLeft: -20 }}>
                {emptyLabel || "—"}
              </li>
            )
        }
      </ul>
    </div>
  );
}

function StatRow({ leftLabel, leftValue, leftColor, leftInfo, rightLabel, rightValue }) {
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start", width: "100%", minHeight: 40 }}>
      {/* Left stat */}
      <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", minHeight: 40, minWidth: 0 }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#222", lineHeight: "20px", minWidth: 0 }}>
          {leftLabel}
        </div>
        <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: leftColor || "#222", lineHeight: "20px", whiteSpace: "nowrap" }}>
            {leftValue}
          </span>
          {leftInfo && (
          typeof leftInfo === "string"
            ? <Tooltip text={leftInfo}><InfoIcon /></Tooltip>
            : <InfoIcon />
        )}
        </div>
      </div>
      {/* Right stat */}
      <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", minHeight: 40, minWidth: 0 }}>
        {rightLabel ? (
          <>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#222", lineHeight: "20px", minWidth: 0 }}>
              {rightLabel}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#222", lineHeight: "20px", whiteSpace: "nowrap" }}>
                {rightValue}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ExpandedCard({ record, oddzial, availableYears, selectedRok, onRokChange, e8MatData }) {
  if (!record || !oddzial) return null;

  const { szkola, statystyki_szkoly_agg: agg } = record;
  const e8Mat = e8MatData?.[selectedRok] ?? null;
  const isPublic = szkola.status_publiczny === "PUBLIC_RIGHTS";
  const isAdapted = szkola.dostosowanie_niepelnosprawni === "ADAPTED";
  const schoolDisplayName = szkola.nazwa.replace(/, Gdańsk$/, "");

  return (
    <div style={s.card}>

      {/* ═══ Szczegóły profilu ══════════════════════════════════════════════ */}
      <div style={s.profileSection}>

        {/* Header: nazwa profilu + rok rekrutacji */}
        <div style={s.profileHeaderRow}>
          <div style={{ flex: 1 }}>
            <span style={s.sectionLabel}>Szczegóły profilu</span>
            <div style={s.profileNameRow}>
              <span style={s.profileName}>{oddzial.nazwa}</span>
              <span style={s.profileYears}>({oddzial.lata_nauki} {lataLabel(oddzial.lata_nauki)})</span>
            </div>
            {oddzial.zawod && (
              <div style={s.zawodRow}>
                <span style={{ fontWeight: 500 }}>Kształcenie w zawodzie:</span>
                <span style={{ fontWeight: 700 }}>{oddzial.zawod}</span>
              </div>
            )}
          </div>

          {/* Liczba zdających + Rok rekrutacji */}
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexShrink: 0 }}>
            <div style={s.rokBox}>
              <span style={s.sectionLabel}>Liczba zdających E8 (mat)</span>
              <div style={{ padding: "12px 0", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={s.e8Value}>
                  {e8Mat != null ? e8Mat.toLocaleString("pl-PL") : "—"}
                </span>
                <Tooltip text="Liczba zdających egzamin ósmoklasisty w Gdańsku, na przykładzie przedmiotu matematyka.">
                  <InfoIcon />
                </Tooltip>
              </div>
            </div>
            <div style={s.rokBox}>
              <span style={s.sectionLabel}>Rok rekrutacji</span>
              <div style={s.selectWrap}>
                <select
                  style={s.yearSelect}
                  value={selectedRok}
                  onChange={(e) => onRokChange(Number(e.target.value))}
                >
                  {availableYears.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <span style={s.selectArrow}>▾</span>
              </div>
            </div>
          </div>
        </div>

        {/* Przedmioty — 4 kolumny */}
        <div style={s.subjectsGrid}>
          <SubjectCol
            title="Przedmioty punktowane:"
            titleStyle={{ color: "#9000ff", fontWeight: 800 }}
            items={oddzial.przedmioty_punktowane}
          />
          <SubjectCol
            title="Obowiązkowe rozszerzenia:"
            titleStyle={{ fontWeight: 700 }}
            items={oddzial.przedmioty_rozszerzone_obowiazkowe}
          />
          <SubjectCol
            title="Przedmioty rozszerzone do wyboru:"
            titleStyle={{ fontWeight: 700 }}
            items={oddzial.przedmioty_rozszerzone_opcjonalne}
            emptyLabel="Brak"
          />
          <SubjectCol
            title="Nauczane języki obce:"
            titleStyle={{ fontWeight: 700 }}
            items={oddzial.jezyki_obce}
          />
        </div>

        {/* Statystyki oddziału */}
        <div style={s.statsBlock}>
          <StatRow
            leftLabel="Liczba przyjętych/miejsc"
            leftValue={<>{oddzial.liczba_zakwalifikowanych} / {oddzial.liczba_miejsc}</>}
            leftInfo="Przyjęci to kandydaci, którzy potwierdzili wolę nauki po zakwalifikowaniu się do danego oddziału i nie dokonali później żadnych zmian."
          />
          <StatRow
            leftLabel="Liczba punktów ostatniego zakwalifikowanego – próg punktowy"
            leftValue={fmt(oddzial.prog_punktowy)}
            leftColor="#9000ff"
            leftInfo="Liczba punktów ostatniego zakwalifikowanego, czyli próg punktowy to najmniejsza liczba punktów, która uprawniała w danym roku do przyjęcia kandydata do wskazanego oddziału."
            rightLabel="Średnia liczba punktów przyjętych"
            rightValue={fmt(oddzial.srednia_punktow)}
          />
          <StatRow
            leftLabel={<>Liczba chętnych <strong>z pierwszej preferencji</strong></>}
            leftValue={oddzial.liczba_przyjętych}
            leftInfo="Podczas rekrutacji kandydat układa listę oddziałów (klas) ze szkół, do których chciałby się dostać. Rozpoczyna od oddziału (klasy), do którego chce się dostać najbardziej. Oddział wybrany na pierwszym miejscu na liście nazywany jest „pierwszą preferencją."
            rightLabel={<>Liczba chętnych <strong>ogółem</strong> (z dowolnej preferencji)</>}
            rightValue={oddzial.chetni_ogolem ?? "—"}
          />
          <StatRow
            leftLabel="Liczba przyjętych z pierwszeństwem przyjęcia (laureaci, finaliści)"
            leftValue={oddzial.laureaci_finalisci ?? "—"}
            rightLabel="Liczba świadectw z wyróżnieniem spośród przyjętych"
            rightValue={oddzial.swiadectwa_wyroznienie ?? "—"}
          />
        </div>
      </div>

      {/* ═══ Informacje o szkole ════════════════════════════════════════════ */}
      <div style={s.schoolSection}>
        <div>
          <span style={s.sectionLabel}>Informacje o szkole</span>
          <div style={s.schoolTitleRow}>
            <span style={s.schoolName}>{schoolDisplayName}</span>
            <span style={s.schoolPublicLabel}>({isPublic ? "Publiczna" : "Niepubliczna"})</span>
          </div>
        </div>

        {/* Statystyki szkoły (zagregowane) */}
        <div style={s.statsBlock}>
          <StatRow
            leftLabel="Liczba przyjętych/miejsc"
            leftValue={<>{szkola.liczba_zakwalifikowanych} / {szkola.liczba_miejsc}</>}
            leftInfo="Przyjęci to kandydaci, którzy potwierdzili wolę nauki po zakwalifikowaniu się do danego oddziału i nie dokonali później żadnych zmian."
          />
          <StatRow
            leftLabel="Liczba punktów ostatniego zakwalifikowanego – próg punktowy"
            leftValue={fmt(agg._agg_prog_min)}
            leftColor="#003cff"
            leftInfo="Liczba punktów ostatniego zakwalifikowanego, czyli próg punktowy to najmniejsza liczba punktów, która uprawniała w danym roku do przyjęcia kandydata do wskazanego oddziału."
            rightLabel="Średnia liczba punktów przyjętych"
            rightValue={fmt(null)}
          />
          <StatRow
            leftLabel={<>Liczba chętnych <strong>z pierwszej preferencji</strong></>}
            leftValue={agg._agg_liczba_przyjętych ?? "—"}
            leftInfo="Podczas rekrutacji kandydat układa listę oddziałów (klas) ze szkół, do których chciałby się dostać. Rozpoczyna od oddziału (klasy), do którego chce się dostać najbardziej. Oddział wybrany na pierwszym miejscu na liście nazywany jest „pierwszą preferencją."
            rightLabel={<>Liczba chętnych <strong>ogółem</strong> (z dowolnej preferencji)</>}
            rightValue={szkola.chetni_ogolem ?? "—"}
          />
          <StatRow
            leftLabel="Liczba przyjętych z pierwszeństwem przyjęcia (laureaci, finaliści)"
            leftValue={agg._agg_laureaci_finalisci ?? "—"}
            rightLabel="Liczba świadectw z wyróżnieniem spośród przyjętych"
            rightValue={agg._agg_swiadectwa_wyroznienie ?? "—"}
          />
        </div>

        {/* Sprawdzian uzdolnień */}
        <div style={s.aptitudeRow}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#000" }}>Sprawdzian uzdolnień:</span>
          <span style={{ fontWeight: 500, fontSize: 14, color: "#000" }}>
            {oddzial.sprawdzian_uzdolnien ? "Obowiązuje" : "Nie obowiązuje"}
          </span>
        </div>

        {/* Dane kontaktowe */}
        <div style={s.contactSection}>
          <span style={s.sectionLabel}>Dane szkoły:</span>
          <div style={s.contactList}>
            <div style={s.contactRow}>
              <LocationIcon />
              <span style={s.contactText}>{szkola.adres}</span>
            </div>
            {szkola.telefon && (
              <div style={s.contactRow}>
                <PhoneIcon />
                <span style={s.contactText}>{szkola.telefon}</span>
              </div>
            )}
            <div style={s.contactRow}>
              <WheelchairIcon />
              <span style={s.contactText}>{isAdapted ? "Dostosowana" : "Nie dostosowana"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "#fff",
    borderRadius: 8,
    padding: 24,
    boxShadow: "0 4px 24px 0 rgba(34, 34, 34, 0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 32,
    fontFamily: "'Poppins', sans-serif",
  },
  profileSection: {
    display: "flex",
    flexDirection: "column",
    gap: 32,
    paddingBottom: 32,
    borderBottom: "1px dashed #9ca3af",
  },
  schoolSection: {
    display: "flex",
    flexDirection: "column",
    gap: 32,
  },
  sectionLabel: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#9ca3af",
    lineHeight: "20px",
    marginBottom: 12,
  },
  profileHeaderRow: {
    display: "flex",
    gap: 32,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  profileNameRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  profileName: {
    fontSize: 20,
    fontWeight: 800,
    color: "#9000ff",
    lineHeight: "20px",
  },
  profileYears: {
    fontSize: 13,
    fontWeight: 500,
    color: "#000",
    lineHeight: "20px",
  },
  zawodRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontSize: 14,
    color: "#000",
    lineHeight: "20px",
    marginTop: 12,
    flexWrap: "wrap",
  },
  rokBox: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    width: 183,
  },
  selectWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  yearSelect: {
    width: "100%",
    height: 44,
    border: "2px solid #f3f4f6",
    borderRadius: 12,
    padding: "0 40px 0 12px",
    fontSize: 16,
    fontWeight: 500,
    fontFamily: "'Poppins', sans-serif",
    color: "#111827",
    background: "#fff",
    appearance: "none",
    WebkitAppearance: "none",
    cursor: "pointer",
    outline: "none",
  },
  selectArrow: {
    position: "absolute",
    right: 12,
    pointerEvents: "none",
    color: "#6b7280",
    fontSize: 14,
  },
  e8Value: {
    fontSize: 16,
    fontWeight: 800,
    color: "#111827",
    lineHeight: "20px",
    fontFamily: "'Poppins', sans-serif",
  },
  subjectsGrid: {
    display: "flex",
    gap: 24,
    alignItems: "flex-start",
    width: "100%",
    fontSize: 14,
  },
  statsBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    width: "100%",
  },
  schoolTitleRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 800,
    color: "#003cff",
    lineHeight: "20px",
  },
  schoolPublicLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#000",
    lineHeight: "20px",
  },
  aptitudeRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    lineHeight: "20px",
    flexWrap: "wrap",
  },
  contactSection: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  contactList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  contactRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  contactText: {
    fontSize: 14,
    fontWeight: 500,
    color: "#000",
    lineHeight: "20px",
  },
};
