/** module: [[whygraph-trial-design]] */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const c=JSON.parse(readFileSync(process.argv[2],'utf8'));
try {
 const api=await import(pathToFileURL(c.module).href);
 const value=c.entry==='main'?await api.main(c.args):await api[c.entry](c.options);
 console.log(JSON.stringify({value}));
}catch(error){console.log(JSON.stringify({error:error.message}));process.exitCode=1;}
