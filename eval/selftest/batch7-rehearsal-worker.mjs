/** module: [[whygraph-trial-design]] */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const config=JSON.parse(readFileSync(process.argv[2],'utf8'));
try {
  const api=await import(pathToFileURL(config.module).href);
  console.log(JSON.stringify({value:await api[config.entry](config.options)}));
} catch(error) {
  console.log(JSON.stringify({error:error.message,stack:error.stack}));
}
