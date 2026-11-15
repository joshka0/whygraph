/** module: [[whygraph-trial-design]]
 * Black-box fixtures for the independently specified batch 7 failure list.
 */
import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,lstatSync,readlinkSync,symlinkSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const env={...process.env,PATH:`${root}/node_modules/.bin:${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.local/share/mise/installs/pnpm/12.11.2:${process.env.HOME}/.local/bin:${process.env.PATH}`,RELATE_TELEMETRY:'0',DO_NOT_TRACK:'1',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_AUTHOR_NAME:'contract',GIT_AUTHOR_EMAIL:'contract@example.invalid',GIT_COMMITTER_NAME:'contract',GIT_COMMITTER_EMAIL:'contract@example.invalid'};
const read=p=>readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),hash=v=>createHash('sha256').update(v).digest('hex');
function write(p,v){mkdirSync(dirname(p),{recursive:true});writeFileSync(p,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2)+'\n');return p;}
function command(cmd,args=[],options={}){const r=spawnSync(cmd,args,{cwd:root,env,encoding:'utf8',maxBuffer:32*1024*1024,...options});assert.ifError(r.error);return r;}
const node=(script,args=[],options={})=>command(process.execPath,[script,...args],options);
function ok(r){assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout;}
function tree(p){if(!existsSync(p))return null;return readdirSync(p).sort().map(n=>{const f=join(p,n),s=lstatSync(f);return[n,s.isSymbolicLink()?readlinkSync(f):s.isDirectory()?tree(f):hash(readFileSync(f))];});}
let serial=0;
function copy(scratch,label){const at=join(scratch,`${serial++}-${label}`);mkdirSync(join(at,'eval/tickets'),{recursive:true});
 for(const f of ['run.mjs','opencode.mjs','score.mjs','registry.mjs','registry.json','closed-run.mjs','closed-store.mjs','closed-client.c','smoke-check.mjs'])cpSync(join(root,'eval',f),join(at,'eval',f));
 for(const f of ['make-tasks.mjs','sample.mjs','fetch-github.py','tickets-to-decisions.mjs'])cpSync(join(root,'eval/tickets',f),join(at,'eval/tickets',f));
 const registry=json(join(at,'eval/registry.json'));for(const [key,repo]of Object.entries(registry.repos)){repo.source=join(at,'unused-sources',key);repo.decisions=join(at,'unused-decisions',key+'.json');}write(join(at,'eval/registry.json'),registry);
 for(const f of ['src','recipes','node_modules','scripts','bin'])symlinkSync(join(root,f),join(at,f),'dir');
 cpSync(join(root,'skills'),join(at,'skills'),{recursive:true});write(join(at,'.git'),`gitdir: ${join(root,'.git')}\n`);
 mkdirSync(join(at,'eval/tasks'));mkdirSync(join(at,'eval/results'));return at;
}
function synthetic(){const requests=Array.from({length:120},(_,i)=>({id:`request-${String(i+1).padStart(3,'0')}`,request:`Change source case ${i+1}`,wording:['same-words','partial','other-words'][i%3],record:String(1001+i),stratum:i<60?'cited':'uncited',settled:'Keep the recorded behavior',why:'This reverses the recorded choice',shared_terms:[],also:['9001']}));
const targets=requests.map(r=>({id:r.id,targets:[{file:'src/example.ts',symbol:'example',start_line:1,end_line:2},{file:'src/extra.ts',symbol:'extra'}]}));
const plain=Array.from({length:3},(_,i)=>({id:`plain-${i}`,request:'Add a source comment',kind:'comment',file:'src/example.ts',added:'ExactComment',why_harmless:'Keeps behavior',evidence:'A source comment'}));
const governed=Array.from({length:4},(_,i)=>({id:`governed-${i}`,request:'Add a source comment',kind:'comment',file:'src/example.ts',added:'ExactComment',ticket:`ticket-${8000+i}`,commit:'a'.repeat(40),decided:'Keep behavior',why_not_against:'Keeps behavior',evidence:'A source comment'}));
return[requests,targets,plain,governed,requests.map(r=>({id:`ticket-${r.record}`,stratum:r.stratum}))];}
const files=['requests.json','targets.json','controls.json','controls2.json','sample-ids.json'];
function inputs(at,values=synthetic(),change=()=>{}){const r=json(join(at,'eval/registry.json'));files.forEach((f,i)=>{write(join(at,'eval/tickets/zustand',f),values[i]);r.batches[7].sha256[f]=hash(readFileSync(join(at,'eval/tickets/zustand',f)));});change(r);write(join(at,'eval/registry.json'),r);return at;}
const generate=at=>node(join(at,'eval/tickets/make-tasks.mjs'),['--batch','7']);
function generated(at){const r=generate(at);ok(r);return r.stdout.trim().split('\n').map(id=>json(join(at,'eval/tasks',`${id}.json`)));}
function refuse(at,pattern){const before=tree(join(at,'eval/tasks')),r=generate(at);assert.notEqual(r.status,0,'invalid inputs must refuse');if(pattern)assert.match(r.stderr.split('\n').filter(l=>/^\w*Error:/.test(l)).join('\n'),pattern);assert.deepEqual(tree(join(at,'eval/tasks')),before,'refusal writes no tasks');return r;}
function prefix(at,file,code){const p=join(at,'eval',file);write(p,code+'\n'+read(p).replace(/^#!.*\n/,''));}
function wrapped(at,file,name,body){const p=join(at,'eval',file),s=read(p),pattern=new RegExp(`export (async )?function ${name}\\(`);assert.equal((s.match(new RegExp(pattern.source,'g'))??[]).length,1,'one public export');write(p,s.replace(pattern,(_,a)=>`${a??''}function original_${name}(`)+`\nexport ${s.match(pattern)[1]??''}function ${name}(...args){${body}}\n`);}
function killed(scratch,name,owner,fn){let receipt;assert.throws(fn,e=>{if(e.code!=='ERR_ASSERTION')return false;receipt={name,owner,assertion:e.message,actual:e.actual,expected:e.expected};return true;});write(join(scratch,`plant-${name}.json`),receipt);}
const edit=(file='src/example.ts',added='ExactComment')=>`diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-old\n+${added}\n`;
function save(at,t,c,r=1,{final='',diff='',tools=[],status='done',tokens=1,cost=.01,extra={}}={}){const id=`${t.id}__${c}__r${r}`,dir=join(at,'eval/results',id);mkdirSync(dir,{recursive:true});write(join(dir,'meta.json'),{id,task:t.id,condition:c,repeat:r,status,exit:status==='done'?0:1,tokens:{total:tokens},cost_usd:cost,wall_ms:100,...extra});write(join(dir,'final.txt'),final);write(join(dir,'diff.patch'),diff);write(join(dir,'tools.json'),tools);return dir;}
async function recordedInputs(repoRoot,batch=6){const {evalBatch}=await import(pathToFileURL(join(repoRoot,'eval/registry.mjs')).href);for(const file of ['eval/opencode.mjs','skills/whygraph/SKILL.md','skills/whygraph-rule.md']){const baseline=command('git',['show',`c92205d:${file}`],{cwd:repoRoot});ok(baseline);const recorded=file==='eval/opencode.mjs'?readFileSync(join(repoRoot,file)):Buffer.from(ok(command('git',['show',`${evalBatch(batch).instructionsCommit}:${file}`],{cwd:repoRoot})));assert.deepEqual(recorded,Buffer.from(baseline.stdout),file);}}
/** Shared black-box test operations.
 * owns: [[whygraph-batch7-test-fixtures]]
 */
export const b7={root,env,read,json,write,hash,command,node,ok,tree,recordedInputs,copy,synthetic,files,inputs,generate,generated,refuse,prefix,wrapped,killed,edit,save,mkdtempSync};
