import 'dotenv/config';
import { getBootstrap } from './app-factory';

class Main {
  async run(): Promise<void> {
    const app = process.env.RUN_AS || 'service';
    // eslint-disable-next-line no-console
    console.log(`Running app: ${app} in env: ${process.env.NODE_ENV || 'local'}`);
    const bootstrap = await getBootstrap(app);
    await bootstrap();
  }
}

const app = new Main();
app.run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start application:', error);
  process.exit(1);
});
