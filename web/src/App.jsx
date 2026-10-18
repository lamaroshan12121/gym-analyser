import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { computeStats } from "./stats.js";

const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
const STORAGE_KEY = "gymSessions";

// Simple counter so every row gets its own id
let nextId = 1;
function newId() {
  return nextId++;
}

// Turn a file into base64 text so we can send it to the backend
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result looks like "data:image/png;base64,AAAA..."
      // We only want the part after the comma
      resolve(reader.result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

// Saved sessions live in the browser's localStorage
function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

// Turn an exercise from the backend into an editable row.
// Everything is kept as text while editing, so typing feels natural.
function toRow(item) {
  return {
    id: newId(),
    exercise: item.exercise,
    weight: String(item.weight_kg),
    sets: String(item.sets),
    reps: item.reps_per_set.join(", "),
  };
}

// "8, 8" -> [8, 8]
function parseReps(text) {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(Number);
}

// Check a row and return a list of problems (empty list = row is fine)
function validateRow(row) {
  const problems = [];
  const weight = Number(row.weight);
  const sets = Number(row.sets);
  const reps = parseReps(row.reps);

  if (!row.exercise.trim()) {
    problems.push("name is empty");
  }
  if (!(weight > 0 && weight <= 500)) {
    problems.push("weight looks wrong");
  }
  if (!(Number.isInteger(sets) && sets >= 1 && sets <= 20)) {
    problems.push("sets looks wrong");
  }
  if (
    reps.length === 0 ||
    reps.some((r) => !(Number.isInteger(r) && r >= 1 && r <= 100))
  ) {
    problems.push("reps look wrong");
  } else if (Number.isInteger(sets) && reps.length !== sets) {
    problems.push(`${sets} sets but ${reps.length} rep entries`);
  }

  return problems;
}

/* ---------- Icons ---------- */

const IconDumbbell = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.5 6.5v11M3.5 9v5M17.5 6.5v11M20.5 9v5M6.5 12h11" />
  </svg>
);

const IconLog = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 6h12M8 12h12M8 18h8M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

const IconChart = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

const IconSparkle = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
);

const IconCamera = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 8.5A2.5 2.5 0 015.5 6h1.8l1.2-2h6l1.2 2h1.8A2.5 2.5 0 0121 8.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
);

const IconAlert = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.2h.01" />
  </svg>
);

const IconCheck = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.3l2.4 2.4 4.6-4.9" />
  </svg>
);

const IconInbox = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3.5 13h4l1.3 2.6h6.4L16.5 13h4" />
    <path d="M5.4 5h13.2l2 8v4.5A1.5 1.5 0 0119.1 19H4.9a1.5 1.5 0 01-1.5-1.5V13z" />
  </svg>
);

const IconInfo = (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.8h.01" />
  </svg>
);

const TABS = [
  { id: "log", label: "Log", icon: IconLog },
  { id: "stats", label: "Stats", icon: IconChart },
  { id: "report", label: "Report", icon: IconSparkle },
];

