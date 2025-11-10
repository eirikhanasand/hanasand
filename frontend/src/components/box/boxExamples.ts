const exampleRequests: FetchRequest[] = [
    { type: "GET", path: "https://api.hanasand.com/api/users", created: "2025-11-10T09:15:23Z" },
    { type: "POST", path: "https://api.hanasand.com/api/users", created: "2025-11-10T09:16:02Z" },
    { type: "GET", path: "https://api.hanasand.com/api/users/42", created: "2025-11-10T09:17:11Z" },
    { type: "PUT", path: "https://vg.no/api/users/42", created: "2025-11-10T09:18:45Z" },
    { type: "DELETE", path: "https://www.login.no/api/users/42", created: "2025-11-10T09:19:30Z" },
    { type: "PATCH", path: "https://www.login.no/api/posts/15", created: "2025-11-10T09:20:01Z" },
    { type: "GET", path: "https://www.login.no/api/posts", created: "2025-11-10T09:21:22Z" },
    { type: "POST", path: "https://www.login.no/api/posts", created: "2025-11-10T09:22:48Z" },
    { type: "OPTIONS", path: "https://api.hanasand.com/ws/api/auth/login", created: "2025-11-10T09:23:33Z" },
    { type: "HEAD", path: "ws://api.hanasand.com/ws/api/health", created: "2025-11-10T09:24:10Z" },
    { type: "GET", path: "wss://api.hanasand.com/ws/api/products", created: "2025-11-10T09:25:41Z" },
    { type: "POST", path: "ws://api.hanasand.com/ws/api/products", created: "2025-11-10T09:26:59Z" },
    { type: "GET", path: "wss://api.hanasand.com/ws/api/products/12", created: "2025-11-10T09:27:44Z" },
    { type: "PUT", path: "https://api.hanasand.com/api/products/12", created: "2025-11-10T09:28:33Z" },
    { type: "DELETE", path: "https://abc.com/api/products/12", created: "2025-11-10T09:29:05Z" },
    { type: "TRACE", path: "https://abc.com/api/debug", created: "2025-11-10T09:30:14Z" },
    { type: "CONNECT", path: "https://abc.com/api/proxy", created: "2025-11-10T09:31:40Z" },
    { type: "POST", path: "https://abc.com/api/auth/login", created: "2025-11-10T09:32:22Z" },
    { type: "GET", path: "https://abc.com/api/settings", created: "2025-11-10T09:33:57Z" },
    { type: "PATCH", path: "https://abc.com/api/settings/profile", created: "2025-11-10T09:34:42Z" },
]

const exampleParameters = [
    { "parameter": "userId", "value": "42" },
    { "parameter": "limit", "value": "25" },
    { "parameter": "sort", "value": "desc" },
    { "parameter": "include", "value": "posts,comments" },
    { "parameter": "active", "value": "true" }
]

export { exampleParameters }
export default exampleRequests
