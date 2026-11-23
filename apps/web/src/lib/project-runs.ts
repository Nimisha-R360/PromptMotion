import type { ProjectResponse, ProjectStatus } from "@promptmotion/shared";
import { getProject } from "./api";
import { logStep } from "./pipeline-log";

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Human wording for a project status. */
export const statusText = (status: ProjectStatus, revising: boolean): string => {
  switch (status) {
    case "queued":
      return "Queued…";
    case "planning":
      return revising ? "Applying your feedback…" : "Writing your video plan…";
    case "validating":
      return "Checking the plan…";
    case "assets":
      return "Creating the voiceover…";
    case "ready":
      return "Ready";
    case "failed":
      return "Something went wrong.";
  }
};

/**
 * Ask GET /projects/:id every second until `done` is true. Reports and logs each status change.
 * (Live server-sent events will replace this later.)
 */
export const pollProject = async (
  projectId: string,
  done: (project: ProjectResponse) => boolean,
  onStatus: (project: ProjectResponse) => void,
  logLabel: string,
): Promise<ProjectResponse> => {
  let lastStatus: ProjectStatus | null = null;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const project = await getProject(projectId);
    if (project.status !== lastStatus) {
      lastStatus = project.status;
      onStatus(project);
      logStep(`${logLabel} status: ${project.status}`, project);
    }
    if (done(project)) return project;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error("This is taking too long. Try again.");
};

/** 75.4 → "1:15.4" */
export const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
};
