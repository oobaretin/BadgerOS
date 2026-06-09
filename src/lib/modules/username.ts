import { fetchJson } from "@/lib/fetchExternal";

const PLATFORMS = [
  {
    name: "GitHub",
    url: (u: string) => `https://api.github.com/users/${u}`,
    profile: (u: string) => `https://github.com/${u}`,
    check: (r: { login?: string }) => !!r.login,
  },
  {
    name: "Reddit",
    url: (u: string) => `https://www.reddit.com/user/${u}/about.json`,
    profile: (u: string) => `https://www.reddit.com/user/${u}`,
    check: (r: { data?: { name?: string } }) => !!r.data?.name,
  },
  {
    name: "Dev.to",
    url: (u: string) => `https://dev.to/api/users/by_username?url=${u}`,
    profile: (u: string) => `https://dev.to/${u}`,
    check: (r: { username?: string }) => !!r.username,
  },
  {
    name: "HackerNews",
    url: (u: string) => `https://hacker-news.firebaseio.com/v0/user/${u}.json`,
    profile: (u: string) => `https://news.ycombinator.com/user?id=${u}`,
    check: (r: { id?: string } | null) => !!r?.id,
  },
];

const HEAD_PLATFORMS = [
  { name: "Twitter", url: (u: string) => `https://twitter.com/${u}` },
  { name: "Instagram", url: (u: string) => `https://www.instagram.com/${u}` },
  { name: "TikTok", url: (u: string) => `https://www.tiktok.com/@${u}` },
  { name: "LinkedIn", url: (u: string) => `https://www.linkedin.com/in/${u}` },
  { name: "Pinterest", url: (u: string) => `https://www.pinterest.com/${u}` },
  { name: "Twitch", url: (u: string) => `https://www.twitch.tv/${u}` },
  { name: "Medium", url: (u: string) => `https://medium.com/@${u}` },
  { name: "Keybase", url: (u: string) => `https://keybase.io/${u}` },
  { name: "Gitlab", url: (u: string) => `https://gitlab.com/${u}` },
  { name: "Steam", url: (u: string) => `https://steamcommunity.com/id/${u}` },
];

export async function runUsernameIntel(query: string) {
  const apiChecks = await Promise.allSettled(
    PLATFORMS.map(async (p) => {
      const res = await fetchJson(p.url(query), {
        headers: { "User-Agent": "BadgerOS-Personal" },
      });
      const data = res.data;
      return {
        platform: p.name,
        found: p.check(data as Record<string, unknown>),
        url: p.profile(query),
        verification: "api" as const,
        data,
      };
    })
  );

  const headChecks = await Promise.allSettled(
    HEAD_PLATFORMS.map(async (p) => {
      const url = p.url(query);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          headers: { "User-Agent": "BadgerOS-Personal" },
          signal: controller.signal,
        });
        return {
          platform: p.name,
          found: res.status === 200,
          url,
          verification: "head" as const,
        };
      } catch {
        return {
          platform: p.name,
          found: false,
          url,
          verification: "head" as const,
          error: "Request failed or timed out",
        };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  return {
    source: "Username Lookup",
    username: query,
    verified: apiChecks
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value),
    detected: headChecks
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value),
  };
}
