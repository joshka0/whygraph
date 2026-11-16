#!/usr/bin/node
/** module: [[whygraph-trial-design]]
 * Native event fake. It makes no network call and runs no tool.
 */
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const config=JSON.parse(readFileSync('/config/fake.json','utf8'));
const emit=event=>process.stdout.write(JSON.stringify(event)+'\n');
try { readFileSync('/etc/resolv.conf'); }
catch { emit({type:'error',error:{name:'UnknownError',data:{message:'Unexpected server error. Check server logs for details.'}}});process.exit(1); }
writeFileSync('/config/observed.json',JSON.stringify({args:process.argv.slice(2),repo:readdirSync('/repo'),env:Object.fromEntries(['HOME','PATH','XDG_CONFIG_HOME','XDG_CACHE_HOME','XDG_STATE_HOME','XDG_DATA_HOME','OPENCODE_CONFIG_CONTENT'].map(k=>[k,process.env[k]]))}));
const mode=config.mode;
if(mode==='timeout')await new Promise(done=>setTimeout(done,60000));
if(mode==='malformed'){process.stdout.write('{broken json\n');process.exit(1);}
if(mode==='error'||mode==='message'||mode==='part'){
 emit(mode==='part'?{type:'error',part:{message:'part startup denied'}}:{type:'error',error:mode==='message'?{name:'AccessError',message:'model access denied'}:{name:'UnknownError',data:{message:'Unexpected server error. Check server logs for details.'}}});
 process.exit(1);
}
emit({type:'step_start',part:{}});
emit({type:'text',part:{text:mode==='wrong'?'okay':' \n ok\t '}});
if(mode==='tool')emit({type:'tool_use',part:{tool:'read',state:{status:'completed',input:{filePath:'/repo/file'},output:'PRIVATE TOOL OUTPUT'}}});
if(mode!=='incomplete')emit({type:'step_finish',part:{reason:'stop',tokens:{total:mode==='zero'?0:3,input:2,output:1},cost:0}});
if(mode==='error-after-stop')emit({type:'error',error:{name:'AccessError',data:{message:'late model error'}}});
