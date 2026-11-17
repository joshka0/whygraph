#!/usr/bin/node
/** module: [[whygraph-trial-design]]
 * Scripted agent that leaves service calls open: it sends raw search frames to the
 * service socket, never reads a reply, then ends its run.
 */
import {readFileSync,writeFileSync,symlinkSync} from 'node:fs';
import {createConnection} from 'node:net';
const config=JSON.parse(readFileSync('/config/rehearsal.json','utf8'));
const emit=(type,part)=>process.stdout.write(JSON.stringify({type,part})+'\n');
const u=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b;};
const frame=args=>Buffer.concat([u(args.length),...args.flatMap(a=>[u(Buffer.byteLength(a)),Buffer.from(a)])]);
try{
 const sockets=[];
 for(let i=0;i<config.count;i++)await new Promise((ok,fail)=>{const s=createConnection('/whygraph/service.sock');s.once('error',fail);s.once('connect',()=>{s.on('error',()=>{});s.write(frame(['search','HOLD-'+i]));sockets.push(s);ok();});});
 await new Promise(ok=>setTimeout(ok,1500));
 writeFileSync('/repo/stopped-observations.json',JSON.stringify({opened:sockets.length}));
 if(config.mode==='breach')symlinkSync('/etc/hostname','/repo/stopped-escape');
 emit('text',{text:'Scripted calls left open.'});
 emit('step_finish',{reason:'stop',cost:0,tokens:{input:0,output:0,reasoning:0,cache:{read:0,write:0},total:0}});
 // Open sockets keep Node alive: end the run with its calls still open, as a killed agent would.
 process.stdout.write('',()=>process.exit(0));
}catch(error){emit('error',{message:error.message});process.stderr.write(error.stack+'\n');process.exitCode=1;}
