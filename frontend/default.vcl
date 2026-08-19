vcl 4.0;

backend default {
    .host = "127.0.0.1";
    .port = "3001";
}

sub vcl_recv {
    if (req.method != "GET" && req.method != "HEAD") {
        return (pass);
    }

    if (req.url ~ "^/api(?:[/?#]|$)") {
        return (pass);
    }

    if (req.url ~ "^/(ti|dwm)(?:[/?#]|$)") {
        return (pass);
    }

    if (req.url ~ "^/s(?:[/?#]|$)") {
        return (pass);
    }

    if (req.url ~ "^/dashboard(?:/|$)") {
        # Authenticated dashboard HTML is safe to cache only when the complete
        # session cookie is part of the hash. API requests remain uncached.
        if (!(req.http.Cookie ~ "(^|; )access_token=") || !(req.http.Cookie ~ "(^|; )id=")) {
            return (pass);
        }
    } else if (req.http.Cookie ~ "(^|; )access_token=" || req.http.Cookie ~ "(^|; )id=" || req.url ~ "^/(profile|role|ai)(/|$)") {
        return (pass);
    }

    if (req.http.Cookie) {
        set req.http.X-Theme = regsub(req.http.Cookie, ".*theme=([^;]+);?.*", "\1");
    }
    return (hash);
}

sub vcl_hash {
    # Hashes theme and the complete authenticated session. This prevents one
    # tenant, impersonation target, or role set from receiving another user's
    # rendered dashboard response.
    hash_data(req.http.X-Theme);
    if (req.url ~ "^/dashboard(?:/|$)") {
        hash_data(req.http.Cookie);
    }
}

sub vcl_backend_response {
    if (bereq.url ~ "^/$" && beresp.status == 200 && !(bereq.http.Cookie ~ "(^|; )access_token=") && !(bereq.http.Cookie ~ "(^|; )id=")) {
        # The public homepage is safe to cache even though the shared Next
        # layout reads cookies and headers. Authenticated requests already
        # pass in vcl_recv; theme cookies are part of the cache hash.
        unset beresp.http.Set-Cookie;
        set beresp.ttl = 5s;
        set beresp.grace = 30s;
        set beresp.http.Cache-Control = "public, max-age=5, stale-while-revalidate=30";
        return (deliver);
    } else if (bereq.url ~ "^/dashboard(?:/|$)" && beresp.status == 200) {
        # Next marks cookie-aware dynamic pages private. They are still safe
        # here because vcl_hash includes the complete authenticated cookie.
        # Set-Cookie is safe to replay only for that same session key.
        set beresp.ttl = 5s;
        return (deliver);
    } else if (beresp.http.Set-Cookie) {
        set beresp.uncacheable = true;
        set beresp.ttl = 0s;
        return (deliver);
    } else if (beresp.http.Cache-Control ~ "(?i)(no-cache|no-store|private)") {
        set beresp.uncacheable = true;
        set beresp.ttl = 0s;
    } else {
        set beresp.ttl = 52w;
    }
    return (deliver);
}

sub vcl_deliver {
    set resp.http.Via = "Varnish Hanasand Cache";

    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT:" + obj.hits;
    } else {
        set resp.http.X-Cache = "MISS";
    }

    return (deliver);
}
