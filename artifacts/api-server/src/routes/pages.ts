import { Router } from "express";
import { readFileSync } from "fs";
import { join } from "path";

const router = Router();

const html = (title: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — PC Monitor & Control</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0b1120;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 0 16px 60px;
    }
    header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 32px 0 28px;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 40px;
    }
    .logo {
      width: 48px; height: 48px;
      background: #f97316;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
    }
    .brand { font-size: 20px; font-weight: 700; color: #f1f5f9; }
    .brand span { color: #f97316; }
    main { max-width: 720px; margin: 0 auto; }
    h1 { font-size: 32px; font-weight: 800; color: #f1f5f9; margin-bottom: 8px; }
    .updated { font-size: 13px; color: #64748b; margin-bottom: 36px; }
    h2 { font-size: 18px; font-weight: 700; color: #f97316; margin: 32px 0 10px; }
    p { font-size: 15px; line-height: 1.75; color: #94a3b8; margin-bottom: 12px; }
    ul { padding-left: 20px; margin-bottom: 12px; }
    li { font-size: 15px; line-height: 1.75; color: #94a3b8; margin-bottom: 4px; }
    a { color: #f97316; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    footer {
      margin-top: 60px;
      text-align: center;
      font-size: 13px;
      color: #334155;
    }
    ${title === 'Feedback' ? `
    .btn {
      display: inline-block;
      background: #f97316;
      color: #fff;
      font-weight: 700;
      font-size: 15px;
      padding: 14px 28px;
      border-radius: 12px;
      text-decoration: none;
      margin-top: 8px;
      transition: opacity .15s;
    }
    .btn:hover { opacity: .85; text-decoration: none; }
    .option { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 20px; }
    .option-icon { font-size: 28px; flex-shrink: 0; margin-top: 2px; }
    .option-title { font-size: 16px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
    ` : ''}
  </style>
</head>
<body>
  <header>
    <div class="logo">🖥</div>
    <div>
      <div class="brand">PC Monitor <span>&amp;</span> Control</div>
    </div>
  </header>
  <main>${body}</main>
  <footer>© ${new Date().getFullYear()} PC Monitor &amp; Control. All rights reserved.</footer>
</body>
</html>`;

router.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(
    html(
      "Privacy Policy",
      `
      <h1>Privacy Policy</h1>
      <p class="updated">Last updated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

      <div class="card">
        <p>PC Monitor &amp; Control is designed with your privacy as a priority. <strong style="color:#f1f5f9">We do not collect, store, or transmit any personal data to any external server.</strong> Everything stays on your local network and your device.</p>
      </div>

      <h2>Information We Do NOT Collect</h2>
      <ul>
        <li>We do not collect your name, email address, or any personal identifiers.</li>
        <li>We do not send hardware metrics or PC data to any remote server.</li>
        <li>We do not use analytics, advertising SDKs, or third-party tracking.</li>
        <li>We do not access your camera, microphone, contacts, or location.</li>
      </ul>

      <h2>Local Data Storage</h2>
      <p>The app stores the following information <strong style="color:#f1f5f9">locally on your device only</strong>:</p>
      <ul>
        <li>PC connection details you enter (name, local IP address, port, optional API key).</li>
        <li>Your dashboard layout and card preferences.</li>
      </ul>
      <p>This data never leaves your device and is not shared with anyone.</p>

      <h2>Local Network Communication</h2>
      <p>The app communicates directly with PCs on your local WiFi network using HTTP. All communication is peer-to-peer between your phone and your PC — no data passes through our servers or any third-party servers.</p>

      <h2>Hardware Metrics</h2>
      <p>CPU usage, GPU stats, RAM, temperatures, disk usage, fan speeds, and network activity are read directly from your PC via the companion <code style="color:#f97316">pc_agent.py</code> script. This data is displayed in the app in real time and is never stored persistently or sent anywhere outside your local network.</p>

      <h2>Children's Privacy</h2>
      <p>This app is not directed at children under 13 and does not knowingly collect any information from children.</p>

      <h2>Changes to This Policy</h2>
      <p>If we make material changes to this privacy policy, we will update the date at the top of this page. We encourage you to review this policy periodically.</p>

      <h2>Contact</h2>
      <p>If you have any questions about this privacy policy, please reach out via our <a href="/feedback">feedback page</a>.</p>
    `
    )
  );
});

router.get("/feedback", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(
    html(
      "Feedback",
      `
      <h1>Share Your Feedback</h1>
      <p class="updated">We'd love to hear from you — bug reports, feature requests, or general thoughts.</p>

      <div class="option">
        <div class="option-icon">🐛</div>
        <div>
          <div class="option-title">Report a Bug</div>
          <p>Found something broken? Open an issue on GitHub and include your iOS version and a description of what happened.</p>
          <a class="btn" href="https://github.com/issues/new?labels=bug&template=bug_report.md" target="_blank">Open Bug Report</a>
        </div>
      </div>

      <div class="option">
        <div class="option-icon">💡</div>
        <div>
          <div class="option-title">Request a Feature</div>
          <p>Have an idea for a new card, sensor, or control? We want to hear it.</p>
          <a class="btn" href="https://github.com/issues/new?labels=enhancement&template=feature_request.md" target="_blank">Request a Feature</a>
        </div>
      </div>

      <div class="option">
        <div class="option-icon">💬</div>
        <div>
          <div class="option-title">General Discussion</div>
          <p>Questions, tips, or just want to say hi? Use the Discussions tab on GitHub.</p>
          <a class="btn" href="https://github.com/discussions" target="_blank">Start a Discussion</a>
        </div>
      </div>

      <div class="card" style="margin-top:40px">
        <p style="margin:0">⭐ <strong style="color:#f1f5f9">Enjoying the app?</strong> Please consider leaving a review on the App Store — it helps more people find PC Monitor &amp; Control.</p>
      </div>
    `
    )
  );
});

router.get("/app", (_req, res) => {
  try {
    const filePath = join(process.cwd(), "../../artifacts/github-page/index.html");
    const content = readFileSync(filePath, "utf-8");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(content);
  } catch {
    res.status(404).send("Page not found");
  }
});

export default router;
