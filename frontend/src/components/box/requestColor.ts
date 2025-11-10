export default function requestColor(type: RequestType) {
    switch (type.toUpperCase()) {
        case 'GET': return 'bg-green-500'
        case 'POST': return 'bg-blue-500'
        case 'PUT': return 'bg-orange-500'
        case 'PATCH': return 'bg-purple-500'
        case 'DELETE': return 'bg-red-500'
        case 'HEAD': return 'bg-gray-500'
        case 'OPTIONS': return 'bg-teal-500'
        case 'CONNECT': return 'bg-yellow-600'
        case 'TRACE': return 'bg-pink-500'
        default: return 'bg-black'
    }
}
