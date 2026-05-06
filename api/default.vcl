vcl 4.0;

backend default {
    .host = "127.0.0.1";
    .port = "8081";
    .connect_timeout = 10s;
    .first_byte_timeout = 300s;
    .between_bytes_timeout = 300s;
}

sub vcl_recv {
    if (req.http.Upgrade ~ "(?i)websocket") {
        return (pipe);
    }

    if (req.method == "POST" || req.method == "PUT" || req.method == "HEAD" || req.method == "OPTIONS" || req.method == "DELETE") {
        return (pass);
    }

    if (req.http.Authorization || req.http.ID) {
        return (pass);
    }

    if (req.url ~ "^/api/(app|thought/random|test/visits|certificates|auth|vm|vms|metrics|docker|status|tools|logs)(/.*)?$") {
        return (pass);
    }

    if (req.url ~ "^/api/ai/(models|runtime)(/.*)?$") {
        return (pass);
    }

    return (hash);
}

sub vcl_backend_response {
    if (beresp.http.Cache-Control ~ "no-store") {
        set beresp.ttl = 0s;
        return (deliver);
    }

    set beresp.ttl = 1h;
    set beresp.http.Cache-Control = "hanasand-cache, max-age=3600";

    return (deliver);
}

sub vcl_pipe {
    if (req.http.Upgrade) {
        set bereq.http.Connection = "upgrade";
        set bereq.http.Upgrade = req.http.Upgrade;
    }
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
