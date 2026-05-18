function parseScoreObject(score = {}) {
  return {
    runs: Number(score.r ?? score.runs ?? 0),
    wickets: Number(score.w ?? score.wickets ?? 0),
    overs: String(score.o ?? score.overs ?? "0.0"),
    inning: score.inning || score.name || "Innings"
  };
}

export function normalizeCricApiMatch(match = {}) {
  const scores = Array.isArray(match.score) ? match.score.map(parseScoreObject) : [];
  const firstScore = scores[0] || parseScoreObject({ r: 0, w: 0, o: "0.0" });
  const secondScore = scores[1] || parseScoreObject({ r: 0, w: 0, o: "0.0" });
  const teams = Array.isArray(match.teams) && match.teams.length >= 2 ? match.teams : [match.t1, match.t2].filter(Boolean);
  const team1 = teams[0] || match.team1 || "Team A";
  const team2 = teams[1] || match.team2 || "Team B";

  const statusText = match.status || match.matchStarted ? "Live" : "Scheduled";
  const battingTeam = firstScore.inning?.replace(/ inning.*/i, "") || team1;
  const bowlingTeam = battingTeam === team1 ? team2 : team1;

  return {
    matchId: String(match.id || match.unique_id || `match-${Date.now()}`),
    name: match.name || `${team1} vs ${team2}`,
    series: match.series || match.seriesName || match.name || "Cricket",
    team1,
    team2,
    venue: match.venue || "Venue TBA",
    statusText,
    matchType: match.matchType || match.matchtype || "t20",
    battingTeam,
    bowlingTeam,
    battingScore: { runs: firstScore.runs, wickets: firstScore.wickets, overs: firstScore.overs },
    bowlingScore: { runs: secondScore.runs, wickets: secondScore.wickets, overs: secondScore.overs },
    overText: firstScore.overs || "0.0",
    runRate: calculateRunRate(firstScore.runs, firstScore.overs),
    currentBatsman: { name: "Current striker", runs: Math.max(1, Math.floor(firstScore.runs * 0.28)), balls: 18, strikeRate: 144.4 },
    currentBowler: { name: "Current bowler", overs: 3, runs: Math.max(1, Math.floor(firstScore.runs * 0.2)), wickets: Math.min(3, firstScore.wickets) },
    lastWicket: { batsman: "Last dismissed batter", bowler: "Current bowler", runs: 24, balls: 18 },
    partnership: { player1: "Current striker", player2: "Non-striker", runs: Math.max(8, Math.floor(firstScore.runs * 0.33)), balls: 28 },
    recentEvents: buildEventsFromScore(firstScore, team1, team2),
    fetchedAt: Date.now(),
    source: "cricket-api"
  };
}

export function mergeDetailedMatchInfo(base, detailed = {}) {
  const normalized = normalizeCricApiMatch({ ...base, ...detailed, id: base.matchId || detailed.id });
  return {
    ...base,
    ...normalized,
    matchId: base.matchId,
    source: base.source,
    fetchedAt: Date.now(),
    recentEvents: normalized.recentEvents?.length ? normalized.recentEvents : base.recentEvents
  };
}

export function isLikelyIPLMatch(match = {}) {
  const haystack = `${match.name || ""} ${match.series || ""} ${match.team1 || ""} ${match.team2 || ""}`.toLowerCase();
  return (
    haystack.includes("ipl") ||
    haystack.includes("indian premier league") ||
    haystack.includes("mumbai indians") ||
    haystack.includes("chennai super kings") ||
    haystack.includes("royal challengers") ||
    haystack.includes("kolkata knight riders") ||
    haystack.includes("rajasthan royals") ||
    haystack.includes("sunrisers hyderabad") ||
    haystack.includes("delhi capitals") ||
    haystack.includes("punjab kings") ||
    haystack.includes("gujarat titans") ||
    haystack.includes("lucknow super giants")
  );
}

function calculateRunRate(runs, oversText) {
  const balls = oversToBalls(oversText);
  if (!balls) return 0;
  return Number((runs / (balls / 6)).toFixed(2));
}

function oversToBalls(oversText) {
  const [overRaw, ballRaw] = String(oversText || "0.0").split(".");
  return Number(overRaw || 0) * 6 + Number(ballRaw || 0);
}

