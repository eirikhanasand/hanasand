import { strict as assert } from 'node:assert'
import test from 'node:test'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'

test('DWM scraper API base prefers explicit and environment-aware defaults', () => {
    assert.equal(tiScraperApiBase({ TI_SCRAPER_API_BASE: 'https://ti.example.test/' }), 'https://ti.example.test')
    assert.equal(tiScraperApiBase({ HANASAND_TI_SCRAPER_LOCAL_BASE: 'http://127.0.0.1:9901/' }), 'http://127.0.0.1:9901')
    assert.equal(tiScraperApiBase({ NODE_ENV: 'production' }), 'http://ti-scraper:8097')
    assert.equal(tiScraperApiBase({ NODE_ENV: 'development' }), 'http://127.0.0.1:8097')
})
