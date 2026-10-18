import { useState } from "react";
import "./App.css";

const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

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

export default function App() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exercises, setExercises] = useState([]);

  function handleFileChange(event) {
    const chosen = event.target.files[0];
    setError("");
    setExercises([]);

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
    setExercises([]);

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

      setExercises(data.exercises);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

      {exercises.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Exercise</th>
              <th>kg</th>
              <th>Sets</th>
              <th>Reps</th>
            </tr>
          </thead>
          <tbody>
            {exercises.map((item, index) => (
              <tr key={index} className={item.needs_review ? "review" : ""}>
                <td>
                  {item.exercise}
                  {item.needs_review && (
                    <span className="problems">
                      Check this row: {item.problems.join(", ")}
                    </span>
                  )}
                </td>
                <td>{item.weight_kg}</td>
                <td>{item.sets}</td>
                <td>{item.reps_per_set.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}