function EmptyState({ icon, title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon">{icon}</span>
      <span className="empty-title">{title}</span>
      <p className="empty-text">{children}</p>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [sessions, setSessions] = useState(loadSessions);
  const [savedMessage, setSavedMessage] = useState("");
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [tab, setTab] = useState("log");
  const [confirmId, setConfirmId] = useState(null);

  // Recalculate the stats whenever the saved sessions change
  const stats = useMemo(() => computeStats(sessions), [sessions]);

  // Muscle groups with the most sets this week first
  const muscleSets = Object.entries(stats.thisWeek.setsByMuscle).sort(
    (a, b) => b[1] - a[1]
  );

  // Let the "Session saved." note fade out on its own
  useEffect(() => {
    if (!savedMessage) return;
    const timer = setTimeout(() => setSavedMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [savedMessage]);

  // Don't leave a delete armed indefinitely
  useEffect(() => {
    if (confirmId === null) return;
    const timer = setTimeout(() => setConfirmId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmId]);

  function handleFileChange(event) {
    const chosen = event.target.files[0];
    setError("");
    setRows([]);
    setShowEditor(false);
    setSavedMessage("");

    if (!chosen) return;

    if (!allowedTypes.includes(chosen.type)) {
      setFile(null);
      setPreviewUrl("");
      setError("Please choose a PNG, JPEG or WEBP image.");
      return;
    }

    setFile(chosen);
    setPreviewUrl(URL.createObjectURL(chosen));
  }

  async function handleRead() {
    if (!file) return;

    setLoading(true);
    setError("");
    setRows([]);
    setShowEditor(false);
    setSavedMessage("");

    try {
      const imageBase64 = await fileToBase64(file);

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setRows(data.exercises.map(toRow));
      setShowEditor(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReport() {
    setReportLoading(true);
    setReportError("");
    setReport(null);

    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setReport(data);
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportLoading(false);
    }
  }

  function updateRow(id, field, value) {
    setRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function deleteRow(id) {
    setRows(rows.filter((row) => row.id !== id));
  }

  function addRow() {
    setRows([
      ...rows,
      { id: newId(), exercise: "", weight: "", sets: "2", reps: "" },
    ]);
  }

  const canSave =
    rows.length > 0 && rows.every((row) => validateRow(row).length === 0);

  const invalidCount = rows.filter((row) => validateRow(row).length > 0).length;

  function handleSave() {
    if (!canSave) return;

    const session = {
      id: Date.now(),
      date: new Date().toISOString(),
      exercises: rows.map((row) => ({
        exercise: row.exercise.trim(),
        weight_kg: Number(row.weight),
        sets: Number(row.sets),
        reps_per_set: parseReps(row.reps),
      })),
    };

    const updated = [session, ...sessions];

    if (storeSessions(updated)) {
      setSessions(updated);
      setReport(null);
      setRows([]);
      setShowEditor(false);
      setSavedMessage("Session saved.");
    } else {
      setError("Could not save to this browser's storage.");
    }
  }

  function handleDeleteSession(id) {
    const updated = sessions.filter((session) => session.id !== id);
    if (storeSessions(updated)) {
      setSessions(updated);
      setReport(null);
    }
  }

  const hasSessions = sessions.length > 0;

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-mark">{IconDumbbell}</span>
        <div>
          <h1>Gym Log Analyser</h1>
          <p className="app-tagline">Screenshot in, progress out.</p>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab${tab === item.id ? " active" : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
            {item.id === "log" && showEditor && rows.length > 0 && (
              <span className="tab-dot" />
            )}
          </button>
        ))}
      </nav>

      {/* ---------------- Log ---------------- */}

      {tab === "log" && (
        <section className="stack">
          <label className="uploader">
            <input
              className="file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
            />
            <span className="uploader-icon">{IconCamera}</span>
            <span className="uploader-title">
              {file ? file.name : "Choose a screenshot"}
            </span>
            <span className="uploader-hint">PNG, JPEG or WEBP</span>
          </label>

          {previewUrl && (
            <img className="preview" src={previewUrl} alt="Your workout notes" />
          )}

          <button
            className="btn block"
            onClick={handleRead}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Reading screenshot...
              </>
            ) : (
              "Read screenshot"
            )}
          </button>

          {loading && (
            <div className="loading-panel" aria-live="polite">
              <span className="loading-label">
                <span className="spinner" aria-hidden="true" />
                Pulling the exercises out of your note
              </span>
              <div className="skeleton tall" />
              <div className="skeleton tall" />
              <div className="skeleton tall" />
            </div>
          )}

          {error && (
            <div className="banner error" role="alert">
              {IconAlert}
              <span>{error}</span>
            </div>
          )}

          {savedMessage && (
            <div className="banner success" role="status">
              {IconCheck}
              <span>{savedMessage}</span>
            </div>
          )}

          {showEditor && (
            <div>
              <p className="hint">
                {IconInfo}
                <span>
                  Check the numbers against your note and fix anything that's
                  wrong.
                </span>
              </p>

              <div className="editor-rows">
                {rows.map((row) => {
                  const problems = validateRow(row);
                  return (
                    <div
                      key={row.id}
                      className={`row-card${problems.length > 0 ? " review" : ""}`}
                    >
                      <div className="field">
                        <label
                          className="field-label"
                          htmlFor={`exercise-${row.id}`}
                        >
                          Exercise
                        </label>
                        <input
                          id={`exercise-${row.id}`}
                          type="text"
                          placeholder="e.g. Bench press"
                          value={row.exercise}
                          onChange={(e) =>
                            updateRow(row.id, "exercise", e.target.value)
                          }
                        />
                      </div>

                      <div className="field-grid">
                        <div className="field">
                          <label
                            className="field-label"
                            htmlFor={`weight-${row.id}`}
                          >
                            Weight (kg)
                          </label>
                          <input
                            id={`weight-${row.id}`}
                            type="number"
                            step="0.5"
                            inputMode="decimal"
                            value={row.weight}
                            onChange={(e) =>
                              updateRow(row.id, "weight", e.target.value)
                            }
                          />
                        </div>

                        <div className="field">
                          <label
                            className="field-label"
                            htmlFor={`sets-${row.id}`}
                          >
                            Sets
                          </label>
                          <input
                            id={`sets-${row.id}`}
                            type="number"
                            inputMode="numeric"
                            value={row.sets}
                            onChange={(e) =>
                              updateRow(row.id, "sets", e.target.value)
                            }
                          />
                        </div>

                        <div className="field field-reps">
                          <label
                            className="field-label"
                            htmlFor={`reps-${row.id}`}
                          >
                            Reps per set
                          </label>
                          <input
                            id={`reps-${row.id}`}
                            type="text"
                            placeholder="8, 8, 6"
                            value={row.reps}
                            onChange={(e) =>
                              updateRow(row.id, "reps", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      {problems.length > 0 && (
                        <p className="problems">
                          {IconAlert}
                          <span>Check this row: {problems.join(", ")}</span>
                        </p>
                      )}

                      <button
                        className="btn danger small block row-delete"
                        onClick={() => deleteRow(row.id)}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="actions">
                <button className="btn secondary" onClick={addRow}>
                  Add row
                </button>
                <button className="btn" onClick={handleSave} disabled={!canSave}>
                  Save session
                </button>
              </div>

              {invalidCount > 0 && (
                <p className="save-note">
                  {invalidCount} {invalidCount === 1 ? "row needs" : "rows need"}{" "}
                  fixing before you can save.
                </p>
              )}
            </div>
          )}

          <h2>Saved sessions</h2>
          {!hasSessions ? (
            <EmptyState icon={IconInbox} title="No sessions yet">
              Upload a screenshot of your workout notes and your saved sessions
              will show up here.
            </EmptyState>
          ) : (
            <div>
              {sessions.map((session) => (
                <div className="session" key={session.id}>
                  <div className="session-main">
                    <span className="session-date">
                      {new Date(session.date).toLocaleString()}
                    </span>
                    <span className="session-names">
                      {session.exercises.map((item) => item.exercise).join(", ")}
                    </span>
                  </div>

                  {confirmId === session.id ? (
                    <div className="confirm-group">
                      <button
                        className="btn ghost small"
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn danger small"
                        onClick={() => {
                          handleDeleteSession(session.id);
                          setConfirmId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn ghost small"
                      onClick={() => setConfirmId(session.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------------- Stats ---------------- */}

      {tab === "stats" && (
        <section>
          {!hasSessions ? (
            <EmptyState icon={IconChart} title="Nothing to measure yet">
              Save your first session on the Log tab and your weekly volume,
              personal bests and stalled lifts will appear here.
            </EmptyState>
          ) : (
            <div>
              <h2>This week</h2>
              <div className="stat-cards">
                <div className="stat-card">
                  <span className="stat-value">{stats.thisWeek.sessionCount}</span>
                  <span className="stat-label">Sessions</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.thisWeek.totalSets}</span>
                  <span className="stat-label">Total sets</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">
                    {Math.round(stats.thisWeek.volumeKg).toLocaleString()}
                  </span>
                  <span className="stat-label">Volume kg</span>
                </div>
              </div>

              <h2>Muscle groups</h2>
              {muscleSets.length > 0 ? (
                <div className="muscle-list">
                  {muscleSets.map(([group, setCount]) => (
                    <span className="tag" key={group}>
                      {group} <strong>{setCount}</strong>{" "}
                      {setCount === 1 ? "set" : "sets"}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState icon={IconInbox} title="Quiet week so far">
                  You haven't saved a session this week yet. Log one and your
                  muscle group split will show up here.
                </EmptyState>
              )}

              <h2>Personal bests</h2>
              <div className="data-list">
                {stats.personalBests.map((pb) => (
                  <div className="data-row" key={pb.exercise}>
                    <span className="data-name">
                      {pb.exercise}
                      <span className="data-sub">First lifted {pb.date}</span>
                    </span>
                    <span className="data-value pill">{pb.weight_kg} kg</span>
                  </div>
                ))}
              </div>

              <h2>Stalled lifts</h2>
              {stats.stalledLifts.length === 0 ? (
                <EmptyState icon={IconCheck} title="Nothing stalled">
                  A lift shows up here when its top weight stays the same for 3
                  weeks in a row.
                </EmptyState>
              ) : (
                <div>
                  {stats.stalledLifts.map((lift) => (
                    <div className="stalled" key={lift.exercise}>
                      {IconAlert}
                      <span>
                        <strong>{lift.exercise}</strong> has been stuck at{" "}
                        {lift.weight_kg}kg for {lift.weeks} weeks in a row.
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <h2>Days since last trained</h2>
              <div className="data-list">
                {stats.daysSince.map((item) => (
                  <div className="data-row" key={item.exercise}>
                    <span className="data-name">{item.exercise}</span>
                    <span className="data-value muted">
                      {item.days} {item.days === 1 ? "day" : "days"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ---------------- Report ---------------- */}

      {tab === "report" && (
        <section className="stack">
          {!hasSessions ? (
            <EmptyState icon={IconSparkle} title="No report yet">
              Once you've saved a session or two, you can generate a weekly
              coach report on how your training is going.
            </EmptyState>
          ) : (
            <>
              <h2>Weekly coach report</h2>

              <button
                className="btn block"
                onClick={handleReport}
                disabled={reportLoading}
              >
                {reportLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Writing report...
                  </>
                ) : report ? (
                  "Regenerate report"
                ) : (
                  "Generate report"
                )}
              </button>

              {reportLoading && (
                <div className="loading-panel" aria-live="polite">
                  <span className="loading-label">
                    <span className="spinner" aria-hidden="true" />
                    Looking over your last few weeks
                  </span>
                  <div className="skeleton" />
                  <div className="skeleton w92" />
                  <div className="skeleton w74" />
                </div>
              )}

              {reportError && (
                <div className="banner error" role="alert">
                  {IconAlert}
                  <span>{reportError}</span>
                </div>
              )}

              {report && (
                <div className="report">
                  <p className="report-summary">{report.summary}</p>

                  <div className="report-block">
                    <h3>Progress</h3>
                    <ul>
                      {report.progress.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="report-block flags">
                    <h3>Flags</h3>
                    {report.flags.length === 0 ? (
                      <p className="report-none">Nothing to flag this week.</p>
                    ) : (
                      <ul>
                        {report.flags.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="report-block">
                    <h3>Next week</h3>
                    <ul>
                      {report.suggestions.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
