import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

const port = env.PORT;
let server: ReturnType<typeof app.listen> | undefined;

async function startServer() {
  try {
    await prisma.$connect();

    server = app.listen(port, () => {
      console.log(`SERVER running on PORT: ${port}`);
    });
  } catch (error) {
    console.error(`ERROR: While starting the server!! ERROR: ${error}`);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  await new Promise<void>((resolve) =>
    server ? server.close(() => resolve()) : resolve(),
  );
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (e) => {
  console.log(`Uncaught exception, ${e}`);
  process.exit(1);
});

process.on("unhandledRejection", (r) => {
  console.log(`Unhandled rejection ${r}`);
  process.exit(1);
});

startServer();
