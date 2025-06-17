import express from 'express';
import fs from 'fs';
import axios from 'axios';
import { exec } from 'child_process';
import pino from 'pino';
import { 
  default as makeWASocket, 
  useMultiFileAuthState, 
  delay, 
  makeCacheableSignalKeyStore, 
  Browsers,
  jidNormalizedUser 
} from '@whiskeysockets/baileys';
import multer from 'multer';
import path from 'path';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

function removeFile(FilePath) {
  if (fs.existsSync(FilePath)) {
    fs.rmSync(FilePath, { recursive: true, force: true });
  }
}

// Pair route
router.get('/', async (req, res) => {
  let num = req.query.number;

  async function PrabathPair() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    try {
      let PrabathPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' })),
        },
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
        browser: Browsers.macOS('Safari'),
      });

      if (!PrabathPairWeb.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await PrabathPairWeb.requestPairingCode(num);
        if (!res.headersSent) {
          await res.send({ code });
        }
      }

      PrabathPairWeb.ev.on('creds.update', saveCreds);

      PrabathPairWeb.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
          try {
            console.log('✅ Connected successfully!');
            await delay(5000);

            const user_jid = jidNormalizedUser(PrabathPairWeb.user.id);

            await PrabathPairWeb.sendMessage(user_jid, {
              text: `✅ *Profile Setup Complete!*

Owner: MR-RABBIT
Number: ${user_jid}

_Thanks for using RABBIT XMD!_`
            });

            await removeFile('./session');

          } catch (err) {
            console.error('❌ Error after connection open:', err);
            exec('pm2 restart rabbit-bot');
          }
        } else if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
          await delay(5000);
          PrabathPair();
        }
      });

    } catch (err) {
      console.error('❌ Service error:', err);
      exec('pm2 restart rabbit-bot');
      PrabathPair();
      removeFile('./session');
      if (!res.headersSent) {
        res.send({ code: 'Service Unavailable' });
      }
    }
  }

  await PrabathPair();
});

// Upload & set profile picture
router.post('/upload-dp', upload.single('photo'), async (req, res) => {
  const imagePath = req.file.path;
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS('Safari')
    });

    await sock.waitForConnectionUpdate(c => c.connection === 'open');
    await sock.updateProfilePicture(sock.user.id, { url: imagePath });

    res.send('✅ DP updated successfully!');
    fs.unlinkSync(imagePath); // cleanup
  } catch (e) {
    console.error(e);
    res.status(500).send('❌ Failed to set DP.');
  }
});

export default router;
