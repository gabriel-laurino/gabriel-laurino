import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const login = "gabriel-laurino";
const token = process.env.GITHUB_TOKEN;
const output = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/activity.svg");

if (!token) {
  throw new Error("GITHUB_TOKEN is required to refresh the activity artwork.");
}

const query = `query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
      totalCount
      nodes { isFork stargazerCount name }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "gabriel-laurino-profile-artwork",
  },
  body: JSON.stringify({ query, variables: { login } }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL returned HTTP ${response.status}`);
}

const payload = await response.json();
if (payload.errors?.length || !payload.data?.user) {
  throw new Error(`GitHub GraphQL data unavailable: ${JSON.stringify(payload.errors ?? [])}`);
}

const user = payload.data.user;
const calendar = user.contributionsCollection.contributionCalendar;
const weeks = calendar.weeks;
if (weeks.length < 50 || weeks.length > 54) {
  throw new Error(`Unexpected contribution calendar length: ${weeks.length}`);
}

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[char]);

const count = calendar.totalContributions;
const publicRepos = user.repositories.totalCount;
const originalApps = user.repositories.nodes.filter((repo) => !repo.isFork && repo.name !== login).length;
const updated = weeks.at(-1).contributionDays.at(-1).date;
const cell = 12;
const gap = 5;
const gridX = 78;
const gridY = 190;
const levels = ["#173243", "#1b666e", "#248f8d", "#46c6ac", "#8bf4ce"];
const levelFor = (value) => value === 0 ? 0 : value >= 8 ? 4 : value >= 5 ? 3 : value >= 3 ? 2 : 1;

const squares = weeks.flatMap((week, x) => week.contributionDays.map((day, y) =>
  `<rect x="${gridX + x * (cell + gap)}" y="${gridY + y * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${levels[levelFor(day.contributionCount)]}"><title>${escapeXml(day.date)}: ${day.contributionCount} contributions</title></rect>`,
)).join("\n    ");

const labels = [];
let lastMonth = -1;
for (let x = 0; x < weeks.length; x++) {
  const day = weeks[x].contributionDays[0];
  const date = new Date(`${day.date}T12:00:00Z`);
  const month = date.getUTCMonth();
  if (month !== lastMonth) {
    const label = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date).toUpperCase();
    labels.push(`<text x="${gridX + x * (cell + gap)}" y="178" fill="#8caab8" font-family="Arial,sans-serif" font-size="12" letter-spacing="1">${label}</text>`);
    lastMonth = month;
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 365" role="img" aria-labelledby="title desc">
  <title id="title">Gabriel's GitHub activity</title>
  <desc id="desc">${count} contributions over the last year, ${publicRepos} public repositories and ${originalApps} original applications. Updated ${updated}.</desc>
  <defs>
    <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0a1826"/><stop offset="1" stop-color="#102734"/></linearGradient>
    <linearGradient id="edge"><stop stop-color="#57ddec"/><stop offset=".5" stop-color="#7cf3cd"/><stop offset="1" stop-color="#6f9fff"/></linearGradient>
    <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#8fe1e9" stroke-opacity=".04"/></pattern>
  </defs>
  <rect width="1100" height="365" rx="20" fill="url(#bg)"/>
  <rect width="1100" height="365" rx="20" fill="url(#grid)"/>
  <text x="40" y="43" fill="#79ece2" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="3">CODE IN MOTION</text>
  <text x="40" y="102" fill="#f0fbfd" font-family="Arial,sans-serif" font-size="48" font-weight="800">${count}</text>
  <text x="154" y="94" fill="#b8d4db" font-family="Arial,sans-serif" font-size="17">contributions</text>
  <text x="154" y="117" fill="#829eaa" font-family="Arial,sans-serif" font-size="13">in the last year</text>
  <path d="M340 65V122M532 65V122" stroke="#31515d"/>
  <text x="366" y="90" fill="#eff9fc" font-family="Arial,sans-serif" font-size="29" font-weight="700">${publicRepos}</text>
  <text x="366" y="116" fill="#9bb9c3" font-family="Arial,sans-serif" font-size="13">public repos</text>
  <text x="558" y="90" fill="#eff9fc" font-family="Arial,sans-serif" font-size="29" font-weight="700">${originalApps}</text>
  <text x="558" y="116" fill="#9bb9c3" font-family="Arial,sans-serif" font-size="13">original apps</text>
  <text x="1060" y="90" text-anchor="end" fill="#8eabb6" font-family="Consolas,monospace" font-size="13">PUBLIC ACTIVITY</text>
  <path d="M40 146H1060" stroke="#345361"/>
  ${labels.join("\n  ")}
  <text x="39" y="201" fill="#849eaa" font-family="Arial,sans-serif" font-size="12">MON</text>
  <text x="39" y="235" fill="#849eaa" font-family="Arial,sans-serif" font-size="12">WED</text>
  <text x="39" y="269" fill="#849eaa" font-family="Arial,sans-serif" font-size="12">FRI</text>
  ${squares}
  <text x="40" y="337" fill="#829eaa" font-family="Arial,sans-serif" font-size="12">GENERATED FROM GITHUB · ${escapeXml(updated)}</text>
  <text x="1060" y="337" text-anchor="end" fill="#829eaa" font-family="Arial,sans-serif" font-size="12">LESS</text>
  ${levels.map((color, i) => `<rect x="${956 + i * 17}" y="326" width="12" height="12" rx="3" fill="${color}"/>`).join("")}
  <rect x="1" y="1" width="1098" height="363" rx="19" fill="none" stroke="url(#edge)" stroke-opacity=".35" stroke-width="2"/>
</svg>\n`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, svg, "utf8");
console.log(`Updated ${output}: ${count} contributions, ${publicRepos} repositories, ${originalApps} original apps.`);
