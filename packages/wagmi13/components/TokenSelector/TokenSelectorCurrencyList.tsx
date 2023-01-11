import { AddressZero } from '@ethersproject/constants'
import { ChainId } from '@sushiswap/chain'
import { Type } from '@sushiswap/currency'
import { Currency } from '@sushiswap/ui13/components/currency'
import React, { FC, memo, useMemo } from 'react'
import { useAccount } from 'wagmi'

import { usePrices } from '../../hooks'
import { TokenSelectorRow } from './TokenSelectorRow'
import { useBalances } from '@sushiswap/react-query'

interface TokenSelectorCurrencyListProps {
  id: string
  currencies: Type[]
  chainId: ChainId
  onSelect(currency: Type): void
  selected: Type | undefined
}

export const TokenSelectorCurrencyList: FC<TokenSelectorCurrencyListProps> = memo(function TokenSelectorCurrencyList({
  id,
  onSelect,
  currencies,
  chainId,
  selected,
}) {
  const { address } = useAccount()
  const { data: pricesMap } = usePrices({ chainId })
  const { data: balancesMap } = useBalances({ chainId, account: address })

  const rowData: TokenSelectorRow[] = useMemo(() => {
    if (!currencies) return []

    return currencies.map((currency) => ({
      id: id,
      account: address,
      currency,
      balance: balancesMap?.[currency.isNative ? AddressZero : currency.address],
      price: pricesMap?.[currency.isNative ? AddressZero : currency.address],
      onSelect: () => onSelect(currency),
      selected: selected
        ? (currency.isNative === true && selected.isNative === true) ||
          (selected.isToken && currency.isToken && currency.wrapped.address === selected.wrapped.address)
        : false,
    }))
  }, [address, balancesMap, currencies, id, onSelect, pricesMap, selected])

  return <Currency.List className="scroll" rowHeight={64} rowRenderer={TokenSelectorRow} rowData={rowData} />
})
