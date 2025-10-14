// Vercel serverless function: proxies requests to API-Sports using server-side API key
const fetch = require('node-fetch');
module.exports = async (req, res) => {
  const API_KEY = process.env.API_SPORTS_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'API_SPORTS_KEY not set' });
  const qs = new URLSearchParams(req.query);
  const url = 'https://v3.football.api-sports.io/fixtures?' + qs.toString();
  try {
    const r = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
    const data = await r.json();
    if (data && data.response) {
      const transformed = data.response.map(item => {
        const minute = item.fixture && item.fixture.status ? item.fixture.status.elapsed || 0 : 0;
        let homePressure = 0, awayPressure = 0;
        try {
          const stats = (item.statistics || []);
          const homeStats = stats.find(s=>s.team && s.team.name === (item.teams.home && item.teams.home.name)) || {};
          const awayStats = stats.find(s=>s.team && s.team.name === (item.teams.away && item.teams.away.name)) || {};
          const extract = (obj, type) => {
            if (!obj.statistics) return 0;
            const e = obj.statistics.find(x=>x.type === type);
            return e ? (parseInt(e.value) || 0) : 0;
          };
          const hAtt = extract(homeStats, 'Attacks');
          const aAtt = extract(awayStats, 'Attacks');
          if (hAtt || aAtt) {
            const total = Math.max(1, hAtt + aAtt);
            homePressure = Math.round( (hAtt/total) * 100 );
            awayPressure = Math.round( (aAtt/total) * 100 );
          }
        } catch(e) {}
        let xgHome = 0, xgAway = 0;
        try {
          const s = item.statistics || [];
          const h = s.find(s=>s.team && s.team.name === (item.teams.home && item.teams.home.name));
          const a = s.find(s=>s.team && s.team.name === (item.teams.away && item.teams.away.name));
          const ext = (obj, name) => {
            if (!obj || !obj.statistics) return 0;
            const e = obj.statistics.find(x=>x.type && x.type.toLowerCase().includes(name.toLowerCase()));
            return e ? (parseFloat(e.value) || 0) : 0;
          };
          xgHome = ext(h,'xG');
          xgAway = ext(a,'xG');
        } catch(e) {}
        return {
          fixtureId: item.fixture && item.fixture.id,
          league: item.league || null,
          teams: item.teams || null,
          goals: item.goals || null,
          minute: minute,
          homePressure: homePressure,
          awayPressure: awayPressure,
          xgHome: xgHome,
          xgAway: xgAway,
          raw: item
        };
      });
      res.setHeader('Content-Type','application/json');
      res.status(200).send(JSON.stringify({ response: transformed }));
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};
