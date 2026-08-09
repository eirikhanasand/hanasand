#!/bin/sh

failed=0
excluded_suites='api.test.ts|evidenceEndpointsHolds.test.ts|evidenceEndpointsPass.test.ts|evidenceEndpointsValidation.test.ts'
listener_parts='api.part33.ts|api.part38.ts|api.part51.ts'

run_isolated() {
  test_file="$1"
  test_tmp=$(mktemp -d)
  TMPDIR="$test_tmp" bun test --max-concurrency 1 "$test_file"
  status=$?
  rm -rf "$test_tmp"
  return "$status"
}

for suite in \
  src/tests/evidenceEndpointsHolds.test.ts \
  src/tests/evidenceEndpointsPass.test.ts \
  src/tests/evidenceEndpointsValidation.test.ts \
  src/tests/apiParts/api.part33.ts \
  src/tests/apiParts/api.part38.ts \
  src/tests/apiParts/api.part51.ts
do
  run_isolated "./$suite" || failed=1
done

# ponytail: run one file per Bun process; grouped concurrent suites leak module/global test state and create false auth failures.
for suite in $(find src/tests/apiParts -name 'api.part*.ts' -type f | sort | grep -Ev "/($listener_parts)$"); do
  run_isolated "./$suite" || failed=1
done
for suite in $(find src/tests -name '*.test.ts' -type f | sort | grep -Ev "/($excluded_suites)$"); do
  run_isolated "./$suite" || failed=1
done

exit "$failed"
