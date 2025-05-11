-- Query to fetch the allowlist or blocklist. See the list handler for further details.

SELECT l.name, l.comment,
COALESCE((SELECT array_agg(version) FROM {list}_versions WHERE name = l.name), '{}'::TEXT[]) AS versions, 
COALESCE((SELECT array_agg(ecosystem) FROM {list}_ecosystems WHERE name = l.name), '{}'::TEXT[]) AS ecosystems, 
COALESCE((SELECT array_agg(repository) FROM {list}_repositories WHERE name = l.name), '{}'::TEXT[]) AS repositories,
COALESCE((SELECT array_agg(reference) FROM {list}_references WHERE name = l.name), '{}'::TEXT[]) AS "references",
COALESCE((
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', u.id,
            'name', u.name,
            'avatar', u.avatar
        )
    )
    FROM {list}_authors la
    JOIN users u ON la.author = u.id
    WHERE la.name = l.name
), '[]'::jsonb) AS authors,
COALESCE((
    SELECT jsonb_build_object(
        'id', u.id,
        'name', u.name,
        'avatar', u.avatar,
        'time', lc.timestamp
    )
    FROM {list}_created lc
    JOIN users u ON lc.id = u.id
    WHERE lc.name = l.name
    LIMIT 1
), '{}'::jsonb) AS created,
COALESCE((
    SELECT jsonb_build_object(
        'id', u.id,
        'name', u.name,
        'avatar', u.avatar,
        'time', lu.timestamp
    )
    FROM {list}_updated lu
    JOIN users u ON lu.id = u.id
    WHERE lu.name = l.name
    LIMIT 1
), '{}'::jsonb) AS updated,
COALESCE((
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', cl.id,
            'name', cl.name,
            'event', cl.event,
            'author', jsonb_build_object(
                'id', u.id,
                'name', u.name,
                'avatar', u.avatar
            ),
            'timestamp', cl.timestamp
        )
    )
    FROM {list}_changelog cl
    JOIN users u ON cl.author = u.id
    WHERE cl.name = l.name
), '[]'::jsonb) AS "changeLog"
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
-- name filter
WHERE ($1::TEXT IS NULL OR (SELECT l.name = $1))
-- ecosystem filter
AND ($2::TEXT IS NULL OR le.ecosystems IS NULL OR (SELECT $2 = ANY(le.ecosystems)))
-- version filter
AND ($3::TEXT IS NULL OR lv.versions IS NULL OR $3 = ANY(lv.versions))
-- repository filter (checks for unique word since the repository is often 
-- '[REMOTE] npm', but could also be '[LOCAL] npm-other'), which should not be
-- included since 'npm-other' !== 'npm' and 'other-npm' !== 'npm'
AND (
    $4::TEXT IS NULL OR lr.repositories IS NULL OR EXISTS (
        SELECT 1 FROM unnest(lr.repositories) AS repo
        WHERE repo ~* ('\y' || $4 || '\y')
    )
)
-- startDate filter
AND ($5::TIMESTAMP IS NULL OR (
    SELECT lc.timestamp
    FROM {list}_created lc
    WHERE lc.name = l.name
    LIMIT 1
) >= $5::TIMESTAMP)
-- endDate filter
AND ($6::TIMESTAMP IS NULL OR (
    SELECT lc.timestamp
    FROM {list}_created lc
    WHERE lc.name = l.name
    LIMIT 1
) <= $6::TIMESTAMP)
-- search filter
AND (
    $9::TEXT IS NULL 
    OR l.name ILIKE '%' || $9 || '%' 
    OR l.comment ILIKE '%' || $9 || '%'
    OR EXISTS (
        SELECT 1
        FROM unnest(lv.versions) AS version
        WHERE version ILIKE '%' || $9 || '%'
    )
    OR EXISTS (
        SELECT 1
        FROM unnest(le.ecosystems) AS ecosystem
        WHERE ecosystem ILIKE '%' || $9 || '%'
    )
    OR EXISTS (
        SELECT 1
        FROM unnest(lr.repositories) AS repository
        WHERE repository ILIKE '%' || $9 || '%'
    )
    OR EXISTS (
        SELECT 1
        FROM unnest(lrf.references) AS reference
        WHERE reference ILIKE '%' || $9 || '%'
    )
)
LIMIT $8::INT OFFSET ($7::INT * $8::INT) - $8::INT;
;
