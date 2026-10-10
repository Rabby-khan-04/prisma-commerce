import { Router } from "express";
import { controller } from "../../../infra/controllers";
import { validate } from "../../../infra/middleware";
import {
  logout,
  refreshAccessToken,
  userLogin,
  userRegister,
} from "../logic/auth.logic";
import {
  userLoginSchema,
  userRegistrationSchema,
} from "../schemas/auth.schema";

const router = Router();

router
  .route("/register")
  .post(
    validate(userRegistrationSchema, "body"),
    controller(userRegister, { status: 201 }),
  );

router
  .route("/login")
  .post(validate(userLoginSchema, "body"), controller(userLogin));

router.route("/refresh").post(controller(refreshAccessToken));
router.route("/logout").post(controller(logout));

export default router;
