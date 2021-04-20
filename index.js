const axios = require(`axios`);
const extract = require(`extract-zip`);
const { createWriteStream, mkdirSync, rmdirSync, unlinkSync } = require(`fs`);
const { join } = require(`path`);

const unofficialNotionAPI = `https://www.notion.so/api/v3`;
const { NOTION_TOKEN, NOTION_SPACE_ID } = process.env;
const client = axios.create({
  baseURL: unofficialNotionAPI,
  headers: {
    Cookie: `token_v2=${NOTION_TOKEN}`,
  },
});

if (!NOTION_TOKEN || !NOTION_SPACE_ID) {
  console.error(
    `Environment variable NOTION_TOKEN or NOTION_SPACE_ID is missing. Check the README.md for more information.`
  );
  process.exit(1);
}

const sleep = async (seconds) => {
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
};

const round = (number) => Math.round(number * 100) / 100;

const exportFromNotion = async (destination, format) => {
  const task = {
    eventName: `exportSpace`,
    request: {
      spaceId: NOTION_SPACE_ID,
      exportOptions: {
        exportType: format,
        timeZone: `Europe/Berlin`,
        locale: `en`,
      },
    },
  };
  const {
    data: { taskId },
  } = await client.post(`enqueueTask`, { task });

  console.log(`Started Export as task [${taskId}].\n`);

  let exportURL;
  while (true) {
    await sleep(2);
    const {
      data: { results: tasks },
    } = await client.post(`getTasks`, { taskIds: [taskId] });
    const task = tasks.find((t) => t.id === taskId);

    console.log(`Exported ${task.status.pagesExported} pages.`);

    if (task.state === `success`) {
      exportURL = task.status.exportURL;
      console.log(`\nExport finished.`);
      break;
    }
  }

  const response = await client({
    method: `GET`,
    url: exportURL,
    responseType: `stream`,
  });

  const size = response.headers["content-length"];
  console.log(`Downloading ${round(size / 1000 / 1000)}mb...`);

  const stream = response.data.pipe(createWriteStream(destination));
  await new Promise((resolve, reject) => {
    stream.on(`close`, resolve);
    stream.on(`error`, reject);
  });
};

const run = async () => {
  const workspaceDir = join(process.cwd(), `workspace`);
  const workspaceZip = join(process.cwd(), `workspace.zip`);

  await exportFromNotion(workspaceZip, `markdown`);
  rmdirSync(workspaceDir, { recursive: true });
  mkdirSync(workspaceDir, { recursive: true });
  await extract(workspaceZip, { dir: workspaceDir });
  unlinkSync(workspaceZip);

  console.log(`✅ Export downloaded and unzipped.`);
};

run();
