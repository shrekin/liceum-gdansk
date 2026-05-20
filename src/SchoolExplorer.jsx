import { useState, useEffect, useMemo } from "react";
import ExpandedCard from "./ExpandedCard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBySchool(data) {
  const map = {};
  for (const rec of data) {
    const id = rec.szkola.cerej;
    if (!map[id]) {
      map[id] = {
        cerej: id,
        nazwa: rec.szkola.nazwa,
        typ_szkoly: rec.typ_szkoly,
        records: [],
      };
    }
    map[id].records.push(rec);
  }
  for (const s of Object.values(map)) {
    s.records.sort((a, b) => b.rok - a.rok);
  }
  return Object.values(map).sort((a, b) =>
    a.nazwa.localeCompare(b.nazwa, "pl")
  );
}

function getAvailableYears(school) {
  return school.records.map((r) => r.rok);
}

function getRecord(school, rok) {
  return school.records.find((r) => r.rok === rok) || school.records[0];
}

const YEARS = [2025, 2024, 2023, 2022, 2021];

// ─── Ikony ────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      style={{
        transition: "transform 0.2s",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="#6b7280"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── SchoolRow ────────────────────────────────────────────────────────────────

function SchoolRow({ school, isOpen, onToggle }) {
  const latest = school.records[0];
  const isLO = school.typ_szkoly === "Liceum ogólnokształcące";

  return (
    <div style={rs.row} onClick={onToggle}>
      <span
        style={{
          ...rs.typeBadge,
          background: isLO ? "#ede9fe" : "#dbeafe",
          color: isLO ? "#7c3aed" : "#1d4ed8",
        }}
      >
        {isLO ? "LO" : "T"}
      </span>

      <div style={rs.nameBlock}>
        <span style={rs.schoolName}>{school.nazwa.replace(/, Gdańsk$/, "")}</span>
        <span style={rs.meta}>
          {latest.oddzialy.length} {oddzialLabel(latest.oddzialy.length)} · próg
          min{" "}
          <strong>
            {latest.statystyki_szkoly_agg._agg_prog_min
              ?.toFixed(2)
              .replace(".", ",") ?? "—"}{" "}
            pkt
          </strong>{" "}
          · dane za {latest.rok}
        </span>
      </div>

      <ChevronIcon open={isOpen} />
    </div>
  );
}

function oddzialLabel(n) {
  if (n === 1) return "profil";
  if (n >= 2 && n <= 4) return "profile";
  return "profili";
}

// ─── ProfileList ──────────────────────────────────────────────────────────────

