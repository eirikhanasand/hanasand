#!/bin/sh

failed=0
excluded_suites='api.test.ts|evidenceEndpointsHolds.test.ts|evidenceEndpointsPass.test.ts|evidenceEndpointsValidation.test.ts'
listener_parts='api.part33.ts|api.part38.ts|api.part41.ts|api.part44.ts|api.part51.ts'

for suite in \
  src/tests/evidenceEndpointsHolds.test.ts \
  src/tests/evidenceEndpointsPass.test.ts \
  src/tests/evidenceEndpointsValidation.test.ts \
  src/tests/apiParts/api.part33.ts \
  src/tests/apiParts/api.part38.ts \
  src/tests/apiParts/api.part41.ts \
  src/tests/apiParts/api.part44.ts \
  src/tests/apiParts/api.part51.ts
do
  bun test --max-concurrency 1 "./$suite" || failed=1
done

find src/tests/apiParts -name 'api.part*.ts' -type f | sort | grep -Ev "/($listener_parts)$" | sed 's#^#./#' | xargs -n 20 bun test --max-concurrency 20 || failed=1
find src/tests -name '*.test.ts' -type f | sort | grep -Ev "/($excluded_suites)$" | xargs -n 20 bun test --max-concurrency 20 || failed=1

exit "$failed"
