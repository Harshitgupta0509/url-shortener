import { app } from "./app";

app.listen(3000, (error?: Error) => {
  if (error) {
    console.error("Server failed to start:", error);
    process.exit(1);
  }

  console.log("Server running on http://localhost:3000");
});
