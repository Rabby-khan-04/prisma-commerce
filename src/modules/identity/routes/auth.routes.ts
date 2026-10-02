import { Router } from "express";
import { authResourceController } from "../../../infra/controllers";
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
    authResourceController(userRegister, 201),
  );

router
  .route("/login")
  .post(validate(userLoginSchema, "body"), authResourceController(userLogin));

router.route("/refresh").post(authResourceController(refreshAccessToken));
router.route("/logout").post(authResourceController(logout));

export default router;
