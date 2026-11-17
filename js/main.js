'use strict';
// ===================== App, Menüs, Sitzungen =====================
const AI_KEYS = Object.keys(AI_LEVELS);
const FAC_KEYS = ['A', 'D', 'K'];
function lsGet(k, d) { try { const v = localStorage.getItem('frontlinien.' + k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem('frontlinien.' + k, v); } catch (e) { } }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Sitzungen ----------
class LocalSession {
  constructor(game, pid, speed) { this.game = this.world = game; this.pid = pid; this.speed = speed || 1; this.acc = 0; this.paused = false; }
  cmd(c) { this.game.command(this.pid, c); }
  view() { return this.game.playerView(this.pid); }
  update(dt) {
    if (this.paused) return;
    this.acc += Math.min(dt, 0.25) * this.speed; let n = 0;
    while (this.acc >= TICK && n < 10) { this.game.step(); this.acc -= TICK; n++; }
    if (n >= 10) this.acc = 0;
  }
  alpha() { return Math.min(1, this.acc / TICK); }
  takeEvents() { const e = this.game.events; this.game.events = []; return e; }
  close() { }
}
class HostSession extends LocalSession {
  constructor(game, pid, net, peerPid) {
    super(game, pid, 1); this.net = net; this.peerPid = peerPid; game.net = true; this.sendT = 0;
    net.on('data', (peer, d) => { if (d && d.t === 'cmd' && this.peerPid.has(peer)) this.game.command(this.peerPid.get(peer), d.c); });
    net.on('leave', (peer) => { const pid = this.peerPid.get(peer); if (pid == null) return; this.peerPid.delete(peer); const p = this.game.P(pid); if (p.alive) { this.game.makeAI(pid, 'mittel'); this.game.msg(`${p.name} hat das Spiel verlassen – die CPU übernimmt.`, -1, '#ffd54f'); } });
    net.on('join', () => { });
  }
  update(dt) {
    super.update(dt);
    this.sendT += dt;
    if (this.sendT >= 0.15) { this.sendT = 0; this.net.broadcast(this.game.netPack()); this.net.reap(15000); }
  }
  close() { this.net.close(); }
}
class ClientSession {
  constructor(mirror, pid, net) {
    this.world = mirror; this.pid = pid; this.net = net; this.last = performance.now(); this.iv = 150;
    net.on('data', (d) => {
      if (!d) return;
      if (d.t === 'snap') { const now = performance.now(); this.iv = Math.max(60, Math.min(400, this.iv * 0.8 + (now - this.last) * 0.2)); this.last = now; this.world.apply(d); }
    });
    net.on('close', () => { this.lost = true; });
  }
  cmd(c) { this.net.send({ t: 'cmd', c }); }
  view() { return this.world.playerView(this.pid); }
  update(dt) {
    this.pingT = (this.pingT || 0) + dt;
    if (this.pingT > 2) { this.pingT = 0; this.net.send({ t: 'ping' }); }
    if (performance.now() - this.last > 15000 && !this.world.over) this.lost = true;
  }
  alpha() { return Math.min(1, (performance.now() - this.last) / this.iv); }
  takeEvents() { const e = this.world.events; this.world.events = []; return e; }
  close() { this.net.close(); }
}

// ---------- App ----------
const App = {
  init() {
    this.hud = new HUD(); this.hud.app = this;
    this.r2d = new Renderer($('#cv'));
    this.setGfx(lsGet('gfx', '3d'));
    $('#gfxSel').onchange = (e) => this.setGfx(e.target.value);
    $('#gfxSel2').onchange = (e) => this.setGfx(e.target.value);
    $('#optShadow').onchange = (e) => { lsSet('shadows', e.target.checked ? '1' : '0'); if (this.r3) { this.r3.setShadows(e.target.checked); if (this.session && this.rend === this.r3) this.r3.setWorld(this.session.world); } };
    $('#nameIn').value = lsGet('name', 'Kommandant');
    $('#nameIn').addEventListener('change', () => lsSet('name', $('#nameIn').value.trim() || 'Kommandant'));
    $('#btnLocal').onclick = () => { this.mission = null; this.openSetup('local'); };
    $('#btnCampaign').onclick = () => this.openCampaign();
    $('#btnCampStart').onclick = () => this.startMission(this.campSel);
    $('#campDiff').value = lsGet('campDiff', '0');
    $('#campDiff').onchange = (e) => lsSet('campDiff', e.target.value);
    $('#btnNextMission').onclick = () => { const M = this.mission; const nx = M && CAMPAIGN[M.fac][M.idx + 1]; this.quit(); if (nx) { this.campFac = nx.fac; this.campSel = nx; this.openCampaign(); } };
    $('#btnRetry').onclick = () => { const M = this.mission; this.quit(); if (M) this.startMission(CAMPAIGN[M.fac][M.idx]); };
    $('#btnHost').onclick = () => { this.mission = null; this.openSetup('host'); };
    $('#btnJoin').onclick = () => this.show('joinScreen');
    $('#btnHelp').onclick = () => this.showHelp('mainMenu');
    $('#btnHelp2').onclick = () => this.showHelp('pauseScreen');
    $$('[data-back]').forEach(b => b.onclick = () => this.toMenu());
    $('#setupBack').onclick = () => this.toMenu();
    $('#btnDoJoin').onclick = () => this.join($('#codeIn').value);
    $('#btnStart').onclick = () => this.startFromLobby();
    $('#menuBtn').onclick = () => this.togglePause();
    $('#btnResume').onclick = () => this.togglePause(false);
    $('#btnQuit').onclick = () => this.quit();
    $('#btnSurrender').onclick = () => { if (this.session) { this.session.cmd({ c: 'surrender' }); this.togglePause(false); } };
    $('#btnEndMenu').onclick = () => this.quit();
    $('#btnWatch').onclick = () => { this.watching = true; this.show(null); };
    $('#optHp').onchange = (e) => this.hud.ui.showHp = e.target.checked;
    $('#optEdge').onchange = (e) => this.hud.edge = e.target.checked;
    this.initLobbyControls();
    SND.init(); SND.play('menu');
    const syncVol = () => $$('[data-vol]').forEach(r => r.value = SND.vol[r.dataset.vol]);
    $$('[data-vol]').forEach(r => r.oninput = () => { SND.start(); SND.setVol(r.dataset.vol, +r.value); syncVol(); if (r.dataset.vol === 'voice') SND.say('built'); });
    syncVol();
    const jc = new URLSearchParams(location.search).get('join') || (location.hash.length === 6 ? location.hash.slice(1) : '');
    if (jc) { $('#codeIn').value = jc; this.show('joinScreen'); }
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    $('#installHint').textContent = ios ? 'Tipp: In Safari „Teilen → Zum Home-Bildschirm“ für Vollbild-App.' : 'Tipp: Über das Browser-Menü „App installieren“ für Vollbild-Modus.';
    let lt = performance.now(), hudT = 0, miniT = 0;
    const assetTick = setInterval(() => { const r = this.r3; if (!r || !r.assets) { $('#assetStatus').textContent = ''; return; } const a = r.assets; $('#assetStatus').textContent = a.ready ? '3D-Modelle geladen ✔' : `3D-Modelle werden geladen … ${Math.round((a.progress || 0) * 100)} %`; if (a.ready) clearInterval(assetTick); }, 400);
    const loop = (now) => {
      const dt = Math.min(0.25, (now - lt) / 1000); lt = now;
      if (this.session) {
        const s = this.session;
        s.update(dt);
        for (const ev of s.takeEvents()) this.onEvent(ev);
        if (this.fog) { if (s.world.over && this.fog.enabled) this.fog.revealAll(); this.fog.update(s.world); }
        this.hud.frame(dt);
        hudT += dt; if (hudT > 0.15) { hudT = 0; this.hud.refresh(); AudioDirector.view(s.view(), 0.15); this.checkEnd(); if (s.world.mission) { const t = missionStatus(s.world); if (t !== this._mbt) { this._mbt = t; $('#missionBox').textContent = t; } } }
        this.rend.draw(this.hud.cam, this.hud.ui, s.alpha(), now / 1000);
        miniT += dt; if (miniT > 0.25) { miniT = 0; this.hud.miniInfo = this.rend.drawMini(this.hud.mini, this.hud.cam, s.pid, this.hud.viewW(), this.hud.viewH()); }
        if (s.lost && !this.endShown) { this.endShown = true; $('#endTitle').textContent = 'VERBINDUNG VERLOREN'; $('#endStats').innerHTML = '<p>Die Verbindung zum Host wurde getrennt.</p>'; $('#btnWatch').classList.add('hidden'); this.show('endScreen'); }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !/claude|anthropic/.test(location.hostname)) { try { navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { } }
  },
  setGfx(mode) {
    if (mode === '3d' && !webglOk()) { mode = '2d'; toast('3D wird auf diesem Gerät nicht unterstützt – 2D aktiv', 3000); }
    if (mode === '3d' && !this.r3) { try { this.r3 = new Renderer3D($('#gl'), $('#cv')); this.r3.onAssets = () => { this.hud.gridKey = ''; }; } catch (e) { console.error(e); mode = '2d'; } }
    this.gfx = mode; lsSet('gfx', mode);
    this.rend = mode === '3d' ? this.r3 : this.r2d;
    $('#gl').classList.toggle('hidden', mode !== '3d');
    this.hud.k = mode === '3d' ? CSIN : 1;
    $('#gfxSel').value = mode; $('#gfxSel2').value = mode;
    $('#shadowRow').classList.toggle('hidden', mode !== '3d');
    $('#optShadow').checked = !!(this.r3 && this.r3.shadows);
    if (this.session) { this.rend.setWorld(this.session.world); this.hud.clampCam(); this.hud.gridKey = ''; }
  },
  show(id) { $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id)); },
  toMenu() { if (this.net && !this.session) { this.net.close(); this.net = null; } this.show('mainMenu'); },
  onEvent(ev) {
    if (this.fog && this.session) this.fog.onEvent(ev, this.session.world.time);
    this.rend.fx.add(ev, performance.now() / 1000, this.hud.pid);
    const fogV = this.fog, cam = this.hud.cam, vw = this.hud.viewW(), vh = this.hud.viewH();
    AudioDirector.event(ev, (x, y) => x > cam.x - 64 && y > cam.y - 64 && x < cam.x + vw + 64 && y < cam.y + vh + 64 && (!fogV || !fogV.enabled || fogV.visAt(x, y)));
    const pid = this.hud.pid;
    if (ev.k === 'msg' && (ev.p === -1 || ev.p === pid)) this.hud.addMsg(ev.txt, ev.col);
    else if (ev.k === 'ready' && ev.p === pid) this.hud.addMsg(DEFS[ev.type].name + ' ist bereit zum Platzieren', '#ffd54f');
    else if (ev.k === 'unit' && ev.p === pid && DEFS[ev.type].sup) this.hud.addMsg(DEFS[ev.type].name + ' ist einsatzbereit!', '#ea80fc');
  },
  togglePause(force) {
    if (!this.session) return;
    const open = force !== undefined ? force : $('#pauseScreen').classList.contains('hidden');
    if (this.session instanceof LocalSession && !(this.session instanceof HostSession)) this.session.paused = open;
    this.show(open ? 'pauseScreen' : null);
  },
  quit() {
    if (this.session) this.session.close();
    this.session = null; this.net = null; this.endShown = false; this.lostShown = false; this.watching = false;
    $('#hud').classList.add('hidden'); document.body.classList.remove('ingame');
    const c = $('#cv').getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 9999, 9999);
    if (this.r3) { this.r3.three.setClearColor(0x0b0f0b); this.r3.three.clear(); }
    this.show('mainMenu'); SND.play('menu');
  },
  checkEnd() {
    const s = this.session, w = s.world, v = s.view();
    if (this.endShown) return;
    const lost = !v.alive, over = w.over;
    if (!over && !(lost && !this.lostShown)) return;
    if (over) this.endShown = true; else this.lostShown = true;
    const win = over && (w.mission ? w.missionResult === 'win' : w.isWinner(s.pid));
    const M = w.mission ? this.mission : null;
    $('#btnNextMission').classList.toggle('hidden', !(M && win && CAMPAIGN[M.fac][M.idx + 1]));
    $('#btnRetry').classList.toggle('hidden', !(M && over && !win));
    SND.say(M ? (win ? 'mwin' : 'mlose') : (win ? 'win' : 'lose'), true);
    if (M && win) { if (this.campProgress(M.fac) < M.idx + 1) lsSet('camp.' + M.fac, M.idx + 1); }
    $('#endTitle').textContent = M ? (win ? 'MISSION ERFÜLLT' : 'MISSION GESCHEITERT') : win ? 'SIEG!' : (over ? (lost ? 'NIEDERLAGE' : 'SPIEL VORBEI') : 'BESIEGT');
    $('#endTitle').style.color = win ? '#c5e1a5' : '#ff8a80';
    $('#btnWatch').classList.toggle('hidden', over);
    let html = '<table><tr><th>Spieler</th><th>Fraktion</th><th>Abschüsse</th><th>Verluste</th><th>Erwirtschaftet</th><th></th></tr>';
    for (const p of w.players) { const st = p.stats || {}; html += `<tr><td><span class="swatch" style="background:${p.color}"></span> ${esc(p.name)}</td><td>${FACTIONS[p.fac].name}</td><td>${st.kills ?? '–'}</td><td>${st.lost ?? '–'}</td><td>${st.earned != null ? st.earned.toLocaleString('de-DE') : '–'}</td><td>${p.alive ? '✔' : '✖'}</td></tr>`; }
    html += '</table>';
    if (M) html = (win ? `<p>${M.idx === 14 ? '🏆 <b>Kampagne „' + STORY[M.fac].title + '“ abgeschlossen!</b> ' + ({ A: 'Die Sonne geht über einer freien Welt auf. General Whitmore salutiert.', D: 'Der Eiserne Sturm hat die Welt geeint. Marschall Orlow nickt zufrieden.', K: 'Es gibt nur noch eine Stimme. Der Schwarm ist vollkommen.' })[M.fac] : 'Hervorragende Arbeit, Kommandant. Die nächste Mission ist freigeschaltet.'}</p>` : `<p>${esc(w.missionWhy || 'Das Missionsziel wurde verfehlt.')}</p>`) + html;
    $('#endStats').innerHTML = html;
    this.show('endScreen');
  },

  // ---------- Kampagne ----------
  campProgress(f) { return +lsGet('camp.' + f, '0'); },
  openCampaign() {
    if (!this.campFac) this.campFac = lsGet('campFac', 'A');
    $('#campIntro').textContent = STORY.intro;
    $('#campTabs').innerHTML = FAC_KEYS.map(f => `<button data-f="${f}" class="${f === this.campFac ? 'on' : ''}">${FACTIONS[f].name}<br><small>${STORY[f].title} · ${this.campProgress(f)}/15</small></button>`).join('');
    $$('#campTabs button').forEach(b => b.onclick = () => { this.campFac = b.dataset.f; lsSet('campFac', this.campFac); this.campSel = null; this.openCampaign(); });
    const f = this.campFac, prog = this.campProgress(f), list = CAMPAIGN[f];
    if (!this.campSel || this.campSel.fac !== f) this.campSel = list[Math.min(prog, 14)];
    $('#campFacTxt').innerHTML = `<b>${STORY[f].title}</b> – ${STORY[f].hero}<br>${STORY[f].text}`;
    $('#campList').innerHTML = list.map((m, i) => `<button data-i="${i}" class="${m === this.campSel ? 'on' : ''} ${i < prog ? 'done' : ''}" ${i > prog ? 'disabled' : ''}>${i > prog ? '🔒 ' : ''}${i + 1}. ${m.title}</button>`).join('');
    $$('#campList button').forEach(b => b.onclick = () => { this.campSel = list[+b.dataset.i]; this.openCampaign(); });
    const M = this.campSel, st = missionToSetup(M, 'x');
    const typ = { destroy: 'Vernichtung', survive: 'Verteidigung', capture: 'Eroberung', target: 'Gezielter Schlag' }[M.goal.type];
    const foes = M.enemies.map(e => FACTIONS[e.fac].name).join(', ');
    $('#campBrief').innerHTML = `<h3>Mission ${M.idx + 1}: ${esc(M.title)}</h3><div class="small-txt">${typ} · Gegner: ${foes}${M.allies ? ' · Verbündete: ' + M.allies.map(a => FACTIONS[a.fac].name).join(', ') : ''} · Karte: ${(MAPS.find(x => x.id === M.map.id) || {}).name || ''}</div>
      <p class="brief">${esc(M.brief)}</p><div class="goal">🎯 ${esc(missionGoalText(st.mission))}</div>
      <div class="small-txt" style="margin-top:6px">${M.player.base === 'none' ? 'Du startest ohne Basis – verliere nicht alle Einheiten!' : ''}${M.tech < 3 ? ' Verfügbare Technik ist in dieser Mission begrenzt.' : ''}</div>`;
    this.show('campaignScreen');
  },
  startMission(M) {
    if (!M) return;
    const name = ($('#nameIn').value.trim() || 'Kommandant').slice(0, 16);
    const setup = missionToSetup(M, name, +lsGet('campDiff', '0'));
    this.mission = M;
    const game = new Game(setup);
    this.begin(new LocalSession(game, 0, 1));
  },

  // ---------- Lobby ----------
  initLobbyControls() {
    const ms = $('#mapSel');
    MAPS.forEach(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = `${m.name} (${m.players} Spieler, ${m.size})`; ms.appendChild(o); });
    const o = document.createElement('option'); o.value = 'random'; o.textContent = '🎲 Zufallskarte (2–10 Spieler)'; ms.appendChild(o);
    for (let i = 2; i <= 10; i++) { const op = document.createElement('option'); op.value = i; op.textContent = i; $('#rPlayers').appendChild(op); }
    const upd = () => { if (this.lobbyMode === 'client') return; this.readLobbyOpts(); this.lobbyChanged(); };
    ['#mapSel', '#rPlayers', '#rWater', '#rMount', '#rSeed', '#optSW', '#optFog', '#optCredits', '#optSpeed'].forEach(s => $(s).addEventListener('change', upd));
    $('#rDice').onclick = () => { $('#rSeed').value = (Math.random() * 1e6) | 0; upd(); };
    $('#copyLink').onclick = () => { const t = $('#roomLink').textContent; try { navigator.clipboard.writeText(t).then(() => toast('Link kopiert')).catch(() => toast('Bitte Link manuell kopieren')); } catch (e) { toast('Bitte Link manuell kopieren'); } };
  },
  readLobbyOpts() {
    const L = this.L;
    L.map = { id: $('#mapSel').value, seed: +$('#rSeed').value || 1, players: +$('#rPlayers').value || 4, water: +$('#rWater').value, mount: +$('#rMount').value };
    if (L.map.id !== 'random') L.map.seed = 1234;
    L.sw = $('#optSW').checked; L.fog = $('#optFog').checked; L.credits = +$('#optCredits').value; L.speed = +$('#optSpeed').value;
    this.fitSlots();
  },
  fitSlots() {
    const L = this.L, n = mapMaxPlayers(L.map);
    while (L.slots.length < n) L.slots.push({ type: this.lobbyMode === 'host' ? 'open' : 'closed', ai: 'mittel', name: '', fac: 'R', team: 0, color: L.slots.length });
    while (L.slots.length > n) { const s = L.slots.pop(); if (s.type === 'human' && this.net) this.net.send(s.peer, { t: 'kick', why: 'Karte hat weniger Plätze' }); }
  },
  openSetup(mode) {
    const name = ($('#nameIn').value.trim() || 'Kommandant').slice(0, 16); lsSet('name', name);
    this.lobbyMode = mode;
    if (mode === 'host' && !peerAvailable()) { toast('Online-Modus nicht verfügbar: Verbindungsbibliothek konnte nicht geladen werden.', 3500); return; }
    this.L = { map: { id: 'flussduell', seed: 1234, players: 4, water: 1, mount: 1 }, sw: true, fog: true, credits: 10000, speed: 1, slots: [] };
    this.L.slots.push({ type: 'you', name, fac: lsGet('fac', 'A'), team: 0, color: 1 });
    this.L.slots.push({ type: mode === 'host' ? 'open' : 'ai', ai: 'mittel', name: '', fac: 'R', team: 0, color: 0 });
    $('#rSeed').value = (Math.random() * 1e6) | 0;
    $('#mapSel').value = 'flussduell';
    this.applyLobbyToControls();
    this.fitSlots();
    $('#setupTitle').textContent = mode === 'local' ? 'Gefecht gegen CPU' : 'Online-Spiel (Host)';
    $('#roomBox').classList.toggle('hidden', mode !== 'host');
    $('#speedRow').classList.toggle('hidden', mode !== 'local');
    $('#btnStart').classList.remove('hidden');
    $('#lobbyStatus').textContent = '';
    this.setLobbyEnabled(true);
    if (mode === 'host') {
      $('#roomCode').textContent = '…'; $('#roomLink').textContent = 'Verbinde mit Server …';
      this.peerSlot = new Map();
      this.net = new NetHost((code) => {
        $('#roomCode').textContent = code;
        $('#roomLink').textContent = location.origin + location.pathname + '?join=' + code;
      }, (e) => { $('#lobbyStatus').textContent = 'Netzwerkfehler: ' + (e.type || e.message || e) + ' – Online klappt nur, wenn das Spiel über eine eigene Webadresse (z. B. GitHub Pages) läuft.'; });
      this.net.on('data', (peer, d) => this.hostLobbyMsg(peer, d));
      const net = this.net; clearInterval(this._reap); this._reap = setInterval(() => { if (this.net === net && !this.session) net.reap(15000); else clearInterval(this._reap); }, 3000);
      this.net.on('leave', (peer) => { const s = this.L.slots.find(x => x.peer === peer); if (s && !this.session) { s.type = 'open'; s.peer = null; s.name = ''; this.lobbyChanged(); } });
    }
    this.renderLobby(); this.show('setup');
  },
  applyLobbyToControls() {
    const L = this.L;
    $('#mapSel').value = L.map.id; $('#rPlayers').value = L.map.players; $('#rWater').value = L.map.water; $('#rMount').value = L.map.mount;
    if (L.map.id === 'random') $('#rSeed').value = L.map.seed;
    $('#optSW').checked = L.sw; $('#optFog').checked = L.fog !== false; $('#optCredits').value = L.credits; $('#optSpeed').value = L.speed;
  },
  setLobbyEnabled(on) { ['#mapSel', '#rPlayers', '#rWater', '#rMount', '#rSeed', '#rDice', '#optSW', '#optFog', '#optCredits', '#optSpeed'].forEach(s => $(s).disabled = !on); },
  lobbyChanged() {
    this.renderLobby();
    if (this.lobbyMode === 'host' && this.net) for (const [peer] of this.net.conns) { const idx = this.L.slots.findIndex(s => s.peer === peer); this.net.send(peer, { t: 'lobby', L: this.publicLobby(), you: idx }); }
  },
  publicLobby() { const L = this.L; return { map: L.map, sw: L.sw, fog: L.fog, credits: L.credits, slots: L.slots.map(s => ({ type: s.type, ai: s.ai, name: s.name, fac: s.fac, team: s.team, color: s.color })) }; },
  hostLobbyMsg(peer, d) {
    if (!d || this.session) return;
    if (d.t === 'hello') {
      const slot = this.L.slots.find(s => s.type === 'open');
      if (!slot) { this.net.send(peer, { t: 'full' }); return; }
      slot.type = 'human'; slot.peer = peer; slot.name = String(d.name || 'Gast').slice(0, 16); slot.fac = FAC_KEYS.includes(d.fac) ? d.fac : 'R';
      const used = new Set(this.L.slots.filter(s => s !== slot && s.type !== 'closed' && s.type !== 'open').map(s => s.color));
      if (used.has(slot.color)) { for (let c = 0; c < 10; c++) if (!used.has(c)) { slot.color = c; break; } }
      this.lobbyChanged();
      toast(slot.name + ' ist beigetreten');
    } else if (d.t === 'slot') {
      const slot = this.L.slots.find(s => s.peer === peer); if (!slot) return;
      if (['A', 'D', 'K', 'R'].includes(d.fac)) slot.fac = d.fac;
      if (d.team >= 0 && d.team <= 5) slot.team = d.team | 0;
      if (d.color >= 0 && d.color < 10) slot.color = d.color | 0;
      this.lobbyChanged();
    }
  },
  renderLobby() {
    const L = this.L, client = this.lobbyMode === 'client';
    $('#randOpts').classList.toggle('hidden', L.map.id !== 'random');
    const md = MAPS.find(m => m.id === L.map.id);
    $('#mapDesc').textContent = md ? md.desc : 'Zufällig erzeugte Karte mit Gewässern, Hügeln und Bergen. Der Seed bestimmt das Aussehen.';
    this.drawPreview();
    const tb = $('#slots tbody'); tb.innerHTML = '';
    L.slots.forEach((s, i) => {
      const tr = document.createElement('tr');
      const mineSlot = client ? i === this.mySlot : s.type === 'you';
      const editSlot = !client || mineSlot;
      // Typ
      let typeHtml;
      if (s.type === 'you') typeHtml = `<b>${esc(s.name)}</b> ${this.lobbyMode === 'host' ? '(Host)' : '(Du)'}`;
      else if (s.type === 'human') typeHtml = `👤 ${esc(s.name)}${mineSlot ? ' (Du)' : ''}${!client ? ` <button class="small" data-kick="${i}">✕</button>` : ''}`;
      else if (client) typeHtml = s.type === 'ai' ? 'CPU ' + AI_LEVELS[s.ai].name : s.type === 'open' ? '<i>offen</i>' : '<i>geschlossen</i>';
      else {
        const opts = (this.lobbyMode === 'host' ? [['open', 'Offen (für Freunde)']] : []).concat([['closed', 'Geschlossen']], AI_KEYS.map(k => ['ai:' + k, 'CPU ' + AI_LEVELS[k].name]));
        const cur = s.type === 'ai' ? 'ai:' + s.ai : s.type;
        typeHtml = `<select data-type="${i}">${opts.map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      }
      const active = s.type !== 'closed' && s.type !== 'open';
      const dis = (!editSlot || !active) ? 'disabled' : '';
      const facSel = `<select data-fac="${i}" ${dis}>${[['R', 'Zufall'], ...FAC_KEYS.map(k => [k, FACTIONS[k].name])].map(([v, t]) => `<option value="${v}" ${v === s.fac ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      const teamSel = `<select data-team="${i}" ${dis}>${[0, 1, 2, 3, 4, 5].map(t => `<option value="${t}" ${t === s.team ? 'selected' : ''}>${t ? 'Team ' + t : '–'}</option>`).join('')}</select>`;
      const colSel = `<span class="swatch" style="background:${PCOLORS[s.color]}"></span> <select data-color="${i}" ${dis}>${PCOLORS.map((c, ci) => `<option value="${ci}" ${ci === s.color ? 'selected' : ''}>${PCOLOR_NAMES[ci]}</option>`).join('')}</select>`;
      tr.innerHTML = `<td>${i + 1}</td><td>${typeHtml}</td><td>${facSel}</td><td>${teamSel}</td><td>${colSel}</td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => this.slotEdit(sel)));
    tb.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => { const s = L.slots[+b.dataset.kick]; if (this.net) this.net.send(s.peer, { t: 'kick', why: 'Vom Host entfernt' }); s.type = 'open'; s.peer = null; s.name = ''; this.lobbyChanged(); });
    const me = client ? L.slots[this.mySlot] : L.slots[0];
    const f = me && FACTIONS[me.fac];
    $('#facInfo').innerHTML = f ? `<b>${f.name}:</b> ${f.desc}` : 'Fraktion „Zufall“ wird beim Start ausgelost.';
  },
  slotEdit(sel) {
    const L = this.L, ds = sel.dataset;
    if (ds.type != null) { const s = L.slots[+ds.type], v = sel.value; if (v.startsWith('ai:')) { s.type = 'ai'; s.ai = v.slice(3); } else s.type = v; }
    else if (ds.fac != null) { L.slots[+ds.fac].fac = sel.value; if (L.slots[+ds.fac].type === 'you') lsSet('fac', sel.value); }
    else if (ds.team != null) L.slots[+ds.team].team = +sel.value;
    else if (ds.color != null) L.slots[+ds.color].color = +sel.value;
    if (this.lobbyMode === 'client') { const s = L.slots[this.mySlot]; this.net.send({ t: 'slot', fac: s.fac, team: s.team, color: s.color }); this.renderLobby(); return; }
    this.lobbyChanged();
  },
  drawPreview() {
    const L = this.L, key = JSON.stringify(L.map);
    if (this._pvKey !== key) { this._pvKey = key; this._pv = buildMap(L.map); }
    const m = this._pv, cv = $('#preview'), c = cv.getContext('2d'), S = cv.width, sc = S / Math.max(m.w, m.h);
    const cols = ['#1e4673', '#466c2e', '#807a48', '#79726c', '#4b829b'];
    c.fillStyle = '#000'; c.fillRect(0, 0, S, S);
    const ox = (S - m.w * sc) / 2, oy = (S - m.h * sc) / 2;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const i = y * m.w + x; c.fillStyle = m.ra[i] ? RES[m.rt[i]].color : cols[m.ter[i]]; c.fillRect(ox + x * sc, oy + y * sc, sc + 0.6, sc + 0.6); }
    c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    m.starts.forEach((s, i) => { c.fillStyle = 'rgba(0,0,0,0.7)'; c.beginPath(); c.arc(ox + s.x * sc, oy + s.y * sc, 9, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillText(i + 1, ox + s.x * sc, oy + s.y * sc + 1); });
  },
  resolvePlayers() {
    const L = this.L, act = L.slots.map((s, i) => ({ s, i })).filter(({ s }) => s.type !== 'closed' && s.type !== 'open');
    const used = new Set(), players = [];
    for (const { s } of act) {
      let col = s.color; if (used.has(col)) for (let c = 0; c < 10; c++) if (!used.has(c)) { col = c; break; } used.add(col);
      players.push({ name: s.type === 'ai' ? 'CPU ' + AI_LEVELS[s.ai].name : s.name, fac: s.fac === 'R' ? FAC_KEYS[(Math.random() * 3) | 0] : s.fac, team: s.team, color: PCOLORS[col], ai: s.type === 'ai' ? s.ai : null, slot: s });
    }
    // gleichnamige CPUs nummerieren
    const cnt = {}; players.forEach(p => { if (p.ai) { cnt[p.name] = (cnt[p.name] || 0) + 1; if (cnt[p.name] > 1) p.name += ' ' + cnt[p.name]; } });
    return players;
  },
  pickStarts(map, n, teams) {
    // weit auseinander liegende Startpunkte wählen
    const st = map.starts, chosen = [(Math.random() * st.length) | 0];
    while (chosen.length < n) {
      let best = -1, bd = -1;
      for (let i = 0; i < st.length; i++) { if (chosen.includes(i)) continue; const d = Math.min(...chosen.map(j => Math.hypot(st[i].x - st[j].x, st[i].y - st[j].y))) + Math.random(); if (d > bd) { bd = d; best = i; } }
      chosen.push(best);
    }
    // Teammitglieder möglichst nebeneinander
    const order = new Array(n);
    const idxs = [...chosen];
    const byTeam = {}; teams.forEach((t, i) => { const k = t > 0 ? 't' + t : 'p' + i; (byTeam[k] = byTeam[k] || []).push(i); });
    for (const k in byTeam) {
      const mem = byTeam[k]; if (!idxs.length) break;
      let cur = idxs.splice((Math.random() * idxs.length) | 0, 1)[0]; order[mem[0]] = cur;
      for (let m = 1; m < mem.length; m++) { let bi = 0, bd2 = 1e9; idxs.forEach((si, j) => { const d = Math.hypot(st[si].x - st[cur].x, st[si].y - st[cur].y); if (d < bd2) { bd2 = d; bi = j; } }); cur = idxs.splice(bi, 1)[0]; order[mem[m]] = cur; }
    }
    return order;
  },
  startFromLobby() {
    if (this.lobbyMode === 'client') return;
    const L = this.L, players = this.resolvePlayers();
    if (players.length < 2) { $('#lobbyStatus').textContent = 'Mindestens 2 Spieler (oder CPU) nötig.'; return; }
    const teams = new Set(players.map((p, i) => p.team > 0 ? 't' + p.team : 'p' + i));
    if (teams.size < 2) { $('#lobbyStatus').textContent = 'Es müssen mindestens 2 gegnerische Teams spielen.'; return; }
    const map = buildMap(L.map);
    const startOrder = this.pickStarts(map, players.length, players.map(p => p.team));
    const setup = { map: L.map, sw: L.sw, fog: L.fog !== false, credits: L.credits, startOrder, players: players.map(p => ({ name: p.name, fac: p.fac, team: p.team, color: p.color, ai: p.ai })) };
    const game = new Game(setup);
    const myPid = players.findIndex(p => p.slot.type === 'you');
    if (this.lobbyMode === 'local') this.begin(new LocalSession(game, myPid, L.speed));
    else {
      const mapData = encodeMap(game.map), peerPid = new Map();
      players.forEach((p, i) => { if (p.slot.type === 'human') { peerPid.set(p.slot.peer, i); this.net.send(p.slot.peer, { t: 'start', pid: i, setup: { mapData, sw: L.sw, fog: L.fog !== false, players: setup.players } }); } });
      for (const [peer] of this.net.conns) if (!peerPid.has(peer)) this.net.send(peer, { t: 'kick', why: 'Spiel hat ohne dich begonnen' });
      const hs = new HostSession(game, myPid, this.net, peerPid);
      this.net.broadcast(game.netPack(true));
      this.begin(hs);
    }
  },
  join(code) {
    code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { $('#joinStatus').textContent = 'Der Code hat 5 Zeichen.'; return; }
    if (!peerAvailable()) { $('#joinStatus').textContent = 'Online-Modus nicht verfügbar (Bibliothek nicht geladen).'; return; }
    const name = ($('#nameIn').value.trim() || 'Gast').slice(0, 16); lsSet('name', name);
    $('#joinStatus').textContent = 'Verbinde …';
    if (this.net) this.net.close();
    const net = this.net = new NetClient(code, () => { $('#joinStatus').textContent = 'Verbunden – warte auf Lobby …'; net.send({ t: 'hello', name, fac: lsGet('fac', 'R') }); clearInterval(this._lp); this._lp = setInterval(() => { if (this.net === net && !this.session) net.send({ t: 'ping' }); else clearInterval(this._lp); }, 2500); },
      (e) => { $('#joinStatus').textContent = e.type === 'peer-unavailable' ? 'Kein Spiel mit diesem Code gefunden.' : e.type === 'timeout' ? 'Zeitüberschreitung – Code prüfen oder anderes Netzwerk probieren.' : 'Verbindungsfehler: ' + (e.type || e); });
    net.on('data', (d) => {
      if (!d || this.session) return;
      if (d.t === 'lobby') {
        this.lobbyMode = 'client'; this.mySlot = d.you; this.L = d.L;
        $('#setupTitle').textContent = 'Online-Lobby'; $('#roomBox').classList.add('hidden'); $('#speedRow').classList.add('hidden');
        $('#btnStart').classList.add('hidden'); $('#lobbyStatus').textContent = 'Warte, bis der Host das Spiel startet …';
        this.applyLobbyToControls(); this.setLobbyEnabled(false); this.renderLobby();
        if ($('#setup').classList.contains('hidden')) this.show('setup');
      } else if (d.t === 'full') { $('#joinStatus').textContent = 'Das Spiel ist voll.'; }
      else if (d.t === 'kick') { toast(d.why || 'Entfernt', 3000); net.close(); this.net = null; this.show('mainMenu'); }
      else if (d.t === 'start') {
        const mirror = new Mirror(d.setup);
        this.begin(new ClientSession(mirror, d.pid, net));
      }
    });
    net.on('close', () => { if (!this.session) { toast('Verbindung zum Host getrennt', 3000); this.show('mainMenu'); } });
  },
  begin(session) {
    this.session = session; this.endShown = false; this.lostShown = false; this.watching = false;
    const w = session.world, fogOn = w.setup ? w.setup.fog !== false : w.fogOn !== false;
    this.fog = new Fog(w.map, session.pid, w.players, fogOn); this.fog.update(w, true);
    this.r2d.fog = this.fog; if (this.r3) this.r3.fog = this.fog; this.hud.fog = this.fog; this.hud.ui.fog = this.fog;
    this.rend.setWorld(session.world);
    $('#hud').classList.remove('hidden'); document.body.classList.add('ingame');
    this.show(null);
    this.hud.start(session);
    const p = session.world.players[session.pid];
    const W0 = session.world;
    if (W0.mission) { this.hud.addMsg(`Mission: ${W0.mission.title}`, '#c5e1a5'); this.hud.addMsg(missionGoalText(W0.mission), '#ffd54f'); }
    else this.hud.addMsg(`Willkommen, Kommandant der ${FACTIONS[p.fac].name}! Zerstöre alle Standardgebäude der Gegner.`, '#c5e1a5');
    $('#missionBox').classList.toggle('hidden', !W0.mission);
    AudioDirector.reset(W0, session.pid); SND.start(); SND.play(p.fac); setTimeout(() => SND.say('start', true), 600);
    this.hud.ui.missionTarget = W0.mission ? W0.mission.targetId : 0;
    if (IS_TOUCH) this.hud.addMsg('Ziehen = Karte bewegen · Zwei Finger = Zoom · „Rahmen“ = mehrere Einheiten wählen', '#b0bec5');
    try { if (IS_TOUCH && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { }
  },

  // ---------- Anleitung ----------
  showHelp(back) {
    const unitRow = d => `<tr><td>${d.name}${d.sup ? ' ⭐' : ''}</td><td>${{ inf: 'Infanterie', veh: 'Fahrzeug', air: 'Luft' }[d.cat]}</td><td>$${d.cost}</td><td>${d.desc || ''}</td></tr>`;
    let fac = '';
    for (const k of FAC_KEYS) {
      const F = FACTIONS[k];
      const units = defsOf(k, d => d.kind === 'unit'), tw = defsOf(k, d => d.role === 'tower'), sp = defsOf(k, d => d.role === 'special'), sw = defsOf(k, d => d.role === 'superweapon');
      fac += `<div><h3>${F.name}</h3><p>${F.desc}</p><table>${units.map(unitRow).join('')}</table>
      <p><b>Verteidigung:</b> ${tw.map(d => `${d.name} (${d.desc})`).join(', ')}</p>
      <p><b>Spezialgebäude:</b> ${sp.map(d => `${d.name} – ${d.desc}`).join('; ')}</p>
      <p><b>Superwaffen:</b> ${sw.map(d => `${d.name} – ${d.desc}`).join('; ')}</p>
      <p><b>Standardgebäude:</b> ${GENERIC_ROLES.map(r => GEN_NAMES[k][r]).join(', ')}</p></div>`;
    }
    $('#helpBody').innerHTML = `<h2>Anleitung</h2>
    <p><b>Ziel:</b> Zerstöre alle Standardgebäude (Bauhof, Kraftwerk, Raffinerie, Kaserne, Fabrik, Flugfeld, Forschung) deiner Gegner. Verteidigungstürme, Spezialgebäude und Superwaffen zählen nicht.</p>
    <h3>Wirtschaft</h3>
    <p>Baue eine <b>Raffinerie</b> – sie bringt einen Ernter mit. Ernter sammeln automatisch: <span style="color:${RES[1].color}">■ Erz</span> (${RES[1].value} pro Einheit), <span style="color:${RES[2].color}">■ Kristall</span> (${RES[2].value}) und das seltene <span style="color:${RES[3].color}">■ Ätherit</span> (${RES[3].value}) – meist umkämpft in der Kartenmitte. Kraftwerke liefern Energie; bei Energiemangel läuft alles langsamer und Superwaffen laden nicht.</p>
    <h3>Grafik</h3><p>Im Hauptmenü und im Spielmenü (☰) kannst du zwischen 3D und 2D wechseln. 2D läuft auch auf älteren Handys flüssig. „Echte Schatten“ sieht in 3D schöner aus, braucht aber mehr Leistung.</p>
    <h3>Steuerung PC</h3><p>Linksklick: auswählen / Befehl · Ziehen: Auswahlrahmen · Rechtsklick: Befehl (oder abbrechen) · Doppelklick: alle dieses Typs · Mausrad: Zoom · WASD/Pfeile oder Bildschirmrand: Karte bewegen · Leertaste: Basis · Q: ganze Armee · F: Angriff-Bewegen · X: Stopp · Strg+1–9: Gruppe speichern, 1–9: Gruppe wählen · Esc: Menü</p>
    <h3>Steuerung Handy/Tablet</h3><p>Tippen: auswählen / Befehl · Wischen: Karte bewegen · Zwei Finger: Zoom · „▭ Rahmen“ antippen, dann ziehen: mehrere Einheiten wählen · Doppeltipp: alle dieses Typs · Lange drücken auf Bau-Symbol: abbrechen · Bauen: Symbol antippen, wenn „BEREIT“ nochmal antippen, Platz auf Karte antippen, dann auf den grünen Rahmen tippen.</p>
    <h3>Kampf</h3><p>Jede Waffe ist gegen bestimmte Ziele stark: Maschinengewehre gegen Infanterie, Kanonen/Laser/Säure gegen Fahrzeuge, Flak/Raketen gegen Luft. Einheiten auf Hügeln haben 25 % mehr Reichweite. Jede Fraktion hat eine Super-Einheit in einer anderen Klasse.</p>
    <h3>Online</h3><p>„Online-Spiel erstellen“ zeigt einen Raum-Code und Link. Freunde öffnen den Link oder geben den Code unter „Online beitreten“ ein – auf iPhone, Android oder Windows. Kein Konto nötig. Verlässt jemand das Spiel, übernimmt die CPU.</p>
    <h3>Mitwirkende</h3><p>3D-Modelle: Quaternius (Toon Shooter Kit, Sci-Fi Essentials Kit, Modular Sci-Fi MegaKit) und Kenney (City Kit Industrial, Tower Defense Kit) – alle CC0. Grafik-Bibliothek: three.js. Online: PeerJS.</p>
    <div class="facgrid">${fac}</div>
    <div class="btnrow"><span></span><button class="big" id="helpBack">Schließen</button></div>`;
    $('#helpBack').onclick = () => this.show(back);
    this.show('helpScreen');
  },
};
addEventListener('load', () => App.init());
