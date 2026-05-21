import React, { useState, useEffect, useMemo, useCallback } from "react";
import ExpandedCard from "./ExpandedCard";
import Timeline from "./Timeline";

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

// ─── InfoIcon + Tooltip ───────────────────────────────────────────────────────

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7" stroke="#9ca3af" strokeWidth="1.5" />
      <rect x="7.25" y="7" width="1.5" height="5" rx="0.75" fill="#9ca3af" />
      <rect x="7.25" y="4.5" width="1.5" height="1.5" rx="0.75" fill="#9ca3af" />
    </svg>
  );
}

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

function ChevronIcon({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      style={{
        transition: "transform 0.2s",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <path d="M5 7.5L10 12.5L15 7.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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


/** Normalizuje nazwę profilu do porównywania:
 *  - trim + lowercase
 *  - usuwa pojedynczy sufiks (litera lub cyfra) po literze klasy: "1bh " → "1b ", "1b1 " → "1b "
 */
function normalizeProfileName(name) {
  let n = name.trim().toLowerCase();
  n = n.replace(/^(\d+[a-z])[a-z\d](\s)/, "$1$2");
  return n;
}

/** Sprawdza czy profil z wyniki pasuje do profilu z gdansk_nabor.
 *  Obsługuje: różnice wielkości liter, trailing space, sufiksy grup,
 *  obcięte nazwy (reg. = regionu) oraz dodane języki w nawiasie.
 */
function profileMatches(wyniki, gdansk) {
  const w = normalizeProfileName(wyniki);
  const g = normalizeProfileName(gdansk);
  if (w === g) return true;
  const minLen = 15;
  // gdansk ma więcej tekstu na końcu (np. dodatkowy język)
  if (w.length >= minLen && g.startsWith(w)) return true;
  // wyniki ma więcej tekstu (rzadkie)
  if (g.length >= minLen && w.startsWith(g)) return true;
  // wspólny prefiks obejmuje ≥80% krótszego stringa (np. "regionu" vs "reg.")
  let i = 0;
  while (i < w.length && i < g.length && w[i] === g[i]) i++;
  const shorter = Math.min(w.length, g.length);
  if (shorter >= minLen && i / shorter >= 0.8) return true;
  return false;
}

// Ręczna mapa profili — używana gdy automatyczne dopasowanie zawodzi.
//
// FORMAT:
//   Klucz (lewa strona)  = `szkolaNazwa|profilWyniki`
//     szkolaNazwa  — nazwa szkoły z wyniki_nabor_gdansk.json (pole szkola.nazwa),
//                    BEZ sufiksu ", Gdańsk"
//     profilWyniki — fragment po " - " z pola oddzial.nazwa, czyli to samo
//                    co extractProfile() zwraca w kolumnie "Szkoła / Profil klasy"
//
//   Wartość (prawa strona) = obiekt { rok: oddzialy[].id, ... }
//                    — dla każdego roku osobne id z gdansk_nabor_dane.json
//                    — rok bez wpisu → karta pokaże "Brak danych"
//
// KIEDY DODAWAĆ:
//   - profil zmienił nazwę między sezonami
//   - podgrupy zostały połączone lub rozdzielone
//   - skrót vs pełna nazwa, nieobsługiwana przez algorytm fuzzy (80% prefix)
//
// ID znajdziesz w gdansk_nabor_dane.json w polu oddzialy[].id
const PROFILE_MANUAL_MAP = {
  // IX LO: w wyniki 2025 → "1E INFORMATYKA:MULTIMEDIA I AI"
  //         w gdansk_nabor → "1E GRAFIKA KOMPUTEROWA" (tylko 2025)
  "IX Liceum Ogólnokształcące|1E INFORMATYKA:MULTIMEDIA I AI": {
    2025: "68ca79f5bc0897545ac52599",
  },
  // X LO Dwuj: w wyniki → "1C-BIZNESOWA_GR.GEO [D] mat-geo (ang-hisz*,niem*)"
  //             podgrupy GEO i WOS połączone; w 2023 profil miał suffix _HISZP
  "X Liceum Ogólnokształcące Dwujęzyczne|1C-BIZNESOWA_GR.GEO [D] mat-geo (ang-hisz*,niem*)": {
    2025: "68ca7a5abc0897545ac52603",
    2024: "66f17cca647f8056106e96da",
    2023: "650c3f64c249e54d9d53c015",
  },
  // XV LO Dwuj: w wyniki → "1a matematyczno-informatyczno-językowa"
  //              w 2023 → "1a Politechniczna", w 2022/2021 → "1ap [O] fiz-mat (ang-niem)"
  "XV Liceum Ogólnokształcące z Oddziałami Dwujęzycznymi|1a matematyczno-informatyczno-językowa": {
    2025: "68ca7a9fbc0897545ac52673",
    2023: "650c4026c249e54d9d53c09a",
    2022: "633f0e79bb10d42aacb17a97",
    2021: "6228beb432c32b746ec9d5c4",
  },
  // XV LO Dwuj: w wyniki → "1d Geograficzno-matematyczna z turystyką regionu"
  //              w gdansk_nabor → "1d Geograficzno-matematyczna z turystyką reg." (skrót)
  "XV Liceum Ogólnokształcące z Oddziałami Dwujęzycznymi|1d Geograficzno-matematyczna z turystyką regionu": {
    2025: "68ca7a97bc0897545ac5266f",
    2024: "66f17cf7647f8056106e973d",
    2023: "650c4040c249e54d9d53d215",
    2022: "633f0e85bb10d42aacb17a9a",
  },
  // X LO Dwuj: w wyniki → "1A-POLITECHNICZNA [D] fiz-inf-mat (ang-hisz*,niem*)"
  //             nazwa identyczna w gdansk_nabor we wszystkich latach
  "X Liceum Ogólnokształcące Dwujęzyczne|1A-POLITECHNICZNA [D] fiz-inf-mat (ang-hisz*,niem*)": {
    2025: "68ca7a57bc0897545ac52601",
    2024: "66f17cc7647f8056106e96d8",
    2023: "650c3f5cc249e54d9d53c013",
    2022: "633f0e1dbb10d42aacb17a33",
    2021: "6228be8432c32b746ec9d555",
  },
  // II LO: w wyniki → "1A POLITECHNICZNA"
  //         w 2024/2023/2022 → "1A POLITECHNICZNA MAT", w 2021 → "1A [O] fiz-ang-mat (ang-hisz,nor)"
  "II Liceum Ogólnokształcące|1A POLITECHNICZNA": {
    2025: "68ca79a5bc0897545ac5255b",
    2024: "66f17c4b647f8056106e963b",
    2023: "650c3d14c249e54d9d53bdcd",
    2022: "633f0cfebb10d42aacb17991",
    2021: "6228be0832c32b746ec9d4ba",
  },
  // II LO: w wyniki → "1E MENEDŻERSKA"
  //         w 2021 → "1E [O] geogr-ang-mat (ang-fra,niem)"
  "II Liceum Ogólnokształcące|1E MENEDŻERSKA": {
    2025: "68ca79acbc0897545ac5255e",
    2024: "66f17c51647f8056106e963e",
    2023: "650c3d2ac249e54d9d53bdf0",
    2022: "633f0d0bbb10d42aacb17994",
    2021: "6228be0e32c32b746ec9d4bd",
  },
  // XIX LO: w wyniki → "1Emf interdyscyplinarny grupa mat-fiz"
  //          nazwa identyczna w gdansk_nabor; dane od 2023
  "XIX Liceum Ogólnokształcące|1Emf interdyscyplinarny grupa mat-fiz": {
    2025: "68ca7a17bc0897545ac525b8",
    2024: "66f17c98647f8056106e968e",
    2023: "650c3e73c249e54d9d53bfc1",
  },
  // I LO: w wyniki → "1b AKADEMICKA matematyczno-fizyczna"
  //        nazwa identyczna w gdansk_nabor we wszystkich latach
  "I Liceum Ogólnokształcące|1b AKADEMICKA matematyczno-fizyczna": {
    2025: "68ca799dbc0897545ac52553",
    2024: "66f17c45647f8056106e9633",
    2023: "650c3cf8c249e54d9d53bda9",
    2022: "633f0cf1bb10d42aacb1798c",
    2021: "6228be0232c32b746ec9d4b5",
  },
  // I LO: w wyniki → "1c POLITECHNICZNA matematyczno-fizyczna"
  //        nazwa identyczna w gdansk_nabor we wszystkich latach
  "I Liceum Ogólnokształcące|1c POLITECHNICZNA matematyczno-fizyczna": {
    2025: "68ca799fbc0897545ac52554",
    2024: "66f17c46647f8056106e9634",
    2023: "650c3cfec249e54d9d53bdaf",
    2022: "633f0cf4bb10d42aacb1798d",
    2021: "6228be0332c32b746ec9d4b6",
  },
  // I LO: w wyniki → "1d EKONOMICZNA matematyczno-geograficzna"
  //        nazwa identyczna w gdansk_nabor we wszystkich latach
  "I Liceum Ogólnokształcące|1d EKONOMICZNA matematyczno-geograficzna": {
    2025: "68ca79a1bc0897545ac52555",
    2024: "66f17c48647f8056106e9635",
    2023: "650c3d05c249e54d9d53bdb5",
    2022: "633f0cf7bb10d42aacb1798e",
    2021: "6228be0532c32b746ec9d4b7",
  },
  // IX LO: w 2025 klasa 1C podzielona na gr.1 (fiz) i gr.2 (inf); w 2021–2024 jeden wspólny oddział
  "IX Liceum Ogólnokształcące|1C_gr.1 FIZYCZNO-MATEMATYCZNA": {
    2025: "68ca79f9bc0897545ac5259b",
    2024: "66f17c83647f8056106e9671",
    2023: "650c3e01c249e54d9d53bf5f",
    2022: "633f0d7ebb10d42aacb179c9",
    2021: "6228be4032c32b746ec9d4ef",
  },
  "IX Liceum Ogólnokształcące|1C_gr.2 INFORMATYCZNO-MATEMATYCZNO": {
    2025: "68ca79f3bc0897545ac52598",
    2024: "66f17c83647f8056106e9671",
    2023: "650c3e01c249e54d9d53bf5f",
    2022: "633f0d7ebb10d42aacb179c9",
    2021: "6228be4032c32b746ec9d4ef",
  },
};

function findGdanskRecord(gdanskData, szkolaNazwa, profilNazwa, rok) {
  const manualKey = `${szkolaNazwa}|${profilNazwa}`;
  const yearMap = PROFILE_MANUAL_MAP[manualKey];

  if (yearMap) {
    const oddzialId = yearMap[rok];
    if (!oddzialId) return null;
    return gdanskData.find((r) => r.oddzialy.some((o) => o.id === oddzialId)) ?? null;
  }

  return (
    gdanskData.find(
      (rec) =>
        rec.szkola.nazwa.replace(", Gdańsk", "") === szkolaNazwa &&
        rec.rok === rok &&
        rec.oddzialy.some((o) => profileMatches(profilNazwa, o.nazwa))
    ) ?? null
  );
}

function findGdanskOddzial(gdanskData, szkolaNazwa, profilNazwa, rok) {
  const record = findGdanskRecord(gdanskData, szkolaNazwa, profilNazwa, rok);
  if (!record) return null;
  const manualKey = `${szkolaNazwa}|${profilNazwa}`;
  const yearMap = PROFILE_MANUAL_MAP[manualKey];
  const oddzialId = yearMap?.[rok];
  if (oddzialId) return record.oddzialy.find((o) => o.id === oddzialId) ?? null;
  return record.oddzialy.find((o) => profileMatches(profilNazwa, o.nazwa)) ?? null;
}

function getProgiFromGdansk(gdanskData, szkolaNazwa, profilNazwa) {
  const odz2025 = findGdanskOddzial(gdanskData, szkolaNazwa, profilNazwa, 2025);
  const odz2024 = findGdanskOddzial(gdanskData, szkolaNazwa, profilNazwa, 2024);
  return {
    prog_2025: odz2025?.prog_punktowy ?? null,
    prog_2024: odz2024?.prog_punktowy ?? null,
  };
}

function getSchoolYears(gdanskData, szkolaNazwa) {
  const years = gdanskData
    .filter((rec) => rec.szkola.nazwa.replace(", Gdańsk", "") === szkolaNazwa)
    .map((rec) => rec.rok);
  return [...new Set(years)].sort((a, b) => b - a);
}

// ─── Kolumny tabeli ───────────────────────────────────────────────────────────

const COLUMNS = [
  { key: "szkolaNazwa",         label: ["Szkoła /", "Profil klasy"],                sortable: true,  width: "minmax(200px, 2.5fr)" },
  { key: "miejsca",             label: ["Liczba miejsc", "w klasie"],               sortable: true,  width: "minmax(70px, 0.8fr)"   },
  { key: "chetni_ogolem",       label: ["Liczba chętnych", "ogółem"],               sortable: true,  width: "minmax(80px, 1fr)"   },
  { key: "chetni_pierwsza_pref",label: ["Liczba chętnych", "I wybór"],                sortable: true,  width: "minmax(85px, 1fr)"   },
  { key: "prob_ogolnie",        label: ["Prawdopod.", "dostania się", "ogólnie"],   sortable: true,  width: "minmax(90px, 1.2fr)"  },
  { key: "prob_pierwsza",       label: ["Prawdop.", "dostania się", "I wybór"],     sortable: true,  width: "minmax(90px, 1.2fr)"  },
  { key: "wskaznik",            label: ["Wskaźnik", ""],                            sortable: true,  width: "minmax(80px, 1fr)"   },
  { key: "prog_2024",           label: ["Próg punktowy", "w roku 2024"],                 sortable: true,  width: "minmax(75px, 0.9fr)"   },
  { key: "prog_2025",           label: ["Próg punktowy", "w roku 2025"],                 sortable: true,  width: "minmax(75px, 0.9fr)"   },
  { key: "expand",              label: ["", ""],                                    sortable: false, width: "32px"                },
  { key: "delete",              label: ["", ""],                                    sortable: false, width: "40px"                },
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

  const [gdanskData,      setGdanskData]      = useState([]);
  const [e8MatData,       setE8MatData]       = useState({});
  const [expandedRowKey,  setExpandedRowKey]  = useState(null);
  const [hoveredRowKey,   setHoveredRowKey]   = useState(null);
  const [cardRok,         setCardRok]         = useState(2025);

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

  useEffect(() => {
    fetch("./gdansk_nabor_dane.json")
      .then((r) => r.json())
      .then((d) => setGdanskData(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("./gdansk_e8_mapa.json")
      .then((r) => r.json())
      .then((d) => {
        const map = {};
        (d.dane || []).forEach((rec) => {
          if (rec.przedmiot === "matematyka") map[rec.rok] = rec.liczba_zdajacych;
        });
        setE8MatData(map);
      })
      .catch(() => {});
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
          ...getProgiFromGdansk(gdanskData, szkola.nazwa, extractProfile(oddzial.nazwa)),
        };
      })
      .filter(Boolean);
  }, [data, watchlist, gdanskData]);

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
      <style>{`
        @keyframes formSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
      {/* ── Nagłówek ── */}
      <div style={styles.header}>
        <h1 style={styles.h1}>
          <span style={{ color: "#1d1d1f" }}>Gdańskie </span>
          <span style={styles.gradient}>Licea 2026</span>
        </h1>
        <p style={styles.subtitle}>
          Pobrane dane z {data.pobrano_czytelnie}.{" "}
          Aktualizacja odbywa się cyklicznie i automatycznie.
        </p>
      </div>

      {/* ── Karta główna ── */}
      <div style={styles.cardWrapper}>
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
                  {col.label.map((line, i) => line && <span key={i}>{line}</span>)}
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
              sortedRows.map((row, i) => {
                const rowKey = `${row.szkolaId}|${row.oddzialNazwa}`;
                const isExpanded = expandedRowKey === rowKey;
                const profil = extractProfile(row.oddzialNazwa);
                const gdanskRecord = isExpanded
                  ? findGdanskRecord(gdanskData, row.szkolaNazwa, profil, cardRok)
                  : null;
                const gdanskOddzial = isExpanded
                  ? findGdanskOddzial(gdanskData, row.szkolaNazwa, profil, cardRok)
                  : null;
                const availableYears = isExpanded ? getSchoolYears(gdanskData, row.szkolaNazwa) : [];

                return (
                  <React.Fragment key={rowKey}>
                    <div
                      style={{
                        ...styles.gridRow,
                        ...styles.dataRow,
                        gridTemplateColumns: gridCols,
                        borderTop: i === 0 ? "none" : "1px solid #f3f4f6",
                        cursor: "pointer",
                        background: isExpanded ? "#EDF3FA" : hoveredRowKey === rowKey ? "#EDF3FA" : "transparent",
                        borderRadius: 4,
                        ...(isExpanded || hoveredRowKey === rowKey ? { margin: "0", padding: "4px 8px" } : {}),
                      }}
                      onMouseEnter={() => setHoveredRowKey(rowKey)}
                      onMouseLeave={() => setHoveredRowKey(null)}
                      onClick={() =>
                        setExpandedRowKey((prev) => {
                          if (prev === rowKey) return null;
                          const years = getSchoolYears(gdanskData, row.szkolaNazwa);
                          setCardRok(years.length > 0 ? years[0] : 2025);
                          return rowKey;
                        })
                      }
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
                            z UO: {fmtPct(row.miejsca, row.chetni_ogolem + row.chetni_ogolem_oczekujacy)}
                          </span>
                        )}
                      </div>

                      {/* Prawdopodobieństwo I wybór */}
                      <div style={{ ...styles.valueCell, flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                        <span>{fmtPct(row.miejsca, row.chetni_pierwsza_pref)}</span>
                        {row.chetni_pierwsza_pref_oczekujacy > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af" }}>
                            z UO: {fmtPct(row.miejsca, row.chetni_pierwsza_pref + row.chetni_pierwsza_pref_oczekujacy)}
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

                      {/* Rozwiń */}
                      <div style={{ ...styles.valueCell, justifyContent: "center" }}>
                        <ChevronIcon open={isExpanded} />
                      </div>

                      {/* Usuń */}
                      <div style={{ ...styles.valueCell, justifyContent: "center" }}>
                        <button
                          style={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromWatchlist(row.szkolaId, row.oddzialNazwa);
                          }}
                          title="Usuń z obserwowanych"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>

                    {/* Panel szczegółów */}
                    {isExpanded && (
                      <div style={styles.expandedPanel}>
                        {gdanskRecord && gdanskOddzial ? (
                          <ExpandedCard
                            record={gdanskRecord}
                            oddzial={gdanskOddzial}
                            availableYears={availableYears.length > 0 ? availableYears : [cardRok]}
                            selectedRok={cardRok}
                            onRokChange={setCardRok}
                            e8MatData={e8MatData}
                          />
                        ) : (
                          <div style={styles.noDataCard}>
                            {/* Nagłówek zawsze widoczny: nazwa klasy + e8 + select roku */}
                            <div style={styles.noDataHeader}>
                              <div style={{ flex: 1 }}>
                                <span style={styles.noDataLabel}>Szczegóły profilu</span>
                                <span style={styles.noDataProfil}>{profil}</span>
                              </div>
                              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexShrink: 0 }}>
                                <div style={styles.noDataBox}>
                                  <span style={styles.noDataLabel}>Liczba zdających E8 (mat)</span>
                                  <div style={{ padding: "12px 0", display: "flex", gap: 8, alignItems: "center" }}>
                                    <span style={styles.noDataValue}>
                                      {e8MatData[cardRok] != null ? e8MatData[cardRok].toLocaleString("pl-PL") : "—"}
                                    </span>
                                    <Tooltip text="Liczba zdających egzamin ósmoklasisty w Gdańsku, na przykładzie przedmiotu matematyka.">
                                      <InfoIcon />
                                    </Tooltip>
                                  </div>
                                </div>
                                <div style={styles.noDataBox}>
                                  <span style={styles.noDataLabel}>Rok rekrutacji</span>
                                  <div style={styles.noDataSelectWrap}>
                                    <select
                                      style={styles.noDataSelect}
                                      value={cardRok}
                                      onChange={(e) => setCardRok(Number(e.target.value))}
                                    >
                                      {(availableYears.length > 0 ? availableYears : [cardRok]).map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                    </select>
                                    <span style={styles.noDataArrow}>▾</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {/* Komunikat braku danych */}
                            <div style={styles.noDetailData}>
                              Brak szczegółowych danych historycznych dla{" "}
                              <strong>{row.szkolaNazwa}</strong> — {profil}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Separator */}
        <div style={styles.separator} />

        {/* ── Przycisk dodawania ── */}
        <div>
          {!showForm && (
            <button style={styles.addBtn} onClick={() => setShowForm(true)}>
              Dodaj szkołę do obserwacji
            </button>
          )}

          {showForm && (
            <div style={{ animation: "formSlideIn 0.2s ease" }}>
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
              </div>

              {/* Przyciski pod formularzem */}
              <div style={styles.formActions}>
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
                <button
                  style={styles.cancelBtn}
                  onClick={() => { setShowForm(false); setFmSchool(""); setFmOddzial(""); }}
                >
                  Anuluj
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
            <li><strong>z UO</strong> — z uwzględnieniem oczekujących, czyli prawdopodobieństwo dostania się liczone łącznie z kandydatami którzy jeszcze nie dostarczyli/nie zweryfikowali wniosku (liczba w nawiasie)</li>
          </ul>
        </div>
        <div style={styles.infoSection}>
          <p style={styles.infoLabel}>Obliczenia</p>
          <ul style={styles.infoList}>
            <li><strong>Prawdopodobieństwo dostania się ogólnie</strong> — to obliczenie miejsca/chetni ogolem (z zaakceptowanymi wnioskami) x 100%</li>
            <li><strong>Prawdopodobieństwo dostania się I wybór</strong> — to obliczenie miejsca/chetni I preferencja (z zaakceptowanymi wnioskami) x 100%</li>
            <li><strong>Z uwzgl. ocz.</strong> - to obliczenie miejsca/(chetni ogółem + chetni oczekujący) x 100%, czyli szacunkowe prawdopodobieństwo dostania się, jeśli uwzględnimy również oczekujących.</li>
            <li><strong>Z uwzgl. ocz. I wybór</strong> - to obliczenie miejsca/(chetni I wybór + chetni I wybór oczekujący) x 100%, czyli szacunkowe prawdopodobieństwo dostania się, jeśli uwzględnimy również oczekujących I wyboru.</li>
            <li><strong>Wskaźnik</strong> - to obliczenie chętni/miejsca, ilu chętnych przypada na jedno miejsce. Im wyższy wskaźnik, tym trudniej się dostać.</li>
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
      </div>{/* /cardWrapper */}

      {/* ── Timeline ── */}
      <div style={{ width: "100%", maxWidth: 1280 }}>
        <Timeline />
      </div>

      {/* ── Stopka ── */}
      <footer style={styles.footer}>
        Źródło danych: nabor-pomorze.edu.com.pl
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
  cardWrapper: {
    width: "100%",
    maxWidth: 1280,
    background: "conic-gradient(from 0deg, #ff0000, #ff8800, #ffff00, #00cc00, #00cccc, #0066ff, #9000ff, #ff0099, #ff0000)",
    borderRadius: 27,
    padding: 3,
    boxShadow: "0px 4px 12px rgba(34,34,34,0.08)",
  },
  card: {
    background: "#fff",
    borderRadius: 24,
    padding: 25,
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
    margin: "0 8px",
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
    margin: "0",
    width: "calc(100% + 0px)",
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
    marginTop: 0,
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
  formActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginTop: 16,
  },
  cancelBtn: {
    background: "#f3f4f6",
    color: "#374151",
    border: "none",
    borderRadius: 8,
    height: 32,
    padding: "0 16px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: "20px",
    fontFamily: "'Poppins', sans-serif",
    transition: "opacity 0.15s",
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
  expandedPanel: {
    padding: "30px 20px 30px",
    borderTop: "1px dashed #e5e7eb",
  },
  noDetailData: {
    fontSize: 14,
    fontWeight: 500,
    color: "#9ca3af",
    textAlign: "center",
    padding: "16px 0 0",
  },
  noDataCard: {
    background: "#fff",
    borderRadius: 8,
    padding: 24,
    boxShadow: "0 4px 24px 0 rgba(34,34,34,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    fontFamily: "'Poppins', sans-serif",
  },
  noDataHeader: {
    display: "flex",
    gap: 32,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  noDataLabel: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#9ca3af",
    lineHeight: "20px",
    marginBottom: 12,
  },
  noDataProfil: {
    display: "block",
    fontSize: 20,
    fontWeight: 800,
    color: "#9000ff",
    lineHeight: "20px",
  },
  noDataBox: {
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    width: 183,
  },
  noDataValue: {
    fontSize: 16,
    fontWeight: 800,
    color: "#111827",
    lineHeight: "20px",
  },
  noDataSelectWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  noDataSelect: {
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
  noDataArrow: {
    position: "absolute",
    right: 12,
    pointerEvents: "none",
    color: "#6b7280",
    fontSize: 14,
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
