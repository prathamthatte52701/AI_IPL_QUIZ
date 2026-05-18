class QuestionTracker {
  constructor() {
    this.roomQuestions = new Map();
  }

  remember(roomCode, question) {
    const key = String(roomCode || "global").toUpperCase();
    const list = this.roomQuestions.get(key) || [];
    list.push({
      text: question.question,
      matchId: question.matchId,
      generatedAt: question.generatedAt || Date.now(),
      fingerprint: this.fingerprint(question.question)
    });
    this.roomQuestions.set(key, list.slice(-50));
  }

  getRecent(roomCode) {
    const key = String(roomCode || "global").toUpperCase();
    return (this.roomQuestions.get(key) || []).slice(-10);
  }

  isSimilar(roomCode, text) {
    const fp = this.fingerprint(text);
    return this.getRecent(roomCode).some((item) => item.fingerprint === fp);
  }

  clear(roomCode) {
    this.roomQuestions.delete(String(roomCode || "global").toUpperCase());
  }

  fingerprint(text = "") {
    return text.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((word) => word.length > 3).slice(0, 8).join("-");
  }
}

export default new QuestionTracker();
