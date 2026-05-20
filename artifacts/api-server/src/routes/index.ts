import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sorareRouter from "./sorare";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sorareRouter);

export default router;
