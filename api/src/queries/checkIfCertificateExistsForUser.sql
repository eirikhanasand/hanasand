SELECT EXISTS (
    SELECT 1
    FROM certificates
    WHERE owner = $1 AND name = $2
) AS "exists";
