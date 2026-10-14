import makeWASocket, { useMultiFileAuthState, delay, Browsers } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const number = req.method === "GET" ? req.query.number : req.body.number;
  
  if (!number) return res.status(400).json({ error: "Number missing! Example: ?number=923218076693" });

  const cleanNum = number.replace(/[^0-9]/g, "");
  const tempDir = `/tmp/${cleanNum}_${Date.now()}`;

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers.macOS("Chrome"),
    });

    if (!sock.authState.creds.registered) {
      await delay(1500);
      const code = await sock.requestPairingCode(cleanNum);
      await delay(2000);
      
      // cleanup
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      
      return res.status(200).json({ code: code });
    }
  } catch (e) {
    console.log(e);
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return res.status(500).json({ error: "Failed to get code, try again", details: e.message });
  }
}
