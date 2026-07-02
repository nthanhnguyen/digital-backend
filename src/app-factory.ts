export async function getBootstrap(app: string): Promise<() => Promise<void>> {
  try {
    const { bootstrap } = await import(`./apps/${app}/main`);
    return bootstrap;
  } catch (err) {
    const error = new Error(`App (${app}) not found - ${err.message}`);
    // eslint-disable-next-line no-console
    console.error(error.message);
    throw error;
  }
}
