import { startServer } from './server';

const port = Number(process.env.PORT ?? 8899);
// Standard: nur lokal erreichbar. Für Freunde im selben Netzwerk: HOST=0.0.0.0 npm run server
const host = process.env.HOST ?? '127.0.0.1';
const pvp = process.env.PVP !== '0';
const savePath = process.env.SAVE ?? 'server-saves.json';

const srv = await startServer({ port, host, pvp, savePath });
console.log(`Aschenthron-Server läuft auf ws://${host}:${srv.port} (PvP ${pvp ? 'an' : 'aus'}, Spielstände: ${savePath})`);
if (host !== '127.0.0.1' && host !== 'localhost') console.log('ACHTUNG: Server ist von anderen Rechnern im Netzwerk erreichbar. Es gibt keine Anmeldung, nur Namen.');
const stop = async () => {
  await srv.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
