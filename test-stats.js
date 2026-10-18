import { computeStats, muscleGroupOf } from "./web/src/stats.js";

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    console.log(`FAIL: ${label}`);
    console.log("  expected:", JSON.stringify(expected));
    console.log("  actual:  ", JSON.stringify(actual));
  }
}

// --- Muscle groups, using the names from your own notes ---
const groups = [
  ["Inclined smith press", "chest"],
  ["Incline Bench Press", "chest"],
  ["Chest fly", "chest"],
  ["Lateral raises", "shoulders"],
  ["wide bar lat pulldown", "back"],
  ["Chest supported wide grip row", "back"],
  ["Preacher curls", "biceps"],
  ["Dumbbell Curl", "biceps"],
  ["Over heat triceps extension", "triceps"],
  ["Squat", "legs"],
];
for (const [name, expected] of groups) {
  check(`muscle group of ${name}`, muscleGroupOf(name), expected);
}

// --- Made-up sessions (dates are in local time) ---
const sessions = [
  {
    date: "2026-09-28T10:00:00",
    exercises: [
      { exercise: "Bench Press", weight_kg: 60, sets: 3, reps_per_set: [8, 8, 8] },
      { exercise: "Dumbbell Curl", weight_kg: 20, sets: 2, reps_per_set: [10, 10] },
    ],
  },
  {
    date: "2026-10-05T10:00:00",
    exercises: [
      { exercise: "Bench Press", weight_kg: 60, sets: 3, reps_per_set: [8, 8, 8] },
      { exercise: "Dumbbell Curl", weight_kg: 22, sets: 2, reps_per_set: [10, 10] },
    ],
  },
  {
    date: "2026-10-12T10:00:00",
    exercises: [
      { exercise: "Bench Press", weight_kg: 60, sets: 3, reps_per_set: [8, 8, 8] },
      { exercise: "Squat", weight_kg: 80, sets: 2, reps_per_set: [5, 5] },
    ],
  },
  {
    date: "2026-10-15T10:00:00",
    exercises: [
      { exercise: "Dumbbell Curl", weight_kg: 22, sets: 2, reps_per_set: [10, 12] },
      { exercise: "Lateral raises", weight_kg: 10, sets: 3, reps_per_set: [12, 12, 12] },
    ],
  },
];

// Pretend today is Sunday 18 October 2026
const stats = computeStats(sessions, new Date("2026-10-18T12:00:00"));

// --- This week (Monday 12 Oct to Sunday 18 Oct) ---
check("sessions this week", stats.thisWeek.sessionCount, 2);
check("total sets this week", stats.thisWeek.totalSets, 10);
check("volume this week", stats.thisWeek.volumeKg, 3084);
check("chest sets", stats.thisWeek.setsByMuscle.chest, 3);
check("legs sets", stats.thisWeek.setsByMuscle.legs, 2);
check("biceps sets", stats.thisWeek.setsByMuscle.biceps, 2);
check("shoulders sets", stats.thisWeek.setsByMuscle.shoulders, 3);

// --- Personal bests (weight, and the first day it was lifted) ---
const pbs = [
  ["Bench Press", [60, "2026-09-28"]],
  ["Dumbbell Curl", [22, "2026-10-05"]],
  ["Squat", [80, "2026-10-12"]],
  ["Lateral raises", [10, "2026-10-15"]],
];
for (const [name, expected] of pbs) {
  const pb = stats.personalBests.find((p) => p.exercise === name);
  check(`personal best for ${name}`, pb && [pb.weight_kg, pb.date], expected);
}

// --- Stalled lifts: only Bench Press has been 60kg for 3 weeks ---
check(
  "stalled lifts",
  stats.stalledLifts.map((s) => [s.exercise, s.weight_kg, s.weeks]),
  [["Bench Press", 60, 3]]
);

// --- Days since last trained ---
const days = Object.fromEntries(stats.daysSince.map((d) => [d.exercise, d.days]));
check("days since Bench Press", days["Bench Press"], 6);
check("days since Squat", days["Squat"], 6);
check("days since Dumbbell Curl", days["Dumbbell Curl"], 3);
check("days since Lateral raises", days["Lateral raises"], 3);

console.log(`${passed} passed, ${failed} failed`);