export interface QuoPaginatedResponse<T> {
  data: T[];
  pageInfo?: {
    endCursor?: string;
    hasNextPage?: boolean;
  };
  pageToken?: string;
}

export interface QuoError {
  error: string;
  message?: string;
  statusCode?: number;
}

export async function callQuoFunction<T>(
  functionPath: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
  accessToken?: string
): Promise<T> {
  if (!accessToken) {
    throw new Error("Access token is required");
  }

  const headers: HeadersInit = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const url = `/functions/v1/${functionPath}`;

  const response = await fetch(url, {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Quo API error: ${error.error || error.message || response.statusText}`
    );
  }

  return response.json();
}

export async function listTasks(
  cursor?: string,
  limit = "50",
  accessToken?: string
): Promise<QuoPaginatedResponse<unknown>> {
  const params = new URLSearchParams({ action: "list", limit });
  if (cursor) params.append("cursor", cursor);

  return callQuoFunction(
    `quo-tasks?${params}`,
    "GET",
    undefined,
    accessToken
  );
}

export async function getTask(
  taskId: string,
  accessToken?: string
): Promise<unknown> {
  const params = new URLSearchParams({ action: "get", taskId });
  return callQuoFunction(`quo-tasks?${params}`, "GET", undefined, accessToken);
}

export async function createTask(
  title: string,
  options?: unknown,
  accessToken?: string
): Promise<unknown> {
  return callQuoFunction(
    "quo-tasks?action=create",
    "POST",
    { title, ...options },
    accessToken
  );
}

export async function updateTask(
  taskId: string,
  updates: unknown,
  accessToken?: string
): Promise<unknown> {
  return callQuoFunction(
    "quo-tasks?action=update",
    "PUT",
    { taskId, ...updates },
    accessToken
  );
}

export async function deleteTask(
  taskId: string,
  accessToken?: string
): Promise<unknown> {
  const params = new URLSearchParams({ action: "delete", taskId });
  return callQuoFunction(
    `quo-tasks?${params}`,
    "DELETE",
    undefined,
    accessToken
  );
}

export async function listContacts(
  cursor?: string,
  limit = "50",
  accessToken?: string
): Promise<QuoPaginatedResponse<unknown>> {
  const params = new URLSearchParams({ action: "list", limit });
  if (cursor) params.append("cursor", cursor);

  return callQuoFunction(
    `quo-contacts?${params}`,
    "GET",
    undefined,
    accessToken
  );
}

export async function getContact(
  contactId: string,
  accessToken?: string
): Promise<unknown> {
  const params = new URLSearchParams({ action: "get", contactId });
  return callQuoFunction(
    `quo-contacts?${params}`,
    "GET",
    undefined,
    accessToken
  );
}

export async function createContact(
  options: unknown,
  accessToken?: string
): Promise<unknown> {
  return callQuoFunction(
    "quo-contacts?action=create",
    "POST",
    options,
    accessToken
  );
}

export async function updateContact(
  contactId: string,
  updates: unknown,
  accessToken?: string
): Promise<unknown> {
  return callQuoFunction(
    "quo-contacts?action=update",
    "PATCH",
    { contactId, ...updates },
    accessToken
  );
}

export async function deleteContact(
  contactId: string,
  accessToken?: string
): Promise<unknown> {
  const params = new URLSearchParams({ action: "delete", contactId });
  return callQuoFunction(
    `quo-contacts?${params}`,
    "DELETE",
    undefined,
    accessToken
  );
}
