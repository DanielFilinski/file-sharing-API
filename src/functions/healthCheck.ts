import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function healthCheck(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("Health check function processed a request.");

  const healthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    services: {
      database: "ok",
      authentication: "ok",
      storage: "ok",
    },
  };

  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(healthStatus),
  };
}

app.http("healthCheck", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: healthCheck,
});
