const API_KEY = "c6ad1210c71b17cca24284ab8a9873b4";
const BASE_URL = "https://v3.football.api-sports.io";

// Helper Funktion zum Fetchen
async function fetchAPI(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "x-apisports-key": API_KEY }
  });
  return response.json();
}

// Datum & Uhrzeit formatieren
function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

// Live Spiele laden
async function loadLiveGames() {
  const data = await fetchAPI("/fixtures?live=all");
  const container = document.getElementById("liveGames");
  container.innerHTML = "";

  if (!data.response || data.response.length === 0) {
    container.innerHTML = "<p>Keine Live Spiele 📭</p>";
    return;
  }

  data.response.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <strong>${game.teams.home.name}</strong> vs <strong>${game.teams.away.name}</strong><br>
      🕒 ${formatDateTime(game.fixture.date)}
    `;
    container.appendChild(card);
  });
}

// Kommende Spiele (24h)
async function loadUpcomingGames() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24*60*60*1000);
  const from = now.toISOString().split("T")[0];
  const to = tomorrow.toISOString().split("T")[0];

  const data = await fetchAPI(`/fixtures?from=${from}&to=${to}`);
  const container = document.getElementById("upcomingGames");
  container.innerHTML = "";

  if (!data.response || data.response.length === 0) {
    container.innerHTML = "<p>Keine Spiele in den nächsten 24h 📭</p>";
    return;
  }

  data.response.forEach(game => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <strong>${game.teams.home.name}</strong> vs <strong>${game.teams.away.name}</strong><br>
      🕒 ${formatDateTime(game.fixture.date)}
    `;
    container.appendChild(card);
  });

  // Kombi generieren
  generateBestCombo(data.response);
}

// Kombi mit höchstem Value generieren
function generateBestCombo(games) {
  // Einfacher Ansatz: Nimm 3 Spiele mit höchster Home-Quote (Value kann später verbessert werden)
  const best = games
    .filter(g => g.bookmakers && g.bookmakers.length > 0)
    .map(g => {
      const odds = g.bookmakers[0].bets[0].values;
      const home = odds.find(o => o.value === "Home");
      return {
        match: `${g.teams.home.name} vs ${g.teams.away.name}`,
        odd: home ? parseFloat(home.odd) : 1
      };
    })
    .sort((a,b) => b.odd - a.odd)
    .slice(0, 3);

  const totalOdds = best.reduce((acc, cur) => acc * cur.odd, 1).toFixed(2);
  document.getElementById("totalOdds").innerText = `Gesamtquote: ${totalOdds}`;
  document.getElementById("totalValue").innerText = `Kombi-Value: ${totalOdds}`;

  document.getElementById("copyCombo").onclick = () => {
    const text = best.map(b => `${b.match} (Quote: ${b.odd})`).join("\n");
    navigator.clipboard.writeText(text);
    alert("Kombi kopiert ✅");
  };
}

// Update Zeit anzeigen
function updateTime() {
  document.getElementById("lastUpdate").innerText =
    "Letztes Update: " + new Date().toLocaleString("de-DE");
}

// Event Listener
document.getElementById("refreshBtn").addEventListener("click", () => {
  loadLiveGames();
  loadUpcomingGames();
  updateTime();
});

// Auto-Start beim Laden
loadLiveGames();
loadUpcomingGames();
updateTime();
