const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

module.exports = async (req, res) => {
  const number = req.query.number?.replace(/[^0-9]/g,'');
  if(!number) return res.status(400).json({error:'Number do'});
  try {
    const { state, saveCreds } = await useMultiFileAuthState('/tmp/'+number);
    const sock = makeWASocket({ auth: state, printQRInTerminal:false, logger: require('pino')({level:'silent'}) });
    sock.ev.on('creds.update', saveCreds);
    if(!sock.authState.creds.registered){
      await new Promise(r=>setTimeout(r,1000));
      const code = await sock.requestPairingCode(number);
      res.json({code});
    } else {
      res.json({error:'Already registered'});
    }
  } catch(e){
    res.status(500).json({error:e.message});
  }
};
