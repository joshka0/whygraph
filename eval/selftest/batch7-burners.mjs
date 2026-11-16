/** module: [[whygraph-trial-design]] */
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const file=fileURLToPath(import.meta.url);

/** Four load processes each have a kernel-owned PID namespace.
 * owns: [[whygraph-batch7-load-scope]]
 */
export async function startBurners(token){
 const scopes=[];
 const stop=async()=>{for(const {owner} of scopes)if(owner.exitCode===null&&owner.signalCode===null)owner.kill('SIGKILL');await Promise.all(scopes.map(s=>s.done));};
 try{
  for(let i=0;i<4;i++){
   const args=['--unshare-pid','--die-with-parent'];
   for(const path of ['/usr','/bin','/lib','/lib64','/etc'])if(existsSync(path))args.push('--ro-bind',path,path);
   args.push('--proc','/proc','--dev','/dev','--chdir','/','--','/usr/bin/node','-e',"process.stdout.write('READY\\n');for(;;)Math.sqrt(Math.random());",token);
   const owner=spawn('bwrap',args,{stdio:['ignore','pipe','pipe']});
   let stdout='',stderr='';
   const done=new Promise((ok,fail)=>{owner.once('error',fail);owner.once('close',(status,signal)=>ok({status,signal,stderr}));});
   scopes.push({owner,done});
   owner.stdout.on('data',b=>stdout+=b);owner.stderr.on('data',b=>stderr+=b);
   await new Promise((ok,fail)=>{
    const ready=()=>{if(stdout.includes('READY\n')){owner.stdout.off('data',ready);ok();}};
    owner.stdout.on('data',ready);done.then(r=>fail(Error(`burner scope ended before readiness: ${JSON.stringify(r)}`)),fail);ready();
   });
  }
  return {stop};
 }catch(error){await stop();throw error;}
}

if(process.argv[1]===file&&process.argv[2]==='--hold'){
 await startBurners(process.argv[3]);
 process.stdout.write('READY\n');
}
