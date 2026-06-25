import { useState } from "react";
import { supabase } from "@/lib/supabase";

export interface AttachmentMeta {
  path: string;
  name: string;
  mime: string;
  size: number;
}

/** Parse the JSON stored in attachment_url (returns null for legacy plain URLs). */
export function parseAttachmentMeta(raw: string | null): AttachmentMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.path && parsed.name) return parsed as AttachmentMeta;
  } catch { /* invalid JSON — return null */ }
  return null;
}

/** Returns true if a mime type is an inline-renderable image. */
export function isImageMime(mime: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"].includes(mime);
}

/** Format bytes to human-readable size string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadState {
  uploading: boolean;
  error: string | null;
}

/**
 * Hook that uploads a File to the message-attachments Storage bucket and
 * returns the JSON-encoded metadata string suitable for attachment_url.
 */
export function useUploadAttachment(workspaceId: string | null) {
  const [state, setState] = useState<UploadState>({ uploading: false, error: null });

  async function upload(file: File): Promise<string | null> {
    if (!workspaceId) {
      setState({ uploading: false, error: "No workspace selected" });
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({ uploading: false, error: "File must be under 10 MB" });
      return null;
    }

    setState({ uploading: true, error: null });
    const ext = file.name.split(".").pop() ?? "";
    const uuid = crypto.randomUUID();
    const path = `${workspaceId}/${uuid}${ext ? `.${ext}` : ""}`;

    const { error } = await supabase.storage
      .from("message-attachments")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      setState({ uploading: false, error: error.message });
      return null;
    }

    const meta: AttachmentMeta = {
      path,
      name: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
    };
    setState({ uploading: false, error: null });
    return JSON.stringify(meta);
  }

  async function getSignedUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from("message-attachments")
      .createSignedUrl(path, 3600);
    if (error) return null;
    return data.signedUrl;
  }

  return { upload, getSignedUrl, ...state };
}
