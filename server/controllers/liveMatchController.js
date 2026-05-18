import cricketDataService from "../services/cricketDataService.js";

export async function listLiveMatches(req, res, next) {
  try {
    const matches = cricketDataService.getAllLiveMatches();
    res.json({ ok: true, matches, health: cricketDataService.getHealth() });
  } catch (error) {
    next(error);
  }
}

export async function refreshLiveMatches(req, res, next) {
  try {
    const matches = await cricketDataService.refreshNow();
    res.json({ ok: true, matches, health: cricketDataService.getHealth() });
  } catch (error) {
    next(error);
  }
}

export async function getLiveMatch(req, res, next) {
  try {
    const match = await cricketDataService.getFreshMatch(req.params.matchId);
    if (!match) return res.status(404).json({ ok: false, message: "Match not found" });
    res.json({ ok: true, match, health: cricketDataService.getHealth() });
  } catch (error) {
    next(error);
  }
}
