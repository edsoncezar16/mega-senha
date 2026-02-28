import { createApp } from './app';

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

const { httpServer } = createApp(CLIENT_ORIGIN);

httpServer.listen(PORT, () => {
  console.log(`Mega Senha server running on port ${PORT}`);
});
