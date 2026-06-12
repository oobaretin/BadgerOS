export function isVercelDeployment(): boolean {
  return process.env.VERCEL === "1";
}

export function getKeySetupHint(keyName?: string): string {
  const label = keyName ? `\`${keyName}\`` : "API keys";
  if (isVercelDeployment()) {
    return `Add ${label} in Vercel → Project Settings → Environment Variables, then redeploy.`;
  }
  return `Add ${label} to .env.local, then restart with npm run dev -- --clean.`;
}

export function getDeploymentInfo() {
  return {
    platform: isVercelDeployment() ? ("vercel" as const) : ("local" as const),
    keySetupHint: getKeySetupHint(),
  };
}
