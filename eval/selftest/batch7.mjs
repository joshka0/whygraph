/** module: [[whygraph-trial-design]]
 */
import {join} from 'node:path';
import {mkdirSync} from 'node:fs';
import {b7 as h} from './batch7-support.mjs';
import {batch7RecordChecks} from './batch7-records.mjs';
import {batch7SamplerChecks} from './batch7-sampler.mjs';
import {batch7ClosedChecks} from './batch7-closed.mjs';
import {batch7AttemptChecks} from './batch7-attempts.mjs';
import {batch7ReportChecks} from './batch7-report.mjs';
import {batch7SmokeChecks} from './batch7-smoke.mjs';
import {batch7RetryChecks} from './batch7-retries.mjs';
import {batch7HostChecks} from './batch7-host.mjs';
import {batch7DataChecks} from './batch7-data.mjs';
import {batch7MemoryChecks} from './batch7-memory.mjs';
import {batch7RehearsalChecks} from './batch7-rehearsal.mjs';
import {batch7StartupChecks} from './batch7-startup.mjs';
/** Independent batch 7 contract cases.
 * owns: [[whygraph-batch7-selftest]]
 */
export async function batch7Checks(context){mkdirSync(join(h.root,'test-results'),{recursive:true});const scratch=h.mkdtempSync(join(h.root,'test-results/batch7-selftest-'));console.log(`Batch 7 self-test scratch retained: ${scratch}`);const shared={};context={...context,shared};return [...await batch7DataChecks({...context,scratch}),...await batch7RecordChecks({...context,scratch}),...await batch7SamplerChecks({...context,scratch}),...await batch7ClosedChecks({...context,scratch}),...await batch7AttemptChecks({...context,scratch}),...await batch7ReportChecks({...context,scratch}),...await batch7SmokeChecks({...context,scratch}),...await batch7RetryChecks({...context,scratch}),...await batch7HostChecks({...context,scratch}),...await batch7MemoryChecks({...context,scratch}),...await batch7RehearsalChecks({...context,scratch}),...await batch7StartupChecks({...context,scratch})];}
