export default async function handler(req, res) {
  try {
    // ✅ Live-Spiele abrufen
    const response = await fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      headers: {
        'x-apisports-key': process.env.API_KEY
      }
    });

    const data = await response.json();

    // 🟡 Wenn keine Spiele gefunden wurden
    if (!data.response || data.response.length === 0) {
      return res.status(200).json({
        success: true,
        matches: []
      });
    }

    // ✅ Spiele zurückgeben
    res.status(200).json({
      success: true,
      matches: data.response
    });

  } catch (error) {
    console.error('API Fehler:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
