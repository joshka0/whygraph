#!/usr/bin/node
/** module: [[whygraph-trial-design]]
 * Scripted agent that leaves real authenticated search clients open, then ends its run.
 * ADR 0011 (2026-11-17), B7-192: the clients supply their private token.
 */
import {readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {spawn} from 'node:child_process';
const config=JSON.parse(readFileSync('/config/rehearsal.json','utf8'));
const emit=(type,part)=>process.stdout.write(JSON.stringify({type,part})+'\n');
try{
 const sockets=[];
 // ADR 0011 (2026-11-17), B7-192: real clients carry the private token for held calls.
 for(let i=0;i<config.count;i++){const child=spawn('/tools/whygraph',['search','HOLD-'+i],{stdio:'ignore'});sockets.push(child);}
 await new Promise(ok=>setTimeout(ok,1500));
 writeFileSync('/repo/stopped-observations.json',JSON.stringify({opened:sockets.length}));
 if(config.mode==='breach')symlinkSync('/etc/hostname','/repo/stopped-escape');
 emit('text',{text:'Scripted calls left open.'});
 emit('step_finish',{reason:'stop',cost:0,tokens:{input:0,output:0,reasoning:0,cache:{read:0,write:0},total:0}});
 // Open clients keep Node alive: end the run with its calls still open, as a killed agent would.
 process.stdout.write('',()=>process.exit(0));
}catch(error){emit('error',{message:error.message});process.stderr.write(error.stack+'\n');process.exitCode=1;}
