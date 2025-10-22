// @ts-expect-error
import http from 'k6/http'
// @ts-expect-error
import { sleep, check } from 'k6'

export default function () {
    // @ts-expect-error
    const url = __ENV.URL
    // @ts-expect-error
    const timeout = Number(__ENV.TIMEOUT || 1)
    const res = http.get(url)
    check(res, { 'status 200': (r: Response) => r.status === 200 })
    sleep(timeout)
}

export let options = {
    // @ts-expect-error
    stages: JSON.parse(__ENV.STAGES || '[]'),
    thresholds: {
        http_req_failed: ['rate<0.05'],
        http_req_duration: ['p(95)<1000'],
    }
}

// 'https://api.tekkom-bot.login.no/api/activity/games'
// 'https://workerbee.login.no/api/events/'
// 'https://api.exam.login.no/api/courses'
// 'https://api.hanasand.com/api/articles'
