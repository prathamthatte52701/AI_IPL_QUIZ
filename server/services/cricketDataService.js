import { EventEmitter } from "events";
import { normalizeCricApiMatch, buildDemoMatches, isLikelyIPLMatch, mergeDetailedMatchInfo } from "../utils/matchEventParser.js";

class CricketDataService extends EventEmitter {
  constructor() {
    super();
    this.liveMatches = new Map();
    this.refreshInterval = Number(process.env.CRICKET_REFRESH_MS || 10000);
    this.apiBase = process.env.CRICKET_API_BASE || "https://api.cricapi.com/v1";
    this.apiKey = process.env.CRICKET_API_KEY || "";
    this.demoEnabled = process.env.ENABLE_DEMO_LIVE_DATA !== "false";
    this.timer = null;
    this.lastFetchAt = null;
    this.source = "booting";
    this.lastError = "";
  }

  start() {
    if (this.timer) return;
    this.refreshNow();
    this.timer = setInterval(() => this.refreshNow(), this.refreshInterval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refreshNow() {
    try {
      if (!this.apiKey || this.apiKey.includes("your_")) {
        this.loadDemoMatches("No CRICKET_API_KEY found. Running demo-live IPL mode.");
        return this.getAllLiveMatches();
      }

      const url = `${this.apiBase}/currentMatches?apikey=${encodeURIComponent(this.apiKey)}&offset=0`;
      const response = await fetch(url, { headers: { "accept": "application/json" } });
      if (!response.ok) throw new Error(`Cricket API HTTP ${response.status}`);
      const payload = await response.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];

      let matches = rows.map(normalizeCricApiMatch).filter(Boolean);
      const iplMatches = matches.filter(isLikelyIPLMatch);
      matches = iplMatches.length ? iplMatches : matches.filter((m) => m.statusText.toLowerCase().includes("live"));

      if (!matches.length) {
        this.loadDemoMatches("Cricket API returned no live IPL matches. Using demo-live IPL data for hackathon testing.");
        return this.getAllLiveMatches();
      }

      this.liveMatches.clear();
      for (const match of matches.slice(0, 8)) {
        match.source = iplMatches.length ? "cricket-api-live-ipl" : "cricket-api-live";
        match.fetchedAt = Date.now();
        this.liveMatches.set(match.matchId, match);
      }

      this.source = iplMatches.length ? "cricket-api-live-ipl" : "cricket-api-live";
      this.lastError = "";
      this.lastFetchAt = Date.now();
      this.emit("matches:updated", this.getAllLiveMatches());
      return this.getAllLiveMatches();
    } catch (error) {
      this.lastError = error.message;
      this.loadDemoMatches(`Cricket API fetch failed: ${error.message}. Using demo-live IPL data.`);
      return this.getAllLiveMatches();
    }
  }

  loadDemoMatches(reason = "Demo-live IPL data active.") {
    if (!this.demoEnabled && this.liveMatches.size > 0) return;
    const demoMatches = buildDemoMatches();
    this.liveMatches.clear();
    for (const match of demoMatches) {
      this.liveMatches.set(match.matchId, match);
    }
    this.source = "demo-live-fallback";
    this.lastError = reason;
    this.lastFetchAt = Date.now();
    this.emit("matches:updated", this.getAllLiveMatches());
  }

  async getFreshMatch(matchId) {
    const base = this.getMatch(matchId) || this.getBestMatch();
    if (!base) {
      this.loadDemoMatches("No match available. Demo fallback injected.");
      return this.getBestMatch();
    }

    if (!this.apiKey || base.source?.includes("demo")) {
      return this.bumpDemoMoment(base.matchId);
    }

    try {
      const url = `${this.apiBase}/match_info?apikey=${encodeURIComponent(this.apiKey)}&id=${encodeURIComponent(base.matchId)}`;
      const response = await fetch(url, { headers: { "accept": "application/json" } });
      if (!response.ok) return base;
      const payload = await response.json();
      const detailed = mergeDetailedMatchInfo(base, payload?.data || payload);
      this.liveMatches.set(detailed.matchId, detailed);
      this.emit("match:updated", detailed);
      return detailed;
    } catch {
      return base;
    }
  }

  bumpDemoMoment(matchId) {
    const match = this.liveMatches.get(matchId) || this.getBestMatch();
    if (!match) return null;
    if (!match.source?.includes("demo")) return match;

    const next = structuredCloneSafe(match);
    const balls = ["0", "1", "2", "4", "6", "W"];
    const event = balls[Math.floor(Date.now() / 1000) % balls.length];
    const striker = next.currentBatsman?.name || next.partnership?.player1 || "Current batter";
    const bowler = next.currentBowler?.name || "current bowler";

    if (event === "W") {
      next.battingScore.wickets = Math.min(9, next.battingScore.wickets + 1);
      next.lastWicket = { batsman: striker, bowler, runs: next.currentBatsman?.runs || 0, balls: next.currentBatsman?.balls || 1 };
      next.recentEvents.unshift({ type: "wicket", player: striker, bowler, text: `${striker} was dismissed by ${bowler}` });
      next.currentBatsman = { name: next.partnership?.player2 || "New batter", runs: 0, balls: 0, strikeRate: 0 };
      next.partnership = { player1: next.currentBatsman.name, player2: "Set batter", runs: 0, balls: 0 };
    } else {
      const runs = Number(event);
      next.battingScore.runs += runs;
      next.currentBatsman.runs += runs;
      next.currentBatsman.balls += 1;
      next.currentBatsman.strikeRate = Number(((next.currentBatsman.runs / Math.max(1, next.currentBatsman.balls)) * 100).toFixed(1));
      next.partnership.runs += runs;
      next.partnership.balls += 1;
      const type = runs === 6 ? "six" : runs === 4 ? "four" : "run";
      next.recentEvents.unshift({ type, player: striker, bowler, runs, text: `${striker} scored ${runs} run${runs === 1 ? "" : "s"} off ${bowler}` });
    }

    next.recentEvents = next.recentEvents.slice(0, 6);
    next.overText = advanceOver(next.overText || "12.3");
    next.fetchedAt = Date.now();
    this.liveMatches.set(next.matchId, next);
    this.emit("match:updated", next);
    return next;
  }

  getMatch(matchId) {
    return this.liveMatches.get(matchId) || null;
  }

  getBestMatch() {
    return this.getAllLiveMatches()[0] || null;
  }

  getAllLiveMatches() {
    return Array.from(this.liveMatches.values()).sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0));
  }

  getHealth() {
    return {
      source: this.source,
      count: this.liveMatches.size,
      lastFetchAt: this.lastFetchAt,
      refreshInterval: this.refreshInterval,
      lastError: this.lastError
    };
  }
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function advanceOver(overText) {
  const [overRaw, ballRaw] = String(overText).split(".");
  let overs = Number(overRaw || 0);
  let balls = Number(ballRaw || 0) + 1;
  if (balls >= 6) {
    overs += 1;
    balls = 0;
  }
  return `${overs}.${balls}`;
}

export default new CricketDataService();
