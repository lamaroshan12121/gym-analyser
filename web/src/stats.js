// A lift counts as "stalled" if its top weight has been the same
// for this many weeks in a row (only weeks you trained it are counted)
const STALL_WEEKS = 3;

// Which muscle group an exercise belongs to.
// Groups are checked in this order, and the first match wins.
// Add your own keywords here over time.
const muscleRules = [
  ["legs", [/\bsquat/, /\bleg/, /\blunge/, /\bcalf/, /\bcalves/, /\bhamstring/, /\bquad/, /\bglute/, /\bhip thrust/]],
  ["triceps", [/\btricep/, /\bpushdown/, /\bskull/]],
  ["biceps", [/\bbicep/, /\bcurl/]],
  ["back", [/\brows?\b/, /\bpulldown/, /\bpull-?ups?\b/, /\bchin-?ups?\b/, /\bdeadlift/, /\blat pull/]],
  ["shoulders", [/\blateral/, /\bshoulder/, /\boverhead press/, /\bohp\b/, /\bfront raise/, /\brear delt/, /\bface pull/]],
  ["chest", [/\bbench/, /\bincline/, /\bchest/, /\bpec/, /\bfly/]],
];

export function muscleGroupOf(exerciseName) {
  const name = exerciseName.toLowerCase();
  for (const [group, patterns] of muscleRules) {
    if (patterns.some((pattern) => pattern.test(name))) {
      return group;
    }
  }
  return "other";
}

function sum(numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

// Midnight (local time) at the start of a date
function dayStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Midnight on the Monday of the week containing this date
function weekStart(date) {
  const d = dayStart(date);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

// "2026-10-12"
function dateLabel(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// sessions: the saved sessions list. now: lets the test script pretend it's a different day.
export function computeStats(sessions, now = new Date()) {
  const thisWeekKey = weekStart(now).getTime();

  // One flat list of every exercise from every session, oldest first
  const entries = [];
  for (const session of sessions) {
    for (const item of session.exercises) {
      entries.push({
        key: item.exercise.trim().toLowerCase(),
        name: item.exercise.trim(),
        date: new Date(session.date),
        weight: item.weight_kg,
        sets: item.sets,
        reps: item.reps_per_set,
      });
    }
  }
  entries.sort((a, b) => a.date - b.date);

  // --- This week ---
  const sessionCount = sessions.filter(
    (session) => weekStart(session.date).getTime() === thisWeekKey
  ).length;

  const setsByMuscle = {};
  let totalSets = 0;
  let volumeKg = 0;

  for (const entry of entries) {
    if (weekStart(entry.date).getTime() !== thisWeekKey) continue;

    const group = muscleGroupOf(entry.name);
    setsByMuscle[group] = (setsByMuscle[group] || 0) + entry.sets;
    totalSets += entry.sets;
    volumeKg += entry.weight * sum(entry.reps);
  }

  // --- Per-exercise stats ---
  const byExercise = new Map();
  for (const entry of entries) {
    if (!byExercise.has(entry.key)) byExercise.set(entry.key, []);
    byExercise.get(entry.key).push(entry);
  }

  const personalBests = [];
  const stalledLifts = [];
  const daysSince = [];

  for (const list of byExercise.values()) {
    const name = list[list.length - 1].name; // most recent spelling

    // Personal best: heaviest weight, and the first day it was lifted
    let best = list[0];
    for (const entry of list) {
      if (entry.weight > best.weight) best = entry;
    }
    personalBests.push({
      exercise: name,
      weight_kg: best.weight,
      date: dateLabel(best.date),
    });

    // Heaviest weight in each week this exercise was trained
    const topByWeek = new Map();
    for (const entry of list) {
      const weekKey = weekStart(entry.date).getTime();
      topByWeek.set(weekKey, Math.max(topByWeek.get(weekKey) ?? 0, entry.weight));
    }
    const weeklyTops = [...topByWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, weight]) => weight);

    // Count back from the latest week while the top weight stays the same
    const latest = weeklyTops[weeklyTops.length - 1];
    let streak = 0;
    for (let i = weeklyTops.length - 1; i >= 0 && weeklyTops[i] === latest; i--) {
      streak++;
    }
    if (streak >= STALL_WEEKS) {
      stalledLifts.push({ exercise: name, weight_kg: latest, weeks: streak });
    }

    // Days since this exercise was last trained
    const lastDate = list[list.length - 1].date;
    const days = Math.round((dayStart(now) - dayStart(lastDate)) / 86400000);
    daysSince.push({ exercise: name, days });
  }

  personalBests.sort((a, b) => a.exercise.localeCompare(b.exercise));
  daysSince.sort((a, b) => b.days - a.days); // longest ago first

  return {
    thisWeek: { sessionCount, totalSets, volumeKg, setsByMuscle },
    personalBests,
    stalledLifts,
    daysSince,
  };
}