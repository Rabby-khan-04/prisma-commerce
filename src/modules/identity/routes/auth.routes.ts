import { Router } from "express";
import { authenticate } from "../../../infra/auth";
import { controller } from "../../../infra/controllers";
import { validate } from "../../../infra/middleware";
import {
  currentUser,
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
  .post(validate(userRegistrationSchema, "body"), controller(userRegister));

router
  .route("/login")
  .post(validate(userLoginSchema, "body"), controller(userLogin));

router.route("/refresh").post(controller(refreshAccessToken));
router.route("/logout").post(controller(logout));
router.route("/me").get(authenticate, controller(currentUser));

export default router;
