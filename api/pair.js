import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { number } = req.body;
  if (!number) {
    return res.status(400).json({ error: "Number required" });
  }

  const cleanNum = number.replace(/[^0-9]/g, "");
  const tempDir = `/tmp/${cleanNum}_${Date.now()}`;

  try {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({level:"silent"}).child({})),
      },
      printQRInTerminal: false,
      browser: ["SUFI-KING-MD", "Chrome", "1.0"],
      logger: pino({ level: "silent" }),
    });

    sock.ev.on("creds.update", saveCreds);

    if (!sock.authState.creds.registered) {
      await new Promise(r => setTimeout(r, 1000));
      const code = await sock.requestPairingCode(cleanNum);
      
      setTimeout(() => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }, 60000);
      
      return res.status(200).json({ code: code });
    } else {
      return res.status(400).json({ error: "Already registered" });
    }

  } catch (error) {
    console.log(error);
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return res.status(200).json({ error: error.message });
  }
}
