import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";

const port = env.PORT;

async function startServer() {
  try {
    await prisma.$connect();

    app.listen(port, () => {
      console.log(`SERVER running on PORT: ${port}`);
    });
  } catch (error) {
    console.error(`ERROR: While starting the server!!`);
    process.exit(1);
  }
}

startServer();
