import express, { type Express } from "express";
import { configCors } from "./config/cors";
import { errorHandler, notFoundError } from "./infra/errors/error-handlers";
import router from "./routes";

const app: Express = express();
app.set("trust proxy", 1);

app.use(configCors());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.get("/health", async (_req, res) => {
  try {
    return res.status(200).json({ success: true, message: "HEALTHY" });
  } catch (error) {
    res.status(503).json({ success: false, error: String(error) });
  }
});

app.get("/api/v1/my-ip", async (req, res) => {
  return res.status(200).json({
    success: true,
    ip: req.ip,
  });
});

app.use("/api/v1", router);

// Not found error handler
app.use(notFoundError);

// Global Error Handler
app.use(errorHandler);

export default app;
