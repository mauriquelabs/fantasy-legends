import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sorareRouter from "./sorare";
import worldCupRouter from "./world-cup";
import playersRouter from "./players";
import leaguesRouter from "./leagues";
import picksRouter from "./picks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sorareRouter);
router.use(worldCupRouter);
router.use(playersRouter);
router.use(leaguesRouter);
router.use(picksRouter);

export default router;
