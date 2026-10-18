const stats = {
  thisWeek: {
    sessionCount: 1,
    totalSets: 6,
    volumeKg: 2530,
    setsByMuscle: { chest: 4, biceps: 2 },
  },
  personalBests: [
    { exercise: "Chest fly", weight_kg: 22, date: "2026-10-18" },
    { exercise: "Dumbbell Curl", weight_kg: 45, date: "2026-10-18" },
    { exercise: "Incline Bench Press", weight_kg: 70, date: "2026-10-18" },
  ],
  stalledLifts: [],
  daysSince: [
    { exercise: "Chest fly", days: 0 },
    { exercise: "Dumbbell Curl", days: 0 },
    { exercise: "Incline Bench Press", days: 0 },
  ],
};

const response = await fetch("http://localhost:3000/api/report", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ stats }),
});

const data = await response.json();
console.log(response.status);
console.log(JSON.stringify(data, null, 2));