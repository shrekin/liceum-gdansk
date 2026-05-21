import React, { useState, useRef, useEffect } from "react";

// ── Date ↔ x mapping (linear: May 15 = 0, Aug 1 = TOTAL_W) ───────────────────
const RANGE_START = new Date(2026, 4, 15); // May 15
const RANGE_END   = new Date(2026, 7,  1); // Aug 1
const SCALE       = 0.95;                  // shrink Figma coords to prevent horizontal scroll
const TOTAL_W     = Math.round(1240 * SCALE);

function dateToX(date) {
  const t = (date - RANGE_START) / (RANGE_END - RANGE_START);
  return Math.max(0, Math.min(TOTAL_W, t * TOTAL_W));
}
function xToDate(x) {
  const t = Math.max(0, Math.min(1, x / TOTAL_W));
  return new Date(RANGE_START.getTime() + t * (RANGE_END - RANGE_START));
}
function fmtDay(d) {
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Event blocks — exact Figma positions ──────────────────────────────────────
// w / h = explicit Figma dimensions; omit = auto (content-sized)
// wrap = true → text wraps within block width (w-[min-content] in Figma)
const sc = (n) => n * SCALE;

const EVENTS = [
  {
    bg: "#24ce84",
    left: sc(0), top: sc(24.35), w: sc(256.522),
    lines: ["Rejestracja i składanie wniosków"],
    sDate: "15.05, 8:00", eDate: "12.06, 15:00",
  },
  {
    bg: "#7e48e4",
    left: sc(43.48), top: sc(112.17), w: sc(200),
    wrap: true,
    lines: ["Sprawdzian uzdolnień kierunkowych"],
    sDate: "01.06, 8:00", eDate: "11.06, 15:00",
  },
  {
    bg: "#f5a810", bord: "#b47a05", dashed: true,
    left: sc(284.5), top: sc(48.35),
    lines: ["Możliwość zmiany wczesniejszego", "wniosku lub złożenie nowego"],
    sDate: "22.06, 8:00", eDate: "26.06, 15:00",
  },
  {
    bg: "#e81b77",
    left: sc(548.5), top: sc(88.17),
    lines: ["Uzupełnienie wniosku o świadectwo", "ukończenia oraz wyniki E8"],
    sDate: "3.07, 8:00", eDate: "8.07, 15:00",
  },
  {
    bg: "#24ce84",
    left: sc(824.5), top: sc(24.35), h: sc(73.043),
    lines: ["Publikacja list", "zakwalifikowanych"],
    sDate: "15.07, 13:00",
  },
  {
    bg: "#4929e8",
    left: sc(824.5), top: sc(112.17), w: sc(239.13), h: sc(73.043),
    lines: ["Potwierdzenie woli nauki"],
    sDate: "15.07, 13:00", eDate: "20.07, 15:00",
  },
  {
    bg: "#24ce84",
    left: sc(1090.5), top: sc(71.89), w: sc(123), h: sc(73),
    wrap: true,
    lines: ["Publikacja list przyjętych"],
    sDate: "21.07, 13:00",
  },
];

const CONTAINER_H = Math.round(200 * SCALE);
const PAD = Math.round(8 * SCALE);
const BADGE_R = Math.round(4 * SCALE);

// ── Sub-components ─────────────────────────────────────────────────────────────

function Badge({ label, dark }) {
  return (
    <span style={{
      display: "inline-block",
      background: dark ? "#222" : "#fff",
      color: dark ? "#fff" : "#222",
      fontSize: 12.174,
      fontWeight: 600,
      lineHeight: "17.391px",
      padding: `0 ${BADGE_R}px`,
      borderRadius: BADGE_R,
      whiteSpace: "nowrap",
      fontFamily: "'Poppins', sans-serif",
    }}>
      {label}
    </span>
  );
}

function EventBlock({ ev }) {
  return (
    <div style={{
      position: "absolute",
      left: ev.left,
      top: ev.top,
      ...(ev.w != null ? { width: ev.w }   : {}),
      ...(ev.h != null ? { height: ev.h }  : {}),
      background: ev.bg,
      border: ev.dashed ? `2px dashed ${ev.bord}` : "none",
      borderRadius: PAD,
      padding: PAD,
      display: "flex",
      flexDirection: "column",
      gap: PAD,
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      fontFamily: "'Poppins', sans-serif",
    }}>
      {/* Label */}
      <div style={{
        textAlign: "center",
        ...(ev.wrap ? { width: "100%", wordBreak: "break-word" } : { whiteSpace: "nowrap" }),
      }}>
        {ev.lines.map((line, i) => (
          <div key={i} style={{ fontSize: 13, fontWeight: 500, color: "#fff", lineHeight: "17.391px" }}>
            {line}
          </div>
        ))}
      </div>
      {/* Dates */}
      <div style={{ display: "flex", gap: PAD, alignItems: "center" }}>
        <Badge label={ev.sDate} />
        {ev.eDate && (
          <>
            <span style={{ fontSize: 12.174, fontWeight: 500, color: "#fff", lineHeight: "17.391px" }}>do</span>
            <Badge label={ev.eDate} dark />
          </>
        )}
      </div>
    </div>
  );
}

// ── Timeline ───────────────────────────────────────────────────────────────────

export default function Timeline() {
  const [markerX, setMarkerX]   = useState(() => dateToX(new Date()));
  const [dragging, setDragging] = useState(false);
  const [isOpen,   setIsOpen]   = useState(true);
  const scrollRef = useRef(null);

  const clamp = (x) => Math.max(0, Math.min(TOTAL_W, x));

  // Mouse drag
  const onDown = (e) => { e.preventDefault(); setDragging(true); };
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const el = scrollRef.current; if (!el) return;
      setMarkerX(clamp(e.clientX - el.getBoundingClientRect().left + el.scrollLeft));
    };
    const up = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [dragging]);

  // Touch drag
  const onTouchStart = (e) => { e.preventDefault(); setDragging(true); };
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => {
      const el = scrollRef.current; if (!el) return;
      const t = e.touches[0];
      setMarkerX(clamp(t.clientX - el.getBoundingClientRect().left + el.scrollLeft));
    };
    const end = () => setDragging(false);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end);
    return () => { window.removeEventListener("touchmove", move); window.removeEventListener("touchend", end); };
  }, [dragging]);

  const markerDate = xToDate(markerX);
  const BADGE_W = sc(37.391);
  const LINE_H  = sc(175.217);

  return (
    <div style={{
      fontFamily: "'Poppins', sans-serif",
      borderRadius: 24,
      padding: 25,
      // Rainbow gradient border — matches Figma screenshot
      background:
        "linear-gradient(#fff, #fff) padding-box, " +
        "conic-gradient(from -45deg at 50% 50%, " +
        "#24ce84, #90e040, #f5a810, #e81b77, #7e48e4, #4929e8, #12bee9, #24ce84" +
        ") border-box",
      border: "3px solid transparent",
      boxShadow: "0px 4px 12px rgba(34,34,34,0.08)",
      display: "flex",
      flexDirection: "column",
      gap: 24,
      width: "100%",
      boxSizing: "border-box",
    }}>

      {/* Header */}
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        onClick={() => setIsOpen((o) => !o)}
      >
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1d1d1f", lineHeight: "28px" }}>
          Terminy postępowania rekrutacyjnego
        </span>
        <svg
          width="20" height="20" viewBox="0 0 20 20" fill="none"
          style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M5 7.5L10 12.5L15 7.5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Scrollable events area + footer — hidden when collapsed */}
      {isOpen && (
        <>
          <div
            ref={scrollRef}
            style={{
              overflowX: "auto",
              overflowY: "visible",
              userSelect: "none",
              cursor: dragging ? "grabbing" : "default",
            }}
          >
            <div style={{ position: "relative", width: TOTAL_W, height: CONTAINER_H }}>

              {EVENTS.map((ev, i) => <EventBlock key={i} ev={ev} />)}

              {/* Draggable marker */}
              <div
                style={{
                  position: "absolute",
                  left: markerX,
                  top: 0,
                  width: 0,
                  height: CONTAINER_H,
                  zIndex: 20,
                  cursor: dragging ? "grabbing" : "grab",
                  touchAction: "none",
                }}
                onMouseDown={onDown}
                onTouchStart={onTouchStart}
              >
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: -(BADGE_W / 2),
                  width: BADGE_W,
                  background: "#000",
                  color: "#fff",
                  fontSize: 12.174,
                  fontWeight: 600,
                  lineHeight: "17.391px",
                  padding: `0 ${BADGE_R}px`,
                  borderRadius: BADGE_R,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  fontFamily: "'Poppins', sans-serif",
                  userSelect: "none",
                }}>
                  {fmtDay(markerDate)}
                </div>
                <div style={{
                  position: "absolute",
                  left: -0.5,
                  top: 17.391,
                  width: 1,
                  height: LINE_H,
                  background: "#000",
                }} />
              </div>

            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 500, color: "#000", lineHeight: "20px" }}>
            Szczegółowe terminy wraz z opisem na stronie{" "}
            <a
              href="http://nabor-pomorze.edu.com.pl/kandydat/app/schedule.xhtml"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#1d78e5", textDecoration: "none" }}
            >
              http://nabor-pomorze.edu.com.pl/kandydat/app/schedule.xhtml
            </a>
          </div>
        </>
      )}
    </div>
  );
}
