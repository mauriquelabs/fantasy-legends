import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sorareRouter from "./sorare";
import worldCupRouter from "./world-cup";
import playersRouter from "./players";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sorareRouter);
router.use(worldCupRouter);
router.use(playersRouter);
router.use(stripeRouter);

export default router;
