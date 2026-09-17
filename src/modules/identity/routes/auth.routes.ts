import { Router } from "express";
import { resourceController } from "../../../infra/controllers";
import { validate } from "../../../infra/middleware";
import { userRegister } from "../logic/auth.logic";
import { userRegistrationSchema } from "../schemas/auth.schema";

const router = Router();

router
  .route("/register")
  .post(
    validate(userRegistrationSchema, "body"),
    resourceController(userRegister),
  );

export default router;
