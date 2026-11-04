import { app } from "./app";
import { startLinkSync } from "./sync";

app.listen(3000, (error?: Error) => {
  if (error) {
    console.error("Server failed to start:", error);
    process.exit(1);
  }

  console.log(`${process.env.REGION} server running on port 3000`);
  startLinkSync();
});