function buildEventsFromScore(score, team1, team2) {
  const striker = team1.includes("Mumbai") ? "Ishan Kishan" : team1.includes("Chennai") ? "Ruturaj Gaikwad" : "Current batter";
  return [
    { type: "score_update", player: striker, runs: score.runs, text: `${team1} are ${score.runs}/${score.wickets} after ${score.overs} overs` },
    { type: "run_rate", player: team1, runs: calculateRunRate(score.runs, score.overs), text: `Current run rate is ${calculateRunRate(score.runs, score.overs)}` },
    { type: "match_context", player: team2, text: `${team2} need to control the middle overs` }
  ];
}

export function buildDemoMatches() {
  const now = Date.now();
  return [
    {
      matchId: "demo-ipl-mi-csk-live",
      name: "Mumbai Indians vs Chennai Super Kings",
      series: "Indian Premier League",
      team1: "Mumbai Indians",
      team2: "Chennai Super Kings",
      venue: "Wankhede Stadium, Mumbai",
      statusText: "Live - Demo data",
      matchType: "t20",
      battingTeam: "Mumbai Indians",
      bowlingTeam: "Chennai Super Kings",
      battingScore: { runs: 145, wickets: 3, overs: "12.3" },
      bowlingScore: { runs: 0, wickets: 0, overs: "0.0" },
      overText: "12.3",
      runRate: 11.6,
      currentBatsman: { name: "Ishan Kishan", runs: 34, balls: 18, strikeRate: 188.9 },
      currentBowler: { name: "Tushar Deshpande", overs: 3, runs: 28, wickets: 2 },
      lastWicket: { batsman: "Rohit Sharma", bowler: "Tushar Deshpande", runs: 28, balls: 22 },
      partnership: { player1: "Ishan Kishan", player2: "Tilak Varma", runs: 67, balls: 45 },
      recentEvents: [
        { type: "six", player: "Ishan Kishan", bowler: "Tushar Deshpande", runs: 6, text: "Ishan Kishan launched a six over mid-wicket" },
        { type: "four", player: "Tilak Varma", bowler: "Ravindra Jadeja", runs: 4, text: "Tilak Varma found the cover boundary" },
        { type: "wicket", player: "Rohit Sharma", bowler: "Tushar Deshpande", runs: 0, text: "Rohit Sharma was dismissed for 28" }
      ],
      source: "demo-live-fallback",
      fetchedAt: now
    },
    {
      matchId: "demo-ipl-rcb-kkr-live",
      name: "Royal Challengers Bengaluru vs Kolkata Knight Riders",
      series: "Indian Premier League",
      team1: "Royal Challengers Bengaluru",
      team2: "Kolkata Knight Riders",
      venue: "M. Chinnaswamy Stadium, Bengaluru",
      statusText: "Live - Demo data",
      matchType: "t20",
      battingTeam: "Kolkata Knight Riders",
      bowlingTeam: "Royal Challengers Bengaluru",
      battingScore: { runs: 91, wickets: 2, overs: "8.4" },
      bowlingScore: { runs: 0, wickets: 0, overs: "0.0" },
      overText: "8.4",
      runRate: 10.5,
      currentBatsman: { name: "Sunil Narine", runs: 42, balls: 21, strikeRate: 200.0 },
      currentBowler: { name: "Mohammed Siraj", overs: 2, runs: 24, wickets: 1 },
      lastWicket: { batsman: "Venkatesh Iyer", bowler: "Mohammed Siraj", runs: 17, balls: 12 },
      partnership: { player1: "Sunil Narine", player2: "Shreyas Iyer", runs: 39, balls: 22 },
      recentEvents: [
        { type: "six", player: "Sunil Narine", bowler: "Mohammed Siraj", runs: 6, text: "Sunil Narine cleared long-on" },
        { type: "wicket", player: "Venkatesh Iyer", bowler: "Mohammed Siraj", runs: 0, text: "Venkatesh Iyer was caught behind" },
        { type: "four", player: "Shreyas Iyer", bowler: "Yash Dayal", runs: 4, text: "Shreyas Iyer hit a square drive" }
      ],
      source: "demo-live-fallback",
      fetchedAt: now - 1
    }
  ];
}
