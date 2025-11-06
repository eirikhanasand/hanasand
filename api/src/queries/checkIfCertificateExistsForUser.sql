SELECT EXISTS (
    SELECT 1
    FROM certificates
    WHERE owner = $1::TEXT AND name = $2::TEXT
) AS "exists";
