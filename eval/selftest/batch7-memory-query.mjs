/** module: [[whygraph-trial-design]] */
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
const [fault,relate,...args]=process.argv.slice(2);
const input=[];for await(const b of process.stdin)input.push(b);
const script=Buffer.concat(input).toString();
if(fault==='exit')process.exit(23);
if(fault==='invalid'){process.stdout.write('{invalid JSON\n');process.exit(0);}
const p=spawn(relate,args,{env:{...process.env,RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1'},stdio:['pipe','pipe','inherit']});
p.stdin.end(script);let dropped=false;
const done=new Promise((ok,fail)=>{p.once('error',fail);p.once('close',(code,signal)=>ok({code,signal}));});
for await(const line of createInterface({input:p.stdout,crlfDelay:Infinity})){
 const row=JSON.parse(line);
 if(fault==='truncated'&&('labels' in row||'type' in row)&&!dropped){dropped=true;continue;}
 if(fault==='renumber'&&args[args.indexOf('--database')+1].endsWith('graph-noterms')&&'id' in row)row.id+=1000;
 process.stdout.write(JSON.stringify(row)+'\n');
}
const result=await done;process.exitCode=result.code??1;
