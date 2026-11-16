#!/usr/bin/node
/** module: [[whygraph-eval-stand-in]] */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const event = (type, part) => process.stdout.write(JSON.stringify({ type, part })+'\n');
const config = JSON.parse(readFileSync('/config/rehearsal.json','utf8'));
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const tool = (name, input, action) => {
  try {
    const output=action();
    event('tool_use',{tool:name,state:{status:'completed',input,output}});
    return output;
  } catch(error) {
    event('tool_use',{tool:name,state:{status:'error',input,error:error.message}});
    throw error;
  }
};
const shell = (command, denied=false) => {
  const r=spawnSync('/tools/shell',['-c',command],{encoding:'utf8',maxBuffer:1<<26,timeout:30000});
  const output=(r.stdout??'')+(r.stderr??'');
  const failed=r.error||r.signal||!Number.isInteger(r.status)||r.status===70||(!denied&&r.status!==0)||(denied&&r.status===0);
  event('tool_use',{tool:'bash',state:{status:denied||failed?'error':'completed',input:{command},output}});
  if(failed)throw new Error(`rehearsal step failed: status ${r.status}, signal ${r.signal}, ${r.error?.message??''}\n${output}`);
  return output;
};

try {
  tool('read',{filePath:config.source},()=>readFileSync(config.source,'utf8'));
  for(const command of ['carry','why','impact','search'])shell(`whygraph ${command} ${quote(command==='impact'?config.impact:config.target)}`);
  for(const command of [
    `cat ${quote(config.store+'/manifest.json')}`,
    'relate --version',
    'cat /tools/whygraph',
    `cat ${quote(config.serviceCode)}`,
    `cat ${quote(config.otherSocket)}`,
    `/usr/bin/node -e ${quote("const s=require('net').connect({host:'127.0.0.1',port:"+config.networkPort+"});s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));s.setTimeout(2000,()=>process.exit(2));")}`,
  ])shell(command,true);
  for(const edit of config.edits)tool('edit',{filePath:edit.file,oldString:edit.before,newString:edit.after},()=>{
    const path=resolve('/repo',edit.file);
    if(!path.startsWith('/repo/'))throw new Error('edit escapes repository');
    const text=readFileSync(path,'utf8');
    if(!edit.before||text.split(edit.before).length!==2)throw new Error(`edit anchor must occur once: ${edit.file}`);
    writeFileSync(path,text.replace(edit.before,edit.after));
    return `Updated ${edit.file}`;
  });
  event('text',{text:'Rehearsal steps completed. No hosted agent ran.'});
  event('step_finish',{reason:'stop',cost:0,tokens:{input:0,output:0,reasoning:0,cache:{read:0,write:0},total:0}});
} catch(error) {
  event('error',{message:error.message});
  process.stderr.write(error.stack+'\n');
  process.exitCode=1;
}
