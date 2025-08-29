import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { OnBehalfOfCredentialAuthConfig, OnBehalfOfUserCredential } from "@microsoft/teamsfx";
import config from "../config";

export async function uploadFile(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("Upload file function processed a request.");

  // Проверяем метод запроса
  if (req.method !== "POST") {
    return {
      status: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Проверяем токен авторизации
  const accessToken: string = req.headers.get("Authorization")?.replace("Bearer ", "").trim();
  if (!accessToken) {
    return {
      status: 401,
      body: JSON.stringify({ error: "No access token provided" }),
    };
  }

  // Инициализируем аутентификацию
  const oboAuthConfig: OnBehalfOfCredentialAuthConfig = {
    authorityHost: config.authorityHost,
    clientId: config.clientId,
    tenantId: config.tenantId,
    clientSecret: config.clientSecret,
  };

  let oboCredential: OnBehalfOfUserCredential;
  try {
    oboCredential = new OnBehalfOfUserCredential(accessToken, oboAuthConfig);
    const userInfo = await oboCredential.getUserInfo();
    context.log(`User ${userInfo.displayName} is uploading a file`);
  } catch (e) {
    context.error(e);
    return {
      status: 401,
      body: JSON.stringify({ error: "Invalid access token" }),
    };
  }

  try {
    // Получаем файл из запроса
    const formData = await req.formData();
    const fileEntry = formData.get("file");

    // Приводим к типу загруженного файла в Node (undici), без DOM-специфики
    type UploadedFile = {
      name: string;
      type: string;
      size: number;
      arrayBuffer: () => Promise<ArrayBuffer>;
    };

    const file = fileEntry as unknown as UploadedFile;

    if (!file || typeof file.name !== 'string' || typeof file.size !== 'number') {
      return {
        status: 400,
        body: JSON.stringify({ error: "No file provided" }),
      };
    }

    // Проверяем размер файла (максимум 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        status: 413,
        body: JSON.stringify({ error: "File too large. Maximum size is 10MB" }),
      };
    }

    // Проверяем тип файла
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "image/jpeg",
      "image/png",
      "image/gif",
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        status: 400,
        body: JSON.stringify({ error: "File type not allowed" }),
      };
    }

    // Здесь должна быть логика сохранения файла
    // Пока возвращаем заглушку
    const fileInfo = {
      id: `file_${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedBy: (await oboCredential.getUserInfo()).displayName,
      uploadedAt: new Date().toISOString(),
      status: "uploaded",
    };

    context.log(`File ${file.name} uploaded successfully`);

    return {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "File uploaded successfully",
        file: fileInfo,
      }),
    };
  } catch (error) {
    context.error("Error uploading file:", error);
    return {
      status: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}

app.http("uploadFile", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: uploadFile,
});
