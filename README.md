# Notion Guardian

A tool that automatically backups your [Notion](notion.so) workspace and commits changes to another repository.

Notion Guardian offers a quick way to setup a secure backup of your data in a private repository — allowing you to track how your notes change over time and to know that your data is safe.

The tool separates the logic for running the export and the actual workspace data into two repositories. This way your backups are not cluttered with other scripts. If you prefer to have a one-repo solution or want to backup specific blocks of your workspace, checkout the [notion-backup fork by upleveled](https://github.com/upleveled/notion-backup).

## How to setup

1. Create a separate private repository for your backups to live in (e.g. "my-notion-backup"). Make sure you create a `main` branch — for example by clicking "Add a README file" when creating the repo.
2. Fork this repository ("notion-guardian").
3. Create a Personal Access Token ([docs](https://docs.github.com/en/free-pro-team@latest/github/authenticating-to-github/creating-a-personal-access-token)) with the "repo" scope and store it as `REPO_PERSONAL_ACCESS_TOKEN` in the secrets of the forked repo.
4. Store your GitHub username in the `REPO_USERNAME` secret.
5. Store the name of your newly created private repo in the `REPO_NAME` secret (in this case "my-notion-backup").
6. Store the email that should be used to commit changes (usually your GitHub account email) in the `REPO_EMAIL` secret.
7. Obtain your Notion space-id and token as described [in this Medium post](https://medium.com/@arturburtsev/automated-notion-backups-f6af4edc298d). Store it in the `NOTION_SPACE_ID` and `NOTION_TOKEN` secret.
8. You will also need to obtain your `notion_user_id` the same way and store it in a `NOTION_USER_ID` secret.
9. Click the "Actions" tab on the forked repo and enable actions by clicking the button.
10. On the left sidebar click the "Backup Notion Workspace" workflow. A notice will tell you that "Scheduled Actions" are disabled, so go ahead and click the button to enable them.
11. Wait until the action runs for the first time or push a commit to the repo to trigger the first backup.
12. Check your private repo to see that an automatic commit with your Notion workspace data has been made. Done 🙌

## How it works

This repo contains a GitHub workflow that runs every day and for every push to this repo. The workflow will execute the script which makes an export request to Notion, waits for it to finish and downloads the workspace content to a temporary directory. The workflow will then commit this directory to the repository configured in the repo secrets.
