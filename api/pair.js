import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason } from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { number } = req.body;
  if (!number) return res.status(400).json({ error: "Number required" });

  const cleanNum = number.replace(/[^0-9]/g, "");
  const tempDir = `/tmp/${cleanNum}_${Date.now()}`;
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(tempDir);
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }).child({})),
      },
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Chrome", "Chrome", "110.0.5585.95"],
      syncFullHistory: false,
    });

    sock.ev.on("creds.update", saveCreds);

    // 3 second wait karo taake socket ready ho
    await new Promise(r => setTimeout(r, 3000));

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(cleanNum);
      
      // IMPORTANT: Socket ko 90 sec zinda rakho taake WhatsApp link ho sake
      await new Promise(r => setTimeout(r, 10000));
      
      // Code bhejo lekin socket background me chalta rahega 60 sec tak
      res.status(200).json({ code: code });
      
      // 90 sec baad folder delete
      setTimeout(() => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }, 90000);
      
      return;
    }
  } catch (e) {
    console.log(e);
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return res.status(200).json({ error: e.message });
  }
}
