/** module: [[whygraph-trial-design]]
 * A disposable host owner, never an agent or trial launcher.
 */
import child from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const c=JSON.parse(readFileSync(process.argv[2],'utf8'));
if(c.spawnFailure){const original=child.spawn;child.spawn=(cmd,args,options)=>original(cmd==='bwrap'?'/no-command-for-contract-test':cmd,args,options);syncBuiltinESMExports();}
const api=await import(pathToFileURL(c.module).href);
const launcher=await api.startClosedShell(c.options);
process.stdout.write('READY\n');
process.stdin.on('data',async()=>{await launcher.stop();process.stdout.write(JSON.stringify(launcher.stats())+'\n');process.exit(0);});
