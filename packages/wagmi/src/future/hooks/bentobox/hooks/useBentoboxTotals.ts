'use client'

import { isBentoBoxChainId } from '@sushiswap/bentobox-sdk'
import { ChainId } from 'sushi/chain'
import { Type } from 'sushi/currency'
import { useQuery } from '@tanstack/react-query'

import { getBentoboxTotals } from '../actions'

interface UseBentoboxTotalsParams {
  chainId: ChainId
  currencies: (Type | undefined)[]
  enabled?: boolean
}

const queryFn = async ({ chainId, currencies }: UseBentoboxTotalsParams) => {
  if (isBentoBoxChainId(chainId)) {
    return getBentoboxTotals(chainId, currencies)
  }
  return undefined
}

export const useBentoboxTotals = ({
  enabled = true,
  ...variables
}: UseBentoboxTotalsParams) => {
  const { currencies, chainId } = variables
  return useQuery({
    queryKey: ['useBentoboxTotals', { chainId, currencies }],
    enabled,
    queryFn: async () => {
      const data = await queryFn(variables)
      if (!data) return null

      return data.map(({ base, elastic }) => ({
        base,
        elastic,
      }))
    },
    refetchInterval: 10000,
  })
}
