export function buildGeminiPrompt({ difficulty, category, usedQuestions = [] }) {
  const used = usedQuestions.slice(-8).map((q, index) => `${index + 1}. ${q}`).join("\n");

  return `
You are an IPL cricket trivia expert and hackathon quiz master.
Generate EXACTLY ONE fresh IPL cricket trivia question.

Difficulty: ${difficulty}
- easy: famous IPL players, trophies, basic teams, very known moments
- medium: team records, orange/purple cap, season-level facts, captains
- hard: lesser-known but still verifiable IPL stats, records, or specific moments

Preferred category: ${category}

Avoid repeating these previous questions:
${used || "No previous questions yet."}

Rules:
1. Return ONLY valid JSON.
2. No markdown.
3. No comments.
4. Question must be IPL-specific.
5. For multiple_choice: give exactly 4 options.
6. correct_answer must match the exact option text for multiple_choice.
7. For true_false: options must be ["True", "False"], correct_answer must be "True" or "False".
8. For fill_blank: options must be [], correct_answer must be a short answer.
9. Explanation should be 1 short sentence.

JSON shape:
{
  "question": "string",
  "type": "multiple_choice" | "true_false" | "fill_blank",
  "options": ["string"],
  "correct_answer": "string",
  "explanation": "string",
  "category": "player_stats" | "team_records" | "memorable_moments" | "rules",
  "difficulty": "easy" | "medium" | "hard"
}
`.trim();
}
