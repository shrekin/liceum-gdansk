"""
nabor_stats.py
Pobiera statystyki naboru do gdańskich liceów ze strony VULCAN (JSF/PrimeFaces AJAX).
Zapisuje wyniki do wyniki_nabor_gdansk.json i wyniki_nabor_gdansk.csv.
"""

import re
import csv
import json
import logging
import random
import time
from datetime import datetime
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup
from rich.console import Console
from rich.table import Table
from rich import box

# ─── Konfiguracja logowania ────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("nabor_stats.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)
console = Console()

# ─── Stałe ────────────────────────────────────────────────────────────────────

URL = "https://nabor-pomorze.edu.com.pl/kandydat/app/candidates_statistics.xhtml"
CITY_ID = "0933016"  # Gdańsk
MAX_RETRIES = 3
TIMEOUT = 15  # sekund

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
}

AJAX_HEADERS = {
    **HEADERS,
    "Faces-Request": "partial/ajax",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept": "application/xml, text/xml, */*; q=0.01",
    "Referer": URL,
}

# ─── Lista szkół ──────────────────────────────────────────────────────────────

SZKOLY = [
    {"id": "8",   "nazwa": "I Liceum Ogólnokształcące"},
    {"id": "9",   "nazwa": "II Liceum Ogólnokształcące"},
    {"id": "10",  "nazwa": "III Liceum Ogólnokształcące z Oddziałami Dwujęzycznymi"},
    {"id": "11",  "nazwa": "IV Liceum Ogólnokształcące z Oddziałami Mistrzostwa Sportowego"},
    {"id": "12",  "nazwa": "V Liceum Ogólnokształcące"},
    {"id": "13",  "nazwa": "VI Liceum Ogólnokształcące"},
    {"id": "14",  "nazwa": "VII Liceum Ogólnokształcące"},
    {"id": "15",  "nazwa": "VIII Liceum Ogólnokształcące"},
    {"id": "16",  "nazwa": "IX Liceum Ogólnokształcące"},
    {"id": "306", "nazwa": "X Liceum Ogólnokształcące Dwujęzyczne"},
    {"id": "19",  "nazwa": "XII Sportowe LO z Oddziałami Mistrzostwa Sportowego"},
    {"id": "20",  "nazwa": "XIV Liceum Ogólnokształcące"},
    {"id": "79",  "nazwa": "XV Liceum Ogólnokształcące z Oddziałami Dwujęzycznymi"},
    {"id": "21",  "nazwa": "XIX Liceum Ogólnokształcące"},
    {"id": "17",  "nazwa": "XXIV Liceum Ogólnokształcące"},
    {"id": "22",  "nazwa": "XX Liceum Ogólnokształcące z Oddziałami Dwujęzycznymi"},
    {"id": "26",  "nazwa": "XXI Liceum Ogólnokształcące z Oddziałami Sportowymi"},
    {"id": "123", "nazwa": "XXIII Liceum Ogólnokształcące"},
    {"id": "385", "nazwa": "Uniwersyteckie LO z Oddziałami Dwujęzycznymi im. P. Adamowicza"},
    {"id": "364", "nazwa": "Ogólnokształcące Liceum Jezuitów z Oddziałami Dwujęzycznymi"},
    {"id": "366", "nazwa": "Akademickie LO Lingwista im. Hymnu Narodowego"},
    {"id": "502", "nazwa": "Liceum Ogólnokształcące TEB Edukacja"},
    {"id": "638", "nazwa": "Liceum Ogólnokształcące Thinking Zone"},
]

# ─── Funkcje pomocnicze ────────────────────────────────────────────────────────

def nowa_sesja() -> requests.Session:
    """Tworzy nową sesję HTTP z nagłówkami przeglądarki."""
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def pobierz_view_state(session: requests.Session) -> str:
    """
    Wykonuje GET na stronę i zwraca aktualną wartość javax.faces.ViewState.
    Rzuca ValueError jeśli nie uda się znaleźć ViewState.
    """
    log.info("Pobieranie świeżego ViewState...")
    resp = session.get(URL, timeout=TIMEOUT)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    # Próba 1: po pełnym id
    tag = soup.find("input", {"id": "j_id1:javax.faces.ViewState:0"})
    # Próba 2: po name jeśli id się zmienił
    if not tag:
        tag = soup.find("input", {"name": "javax.faces.ViewState"})

    if not tag or not tag.get("value"):
        raise ValueError("Nie znaleziono javax.faces.ViewState w HTML strony.")

    vs = tag["value"]
    log.info(f"ViewState pobrany: {vs[:30]}...")
    return vs


def zapytaj_szkole(
    session: requests.Session,
    view_state: str,
    szkola_id: str,
) -> str | None:
    """
    Wysyła żądanie AJAX PrimeFaces dla podanej szkoły.
    Zwraca surowy HTML z resultsPlaceholder lub None przy błędzie.
    """
    data = {
        "j_idt63": "j_idt63",
        "j_idt63:j_idt64:citySelect": CITY_ID,
        "j_idt63:schoolSelectSect:j_idt90:schoolSelect": szkola_id,
        "javax.faces.ViewState": view_state,
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "j_idt63:j_idt104:j_idt105",
        "javax.faces.partial.execute": "j_idt63",
        "javax.faces.partial.render": "resultsPlaceholder",
        "j_idt63:j_idt104:j_idt105": "Szukaj",
    }

    resp = session.post(URL, data=data, headers=AJAX_HEADERS, timeout=TIMEOUT)

    if resp.status_code != 200:
        log.warning(f"Szkoła {szkola_id}: kod HTTP {resp.status_code}")
        return None

    if "resultsPlaceholder" not in resp.text:
        log.warning(f"Szkoła {szkola_id}: brak resultsPlaceholder w odpowiedzi")
        return None

    return resp.text


def wyciagnij_html_z_cdata(xml_tekst: str) -> str | None:
    """
    Wyciąga HTML zawarty w CDATA wewnątrz <update id="resultsPlaceholder">.
    Używa parsera XML lub fallbacku na regex.
    """
    try:
        # Owijamy w root żeby ElementTree był happy
        root = ElementTree.fromstring(f"<root>{xml_tekst}</root>")
        for update in root.iter("update"):
            if update.get("id") == "resultsPlaceholder":
                return update.text or ""
    except ElementTree.ParseError:
        pass

    # Fallback: regex na CDATA
    match = re.search(
        r'<update[^>]*id="resultsPlaceholder"[^>]*><!\[CDATA\[(.*?)\]\]></update>',
        xml_tekst,
        re.DOTALL,
    )
    if match:
        return match.group(1)

    # Fallback 2: bez CDATA (serwer czasem nie owija)
    match = re.search(
        r'<update[^>]*id="resultsPlaceholder"[^>]*>(.*?)</update>',
        xml_tekst,
        re.DOTALL,
    )
    return match.group(1) if match else None


def parsuj_liczbe_z_nawiasem(tekst: str) -> tuple[int, int]:
    """
    Parsuje komórkę tabeli w formacie "87 (12)" lub "87" lub "(12)".
    Zwraca krotkę (liczba_przed_nawiasem, liczba_w_nawiasie).
    Przykłady:
        "87 (12)"  → (87, 12)
        "87"       → (87, 0)
        "(12)"     → (0, 12)
        "0"        → (0, 0)
    """
    tekst = tekst.replace("\xa0", "").replace("\u00a0", "").strip()
    # Liczba w nawiasie
    m_nawias = re.search(r"\((\d+)\)", tekst)
    w_nawiasie = int(m_nawias.group(1)) if m_nawias else 0
    # Liczba przed nawiasem (pierwsza cyfra poza nawiasem)
    tekst_bez_nawiasu = re.sub(r"\(.*?\)", "", tekst).strip()
    m_glowna = re.search(r"\d+", tekst_bez_nawiasu)
    glowna = int(m_glowna.group()) if m_glowna else 0
    return glowna, w_nawiasie


def parsuj_oddzialy(html: str, nazwa_szkoly: str) -> list[dict]:
    """
    Parsuje HTML z resultsPlaceholder i zwraca listę oddziałów.
    Pola wynikowe:
        nazwa                   – nazwa oddziału
        miejsca                 – liczba miejsc
        chetni_ogolom           – chętni zaakceptowani
        chetni_ogolom_oczekujacy – chętni z niezweryfikowanym wnioskiem (w nawiasie)
        chetni_pierwsza_pref    – I preferencja zaakceptowani
        chetni_pierwsza_pref_oczekujacy – I preferencja oczekujący (w nawiasie)
        wskaznik                – chetni_ogolom / miejsca
    """
    soup = BeautifulSoup(html, "lxml")
    oddzialy = []

    tabela = soup.find("table")
    if not tabela:
        log.warning(f"Szkoła '{nazwa_szkoly}': brak tabeli w wynikach")
        return oddzialy

    wiersze = tabela.find_all("tr")
    if len(wiersze) < 2:
        log.warning(f"Szkoła '{nazwa_szkoly}': tabela jest pusta")
        return oddzialy

    for wiersz in wiersze[1:]:  # Pomijamy nagłówek
        komorki = wiersz.find_all(["td", "th"])
        if len(komorki) < 4:
            continue

        teksty = [k.get_text(strip=True) for k in komorki]

        nazwa_oddzialu = teksty[0]
        miejsca,              _                            = parsuj_liczbe_z_nawiasem(teksty[1])
        chetni_ogolom,        chetni_ogolom_ocz            = parsuj_liczbe_z_nawiasem(teksty[2])
        chetni_pref,          chetni_pref_ocz              = parsuj_liczbe_z_nawiasem(teksty[3]) if len(teksty) > 3 else (0, 0)

        wskaznik = round(chetni_ogolom / miejsca, 2) if miejsca > 0 else 0.0

        oddzialy.append({
            "nazwa":                          nazwa_oddzialu,
            "miejsca":                        miejsca,
            "chetni_ogolom":                  chetni_ogolom,
            "chetni_ogolom_oczekujacy":       chetni_ogolom_ocz,
            "chetni_pierwsza_pref":           chetni_pref,
            "chetni_pierwsza_pref_oczekujacy": chetni_pref_ocz,
            "wskaznik":                       wskaznik,
        })

    log.info(f"Szkoła '{nazwa_szkoly}': znaleziono {len(oddzialy)} oddziałów")
    return oddzialy


# ─── Główna logika pobierania ──────────────────────────────────────────────────

def pobierz_wszystkie() -> list[dict]:
    """
    Iteruje po wszystkich szkołach, pobiera dane z obsługą
    wygasłej sesji (MAX_RETRIES prób per szkoła).
    Zwraca listę słowników ze szkołami i ich oddziałami.
    """
    session = nowa_sesja()
    view_state = pobierz_view_state(session)
    wyniki = []

    for szkola in SZKOLY:
        log.info(f"▶ Pobieranie: {szkola['nazwa']} (id={szkola['id']})")
        xml_odpowiedz = None

        for proba in range(1, MAX_RETRIES + 1):
            xml_odpowiedz = zapytaj_szkole(session, view_state, szkola["id"])

            if xml_odpowiedz is not None:
                break  # Sukces — wychodzimy z pętli prób

            # Sesja wygasła lub błąd — odświeżamy
            log.warning(
                f"  Próba {proba}/{MAX_RETRIES} nieudana — "
                f"{'odświeżam sesję' if proba < MAX_RETRIES else 'pomijam szkołę'}"
            )
            if proba < MAX_RETRIES:
                time.sleep(2)
                session = nowa_sesja()
                try:
                    view_state = pobierz_view_state(session)
                except Exception as e:
                    log.error(f"  Nie udało się odświeżyć ViewState: {e}")

        if xml_odpowiedz is None:
            log.error(f"✗ Pominięto szkołę '{szkola['nazwa']}' po {MAX_RETRIES} próbach")
            continue

        html = wyciagnij_html_z_cdata(xml_odpowiedz)
        if not html:
            log.error(f"✗ Nie udało się wyciągnąć HTML dla '{szkola['nazwa']}'")
            continue

        oddzialy = parsuj_oddzialy(html, szkola["nazwa"])

        if oddzialy:
            wyniki.append({
                "id": szkola["id"],
                "nazwa": szkola["nazwa"],
                "oddzialy": oddzialy,
            })

        # Losowe opóźnienie — nie przeciążamy serwera
        czas = random.uniform(1.0, 2.5)
        log.info(f"  Czekam {czas:.1f}s przed kolejnym zapytaniem...")
        time.sleep(czas)

    return wyniki


# ─── Zapis wyników ────────────────────────────────────────────────────────────

def zapisz_json(wyniki: list[dict], plik: str = "wyniki_nabor_gdansk.json") -> None:
    """Zapisuje wyniki do pliku JSON gotowego do użycia na stronie www."""
    teraz = datetime.now()
    payload = {
        "pobrano": teraz.strftime("%Y-%m-%dT%H:%M:%S"),
        "pobrano_czytelnie": teraz.strftime("%-d %B %Y, godz. %H:%M"),
        "szkoly": wyniki,
    }
    with open(plik, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    log.info(f"✓ Zapisano JSON: {plik}")


def zapisz_csv(wyniki: list[dict], plik: str = "wyniki_nabor_gdansk.csv") -> None:
    """Zapisuje wyniki do płaskiego pliku CSV."""
    teraz = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    kolumny = [
        "szkola", "id_szkoly", "oddzial",
        "miejsca",
        "chetni_ogolom", "chetni_ogolom_oczekujacy",
        "chetni_pierwsza_pref", "chetni_pierwsza_pref_oczekujacy",
        "wskaznik", "pobrano",
    ]
    with open(plik, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=kolumny)
        writer.writeheader()
        for szkola in wyniki:
            for oddzial in szkola["oddzialy"]:
                writer.writerow({
                    "szkola":                           szkola["nazwa"],
                    "id_szkoly":                        szkola["id"],
                    "oddzial":                          oddzial["nazwa"],
                    "miejsca":                          oddzial["miejsca"],
                    "chetni_ogolom":                    oddzial["chetni_ogolom"],
                    "chetni_ogolom_oczekujacy":         oddzial.get("chetni_ogolom_oczekujacy", 0),
                    "chetni_pierwsza_pref":             oddzial["chetni_pierwsza_pref"],
                    "chetni_pierwsza_pref_oczekujacy":  oddzial.get("chetni_pierwsza_pref_oczekujacy", 0),
                    "wskaznik":                         oddzial["wskaznik"],
                    "pobrano":                          teraz,
                })
    log.info(f"✓ Zapisano CSV: {plik}")


# ─── Wyświetlenie w terminalu ─────────────────────────────────────────────────

KOLOR_WSKAZNIKA = {
    (3.0, float("inf")): "red",
    (2.0, 3.0): "yellow3",
    (1.0, 2.0): "green",
    (0.0, 1.0): "blue",
}


def kolor_dla_wskaznika(w: float) -> str:
    for (dolny, gorny), kolor in KOLOR_WSKAZNIKA.items():
        if dolny <= w < gorny:
            return kolor
    return "white"


def wyswietl_tabele(wyniki: list[dict]) -> None:
    """Wyświetla dane w czytelnych tabelach pogrupowanych per szkoła."""
    wszystkie_oddzialy = [
        (szkola["nazwa"], o)
        for szkola in wyniki
        for o in szkola["oddzialy"]
    ]
    top5 = sorted(wszystkie_oddzialy, key=lambda x: x[1]["wskaznik"], reverse=True)[:5]

    def fmt(glowna: int, oczekujacy: int) -> str:
        """Formatuje liczbę z oczekującymi: '87 (12)' lub '87' jeśli brak oczekujących."""
        if oczekujacy:
            return f"{glowna} [dim]({oczekujacy})[/dim]"
        return str(glowna)

    for szkola in wyniki:
        tabela = Table(
            title=f"[bold]{szkola['nazwa']}[/bold]",
            box=box.ROUNDED,
            show_lines=True,
            style="white",
        )
        tabela.add_column("Oddział", style="white", min_width=35)
        tabela.add_column("Miejsca", justify="right", style="cyan")
        tabela.add_column("Chętni ogółem", justify="right", style="cyan")
        tabela.add_column("I preferencja", justify="right", style="cyan")
        tabela.add_column("Wskaźnik", justify="right")

        for o in szkola["oddzialy"]:
            kolor = kolor_dla_wskaznika(o["wskaznik"])
            tabela.add_row(
                o["nazwa"],
                str(o["miejsca"]),
                fmt(o["chetni_ogolom"],       o.get("chetni_ogolom_oczekujacy", 0)),
                fmt(o["chetni_pierwsza_pref"], o.get("chetni_pierwsza_pref_oczekujacy", 0)),
                f"[{kolor}]{o['wskaznik']:.2f}[/{kolor}]",
            )
        console.print(tabela)
        console.print()

    # Top 5 najtrudniejszych oddziałów
    top_tabela = Table(
        title="[bold red]🏆 Top 5 najtrudniejszych oddziałów[/bold red]",
        box=box.SIMPLE_HEAVY,
    )
    top_tabela.add_column("Szkoła", style="white")
    top_tabela.add_column("Oddział", style="white")
    top_tabela.add_column("Wskaźnik", justify="right", style="red bold")

    for nazwa_szkoly, o in top5:
        top_tabela.add_row(nazwa_szkoly, o["nazwa"], f"{o['wskaznik']:.2f}")

    console.print(top_tabela)


# ─── Punkt wejścia ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    console.rule("[bold blue]Nabór Pomorze — statystyki gdańskich liceów[/bold blue]")
    console.print(f"Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    try:
        wyniki = pobierz_wszystkie()

        if not wyniki:
            console.print("[bold red]Brak danych — sprawdź logi nabor_stats.log[/bold red]")
        else:
            zapisz_json(wyniki)
            zapisz_csv(wyniki)
            wyswietl_tabele(wyniki)
            console.print(
                f"\n[green]✓ Gotowe![/green] Pobrano dane dla "
                f"[bold]{len(wyniki)}[/bold] szkół, "
                f"[bold]{sum(len(s['oddzialy']) for s in wyniki)}[/bold] oddziałów."
            )

    except KeyboardInterrupt:
        console.print("\n[yellow]Przerwano przez użytkownika.[/yellow]")
    except Exception as e:
        log.exception(f"Nieoczekiwany błąd: {e}")
        raise