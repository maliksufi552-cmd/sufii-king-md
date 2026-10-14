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
  const tempDir = `/tmp/${cleanNum}-${Date.now()}`;

  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers.ubuntu("Chrome"),
      syncFullHistory: false,
    });
    
    sock.ev.on("creds.update", saveCreds);
    
    // Vercel pe thora wait zaroori hai warna Couldn't link aata hai
    await delay(4000);
    
    if (!sock.authState.creds.registered) {
        let code = await sock.requestPairingCode(cleanNum);
        // Code me - hata do taa k jaldi lag jaye
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        res.status(200).json({ code: code });
    }

    sock.ev.on("connection.update", async (u) => {
      if (u.connection === "open") {
        await delay(5000);
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        try { sock.end(); } catch {}
      }
    });

  } catch (e) {
    console.log(e)
    if (!res.headersSent) res.status(500).json({ error: e.message });
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}
