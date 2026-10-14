import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  
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
        keys: makeCacheableSignalKeyStore(state.keys, console.log),
      },
      printQRInTerminal: false,
      browser: ["SUFI-KING-MD", "Chrome", "1.0"],
      logger: { level: "silent" },
    });

    sock.ev.on("creds.update", saveCreds);

    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 30000);
      
      sock.ev.on("connection.update", (update) => {
        if (update.qr) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(cleanNum);
      // Clean up after 1 min
      setTimeout(() => {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      }, 60000);
      
      return res.status(200).json({ code: code, status: "success" });
    } else {
      return res.status(400).json({ error: "Already registered" });
    }

  } catch (error) {
    console.log(error);
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    return res.status(200).json({ 
      code: null, 
      error: error.message,
      note: "Try again, WhatsApp server busy"
    });
  }
      }
