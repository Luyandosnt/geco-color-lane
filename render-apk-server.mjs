import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.env.PORT || 10000);
const apkName = 'Inshimu-Origins-debug.apk';
const apkPath = join(process.cwd(), 'public', apkName);
const checksumPath = `${apkPath}.sha256`;

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Inshimu Origins APK</title>
  <style>
    :root { color-scheme: dark; font-family: Arial, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #08120d; color: #fff; }
    main { width: min(88vw, 440px); padding: 32px; border: 1px solid #324b3b; border-radius: 20px; background: #102119; text-align: center; box-shadow: 0 20px 70px #0008; }
    h1 { margin: 0 0 8px; }
    p { color: #bcd0c2; line-height: 1.5; }
    a.button { display: block; margin-top: 24px; padding: 16px 18px; border-radius: 14px; background: #f2c94c; color: #17130a; text-decoration: none; font-weight: 800; }
    a.secondary { display: inline-block; margin-top: 18px; color: #a7d9b7; }
    small { display: block; margin-top: 24px; color: #809589; }
  </style>
</head>
<body>
  <main>
    <h1>Inshimu Origins</h1>
    <p>Android internal testing build generated from the latest deployed GitHub commit.</p>
    <a class="button" href="/download">Download APK</a>
    <a class="secondary" href="/checksum">View SHA-256 checksum</a>
    <small>Android may ask you to allow installation from this browser.</small>
  </main>
</body>
</html>`;

function sendFile(res, path, contentType, downloadName) {
  if (!existsSync(path)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build file not found.');
    return;
  }

  const headers = {
    'Content-Type': contentType,
    'Content-Length': statSync(path).size,
    'Cache-Control': 'no-store',
  };
  if (downloadName) headers['Content-Disposition'] = `attachment; filename="${downloadName}"`;
  res.writeHead(200, headers);
  createReadStream(path).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/healthz') {
    res.writeHead(existsSync(apkPath) ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: existsSync(apkPath), apk: apkName }));
    return;
  }

  if (url.pathname === '/download' || url.pathname === `/${apkName}`) {
    sendFile(res, apkPath, 'application/vnd.android.package-archive', apkName);
    return;
  }

  if (url.pathname === '/checksum') {
    sendFile(res, checksumPath, 'text/plain; charset=utf-8');
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(page);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Inshimu APK server listening on 0.0.0.0:${port}`);
});
