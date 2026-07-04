export default function requestColor(type: RequestType) {
    switch (type.toUpperCase()) {
        case 'GET': return 'bg-ui-success'
        case 'POST': return 'bg-ui-primary'
        case 'PUT': return 'bg-ui-warning'
        case 'PATCH': return 'bg-ui-primary'
        case 'DELETE': return 'bg-ui-danger'
        case 'HEAD': return 'bg-ui-muted'
        case 'OPTIONS': return 'bg-ui-success'
        case 'CONNECT': return 'bg-ui-warning'
        case 'TRACE': return 'bg-ui-danger'
        default: return 'bg-ui-muted'
    }
}
