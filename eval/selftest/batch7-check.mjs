/** module: [[whygraph-trial-design]] */
import {batch7Checks} from './batch7.mjs';
import {scoreRun,readTasks} from '../score.mjs';
const checks=(await batch7Checks({scoreRun,tasks:readTasks()})).filter(c=>!process.argv[2]||c.group===process.argv[2]||c.name.includes(process.argv[2]));let wrong=0;
for(const c of checks)try{await c.run();console.log(`ok    ${c.name}`);}catch(e){wrong++;console.log(`WRONG ${c.name}\n        ${e.stack}`);}
console.log(`${checks.length-wrong}/${checks.length} batch 7 cases as expected`);process.exitCode=wrong?1:0;
