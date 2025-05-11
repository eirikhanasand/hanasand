vcl 4.0;

backend default {
    .host = "127.0.0.1";
    .port = "8081";
}

sub vcl_recv {
    if (req.method == "POST" || req.method == "PUT" || req.method == "HEAD" || req.method == "OPTIONS" || req.method == "DELETE") {
        return (pass);
    }

    if (req.url ~ "^/api/(list|statistics)(/.*)?$") {
        return (pass);
    }

    return (hash);
}

sub vcl_hash {
    if (req.method == "POST") {
        # Extract Content-Length header and use it in the hash
        if (req.http.Content-Length) {
            set req.http.X-Content-Length = req.http.Content-Length;

            # Include the Content-Length in the cache key
            hash_data(req.http.X-Content-Length);
        }
    }
}

sub vcl_backend_response {
    # Caches for 1 hour
    set beresp.http.Cache-Control = "lsm-cache, max-age=3600";
    set beresp.ttl = 1h;
    return (deliver);
}

sub vcl_deliver {
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT:" + obj.hits;
    } else {
        set resp.http.X-Cache = "MISS";
    }

    return (deliver);
}
