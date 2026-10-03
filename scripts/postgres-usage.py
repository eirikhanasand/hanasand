#!/usr/bin/env python3
"""Display combined CPU cores and resident memory for local PostgreSQL processes."""

import os
import time


CLK_TCK = os.sysconf("SC_CLK_TCK")
PAGE_SIZE = os.sysconf("SC_PAGE_SIZE")


def sample_processes():
    processes = {}
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue

        try:
            with open(f"/proc/{pid}/stat", encoding="ascii") as stat_file:
                stat = stat_file.read()
            name = stat[stat.find("(") + 1 : stat.rfind(")")]
            if not name.startswith("postgres"):
                continue

            fields = stat[stat.rfind(")") + 2 :].split()
            cpu_ticks = int(fields[11]) + int(fields[12])
            with open(f"/proc/{pid}/statm", encoding="ascii") as statm_file:
                resident_pages = int(statm_file.read().split()[1])
            processes[pid] = (cpu_ticks, resident_pages * PAGE_SIZE)
        except (OSError, ValueError, IndexError):
            # Processes can exit between listing /proc and reading their stats.
            continue

    return processes


def main():
    previous = sample_processes()
    previous_time = time.monotonic()

    try:
        while True:
            time.sleep(1)
            current = sample_processes()
            current_time = time.monotonic()
            elapsed = current_time - previous_time
            cpu_cores = sum(
                max(0, values[0] - previous.get(pid, values)[0])
                for pid, values in current.items()
            ) / CLK_TCK / elapsed
            memory_gib = sum(values[1] for values in current.values()) / 1024**3
            print(f"\r{cpu_cores:.2f} CPUs {memory_gib:.2f} GiB RAM", end="", flush=True)
            previous, previous_time = current, current_time
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
