-- Sample query.

SELECT *
FROM sample_table
WHERE timestamp BETWEEN $1 AND $2
LIMIT $4::INT OFFSET ($3::INT * $4::INT) - $4::INT;
