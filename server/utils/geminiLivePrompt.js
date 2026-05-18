export function buildLiveGeminiPrompt({ matchData, difficulty, recentQuestions = [] }) {
  const recentQuestionText = recentQuestions.map((q, index) => `${index + 1}. ${q.text}`).join("\n") || "None yet";
  const recentEvents = (matchData.recentEvents || [])
    .map((event) => `- ${event.text || `${event.type} by ${event.player || "unknown"}`}`)
    .join("\n");

  return `
You are an IPL cricket expert and live-match quiz master.
Generate EXACTLY ONE unique cricket quiz question based on the live match context below.

LIVE MATCH CONTEXT RIGHT NOW:
- Match: ${matchData.team1} vs ${matchData.team2}
- Series: ${matchData.series}
- Venue: ${matchData.venue}
- Status: ${matchData.statusText}
- Batting Team: ${matchData.battingTeam}
- Score: ${matchData.battingScore.runs}/${matchData.battingScore.wickets} in ${matchData.overText || matchData.battingScore.overs} overs
- Current Run Rate: ${matchData.runRate}
- Current Batsman: ${matchData.currentBatsman?.name} (${matchData.currentBatsman?.runs} off ${matchData.currentBatsman?.balls}, SR ${matchData.currentBatsman?.strikeRate})
- Current Bowler: ${matchData.currentBowler?.name} (${matchData.currentBowler?.wickets}/${matchData.currentBowler?.runs} in ${matchData.currentBowler?.overs} overs)
- Last Wicket: ${matchData.lastWicket?.batsman} (${matchData.lastWicket?.runs} off ${matchData.lastWicket?.balls}) by ${matchData.lastWicket?.bowler}
- Current Partnership: ${matchData.partnership?.player1} and ${matchData.partnership?.player2}: ${matchData.partnership?.runs} runs from ${matchData.partnership?.balls} balls
- Recent Events:
${recentEvents}

Difficulty: ${difficulty}
- easy = directly visible from scoreboard/current event
- medium = simple cricket calculation using current data, like strike rate/run rate/partnership
- hard = tactical analysis or projection based on current data

Already asked in this room. DO NOT repeat these:
${recentQuestionText}

Rules:
1. The question MUST be tied to the live context above.
2. Do NOT ask generic historical IPL questions unless directly linked to the current player/match moment.
3. Keep it answerable from the visible scoreboard/context.
4. Prefer multiple_choice for demo stability.
5. Give exactly 4 options for multiple_choice.
6. correct_answer must exactly match one option.
7. Return ONLY valid JSON. No markdown. No explanation outside JSON.

JSON schema:
{
  "question": "string",
  "type": "multiple_choice",
  "options": ["string", "string", "string", "string"],
  "correct_answer": "string",
  "explanation": "short explanation using live match numbers",
  "context": "LIVE - team1 vs team2, score/overs",
  "category": "live_match_stats | recent_event | partnership | run_rate | tactical_prediction",
  "difficulty": "${difficulty}"
}
`;
}
