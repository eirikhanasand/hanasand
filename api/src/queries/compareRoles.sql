SELECT cr.priority <= tr.priority AS can_assign
FROM roles cr
JOIN roles tr ON tr.id = $2::TEXT
WHERE cr.id = $1::TEXT;
