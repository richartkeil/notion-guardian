import "dotenv/config";
import axios from "axios";
import AdmZip from "adm-zip";
import { createWriteStream, promises as fs } from "fs";
import { join } from "path";

type NotionTask = {
  id: string;
  state: string;
  status: {
    pagesExported: number;
    exportURL: string;
  };
  error?: string;
};

const { NOTION_TOKEN, NOTION_SPACE_ID, NOTION_USER_ID } = process.env;
if (!NOTION_TOKEN || !NOTION_SPACE_ID || !NOTION_USER_ID) {
  throw new Error(
    "Environment variable NOTION_TOKEN, NOTION_SPACE_ID or NOTION_USER_ID is missing. Check the README.md for more information."
  );
}

const client = axios.create({
  baseURL: "https://www.notion.so/api/v3", // Unofficial Notion API
  headers: {
    Cookie: `token_v2=${NOTION_TOKEN};`,
    "x-notion-active-user-header": NOTION_USER_ID,
  },
});

const sleep = async (seconds: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
};

const round = (number: number) => Math.round(number * 100) / 100;

const exportFromNotion = async (
  destination: string,
  format: string
): Promise<void> => {
  const task = {
    eventName: "exportSpace",
    request: {
      spaceId: NOTION_SPACE_ID,
      shouldExportComments: false,
      exportOptions: {
        exportType: format,
        collectionViewExportType: "currentView",
        timeZone: "Europe/Berlin",
        locale: "en",
        preferredViewMap: {},
      },
    },
  };
  const {
    data: { taskId },
  }: { data: { taskId: string } } = await client.post("enqueueTask", { task });

  console.log(`Started export as task [${taskId}].`);

  let exportURL: string;
  let fileTokenCookie: string | undefined;
  while (true) {
    await sleep(2);
    const {
      data: { results: tasks },
      headers: { "set-cookie": getTasksRequestCookies },
    }: {
      data: { results: NotionTask[] };
      headers: { [key: string]: string[] };
    } = await client.post("getTasks", { taskIds: [taskId] });
    const task = tasks.find((t) => t.id === taskId);

    if (!task) throw new Error(`Task [${taskId}] not found.`);
    if (task.error) throw new Error(`Export failed with reason: ${task.error}`);

    console.log(`Exported ${task.status.pagesExported} pages.`);

    if (task.state === "success") {
      exportURL = task.status.exportURL;
      fileTokenCookie = getTasksRequestCookies.find((cookie) =>
        cookie.includes("file_token=")
      );
      if (!fileTokenCookie) {
        throw new Error("Task finished but file_token cookie not found.");
      }
      console.log(`Export finished.`);
      break;
    }
  }

  const response = await client({
    method: "GET",
    url: exportURL,
    responseType: "stream",
    headers: { Cookie: fileTokenCookie },
  });

  const size = response.headers["content-length"];
  console.log(`Downloading ${round(size / 1000 / 1000)}mb...`);

  const stream = response.data.pipe(createWriteStream(destination));
  await new Promise((resolve, reject) => {
    stream.on("close", resolve);
    stream.on("error", reject);
  });
};

const extractZip = async (
  filename: string,
  destination: string
): Promise<void> => {
  const zip = new AdmZip(filename);
  zip.extractAllTo(destination, true);

  const extractedFiles = zip.getEntries().map((entry) => entry.entryName);
  const partFiles = extractedFiles.filter((name) =>
    name.match(/Part-\d+\.zip/)
  );

  // Extract found "Part-*.zip" files to destination and delete them:
  await Promise.all(
    partFiles.map(async (partFile: string) => {
      partFile = join(destination, partFile);
      const partZip = new AdmZip(partFile);
      partZip.extractAllTo(destination, true);
      await fs.unlink(partFile);
    })
  );

  const extractedFolders = await fs.readdir(destination);
  const exportFolders = extractedFolders.filter((name: string) =>
    name.startsWith("Export-")
  );

  // Move the contents of found "Export-*" folders to destination and delete them:
  await Promise.all(
    exportFolders.map(async (folderName: string) => {
      const folderPath = join(destination, folderName);
      const contents = await fs.readdir(folderPath);
      await Promise.all(
        contents.map(async (file: string) => {
          const filePath = join(folderPath, file);
          const newFilePath = join(destination, file);
          await fs.rename(filePath, newFilePath);
        })
      );
      await fs.rmdir(folderPath);
    })
  );
};

const run = async (): Promise<void> => {
  const workspaceDir = join(process.cwd(), "workspace");
  const workspaceZip = join(process.cwd(), "workspace.zip");

  await exportFromNotion(workspaceZip, "markdown");
  await fs.rm(workspaceDir, { recursive: true, force: true });
  await fs.mkdir(workspaceDir, { recursive: true });
  await extractZip(workspaceZip, workspaceDir);
  await fs.unlink(workspaceZip);

  console.log("✅ Export downloaded and unzipped.");
};

run();
