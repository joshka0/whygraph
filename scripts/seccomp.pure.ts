/**
 * module: [[whygraph-closed-seccomp]]
 * boundary: pure
 * imports: none
 */
const LOAD = 0x20, JUMP_EQUAL = 0x15, JUMP_AT_LEAST = 0x35, RETURN = 0x06;
const X86_64 = 0xc000003e, X32_BIT = 0x40000000;
const KILL_PROCESS = 0x80000000, EPERM = 0x00050001, ALLOW = 0x7fff0000;
const PTRACE = 101, PROCESS_VM_READV = 310, PROCESS_VM_WRITEV = 311;

/** The classic BPF program that bwrap loads with --seccomp: x86-64 only, EPERM for the three calls that read another process.
 * owns: [[whygraph-closed-seccomp]]
 * decided: ptrace, process_vm_readv and process_vm_writev fail with EPERM in closed namespaces because the operator ruled on 2026-11-17 that no tool may run against the whygraph client (ADR 0011).
 * decided: A call with the x32 bit fails too because x32 numbers reach the same kernel calls under other numbers.
 */
export function ptraceDenyFilter(): Uint8Array {
  const rows: readonly (readonly [number, number, number, number])[] = [
    [LOAD, 0, 0, 4],
    [JUMP_EQUAL, 1, 0, X86_64],
    [RETURN, 0, 0, KILL_PROCESS],
    [LOAD, 0, 0, 0],
    [JUMP_AT_LEAST, 3, 0, X32_BIT],
    [JUMP_EQUAL, 2, 0, PTRACE],
    [JUMP_EQUAL, 1, 0, PROCESS_VM_READV],
    [JUMP_EQUAL, 0, 1, PROCESS_VM_WRITEV],
    [RETURN, 0, 0, EPERM],
    [RETURN, 0, 0, ALLOW],
  ];
  const bytes = new Uint8Array(rows.length * 8);
  const view = new DataView(bytes.buffer);
  rows.forEach(([code, jumpTrue, jumpFalse, value], row) => {
    view.setUint16(row * 8, code, true);
    view.setUint8(row * 8 + 2, jumpTrue);
    view.setUint8(row * 8 + 3, jumpFalse);
    view.setUint32(row * 8 + 4, value, true);
  });
  return bytes;
}
