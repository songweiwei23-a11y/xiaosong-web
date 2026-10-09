// Read-only diagnostics. Print timings and error counts only, never credentials or log contents.
const fs = require('node:fs');
const env = fs.readFileSync('.env.local', 'utf8');
const value = (key) => {
  const match = env.match(new RegExp('^' + key + '=(.*)$', 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : '';
};
(async () => {
  for (let i = 0; i < 3; i++) {
    const started = Date.now();
    try {
      const response = await fetch(value('NEXT_PUBLIC_SUPABASE_URL') + '/auth/v1/health', {
        headers: { apikey: value('NEXT_PUBLIC_SUPABASE_ANON_KEY') }, signal: AbortSignal.timeout(10000),
      });
      await response.arrayBuffer();
      console.log(JSON.stringify({ probe: i + 1, status: response.status, ms: Date.now() - started }));
    } catch (error) {
      console.log(JSON.stringify({ probe: i + 1, name: error.name, code: error.cause?.code, ms: Date.now() - started }));
    }
  }
  const logDir = '/home/ubuntu/.pm2/logs';
  const patterns = ['AuthRetryableFetchError', 'fetch failed', 'ETIMEDOUT', 'ECONNRESET', 'invalid_refresh_token', 'refresh_token_not_found', 'AuthSessionMissingError'];
  for (const name of fs.readdirSync(logDir).filter((name) => name.includes('xiaosong') && name.endsWith('.log'))) {
    const path = logDir + '/' + name;
    const fd = fs.openSync(path, 'r');
    const size = fs.fstatSync(fd).size;
    const buffer = Buffer.alloc(Math.min(size, 250000));
    fs.readSync(fd, buffer, 0, buffer.length, Math.max(0, size - buffer.length));
    fs.closeSync(fd);
    const text = buffer.toString('utf8');
    console.log(JSON.stringify({ log: name, recentErrorCounts: Object.fromEntries(patterns.map((pattern) => [pattern, text.split(pattern).length - 1])) }));
  }
})();
