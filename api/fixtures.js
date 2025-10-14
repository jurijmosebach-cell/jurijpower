
export default async function handler(req, res) {
  try {
    const liveResponse = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers: {
          "x-apisports-key": process.env.API_KEY
        }
      }
    );

    const liveData = await liveResponse.json();
    let matches = liveData.response;

    if (!matches || matches.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      const dateResponse = await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${today}`,
        {
          headers: {
            "x-apisports-key": process.env.API_KEY
          }
        }
      );
      const dateData = await dateResponse.json();
      matches = dateData.response;
    }

    res.status(200).json({
      success: true,
      matches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
