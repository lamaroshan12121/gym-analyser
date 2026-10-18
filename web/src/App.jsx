import { useState } from "react";
import "./App.css";

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

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [sessions, setSessions] = useState(loadSessions);
  const [savedMessage, setSavedMessage] = useState("");

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
    }
  }

  return (
    <div className="app">
      <h1>Gym Log Analyser</h1>
      <p className="subtitle">Upload a screenshot of your workout notes.</p>

      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
      />

      {previewUrl && (
        <img className="preview" src={previewUrl} alt="Your workout notes" />
      )}

      <button onClick={handleRead} disabled={!file || loading}>
        {loading ? "Reading..." : "Read screenshot"}
      </button>

      {error && <div className="error">{error}</div>}
      {savedMessage && <div className="success">{savedMessage}</div>}

      {showEditor && (
        <div>
          <p className="hint">
            Check the numbers against your note and fix anything that's wrong.
          </p>

          <table>
            <thead>
              <tr>
                <th>Exercise</th>
                <th>kg</th>
                <th>Sets</th>
                <th>Reps</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const problems = validateRow(row);
                return (
                  <tr key={row.id} className={problems.length > 0 ? "review" : ""}>
                    <td>
                      <input
                        type="text"
                        value={row.exercise}
                        onChange={(e) => updateRow(row.id, "exercise", e.target.value)}
                      />
                      {problems.length > 0 && (
                        <span className="problems">
                          Check this row: {problems.join(", ")}
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        className="narrow"
                        type="number"
                        step="0.5"
                        value={row.weight}
                        onChange={(e) => updateRow(row.id, "weight", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="narrow"
                        type="number"
                        value={row.sets}
                        onChange={(e) => updateRow(row.id, "sets", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="reps"
                        type="text"
                        value={row.reps}
                        onChange={(e) => updateRow(row.id, "reps", e.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        className="small danger"
                        onClick={() => deleteRow(row.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="actions">
            <button className="secondary" onClick={addRow}>
              Add row
            </button>
            <button onClick={handleSave} disabled={!canSave}>
              Save session
            </button>
          </div>
        </div>
      )}

      <h2>Saved sessions</h2>
      {sessions.length === 0 ? (
        <p className="subtitle">None yet.</p>
      ) : (
        sessions.map((session) => (
          <div className="session" key={session.id}>
            <div>
              <strong>{new Date(session.date).toLocaleString()}</strong>
              <span className="session-names">
                {session.exercises.map((item) => item.exercise).join(", ")}
              </span>
            </div>
            <button
              className="small danger"
              onClick={() => handleDeleteSession(session.id)}
            >
              Delete
            </button>
          </div>
        ))
      )}
    </div>
  );
}