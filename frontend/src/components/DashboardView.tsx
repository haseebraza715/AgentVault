"use client";

import { useEffect, useRef, useState } from "react";
import PageLayout from "@/components/PageLayout";
import SectionCard from "@/components/SectionCard";
import UploadCard from "@/components/UploadCard";
import DownloadCard from "@/components/DownloadCard";
import FooterStatus from "@/components/FooterStatus";
import StudioHero from "@/components/StudioHero";
import PreviewPanel from "@/components/PreviewPanel";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const STORAGE_KEY = "agentvault:lastJob";

type HealthState = {
  status: string;
  detail?: string;
};

type JobStatus = {
  status: string;
  processed: number;
  total: number;
  error?: string | null;
};

type StoredJob = {
  vaultId: string;
  status: JobStatus;
};

export default function DashboardView() {
  const [health, setHealth] = useState<HealthState>({ status: "loading" });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as StoredJob;
        setVaultId(parsed.vaultId);
        setJobStatus(parsed.status);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/health`);
        if (!res.ok) {
          setHealth({ status: "error", detail: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as { status: string };
        setHealth({ status: data.status });
      } catch (err) {
        setHealth({ status: "error", detail: (err as Error).message });
      }
    };

    checkHealth();
  }, []);

  useEffect(() => {
    if (!vaultId) {
      return;
    }

    let active = true;

    const pollStatus = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/status/${vaultId}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as JobStatus;
        if (active) {
          setJobStatus(data);
          if (data.status === "done" || data.status === "error") {
            window.localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ vaultId, status: data })
            );
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      }
    };

    pollStatus();
    pollRef.current = setInterval(pollStatus, 2000);

    return () => {
      active = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [vaultId]);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a zip file.");
      return;
    }
    setError(null);
    setUploading(true);
    setVaultId(null);
    setJobStatus(null);
    window.localStorage.removeItem(STORAGE_KEY);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiBaseUrl}/upload-vault`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Upload failed");
      }

      const data = (await res.json()) as { vault_id: string };
      setVaultId(data.vault_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const downloadUrl = vaultId ? `${apiBaseUrl}/download/${vaultId}` : null;
  const previewUrl = vaultId ? `${apiBaseUrl}/preview/${vaultId}` : null;
  const statusText = jobStatus
    ? `${jobStatus.status} (${jobStatus.processed}/${jobStatus.total})`
    : null;

  return (
    <PageLayout>
      <StudioHero />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="Upload"
          description="Upload a vault zip to begin processing."
        >
          <UploadCard
            uploading={uploading}
            onSelectFile={setFile}
            onUpload={handleUpload}
            error={jobStatus?.status === "error" ? jobStatus.error : error}
            statusText={statusText}
          />
        </SectionCard>
        <SectionCard
          title="Downloads"
          description="Grab the cleaned vault or preview markdown when ready."
        >
          <DownloadCard
            zipUrl={downloadUrl}
            previewUrl={previewUrl}
            enabled={jobStatus?.status === "done"}
          />
        </SectionCard>
      </div>
      <SectionCard
        title="Preview"
        description="View the full markdown preview in your browser."
      >
        <PreviewPanel
          previewUrl={previewUrl}
          enabled={jobStatus?.status === "done"}
        />
      </SectionCard>
      <FooterStatus status={health.status} />
    </PageLayout>
  );
}
