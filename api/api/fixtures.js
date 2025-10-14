// Vercel serverless function: proxies requests to API-Football
export default async function handler(req, res) {
  try {
    // 1. Live-Spiele abrufen
    const liveResponse = await fetch("https://v3.football.api-sports.io/fixtures?live=all", {
      headers: {
        "x-apisports-key": process.env.API_KEY
      }
    });
    const liveData = await liveResponse.json();
    let matches = liveData.response;

    // 2. Wenn keine Live-Spiele vorhanden sind, Tages-Spiele abrufen
    if (!matches || matches.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      const dateResponse = await fetch(`https://v3.football.api-sports.io/fixtures?date=${today}`, {
        headers: {
          "x-apisports-key": process.env.API_KEY
        }
      });
      const dateData = await dateResponse.json();
      matches = dateData.response;
    }

    // 3. Erfolgsantwort
    res.status(200).json({
      success: true,
      matches
    });

  } catch (error) {
    // 4. Fehlerbehandlung
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
