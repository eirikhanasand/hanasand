-- Query to fetch the allowlist or blocklist count. See the list handler for further details.

SELECT COUNT(*) FROM (
    SELECT l.name
    FROM {list} l
    LEFT JOIN (
        SELECT name, array_agg(version) AS versions
        FROM {list}_versions
        GROUP BY name
    ) lv ON lv.name = l.name
    LEFT JOIN (
        SELECT name, array_agg(ecosystem) AS ecosystems
        FROM {list}_ecosystems
        GROUP BY name
    ) le ON le.name = l.name
    LEFT JOIN (
        SELECT name, array_agg(repository) AS repositories
        FROM {list}_repositories
        GROUP BY name
    ) lr ON lr.name = l.name
    LEFT JOIN (
        SELECT name, array_agg(reference) AS references
        FROM {list}_references
        GROUP BY name
    ) lrf ON lrf.name = l.name
    WHERE ($1::TEXT IS NULL OR (SELECT l.name = $1))
    AND ($2::TEXT IS NULL OR le.ecosystems IS NULL OR (SELECT $2 = ANY(le.ecosystems)))
    AND ($3::TEXT IS NULL OR lv.versions IS NULL OR $3 = ANY(lv.versions))
    AND (
        $4::TEXT IS NULL OR lr.repositories IS NULL OR EXISTS (
            SELECT 1 FROM unnest(lr.repositories) AS repo
            WHERE repo ~* ('\y' || $4 || '\y')
        )
    )
    AND ($5::TIMESTAMP IS NULL OR (
        SELECT lc.timestamp
        FROM {list}_created lc
        WHERE lc.name = l.name
        LIMIT 1
    ) >= $5::TIMESTAMP)
    AND ($6::TIMESTAMP IS NULL OR (
        SELECT lc.timestamp
        FROM {list}_created lc
        WHERE lc.name = l.name
        LIMIT 1
    ) <= $6::TIMESTAMP)
    -- search filter
    AND (
        $7::TEXT IS NULL 
        OR l.name ILIKE '%' || $7 || '%' 
        OR l.comment ILIKE '%' || $7 || '%'
        OR EXISTS (
            SELECT 1
            FROM unnest(lv.versions) AS version
            WHERE version ILIKE '%' || $7 || '%'
        )
        OR EXISTS (
            SELECT 1
            FROM unnest(le.ecosystems) AS ecosystem
            WHERE ecosystem ILIKE '%' || $7 || '%'
        )
        OR EXISTS (
            SELECT 1
            FROM unnest(lr.repositories) AS repository
            WHERE repository ILIKE '%' || $7 || '%'
        )
        OR EXISTS (
            SELECT 1
            FROM unnest(lrf.references) AS reference
            WHERE reference ILIKE '%' || $7 || '%'
        )
    )
) AS filtered;
