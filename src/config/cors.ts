import cors, { type CorsOptions } from "cors";

const DEFAULT_ORIGINS = [
  "http://localhost:4000",
  "http://localhost:4001",
  "http://localhost:3000",
  "http://localhost:3001",
];

export function configCors() {
  const allowedOrigin = new Set(DEFAULT_ORIGINS);

  const options: CorsOptions = {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigin.has(origin)) return cb(null, true);

      return cb(new Error(`CORS: origin ${origin} not allowed!!`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  };

  return cors(options);
}
