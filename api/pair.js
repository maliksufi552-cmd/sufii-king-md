import makeWASocket, { useMultiFileAuthState, delay, Browsers } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  let number = req.query.number || req.body?.number;
  if (!number) return res.status(400).json({ error: "Number missing" });
  
  const cleanNum = number.replace(/[^0-9]/g, "");
  const tempDir = `/tmp/${cleanNum}`;

  if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers.macOS("Desktop"),
    });
    sock.ev.on("creds.update", saveCreds);
    await delay(1500);
    let code = await sock.requestPairingCode(cleanNum);
    res.status(200).json({ code: code });

    sock.ev.on("connection.update", async (u) => {
      if (u.connection === "open") {
        await delay(3000);
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        try { sock.end(); } catch {}
      }
    });

  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
}
