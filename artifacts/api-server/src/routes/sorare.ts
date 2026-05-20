import { Router } from "express";

const router = Router();

const SORARE_GRAPHQL_URL = "https://api.sorare.com/graphql";
const USER_AGENT = "Sorare Companion App (Replit)";

router.post("/sorare/graphql", async (req, res) => {
  try {
    const response = await fetch(SORARE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to reach Sorare API", details: String(err) });
  }
});

export default router;
