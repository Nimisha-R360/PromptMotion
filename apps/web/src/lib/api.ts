import {
  type CreateProjectResponse,
  CreateProjectResponseSchema,
  type CreateRevisionResponse,
  CreateRevisionResponseSchema,
  type ProjectResponse,
  ProjectResponseSchema,
} from "@promptmotion/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Anything with a Zod-style `parse` (the shared response schemas). */
type Parser<T> = { parse: (data: unknown) => T };

const request = async <T>(path: string, schema: Parser<T>, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String(body.message)
        : response.statusText;
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${response.status}): ${message}`);
  }
  // Check the response matches the shared contract before the app uses it.
  return schema.parse(body);
};

export const createProject = (prompt: string): Promise<CreateProjectResponse> =>
  request("/projects", CreateProjectResponseSchema, {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });

export const getProject = (id: string): Promise<ProjectResponse> =>
  request(`/projects/${encodeURIComponent(id)}`, ProjectResponseSchema);

export const createRevision = (
  projectId: string,
  feedback: string,
): Promise<CreateRevisionResponse> =>
  request(`/projects/${encodeURIComponent(projectId)}/revisions`, CreateRevisionResponseSchema, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
