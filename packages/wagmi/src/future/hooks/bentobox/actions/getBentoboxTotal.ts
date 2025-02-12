import { BentoBoxChainId } from '@sushiswap/bentobox-sdk'
import { Type } from 'sushi/currency'

import { getBentoboxTotals } from './getBentoboxTotals'

export const getBentoboxTotal = async ({
  chainId,
  currency,
}: { chainId: BentoBoxChainId; currency: Type }) => {
  if (!chainId) return undefined

  const totals = await getBentoboxTotals(chainId, [currency])

  if (!totals || !currency) {
    return undefined
  }

  return totals[0]
}
