import React, { useState, useEffect, useRef } from "react";
import "./App.css";

const PROXY = "https://corsproxy.io/?";

const STAGE_PRESETS: Record<string, any[]> = {
  standard: ["intro", "documentCapture", { name: "faceCapture", options: { mode: "video" } }, "completion"],
  docOnly: ["intro", "documentCapture", "completion"],
  faceOnly: ["intro", { name: "faceCapture", options: { mode: "video" } }, "completion"],
  full: ["intro", "userConsentCapture", "documentCapture", { name: "faceCapture", options: { mode: "video" } }, "poaCapture", "completion"],
};

function App() {
  const [apiKey, setApiKey] = useState("");
  const [version, setVersion] = useState("1.5.1");
  const [clientId, setClientId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [stagePreset, setStagePreset] = useState("standard");
  const [isWorkflowMode, setIsWorkflowMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const mountRef = useRef<HTMLDivElement>(null);
  const complyCubeInstance = useRef<any>(null);

  // Fetch clients (debounced)
  useEffect(() => {
    if (!apiKey.trim()) {
      setClients([]);
      setClientId("");
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoadingClients(true);
      setError("");
      try {
        const res = await fetch(`${PROXY}https://api-dev.ccverify.xyz/v1/clients`, {
          headers: { Authorization: apiKey.trim() },
        });
        if (!res.ok) throw new Error("Invalid API key");
        const json = await res.json();
        setClients(json.data || json.items || []);
      } catch (err: any) {
        setError("Failed to load clients: " + err.message);
      } finally {
        setIsLoadingClients(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [apiKey]);

  // Fetch workflows on mode change
  useEffect(() => {
    if (!apiKey.trim() || !isWorkflowMode) {
      setWorkflows([]);
      setWorkflowId("");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${PROXY}https://api-dev.ccverify.xyz/v1/workflowTemplates`, {
          headers: { Authorization: apiKey.trim() },
        });
        if (!res.ok) throw new Error("Failed to load workflows");
        const json = await res.json();
        const items = json.data || json.items || [];
        setWorkflows(items.filter((w: any) => w.status === "active"));
      } catch (err: any) {
        setError("Workflows: " + err.message);
      }
    })();
  }, [apiKey, isWorkflowMode]);

  const generateToken = async () => {
    if (!clientId) throw new Error("Select a client");
    const res = await fetch(`${PROXY}https://api-dev.ccverify.xyz/v1/tokens`, {
      method: "POST",
      headers: { Authorization: apiKey.trim(), "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, referrer: window.location.origin + "/*" }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Token generation failed");
    }
    const data = await res.json();
    return data.token;
  };

  const loadSdk = async () => {
    const scriptUrl = version === "v1"
      ? "https://assets.ccverify.xyz/web-sdk/v1/complycube.min.js"
      : `https://assets.ccverify.xyz/web-sdk/version/${version}/complycube.min.js`;
    const cssUrl = version === "v1"
      ? "https://assets.ccverify.xyz/web-sdk/v1/style.css"
      : `https://assets.ccverify.xyz/web-sdk/version/${version}/style.css`;

    document.querySelectorAll('script[src*="complycube"], link[href*="ccverify"]').forEach((el) => el.remove());

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    document.head.appendChild(link);

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.onload = () => setTimeout(resolve, 150);
      script.onerror = () => reject(new Error("SDK failed to load"));
      document.head.appendChild(script);
    });
  };

  const startVerification = async () => {
    if (!apiKey || !clientId) return;
    setIsLoading(true);
    setError("");

    try {
      if (mountRef.current) {
        mountRef.current.innerHTML = `<div class="spinner">Loading SDK v${version}...</div>`;
      }
      await loadSdk();
      const token = await generateToken();

      if (mountRef.current) mountRef.current.innerHTML = "";

      const options: any = {
        token,
        containerId: "complycube-mount",
        onComplete: () => {
          alert("Verification completed successfully!");
          complyCubeInstance.current = null;
        },
        onModalClose: () => {
          complyCubeInstance.current?.unmount?.();
          complyCubeInstance.current = null;
          if (mountRef.current) {
            mountRef.current.innerHTML = `<p style="text-align:center;padding:3rem;color:#666">Verification cancelled</p>`;
          }
        },
        onError: (e: any) => {
          setError("SDK Error: " + e.message);
          complyCubeInstance.current = null;
        },
      };

      if (isWorkflowMode && workflowId) {
        options.workflowTemplateId = workflowId;
      } else {
        options.stages = STAGE_PRESETS[stagePreset];
      }

      complyCubeInstance.current = (window as any).ComplyCube.mount(options);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>ComplyCube React Demo</h1>
      <p className="subtitle">React + Vite • api-dev.ccverify.xyz • Full Features</p>

      <div className="card">
        <div className="form-grid">
          <div className="form-group">
            <label>API Key (Dev)</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk_test_..."
              type="password"
            />
            {isLoadingClients && <small style={{ color: "#646cff" }}>Loading clients...</small>}
          </div>
          <div className="form-group">
            <label>SDK Version</label>
            <select value={version} onChange={(e) => setVersion(e.target.value)}>
              <option value="1.5.1">v1.5.1</option>
              <option value="1.5.0">v1.5.0</option>
              <option value="v1">v1 (Latest)</option>
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-group">
            <label>Client ({clients.length})</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={isLoadingClients || clients.length === 0}
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.personDetails?.firstName || c.entityName || "Guest").trim()} {c.personDetails?.lastName || ""} ({c.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Mode</label>
            <div className="toggle-container">
              <span>Stages</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={isWorkflowMode}
                  onChange={(e) => setIsWorkflowMode(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span>Workflow</span>
            </div>
          </div>
        </div>

        <div className="form-grid">
          {!isWorkflowMode ? (
            <div className="form-group">
              <label>Flow</label>
              <select value={stagePreset} onChange={(e) => setStagePreset(e.target.value)}>
                <option value="standard">Standard (Doc + Video)</option>
                <option value="docOnly">Document Only</option>
                <option value="faceOnly">Face Only</option>
                <option value="full">Full Flow + PoA</option>
              </select>
            </div>
          ) : (
            <div className="form-group">
              <label>Workflow ({workflows.length})</label>
              <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} disabled={workflows.length === 0}>
                <option value="">Select workflow...</option>
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <button onClick={startVerification} disabled={isLoading || !clientId} className="start-btn">
          {isLoading && <span className="spinner-btn"></span>}
          {isLoading ? "Initializing SDK..." : "Start Verification"}
        </button>
      </div>

      <div ref={mountRef} id="complycube-mount" className="mount">
        <div className="placeholder">
          <p>ComplyCube verification flow will appear here</p>
        </div>
      </div>
    </div>
  );
}

export default App;