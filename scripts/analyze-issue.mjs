const ISSUE_TITLE = process.env.ISSUE_TITLE ?? "";
const ISSUE_BODY = process.env.ISSUE_BODY ?? "";
const IS_BOT = process.env.IS_BOT === "true";
const ISSUE_NUMBER = process.env.ISSUE_NUMBER ?? "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GITHUB_REPO = process.env.GITHUB_REPO ?? "dev-hann/openflow";

function parseErrorReport(body) {
  const fingerprintMatch = body.match(
    /<!-- openflow-error-report\s*fingerprint:\s*(\S+)/,
  );
  const platformMatch = body.match(/platform:\s*(\w+)/);
  return {
    fingerprint: fingerprintMatch?.[1],
    platform: platformMatch?.[1],
    hasStructuredData: !!fingerprintMatch,
  };
}

function extractFields(body) {
  const tableRows = body.matchAll(/\|\s*`?(\w[\w\s]*)`?\s*\|\s*(.+?)\s*\|/g);
  const fields = {};
  for (const [, key, value] of tableRows) {
    fields[key.trim()] = value.trim().replace(/^`|`$/g, "");
  }
  return fields;
}

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) {
    return "No OPENAI_API_KEY configured. Skipping AI analysis.";
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a software debugging assistant. Analyze errors and issues for a TypeScript/Flutter/React project called OpenFlow. Be concise and actionable.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "Analysis unavailable.";
  } catch (err) {
    return `AI analysis failed: ${err.message}`;
  }
}

async function analyzeAutoReport(title, body) {
  const fields = extractFields(body);
  const stackMatch = body.match(/```\n([\s\S]*?)\n```/);
  const stackTrace = stackMatch?.[1] ?? "";

  const prompt = `Analyze this runtime error from OpenFlow:

Error Code: ${fields["Error Code"] ?? "unknown"}
Platform: ${fields["Platform"] ?? "unknown"}
Version: ${fields["Version"] ?? "unknown"}
Message: ${fields["Message"] ?? title}
${stackTrace ? `Stack Trace:\n${stackTrace}` : ""}

Provide:
1. **Root Cause**: Most likely cause of this error
2. **Affected Code**: Which files/modules are likely involved
3. **Suggested Fix**: How to resolve this
4. **Severity**: critical, high, medium, or low
5. **Potential Root Causes**: List issue numbers if this might be caused by another known issue (format: #123)

Keep the response under 500 words.`;

  return callOpenAI(prompt);
}

async function analyzeManualIssue(title, body) {
  const prompt = `Analyze this user-reported issue for OpenFlow (a personal AI assistant built with TypeScript server, Flutter app, React web):

Title: ${title}
Description: ${body || "No description provided."}

Provide:
1. **Summary**: Brief summary of the issue
2. **Category**: bug, feature-request, question, or other
3. **Affected Area**: Which part of the system is likely involved (server/app/web/agent/llm/tools/etc)
4. **Suggested Investigation**: Where to start looking
5. **Severity**: critical, high, medium, or low

Keep the response under 500 words.`;

  return callOpenAI(prompt);
}

async function main() {
  if (IS_BOT) {
    const report = parseErrorReport(ISSUE_BODY);
    if (!report.hasStructuredData) {
      console.log(
        "Issue created by Bot but missing structured error data. Treating as manual issue.",
      );
      const analysis = await analyzeManualIssue(ISSUE_TITLE, ISSUE_BODY);
      console.log(analysis);
      return;
    }
    const analysis = await analyzeAutoReport(ISSUE_TITLE, ISSUE_BODY);
    console.log(analysis);
  } else {
    const analysis = await analyzeManualIssue(ISSUE_TITLE, ISSUE_BODY);
    console.log(analysis);
  }
}

main().catch((err) => {
  console.error(`Analysis failed: ${err.message}`);
  process.exit(1);
});
