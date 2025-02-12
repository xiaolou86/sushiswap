import type { VercelRequest, VercelResponse } from '@vercel/node'

import { getTokens } from '../../lib/api.js'

const handler = async (_request: VercelRequest, response: VercelResponse) => {
  console.log('TEST')
  response.setHeader(
    'Cache-Control',
    's-maxage=900, stale-while-revalidate=86400',
  )
  const tokens = await getTokens()
  return response.status(200).json(tokens)
}

export default handler
