#!/usr/bin/env node
/** module: [[whygraph-closed-store]] */
import { readFileSync } from 'node:fs';
import { ablatedStores } from './closed-store.mjs';
const [store, directory] = process.argv.slice(2);
if (!store || !directory) throw new Error('usage: measure-preparation.mjs <store> <ablation directory>');
const started = performance.now();
const prepared = ablatedStores(store, directory);
const group = readFileSync('/proc/self/cgroup','utf8').trim().split('\n').find(l => l.startsWith('0::'))?.slice(3);
console.log(JSON.stringify({wall_ms:performance.now()-started,
  scope_peak_bytes: group ? Number(readFileSync(`/sys/fs/cgroup${group}/memory.peak`,'utf8')) : null,
  prepared},null,2));
