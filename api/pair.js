export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  try {
    const number = (req.query.number || '').replace(/[^0-9]/g,'');
    if(!number) return res.status(200).json({error:'Number do bhai'});

    const Baileys = await import('@whiskeysockets/baileys');
    const makeWASocket = Baileys.default;
    const { useMultiFileAuthState } = Baileys;
    const pino = (await import('pino')).default;

    const { state, saveCreds } = await useMultiFileAuthState('/tmp/'+number);
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({level:'silent'}),
      browser: ['SUFII-KING-MD','Chrome','1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);
    await new Promise(r=>setTimeout(r,2000));

    const code = await sock.requestPairingCode(number);
    return res.status(200).json({code: code});
