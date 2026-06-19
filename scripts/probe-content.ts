import 'dotenv/config';
import { selectTopEvent } from '@/lib/content/select';

async function main() {
  const runDate = new Date().toISOString().split('T')[0];
  const event = await selectTopEvent(runDate);
  if (!event) {
    console.log('NO EVENT');
  } else {
    console.log(JSON.stringify(event, null, 2));
  }
  process.exit(0);
}

main();
