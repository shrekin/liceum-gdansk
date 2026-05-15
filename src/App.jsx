import { useState, useEffect, useMemo, useCallback } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wyciąga nazwę profilu z pełnej nazwy oddziału: "Szkoła, Gdańsk - 1a PROFIL" → "1a PROFIL" */
function extractProfile(fullName) {
  const idx = fullName.indexOf(" - ");
  return idx !== -1 ? fullName.slice(idx + 3) : fullName;
}

/** Filtruje wiersze RAZEM */
function filterOddzialy(oddzialy) {
  return oddzialy.filter((o) => !o.nazwa.toUpperCase().includes("RAZEM"));
}

/** Kolor tła komórki wskaźnika */
function wskaznikBg(w) {
  if (w >= 3.0) return "#fecaca";
  if (w >= 2.0) return "#fef08a";
  if (w >= 1.0) return "#bbf7d0";
  return "#e0e7ff";
}

/** Formatuje procent bezpiecznie */
function fmtPct(a, b) {
  if (!b || b === 0) return "—";
  const v = (a / b) * 100;
  return v.toFixed(2).replace(".", ",") + "%";
}

// ─── Ikona sortowania ─────────────────────────────────────────────────────────

function SortIcon({ active, dir }) {
  if (!active) return <span style={{ color: "#d1d5db", marginLeft: 4 }}>↕</span>;
  return (
    <span style={{ color: "#2563eb", marginLeft: 4 }}>
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

// ─── Ikona kosza ──────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

// ─── Liczba z oczekującymi ────────────────────────────────────────────────────

/** Wyświetla "87" lub "87 (12)" gdzie (12) to oczekujący — mniejsze i szare */
function NumWithPending({ value, pending }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span>{value}</span>
      {pending > 0 && (
        <span style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af" }}>
          ({pending})
        </span>
      )}
    </span>
  );
}

// ─── Legenda ──────────────────────────────────────────────────────────────────

const LEGENDA = [
  { bg: "#fecaca", label: "Bardzo trudny", desc: "wskaźnik ≥ 3,0" },
  { bg: "#fef08a", label: "Trudny",        desc: "wskaźnik ≥ 2,0" },
  { bg: "#bbf7d0", label: "Umiarkowany",   desc: "wskaźnik ≥ 1,0" },
  { bg: "#e0e7ff", label: "Wolne miejsca", desc: "wskaźnik < 1,0" },
];

// ─── Progi punktowe (uzupełnij ręcznie: klucz = `${szkolaId}|${oddzialNazwa}`) ──

const PROGI = {
  // przykład:
  // "szkola-1|1a matematyczno-fizyczny": { prog_2024: 172, prog_2025: 168 },
  "79|XV Liceum Ogólnokształcące z Oddziałami Dwujęzyczn…, Gdańsk - 1a matematyczno-informatyczno-językowa": { prog_2024: null, prog_2025: 147.65 },
  "306|X Liceum Ogólnokształcące Dwujęzyczne, Gdańsk - 1A-POLITECHNICZNA [D] fiz-inf-mat (ang-hisz*,niem*)": { prog_2024: 147.05, prog_2025: 160.87 },
};

function getProgi(szkolaId, oddzialNazwa) {
  return PROGI[`${szkolaId}|${oddzialNazwa}`] ?? { prog_2024: null, prog_2025: null };
}

// ─── Kolumny tabeli ───────────────────────────────────────────────────────────

const COLUMNS = [
  { key: "profil",              label: ["Szkoła /", "Profil klasy"],               sortable: false, width: "minmax(200px, 2.5fr)" },
  { key: "miejsca",             label: ["Liczba miejsc", "w klasie"],               sortable: true,  width: "minmax(70px, 1fr)"   },
  { key: "chetni_ogolem",       label: ["Liczba chętnych", "ogółem"],               sortable: true,  width: "minmax(80px, 1fr)"   },
  { key: "chetni_pierwsza_pref", label: ["Chętni", "I preferencja"],                sortable: true,  width: "minmax(85px, 1fr)"   },
  { key: "prob_ogolnie",        label: ["Prawdop.", "ogólnie"],    sortable: true,  width: "minmax(90px, 1.2fr)"  },
  { key: "prob_pierwsza",       label: ["Prawdop.", "I wybór"],    sortable: true,  width: "minmax(90px, 1.2fr)"  },
  { key: "wskaznik",            label: ["Wskaźnik", ""],           sortable: true,  width: "minmax(80px, 1fr)"   },
  { key: "prog_2024",           label: ["Próg", "2024"],           sortable: true,  width: "minmax(75px, 1fr)"   },
  { key: "prog_2025",           label: ["Próg", "2025"],           sortable: true,  width: "minmax(75px, 1fr)"   },
  { key: "delete",              label: ["", ""],                                     sortable: false, width: "40px"                },
];


// ─── Główny komponent ─────────────────────────────────────────────────────────

export default function App() {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [watchlist, setWatchlist] = useState([]);           // [{szkolaId, oddzialNazwa}]
  const [sortCfg,   setSortCfg]   = useState({ key: "wskaznik", dir: "desc" });
  const [showForm,  setShowForm]  = useState(false);
  const [fmSchool,  setFmSchool]  = useState("");           // wybrany id szkoły w formularzu
  const [fmOddzial, setFmOddzial] = useState("");           // wybrana nazwa oddziału

  // ── Pobieranie danych ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("./wyniki_nabor_gdansk.json")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  // ── Wczytanie watchlisty z localStorage ─────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nabor_watchlist");
      if (saved) setWatchlist(JSON.parse(saved));
    } catch {}
  }, []);

  const saveWatchlist = useCallback((list) => {
    setWatchlist(list);
    localStorage.setItem("nabor_watchlist", JSON.stringify(list));
  }, []);

  // ── Budowa wierszy watchlisty ────────────────────────────────────────────────
  const rows = useMemo(() => {
    if (!data) return [];
    return watchlist
      .map(({ szkolaId, oddzialNazwa }) => {
        const szkola  = data.szkoly.find((s) => s.id === szkolaId);
        if (!szkola) return null;
        const oddzial = szkola.oddzialy.find((o) => o.nazwa === oddzialNazwa);
        if (!oddzial) return null;
        return {
          szkolaId,
          oddzialNazwa,
          szkolaNazwa: szkola.nazwa,
          profil:      extractProfile(oddzial.nazwa),
          miejsca:     oddzial.miejsca,
          chetni_ogolem:                   oddzial.chetni_ogolem,
          chetni_ogolem_oczekujacy:        oddzial.chetni_ogolem_oczekujacy        ?? 0,
          chetni_pierwsza_pref:            oddzial.chetni_pierwsza_pref,
          chetni_pierwsza_pref_oczekujacy: oddzial.chetni_pierwsza_pref_oczekujacy ?? 0,
          wskaznik:    oddzial.wskaznik,
          prob_pierwsza: oddzial.miejsca / (oddzial.chetni_pierwsza_pref || Infinity) * 100,
          prob_ogolnie:  oddzial.miejsca / (oddzial.chetni_ogolem        || Infinity) * 100,
          ...getProgi(szkolaId, oddzialNazwa),
        };
      })
      .filter(Boolean);
  }, [data, watchlist]);

  // ── Sortowanie ───────────────────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    if (!rows.length) return rows;
    return [...rows].sort((a, b) => {
      let av = a[sortCfg.key] ?? 0;
      let bv = b[sortCfg.key] ?? 0;
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortCfg.dir === "asc" ? -1 :  1;
      if (av > bv) return sortCfg.dir === "asc" ?  1 : -1;
      return 0;
    });
  }, [rows, sortCfg]);

  const handleSort = (key) => {
    setSortCfg((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  };

  // ── Dodawanie/usuwanie ───────────────────────────────────────────────────────
  const addToWatchlist = () => {
    if (!fmSchool || !fmOddzial) return;
    const exists = watchlist.some(
      (w) => w.szkolaId === fmSchool && w.oddzialNazwa === fmOddzial
    );
    if (!exists) saveWatchlist([...watchlist, { szkolaId: fmSchool, oddzialNazwa: fmOddzial }]);
    setFmSchool("");
    setFmOddzial("");
    setShowForm(false);
  };

  const removeFromWatchlist = (szkolaId, oddzialNazwa) => {
    saveWatchlist(watchlist.filter(
      (w) => !(w.szkolaId === szkolaId && w.oddzialNazwa === oddzialNazwa)
    ));
  };

  // ── Opcje formularza ─────────────────────────────────────────────────────────
  const schoolOptions = data?.szkoly ?? [];
  const oddzialOptions = useMemo(() => {
    if (!fmSchool || !data) return [];
    const s = data.szkoly.find((s) => s.id === fmSchool);
    return s ? filterOddzialy(s.oddzialy) : [];
  }, [fmSchool, data]);

  // ── Style ────────────────────────────────────────────────────────────────────
  const gridCols = COLUMNS.map((c) => c.width).join(" ");

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={styles.centered}>
      <div style={styles.spinner} />
      <p style={{ ...styles.muted, marginTop: 16 }}>Ładowanie danych…</p>
    </div>
  );

  if (error) return (
    <div style={styles.centered}>
      <p style={{ color: "#ef4444", fontFamily: "Poppins, sans-serif" }}>
        Nie udało się załadować danych: {error}
      </p>
    </div>
  );

  return (
    <div style={styles.page}>
      {/* ── Nagłówek ── */}
      <div style={styles.header}>
        <h1 style={styles.h1}>
          <span style={{ color: "#1d1d1f" }}>Gdańskie </span>
          <span style={styles.gradient}>Licea 2026</span>
        </h1>
        <p style={styles.subtitle}>
          Pobrane dane z {data.pobrano_czytelnie}.{" "}
          Aktualizacja automatyczna co 1 godzinę.
        </p>
      </div>

      {/* ── Karta główna ── */}
      <div style={styles.card}>

        {/* Nagłówek karty */}
        <div style={styles.cardTitle}>Statystyki naboru</div>

        {/* ── Tabela watchlisty ── */}
        <div style={{ overflowX: "auto", width: "100%" }}>
          <div style={{ minWidth: 1110 }}>

            {/* Nagłówek kolumn */}
            <div style={{ ...styles.gridRow, ...styles.headerRow, gridTemplateColumns: gridCols }}>
              {COLUMNS.map((col) => (
                <div
                  key={col.key}
                  style={{
                    ...styles.colHeader,
                    cursor: col.sortable ? "pointer" : "default",
                    userSelect: col.sortable ? "none" : "auto",
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span>{col.label[0]}</span>
                  {col.label[1] && <span>{col.label[1]}</span>}
                  {col.sortable && (
                    <SortIcon
                      active={sortCfg.key === col.key}
                      dir={sortCfg.dir}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Wiersze danych */}
            {sortedRows.length === 0 ? (
              <div style={styles.emptyState}>
                Dodaj pierwszą szkołę klikając przycisk poniżej
              </div>
            ) : (
              sortedRows.map((row, i) => (
                <div
                  key={`${row.szkolaId}-${row.oddzialNazwa}`}
                  style={{
                    ...styles.gridRow,
                    ...styles.dataRow,
                    gridTemplateColumns: gridCols,
                    borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                  }}
                >
                  {/* Szkoła / Profil */}
                  <div style={styles.profileCell}>
                    <span style={styles.schoolName}>{row.szkolaNazwa}</span>
                    <span style={styles.profileName}>{row.profil}</span>
                  </div>

                  {/* Miejsca */}
                  <div style={styles.valueCell}>{row.miejsca}</div>

                  {/* Chętni ogółem */}
                  <div style={styles.valueCell}>
                    <NumWithPending
                      value={row.chetni_ogolem}
                      pending={row.chetni_ogolem_oczekujacy}
                    />
                  </div>

                  {/* Chętni I preferencja */}
                  <div style={styles.valueCell}>
                    <NumWithPending
                      value={row.chetni_pierwsza_pref}
                      pending={row.chetni_pierwsza_pref_oczekujacy}
                    />
                  </div>

                  {/* Prawdopodobieństwo ogólnie */}
                  <div style={{ ...styles.valueCell, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span>{fmtPct(row.miejsca, row.chetni_ogolem)}</span>
                    {row.chetni_ogolem_oczekujacy > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>
                        z uwzgl. ocz.: {fmtPct(row.miejsca, row.chetni_ogolem + row.chetni_ogolem_oczekujacy)}
                      </span>
                    )}
                  </div>

                  {/* Prawdopodobieństwo I wybór */}
                  <div style={{ ...styles.valueCell, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span>{fmtPct(row.miejsca, row.chetni_pierwsza_pref)}</span>
                    {row.chetni_pierwsza_pref_oczekujacy > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>
                        z uwzgl. ocz.: {fmtPct(row.miejsca, row.chetni_pierwsza_pref + row.chetni_pierwsza_pref_oczekujacy)}
                      </span>
                    )}
                  </div>

                  {/* Wskaźnik */}
                  <div style={{ ...styles.valueCell, padding: "12px 4px" }}>
                    <span style={{
                      ...styles.wskaznikBadge,
                      background: wskaznikBg(row.wskaznik),
                    }}>
                      {row.wskaznik.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  {/* Próg 2024 */}
                  <div style={{ ...styles.valueCell, color: row.prog_2024 == null ? "#d1d5db" : "#222" }}>
                    {row.prog_2024 ?? "—"}
                  </div>

                  {/* Próg 2025 */}
                  <div style={{ ...styles.valueCell, color: row.prog_2025 == null ? "#d1d5db" : "#222" }}>
                    {row.prog_2025 ?? "—"}
                  </div>

                  {/* Usuń */}
                  <div style={{ ...styles.valueCell, justifyContent: "center" }}>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => removeFromWatchlist(row.szkolaId, row.oddzialNazwa)}
                      title="Usuń z obserwowanych"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Separator */}
        <div style={styles.separator} />

        {/* ── Przycisk dodawania ── */}
        <div>
          <button style={styles.addBtn} onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Anuluj" : "Dodaj szkołę do obserwacji"}
          </button>

          {showForm && (
            <div style={styles.formRow}>
              {/* Dropdown szkoła */}
              <div style={styles.formField}>
                <label style={styles.formLabel}>Szkoła</label>
                <div style={styles.selectWrap}>
                  <select
                    style={styles.select}
                    value={fmSchool}
                    onChange={(e) => { setFmSchool(e.target.value); setFmOddzial(""); }}
                  >
                    <option value="">Wybierz szkołę</option>
                    {schoolOptions.map((s) => (
                      <option key={s.id} value={s.id}>{s.nazwa}</option>
                    ))}
                  </select>
                  <span style={styles.selectArrow}>▾</span>
                </div>
              </div>

              {/* Dropdown profil */}
              <div style={styles.formField}>
                <label style={styles.formLabel}>Profil</label>
                <div style={styles.selectWrap}>
                  <select
                    style={styles.select}
                    value={fmOddzial}
                    onChange={(e) => setFmOddzial(e.target.value)}
                    disabled={!fmSchool}
                  >
                    <option value="">Wybierz profil</option>
                    {oddzialOptions.map((o) => (
                      <option key={o.nazwa} value={o.nazwa}>
                        {extractProfile(o.nazwa)}
                      </option>
                    ))}
                  </select>
                  <span style={styles.selectArrow}>▾</span>
                </div>
              </div>

              {/* Przycisk dodaj */}
              <div style={styles.formBtnWrap}>
                <button
                  style={{
                    ...styles.addBtn,
                    opacity: (!fmSchool || !fmOddzial) ? 0.4 : 1,
                    cursor:  (!fmSchool || !fmOddzial) ? "not-allowed" : "pointer",
                  }}
                  onClick={addToWatchlist}
                  disabled={!fmSchool || !fmOddzial}
                >
                  Dodaj
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Informacje dodatkowe ── */}
        <div style={styles.infoSection}>
          <p style={styles.infoLabel}>Informacje dodatkowe</p>
          <ul style={styles.infoList}>
            <li><strong>Liczba chętnych z I preferencji</strong> — liczba kandydatów, którzy wybrali ten oddział na pierwszym miejscu swojej listy preferencji, a ich wniosek został zaakceptowany przez szkołę.</li>
            <li><strong>*</strong> — Liczba chętnych ogółem do szkoły oznacza liczbę osób, które ubiegają się o przyjęcie do co najmniej jednego oddziału w danej szkole, a ich wniosek został zaakceptowany.</li>
            <li><strong>Liczba przed nawiasem</strong> — liczba osób, które wybrały dany oddział, a ich wniosek został zaakceptowany.</li>
            <li><strong>Liczba w nawiasie</strong> — liczba osób, które wybrały dany oddział, ale nie dostarczyły jeszcze wniosku lub ich wniosek nie został jeszcze zweryfikowany.</li>
          </ul>
        </div>

        {/* ── Legenda ── */}
        <div style={styles.legendRow}>
          {LEGENDA.map((l) => (
            <div key={l.label} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: l.bg }} />
              <span style={styles.legendLabel}>{l.label}</span>
              <span style={styles.legendDesc}>{l.desc}</span>
            </div>
          ))}
        </div>

      </div>{/* /card */}

      {/* ── Stopka ── */}
      <footer style={styles.footer}>
        Źródło: nabor-pomorze.edu.com.pl | VULCAN sp. z o.o. 2026
      </footer>
    </div>
  );
}

// ─── Style ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    fontFamily: "'Poppins', sans-serif",
    background: "#fff",
    minHeight: "100vh",
    padding: "64px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 32,
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #2563eb",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  header: {
    width: "100%",
    maxWidth: 1280,
  },
  h1: {
    fontSize: 60,
    fontWeight: 800,
    letterSpacing: "-1.5px",
    lineHeight: 1,
    margin: "0 0 8px 0",
    paddingTop: 8,
    paddingBottom: 6,
  },
  gradient: {
    background: "linear-gradient(to right, #2563eb, #06b6d4)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: 500,
    color: "#9ca3af",
    margin: 0,
  },
  card: {
    width: "100%",
    maxWidth: 1280,
    background: "#fff",
    border: "3px solid #12bee9",
    borderRadius: 24,
    padding: 33.5,
    boxShadow: "0px 4px 12px rgba(34,34,34,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1d1d1f",
    lineHeight: "28px",
  },
  gridRow: {
    display: "grid",
    alignItems: "center",
  },
  headerRow: {
    paddingBottom: 8,
  },
  dataRow: {
    padding: "4px 0",
  },
  colHeader: {
    display: "flex",
    flexDirection: "column",
    fontSize: 13,
    fontWeight: 500,
    color: "#9ca3af",
    lineHeight: "20px",
    paddingRight: 8,
  },
  profileCell: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  schoolName: {
    fontSize: 11,
    fontWeight: 500,
    color: "#9ca3af",
    lineHeight: "16px",
  },
  profileName: {
    fontSize: 14,
    fontWeight: 400,
    color: "#111827",
    lineHeight: "20px",
  },
  valueCell: {
    display: "flex",
    alignItems: "center",
    fontSize: 16,
    fontWeight: 800,
    color: "#222",
    lineHeight: "20px",
    padding: "12px 8px 12px 0",
  },
  wskaznikBadge: {
    fontSize: 14,
    fontWeight: 800,
    color: "#222",
    padding: "4px 10px",
    borderRadius: 6,
    display: "inline-block",
  },
  deleteBtn: {
    width: 32,
    height: 32,
    background: "#f3f4f6",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6b7280",
    transition: "background 0.15s",
    flexShrink: 0,
  },
  emptyState: {
    padding: "40px 0",
    textAlign: "center",
    fontSize: 14,
    fontWeight: 500,
    color: "#9ca3af",
  },
  separator: {
    height: 1,
    background: "#f3f4f6",
    width: "100%",
    margin: "0 -33.5px",
    width: "calc(100% + 67px)",
  },
  addBtn: {
    background: "#1d78e5",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    height: 32,
    padding: "0 16px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: "20px",
    transition: "opacity 0.15s",
  },
  formRow: {
    display: "flex",
    gap: 24,
    alignItems: "flex-end",
    marginTop: 16,
    flexWrap: "wrap",
  },
  formField: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flex: "1 0 200px",
    minWidth: 200,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#9ca3af",
    lineHeight: "20px",
  },
  selectWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  select: {
    width: "100%",
    height: 56,
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
    transition: "border-color 0.15s",
  },
  selectArrow: {
    position: "absolute",
    right: 12,
    pointerEvents: "none",
    color: "#6b7280",
    fontSize: 14,
  },
  formBtnWrap: {
    display: "flex",
    alignItems: "flex-end",
    paddingBottom: 8,
  },
  infoSection: {
    borderTop: "1px solid #f3f4f6",
    paddingTop: 16,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#9ca3af",
    margin: "0 0 8px 0",
  },
  infoList: {
    fontSize: 12,
    fontWeight: 400,
    color: "#111827",
    lineHeight: "20px",
    paddingLeft: 20,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  legendRow: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 400,
    color: "#374151",
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 4,
    flexShrink: 0,
  },
  legendLabel: {
    fontWeight: 600,
  },
  legendDesc: {
    color: "#9ca3af",
  },
  muted: {
    color: "#9ca3af",
    fontSize: 14,
  },
  footer: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "'Poppins', sans-serif",
    textAlign: "center",
  },
};
