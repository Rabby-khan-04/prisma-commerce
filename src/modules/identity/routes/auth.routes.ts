import { Router } from "express";
import { authResourceController } from "../../../infra/controllers";
import { validate } from "../../../infra/middleware";
import { userLogin, userRegister } from "../logic/auth.logic";
import {
  userLoginSchema,
  userRegistrationSchema,
} from "../schemas/auth.schema";

const router = Router();

router
  .route("/register")
  .post(
    validate(userRegistrationSchema, "body"),
    authResourceController(userRegister),
  );

router
  .route("/login")
  .post(validate(userLoginSchema, "body"), authResourceController(userLogin));

export default router;
