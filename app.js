// JurijPower Pro - Live frontend
// Fetches live fixtures from serverless proxy (/api/fixtures?live=all)
// Shows all live matches, auto-refresh every 30s, computes simple pressure and triggers alarms.
// Notes: Server must provide homePressure/awayPressure and xgHome/xgAway if available.
(function(){
  const POLL_MS = 30000; // 30s
  const ALARM_PRESSURE = 75; // local alarm threshold
  const PUSH_XG_THRESHOLD = 1.0; // xG threshold for push (stage 2)
  const loginSection = document.getElementById('loginSection');
  const appSection = document.getElementById('appSection');
  const loginBtn = document.getElementById('loginBtn');
  const pwInput = document.getElementById('pw');
  const loginMsg = document.getElementById('loginMsg');
  const logoutBtn = document.getElementById('logout');
  const matchList = document.getElementById('matchList');
  const status = document.getElementById('status');
  const refreshBtn = document.getElementById('refreshBtn');
  const leagueFilter = document.getElementById('leagueFilter');

  // login persistence
  function isLogged(){ return localStorage.getItem('jurij_logged')==='1'; }
  function setLogged(v){ if(v)localStorage.setItem('jurij_logged','1'); else localStorage.removeItem('jurij_logged'); }
  // audio context for beep
  let audioCtx = null;
  function playBeep(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type='sine'; o.frequency.value=880;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
      o.stop(audioCtx.currentTime + 0.4);
    }catch(e){ console.warn('Beep failed', e); }
  }

  // notifications
  function ensureNotificationPermission(){
    if(!('Notification' in window)) return;
    if(Notification.permission === 'default') Notification.requestPermission();
  }
  function sendPush(title, body){
    try{
      if(Notification.permission === 'granted') new Notification(title, { body });
    }catch(e){ console.warn('Notification failed', e); }
  }

  // alarm tracking to avoid repeat spam for same match within short time
  const lastAlarm = {}; // fixtureId -> timestamp

  // login handlers
  loginBtn.addEventListener('click', ()=>{
    const PASSWORD = 'AjVqxu330Jm@12';
    if(pwInput.value === PASSWORD){
      setLogged(true); loginSection.classList.add('hidden'); appSection.classList.remove('hidden'); pwInput.value=''; loginMsg.textContent='';
      startPolling();
      ensureNotificationPermission();
    } else {
      loginMsg.textContent = '❌ Falsches Passwort';
    }
  });
  logoutBtn.addEventListener('click', ()=>{
    setLogged(false); appSection.classList.add('hidden'); loginSection.classList.remove('hidden'); stopPolling();
  });

  // fetch fixtures via proxy
  async function fetchFixtures(){
    try{
      const res = await fetch('/api/fixtures?live=all');
      if(!res.ok) throw new Error('Fehler beim Abruf: ' + res.status);
      const j = await res.json();
      return j.response || [];
    }catch(e){
      status.textContent = 'Fehler: ' + (e.message || e);
      return [];
    }
  }

  // compute display pressure values (fallback if backend didn't provide)
  function computePressures(m){
    let hp = m.homePressure || 0;
    let ap = m.awayPressure || 0;
    if(!hp && !ap){
      // fallback: use xg to estimate, else 50/50
      const xgh = m.xgHome || 0; const xga = m.xgAway || 0;
      const total = Math.max(0.001, xgh + xga);
      if(total>0.001){
        hp = Math.round((xgh/total)*100);
        ap = Math.round((xga/total)*100);
      } else { hp = 50; ap = 50; }
    }
    return { home: hp, away: ap };
  }

  function createMatchCard(m){
    const div = document.createElement('div');
    div.className = 'card';
    const home = m.teams && m.teams.home ? m.teams.home.name : 'Heim';
    const away = m.teams && m.teams.away ? m.teams.away.name : 'Auswärts';
    const minute = m.minute || (m.raw && m.raw.fixture && m.raw.fixture.status && m.raw.fixture.status.elapsed) || 0;
    const goals = m.goals ? ((m.goals.home||0) + ' : ' + (m.goals.away||0)) : '—';
    const pressures = computePressures(m);
    const maxPressure = Math.max(pressures.home, pressures.away);

    // build inner HTML
    div.innerHTML = `
      <div style="flex:1">
        <strong>${home}</strong> vs <strong>${away}</strong>
        <div class="small">Minute: ${minute} • ${goals}</div>
        <div class="bars">
          <div>Heim: <span class="pHome">${pressures.home}%</span></div>
          <div class="barWrap"><div class="bar home" style="width:${pressures.home}%"></div></div>
          <div>Auswärts: <span class="pAway">${pressures.away}%</span></div>
          <div class="barWrap"><div class="bar away" style="width:${pressures.away}%"></div></div>
        </div>
      </div>
      <div style="width:140px;text-align:right">
        <div id="signal${m.fixtureId}" class="signal ${pressures.home - pressures.away >= 10 ? 'good' : (pressures.away - pressures.home >= 10 ? 'bad' : 'neutral')}">
          ${pressures.home - pressures.away >= 10 ? 'Heim dominiert' : (pressures.away - pressures.home >= 10 ? 'Auswärts dominiert' : 'Ausgeglichen')}
        </div>
        <div class="small">xG H:${(m.xgHome||0)} A:${(m.xgAway||0)}</div>
        <div style="margin-top:8px"><button class="analyseBtn" data-id="${m.fixtureId}">Analyse</button></div>
      </div>
    `;

    // add click handler for analyse
    div.querySelector('.analyseBtn').addEventListener('click', ()=>{
      alert(`${home} vs ${away}\nMinute: ${minute}\nHeimdruck: ${pressures.home}%\nAuswärtsdruck: ${pressures.away}%\nxG H:${m.xgHome||0} A:${m.xgAway||0}`);
    });

    // return card and meta
    return { el: div, pressures, maxPressure };
  }

  // render matches sorted by pressure desc
  async function render(){
    status.textContent = 'Lade Spiele...';
    const matches = await fetchFixtures();
    // populate league filter
    const leagues = {};
    matches.forEach(m=>{ if(m.league && m.league.name) leagues[m.league.name]=1; });
    leagueFilter.innerHTML = '<option value="all">Alle Ligen</option>';
    Object.keys(leagues).forEach(l=>{
      const opt = document.createElement('option'); opt.value=l; opt.textContent=l; leagueFilter.appendChild(opt);
    });

    // sort by highest pressure
    matches.sort((a,b)=>{
      const pa = Math.max((a.homePressure||0),(a.awayPressure||0));
      const pb = Math.max((b.homePressure||0),(b.awayPressure||0));
      return pb - pa;
    });

    matchList.innerHTML = '';
    matches.forEach(m=>{
      const { el, pressures, maxPressure } = createMatchCard(m);
      matchList.appendChild(el);

      // local alarm (tone+vibration) for pressure >= ALARM_PRESSURE
      const now = Date.now();
      const last = lastAlarm[m.fixtureId] || 0;
      if(maxPressure >= ALARM_PRESSURE && now - last > 60*1000){ // at most once per minute per match
        lastAlarm[m.fixtureId] = now;
        // play beep + vibrate
        playBeep();
        if(navigator.vibrate) navigator.vibrate(500);
      }

      // push condition: pressure>=ALARM_PRESSURE AND xG>=PUSH_XG_THRESHOLD
      const xgMax = Math.max((m.xgHome||0),(m.xgAway||0));
      if(maxPressure >= ALARM_PRESSURE && xgMax >= PUSH_XG_THRESHOLD && now - (lastAlarm[m.fixtureId+'_push']||0) > 60*1000){
        lastAlarm[m.fixtureId+'_push'] = now;
        const title = 'JurijPower – Torchance';
        const body = `${m.teams.home.name} ${m.teams.away.name} • ${m.minute||0}’ • Druck ${maxPressure}% • xG ${xgMax}`;
        sendPush(title, body);
        // also play beep + vibrate for push
        playBeep();
        if(navigator.vibrate) navigator.vibrate([200,100,200]);
        // bring this match to top by scrolling
        el.scrollIntoView({ behavior:'smooth', block:'start' });
      }
    });

    status.textContent = 'Spiele geladen: ' + matches.length + ' • Letzte Aktualisierung: ' + new Date().toLocaleTimeString();
  }

  // refresh control
  refreshBtn.addEventListener('click', render);
  leagueFilter.addEventListener('change', render);

  let pollId = null;
  function startPolling(){ if(pollId) return; render(); pollId = setInterval(render, POLL_MS); }
  function stopPolling(){ if(!pollId) return; clearInterval(pollId); pollId = null; }

  // start if already logged
  if(isLogged()){ loginSection.classList.add('hidden'); appSection.classList.remove('hidden'); startPolling(); ensureNotificationPermission(); }
  // otherwise wait for login
})();
