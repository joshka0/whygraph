// Read-only replay of actual smoke-check callbacks against saved real attempts.
// Prints observations. Writes only its report under test-results; not a test suite.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { readArgs } from '../src/args.pure.ts';
import { batchInstructions, fileKey } from '../eval/registry.mjs';
const root=resolve('.'),archive=join(root,'eval/results/_smoke-archive/5-agent-socket-probe');
const names=[
 '_invalid/zustand7-conflict-zs-02__graph__r1__342d19f3-0498-42bd-8a57-e10c80e680c6',
 '_invalid/zustand7-conflict-zs-02__graph__r1__871e0fea-3dab-44a9-b14c-42c839f9e5c9',
 '_invalid/zustand7-conflict-zs-02__graph-nolink__r1__d69ed185-66e2-4c40-bbd7-d48c13c30b4e',
 'zustand7-conflict-zs-02__graph-nolink__r1',
];
const read=(dir,name)=>JSON.parse(readFileSync(join(dir,name),'utf8'));
const virtual=new Map(),attempts=names.map(name=>{
 const dir=join(archive,name),meta=read(dir,'meta.json');
 const raw=readFileSync(join(dir,'service.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
 // These archived failure events came from the frame-count guard. Convert only
 // the three exact frame refusals in the parent's ruling, without changing disk.
 const converted=raw.map(row=>row.event==='failure'&&['invalid argument count','argument too large','request too large'].includes(row.message)?{...row,event:'refused'}:row);
 const refusals=converted.filter(row=>row.event==='refused');
 meta.service={...meta.service,failures:converted.filter(row=>row.event==='failure').length,
  reasons:converted.filter(row=>row.event==='failure').map(row=>row.message),refused:refusals.length,refusalReasons:refusals.map(row=>row.message)};
 virtual.set(join(dir,'service.jsonl'),converted.map(JSON.stringify).join('\n')+'\n');
 return {name,dir,meta,cell:{id:meta.id,task:{id:meta.task},condition:meta.condition,repeat:meta.repeat}};
});
const smoke=join(root,'eval/smoke-check.mjs');
function load(source) {
 const context={checks:new Map(),failures:[],lines:[],readFileSync:(path,...args)=>virtual.has(String(path))?virtual.get(String(path)):readFileSync(path,...args),
  existsSync,join,fileURLToPath,readArgs,batchInstructions,fileKey,URL,
  process:{argv:['node',smoke,'--batch','7'],exitCode:0},
  console:{log:(...args)=>context.lines.push(args.join(' '))}};
 const check="const check=(name,fn)=>{try{const detail=fn();console.log(`PASS ${name}${detail?`: ${detail}`:''}`);}catch(error){failed=true;console.log(`FAIL ${name}: ${error.message}`);}};";
 const require="const require=(condition,message)=>{if(!condition)throw new Error(message);};";
 for(const needle of [check,require])if(source.split(needle).length!==2)throw new Error('smoke callback capture anchor changed');
 source=source.split('\n').filter(line=>!line.startsWith('import ')).join('\n')
  .replace(check,'const check=(name,fn)=>globalThis.checks.set(name,fn);')
  .replace(require,'const require=(condition,message)=>{if(!condition)globalThis.failures.push(message);};')
  .replaceAll('import.meta.url',JSON.stringify(pathToFileURL(smoke).href));
 // Keep all failed assertions, rather than stopping at the first one. Every
 // recorded assertion failure still makes the evidence verdict FAIL.
 runInNewContext(source+'\nglobalThis.setAttempts=values=>attempts.splice(0,attempts.length,...values);',context,{filename:smoke});
 return context;
}
const old=load(execFileSync('git',['show','d1f41cf:eval/smoke-check.mjs'],{encoding:'utf8'}));
const current=load(readFileSync(smoke,'utf8'));
const report=[];
function apply(engine,version,selection,name,label) {
 engine.setAttempts(selection);engine.failures.length=0;engine.lines.length=0;
 let detail;
 try{detail=engine.checks.get(name)();}catch(error){engine.failures.push(error.message);}
 const row={attempt:label,version,check:name,verdict:engine.failures.length?'FAIL':'PASS',failures:[...engine.failures],detail:detail??null,lines:[...engine.lines]};
 report.push(row);console.log(JSON.stringify(row));
}
const checks=['condition answers','identical agent files','closed store and tool code','service answered every call','tokens and wall time per run'];
// Start with one attempt; --one is the smallest evidence run.
const selection=process.argv.includes('--one')?attempts.slice(0,1):attempts;
for(const attempt of selection) {
 apply(old,'d1f41cf',[attempt],'closed store and tool code',attempt.name);
 for(const check of checks)apply(current,'branch',[attempt],check,attempt.name);
}
// This check compares peers as well as each record. Keep its global four-task
// coverage assertion: these four archived attempts cover one task, not four.
if(!process.argv.includes('--one'))apply(current,'branch',attempts,'identical agent files','all four archived attempts');
if(process.argv.includes('--probes')) {
 const path=process.argv[process.argv.indexOf('--probes')+1];
 const cases=JSON.parse(readFileSync(path,'utf8')),attempt=attempts[0];
 for(const row of cases) {
  virtual.set(join(attempt.dir,'confinement.json'),JSON.stringify(row.result.map(result=>({name:result.probe,status:result.status,command:result.command}))));
  apply(current,'branch',[attempt],'closed store and tool code',row.name);
 }
 virtual.delete(join(attempt.dir,'confinement.json'));
}
const output=join(root,`test-results/trial7-fix9-archive${process.argv.includes('--one')?'-one':process.argv.includes('--probes')?'-with-probes':''}.json`);
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(`Evidence: ${output}`);
