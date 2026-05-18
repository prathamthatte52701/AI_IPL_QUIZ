export const fallbackQuestions = [
  {
    question: "Which team won the first IPL season in 2008?",
    type: "multiple_choice",
    options: ["Mumbai Indians", "Rajasthan Royals", "Chennai Super Kings", "Kolkata Knight Riders"],
    correct_answer: "Rajasthan Royals",
    explanation: "Rajasthan Royals won the inaugural IPL season in 2008.",
    category: "team_records",
    difficulty: "easy"
  },
  {
    question: "Which IPL franchise is commonly known as CSK?",
    type: "multiple_choice",
    options: ["Chennai Super Kings", "Chandigarh Super Kings", "Central Super Knights", "Cricket Super Kings"],
    correct_answer: "Chennai Super Kings",
    explanation: "CSK stands for Chennai Super Kings.",
    category: "team_records",
    difficulty: "easy"
  },
  {
    question: "True or False: The Orange Cap is awarded to the highest run-scorer in an IPL season.",
    type: "true_false",
    options: ["True", "False"],
    correct_answer: "True",
    explanation: "The Orange Cap goes to the season's leading run-scorer.",
    category: "rules",
    difficulty: "easy"
  },
  {
    question: "Which player is strongly associated with the nickname 'Mr. IPL'?",
    type: "multiple_choice",
    options: ["Suresh Raina", "Jasprit Bumrah", "Ravichandran Ashwin", "David Warner"],
    correct_answer: "Suresh Raina",
    explanation: "Suresh Raina is widely called Mr. IPL for his consistent IPL impact.",
    category: "player_stats",
    difficulty: "medium"
  },
  {
    question: "Fill in the blank: The Purple Cap is awarded to the highest ____ taker in an IPL season.",
    type: "fill_blank",
    options: [],
    correct_answer: "wicket",
    explanation: "The Purple Cap is for the leading wicket-taker.",
    category: "rules",
    difficulty: "easy"
  },
  {
    question: "Which team won the IPL 2023 final?",
    type: "multiple_choice",
    options: ["Gujarat Titans", "Mumbai Indians", "Chennai Super Kings", "Royal Challengers Bengaluru"],
    correct_answer: "Chennai Super Kings",
    explanation: "CSK defeated Gujarat Titans in the IPL 2023 final.",
    category: "memorable_moments",
    difficulty: "medium"
  },
  {
    question: "True or False: A Super Over can be used to decide a tied IPL match.",
    type: "true_false",
    options: ["True", "False"],
    correct_answer: "True",
    explanation: "IPL tied matches can be decided by a Super Over.",
    category: "rules",
    difficulty: "easy"
  },
  {
    question: "Which franchise is associated with the home venue Eden Gardens?",
    type: "multiple_choice",
    options: ["Kolkata Knight Riders", "Delhi Capitals", "Punjab Kings", "Sunrisers Hyderabad"],
    correct_answer: "Kolkata Knight Riders",
    explanation: "KKR's iconic home ground is Eden Gardens in Kolkata.",
    category: "team_records",
    difficulty: "medium"
  }
];

let fallbackIndex = 0;

export function getFallbackQuestion(difficulty = "medium") {
  const preferred = fallbackQuestions.filter((question) => question.difficulty === difficulty);
  const pool = preferred.length > 0 ? preferred : fallbackQuestions;
  const question = pool[fallbackIndex % pool.length];
  fallbackIndex += 1;
  return { ...question, id: `fallback-${Date.now()}-${fallbackIndex}` };
}
