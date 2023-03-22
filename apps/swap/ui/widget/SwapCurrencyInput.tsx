'use client'

import React, { FC, useEffect, useState } from 'react'
import { Web3Input } from '@sushiswap/wagmi/future/components/Web3Input'
import { useSwapActions, useSwapState } from '../trade/TradeProvider'
import { useDebounce } from '@sushiswap/hooks'
import { useTokenState } from '../TokenProvider'

export const SwapCurrencyInput: FC = () => {
  const { tokensLoading } = useTokenState()
  const { token0, value, network0 } = useSwapState()
  const [localValue, setLocalValue] = useState(value)
  const { setToken0, setValue } = useSwapActions()
  const debouncedValue = useDebounce(localValue, 250)

  // To avoid slow input
  useEffect(() => {
    setValue(debouncedValue)
  }, [setValue, debouncedValue])

  useEffect(() => {
    if (value !== localValue && value === '0') {
      setLocalValue('')
    }
  }, [value])

  return (
    <Web3Input.Currency
      type="INPUT"
      className="p-3 dark:bg-slate-800 bg-white rounded-xl"
      chainId={network0}
      onSelect={setToken0}
      value={localValue}
      onChange={setLocalValue}
      currency={token0}
      loading={tokensLoading}
      currencyLoading={tokensLoading}
    />
  )
}
