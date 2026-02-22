import type { VercelRequest, VercelResponse } from '@vercel/node'

const GEOSERVER_BASE = 'http://sil.loja.gob.ec/geoserver/pugs_2023_2033/wms'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Forward all query params to GeoServer
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      params.set(key, value)
    }
  }

  const url = `${GEOSERVER_BASE}?${params.toString()}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      return res.status(response.status).send('GeoServer error')
    }

    // Forward content type
    const contentType = response.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    // Cache tiles for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*')

    const buffer = Buffer.from(await response.arrayBuffer())
    return res.send(buffer)
  } catch (error) {
    console.error('WMS proxy error:', error)
    return res.status(502).send('Failed to fetch from GeoServer')
  }
}
