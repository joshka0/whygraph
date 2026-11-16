#!/usr/bin/env node
/** module: [[whygraph-trial-design]]
 * Repeat the complete offline self-test with changed working registry counts.
 * Run after the normal self-test: node eval/selftest/batch7-independence.mjs LOG
 */
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,mkdtempSync,openSync,closeSync,readFileSync,statSync,symlinkSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const baseline=process.argv[2];
assert.ok(baseline,'usage: node eval/selftest/batch7-independence.mjs BASELINE-LOG');
const previous=readFileSync(baseline,'utf8');
assert.ok(/\d+\/\d+ cases as expected/.test(previous),'baseline self-test must finish first');
const scratch=mkdtempSync(join(root,'test-results/i-'));
const clone=spawnSync('git',['clone','-q','--shared','--no-checkout',root,scratch],{encoding:'utf8'});
assert.equal(clone.status,0,clone.stderr);
const refs=spawnSync('git',['for-each-ref','--format=%(refname:short) %(objectname)','refs/heads'],{cwd:root,encoding:'utf8'});
assert.equal(refs.status,0,refs.stderr);
for(const row of refs.stdout.trim().split('\n')){
  const [branch,commit]=row.split(' '),existing=spawnSync('git',['show-ref','--verify','--quiet',`refs/heads/${branch}`],{cwd:scratch});
  if(existing.status===1){const added=spawnSync('git',['branch',branch,commit],{cwd:scratch,encoding:'utf8'});assert.equal(added.status,0,added.stderr);}
  else assert.equal(existing.status,0,'read scratch branch');
}
const copiedRefs=spawnSync('git',['for-each-ref','--format=%(refname:short) %(objectname)','refs/heads'],{cwd:scratch,encoding:'utf8'});
assert.equal(copiedRefs.status,0,copiedRefs.stderr);
assert.equal(copiedRefs.stdout,refs.stdout,'scratch preserves source local branches');
assert.ok(statSync(join(scratch,'.git')).isDirectory(),'nested fixtures require a Git directory');
for(const file of ['skills/whygraph/SKILL.md','skills/whygraph-rule.md']){
  const history=spawnSync('git',['show',`c92205d:${file}`],{cwd:scratch,encoding:'utf8'});
  assert.equal(history.status,0,`scratch history must hold ${file}: ${history.stderr}`);
}
const files=spawnSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});
assert.equal(files.status,0,files.stderr);
for(const file of files.stdout.split('\0').filter(Boolean)){
  const target=join(scratch,file);mkdirSync(dirname(target),{recursive:true});cpSync(join(root,file),target);
}
symlinkSync(join(root,'node_modules'),join(scratch,'node_modules'),'dir');
if(existsSync(join(root,'eval/results')))cpSync(join(root,'eval/results'),join(scratch,'eval/results'),{recursive:true});
mkdirSync(join(scratch,'test-results'),{recursive:true});
const path=join(scratch,'eval/registry.json'),registry=JSON.parse(readFileSync(path,'utf8'));
const before={requests:registry.batches[7].counts.requests,sampleCounts:registry.batches[7].sampleCounts};
registry.batches[7].counts.requests=36;
registry.batches[7].sampleCounts={cited:37,uncited:41};
assert.notEqual(before.requests,registry.batches[7].counts.requests);
assert.notDeepEqual(before.sampleCounts,registry.batches[7].sampleCounts);
writeFileSync(path,JSON.stringify(registry,null,2)+'\n');
const preflight=spawnSync(process.execPath,['--input-type=module','-e',`import{batch4Checks}from './eval/selftest/batch4.mjs';import{readTasks,scoreRun}from './eval/score.mjs';const cases=await batch4Checks({tasks:readTasks(),scoreRun});const owner=cases.find(c=>c.name==='B4 default generator preserves main batch 3 bytes and original order');if(!owner)throw Error('missing historical preflight case');await owner.run();console.log('historical main-branch preflight passed');`],{cwd:scratch,env:{...process.env,TMPDIR:'/mnt/ssd/tmp'},encoding:'utf8'});
writeFileSync(join(scratch,'test-results/independence-preflight.txt'),preflight.stdout+preflight.stderr);
assert.equal(preflight.status,0,preflight.stderr);
const log=join(scratch,'test-results/independence-selftest.txt'),fd=openSync(log,'w');
console.log(`Independence scratch retained: ${scratch}`);
let result;
try{result=spawnSync('systemd-run',['--user','--scope','-q','-p','MemoryMax=6G','-p','CPUQuota=400%',process.execPath,'eval/selftest/check.mjs'],{cwd:scratch,env:{...process.env,TMPDIR:'/mnt/ssd/tmp'},stdio:['ignore',fd,fd]});}finally{closeSync(fd);}
assert.ifError(result.error);
const current=readFileSync(log,'utf8');
const cases=text=>text.split('\n').filter(line=>/^(?:ok  |WRONG)/.test(line));
const summary=text=>text.match(/\d+\/\d+ cases as expected[^\n]*/)?.[0];
const receipt={baseline,source:root,scratch,before,after:{requests:36,sampleCounts:{cited:37,uncited:41}},log,exit:result.status,baselineSummary:summary(previous),summary:summary(current),sameCases:JSON.stringify(cases(current))===JSON.stringify(cases(previous))};
writeFileSync(join(scratch,'independence.json'),JSON.stringify(receipt,null,2)+'\n');
assert.match(current,/\d+\/\d+ cases as expected/,'independence self-test must finish');
assert.equal(summary(current),summary(previous),'same case counts and results');
assert.deepEqual(cases(current),cases(previous),'every case has the same verdict');
assert.equal(result.status,Number(summary(previous).split('/')[0])===Number(summary(previous).split('/')[1].split(' ')[0])?0:1,'same exit status');
console.log(JSON.stringify(receipt,null,2));