function ProfileList({ oddzialy, selectedIdx, onSelect }) {
  return (
    <div style={pl.wrapper}>
      {oddzialy.map((o, i) => {
        const isSelected = i === selectedIdx;
        return (
          <div
            key={o.id || o.nazwa}
            style={{
              ...pl.row,
              background: isSelected ? "#faf5ff" : "#fff",
              borderLeft: isSelected
                ? "3px solid #9000ff"
                : "3px solid transparent",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
          >
            <div style={pl.nameBlock}>
              <span
                style={{
                  ...pl.profileName,
                  color: isSelected ? "#9000ff" : "#111827",
                }}
              >
                {o.nazwa}
              </span>
              {o.zawod && (
                <span style={pl.zawod}>{o.zawod}</span>
              )}
            </div>
            <div style={pl.stats}>
              <span style={pl.statItem}>
                <span style={pl.statLabel}>próg</span>{" "}
                <span
                  style={{
                    ...pl.statValue,
                    color: isSelected ? "#9000ff" : "#222",
                  }}
                >
                  {o.prog_punktowy?.toFixed(2).replace(".", ",") ?? "—"}
                </span>
              </span>
              <span style={pl.statItem}>
                <span style={pl.statLabel}>miejsc</span>{" "}
                <span style={pl.statValue}>{o.liczba_miejsc ?? "—"}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SchoolExplorer() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtry
  const [filterRok, setFilterRok] = useState("Wszystkie");
  const [filterTyp, setFilterTyp] = useState("Wszystkie");
  const [filterSearch, setFilterSearch] = useState("");

  // Rozwinięta szkoła (accordion)
  const [expandedCerej, setExpandedCerej] = useState(null);
  // Wybrany profil { cerej, oddzialIdx } — null = żaden
  const [selectedProfile, setSelectedProfile] = useState(null);
  // Rok wyświetlany na karcie
  const [cardRok, setCardRok] = useState(null);

  useEffect(() => {
    fetch("./gdansk_nabor_dane.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const schools = useMemo(() => {
    if (!data) return [];
    return groupBySchool(Array.isArray(data) ? data : []);
  }, [data]);

  const uniqueTypes = useMemo(
    () => ["Wszystkie", ...new Set(schools.map((s) => s.typ_szkoly))],
    [schools]
  );

  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      if (filterTyp !== "Wszystkie" && s.typ_szkoly !== filterTyp) return false;
      if (
        filterSearch &&
        !s.nazwa.toLowerCase().includes(filterSearch.toLowerCase())
      )
        return false;
      if (filterRok !== "Wszystkie") {
        if (!s.records.some((r) => r.rok === Number(filterRok))) return false;
      }
      return true;
    });
  }, [schools, filterRok, filterTyp, filterSearch]);

  const handleSchoolToggle = (cerej, school) => {
    if (expandedCerej === cerej) {
      setExpandedCerej(null);
      setSelectedProfile(null);
      return;
    }
    setExpandedCerej(cerej);
    setSelectedProfile(null);
    const defaultRok =
      filterRok !== "Wszystkie" ? Number(filterRok) : school.records[0].rok;
    setCardRok(defaultRok);
  };

  const handleProfileSelect = (cerej, idx) => {
    // Kliknięcie tego samego profilu → zamknij kartę
    if (
      selectedProfile &&
      selectedProfile.cerej === cerej &&
      selectedProfile.oddzialIdx === idx
    ) {
      setSelectedProfile(null);
      return;
    }
    setSelectedProfile({ cerej, oddzialIdx: idx });
  };

  const handleCardRokChange = (rok) => {
    setCardRok(rok);
  };

  if (loading)
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p
          style={{
            color: "#9ca3af",
            marginTop: 16,
            fontSize: 14,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          Ładowanie danych…
        </p>
      </div>
    );

  if (error)
    return (
      <div style={styles.centered}>
        <p
          style={{
            color: "#ef4444",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          Błąd ładowania danych: {error}
        </p>
      </div>
    );

  return (
    <div style={styles.root}>
      {/* ── Filtry ──────────────────────────────────────────────────────── */}
      <div style={styles.filterBar}>
        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Rok rekrutacji</label>
          <div style={styles.selectWrap}>
            <select
              style={styles.select}
              value={filterRok}
              onChange={(e) => setFilterRok(e.target.value)}
            >
              <option value="Wszystkie">Wszystkie lata</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span style={styles.selectArrow}>▾</span>
          </div>
        </div>

        <div style={styles.filterField}>
          <label style={styles.filterLabel}>Typ szkoły</label>
          <div style={styles.selectWrap}>
            <select
              style={styles.select}
              value={filterTyp}
              onChange={(e) => setFilterTyp(e.target.value)}
            >
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span style={styles.selectArrow}>▾</span>
          </div>
        </div>

        <div style={{ ...styles.filterField, flex: 2 }}>
          <label style={styles.filterLabel}>Szukaj szkoły</label>
          <input
            type="search"
            placeholder="Wpisz nazwę szkoły…"
            style={styles.searchInput}
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={styles.resultCount}>
        {filteredSchools.length} {schoolLabel(filteredSchools.length)}
      </div>

      {/* ── Lista szkół ──────────────────────────────────────────────────── */}
      <div style={styles.list}>
        {filteredSchools.length === 0 ? (
          <div style={styles.empty}>
            Brak szkół spełniających kryteria filtrowania.
          </div>
        ) : (
          filteredSchools.map((school) => {
            const isOpen = expandedCerej === school.cerej;
            const record = isOpen ? getRecord(school, cardRok) : null;
            const oddzialy = record?.oddzialy ?? [];

            const hasSelected =
              selectedProfile && selectedProfile.cerej === school.cerej;
            const selectedIdx = hasSelected ? selectedProfile.oddzialIdx : null;
            const clampedIdx =
              selectedIdx !== null
                ? Math.min(selectedIdx, Math.max(0, oddzialy.length - 1))
                : null;
            const oddzial =
              clampedIdx !== null ? oddzialy[clampedIdx] ?? null : null;

            return (
              <div
                key={school.cerej}
                style={{
                  ...styles.schoolCard,
                  boxShadow: isOpen
                    ? "0px 4px 20px rgba(34,34,34,0.12)"
                    : "none",
                  border: isOpen ? "2px solid #f3f4f6" : "1px solid #f3f4f6",
                }}
              >
                {/* Nagłówek szkoły */}
                <SchoolRow
                  school={school}
                  isOpen={isOpen}
                  onToggle={() => handleSchoolToggle(school.cerej, school)}
                />

                {/* Rozwinięta zawartość */}
                {isOpen && record && (
                  <div
                    style={styles.expandedBody}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Lista profili */}
                    <ProfileList
                      oddzialy={oddzialy}
                      selectedIdx={clampedIdx}
                      onSelect={(idx) =>
                        handleProfileSelect(school.cerej, idx)
                      }
                    />

                    {/* Karta profilu — tylko gdy wybrany */}
                    {oddzial && (
                      <div style={styles.cardWrapper}>
                        <ExpandedCard
                          record={record}
                          oddzial={oddzial}
                          availableYears={getAvailableYears(school)}
                          selectedRok={cardRok}
                          onRokChange={handleCardRokChange}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function schoolLabel(n) {
  if (n === 1) return "szkoła";
  if (n >= 2 && n <= 4) return "szkoły";
  return "szkół";
}

// ─── Row styles ───────────────────────────────────────────────────────────────

const rs = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    cursor: "pointer",
    userSelect: "none",
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
    flexShrink: 0,
    letterSpacing: "0.5px",
  },
  nameBlock: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  schoolName: {
    fontSize: 15,
    fontWeight: 700,
    color: "#111827",
    lineHeight: "22px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    fontSize: 12,
    fontWeight: 400,
    color: "#9ca3af",
    lineHeight: "18px",
  },
};

// ─── ProfileList styles ───────────────────────────────────────────────────────

const pl = {
  wrapper: {
    borderTop: "1px solid #f3f4f6",
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "12px 20px",
    cursor: "pointer",
    userSelect: "none",
    transition: "background 0.15s",
    borderBottom: "1px solid #f9fafb",
  },
  nameBlock: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  profileName: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: "20px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  zawod: {
    fontSize: 12,
    fontWeight: 400,
    color: "#9ca3af",
    lineHeight: "18px",
  },
  stats: {
    display: "flex",
    gap: 16,
    flexShrink: 0,
    alignItems: "center",
  },
  statItem: {
    fontSize: 13,
    color: "#6b7280",
    whiteSpace: "nowrap",
  },
  statLabel: {
    fontWeight: 400,
  },
  statValue: {
    fontWeight: 700,
    color: "#222",
  },
};

// ─── Main styles ──────────────────────────────────────────────────────────────

const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    fontFamily: "'Poppins', sans-serif",
    width: "100%",
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 0",
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid #e5e7eb",
    borderTop: "3px solid #9000ff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  filterBar: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  filterField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
    minWidth: 160,
  },
  filterLabel: {
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
    height: 44,
    border: "2px solid #f3f4f6",
    borderRadius: 12,
    padding: "0 40px 0 12px",
    fontSize: 14,
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
    fontSize: 13,
  },
  searchInput: {
    height: 44,
    border: "2px solid #f3f4f6",
    borderRadius: 12,
    padding: "0 12px",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'Poppins', sans-serif",
    color: "#111827",
    background: "#fff",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  resultCount: {
    fontSize: 13,
    fontWeight: 500,
    color: "#9ca3af",
    lineHeight: "20px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  schoolCard: {
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
    transition: "box-shadow 0.2s",
  },
  expandedBody: {
    display: "flex",
    flexDirection: "column",
  },
  cardWrapper: {
    padding: 20,
    borderTop: "1px solid #f3f4f6",
  },
  empty: {
    padding: "40px 0",
    textAlign: "center",
    fontSize: 14,
    fontWeight: 500,
    color: "#9ca3af",
  },
};
