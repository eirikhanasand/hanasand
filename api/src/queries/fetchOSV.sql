SELECT * FROM vulnerabilities
WHERE package_name = $1
AND ecosystem = $2
AND (
    version_introduced = 'unknown' OR
    (
        version_introduced ~ '^[0-9]+(\.[0-9]+)*$'
        AND string_to_array(version_introduced, '.')::int[] 
        <= string_to_array($3, '.')::int[]
    )
)
AND (
    version_fixed = 'unknown' OR
    (
        version_fixed ~ '^[0-9]+(\.[0-9]+)*$'
        AND string_to_array(version_fixed, '.')::int[] 
        >= string_to_array($3, '.')::int[]
    )
);
