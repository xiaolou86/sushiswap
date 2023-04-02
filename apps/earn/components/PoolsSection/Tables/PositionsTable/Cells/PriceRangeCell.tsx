import { classNames } from '@sushiswap/ui'
import { FC, useMemo } from 'react'

import { ConcentratedLiquidityPosition, useConcentratedLiquidityPool } from '@sushiswap/wagmi/future/hooks'
import { useToken } from '@sushiswap/react-query'
import { Row } from '../../SharedCells/types'
import { ArrowSmLeftIcon, ArrowSmRightIcon } from '@heroicons/react/solid'
import { Position } from '@sushiswap/v3-sdk'
import { JSBI } from '@sushiswap/math'
import { getPriceOrderingFromPositionForUI, getTickToPrice } from '../../../../../lib/functions'
import { Bound } from '../../../../../lib/constants'

export const PriceRangeCell: FC<Row<ConcentratedLiquidityPosition>> = ({ row }) => {
  const { data: token0 } = useToken({ chainId: row.chainId, address: row.token0 })
  const { data: token1 } = useToken({ chainId: row.chainId, address: row.token1 })
  const { data: pool } = useConcentratedLiquidityPool({ chainId: row.chainId, token0, token1, feeAmount: row.fee })

  const position = useMemo(() => {
    if (pool && row.liquidity) {
      return new Position({
        pool,
        liquidity: JSBI.BigInt(row.liquidity),
        tickLower: row.tickLower,
        tickUpper: row.tickUpper,
      })
    }

    return undefined
  }, [pool, row.liquidity, row.tickLower, row.tickUpper])

  const closed = row.liquidity?.eq('0')
  const pricesFromPosition = getPriceOrderingFromPositionForUI(position)
  const invalidRange = Boolean(row.tickLower >= row.tickUpper)

  const pricesAtTicks = useMemo(() => {
    return {
      [Bound.LOWER]: getTickToPrice(token0, token1, row.tickLower),
      [Bound.UPPER]: getTickToPrice(token0, token1, row.tickUpper),
    }
  }, [token0, token1, row.tickLower, row.tickUpper])

  const { [Bound.LOWER]: lowerPrice, [Bound.UPPER]: upperPrice } = pricesAtTicks

  const price = pool && token0 ? pool.priceOf(token0) : undefined
  const outOfRange = Boolean(
    !invalidRange && price && lowerPrice && upperPrice && (price.lessThan(lowerPrice) || price.greaterThan(upperPrice))
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div
          className={classNames(
            invalidRange || outOfRange ? 'bg-red' : closed ? 'bg-slate-700' : 'bg-green',
            'w-2 h-2 rounded-full'
          )}
        />
        <span className="text-sm flex items-center gap-1 text-gray-900 dark:text-slate-50">
          {pricesFromPosition.priceLower?.toSignificant(6)}{' '}
          <div className="flex items-center">
            <ArrowSmLeftIcon width={16} height={16} className="text-slate-500" />
            <ArrowSmRightIcon width={16} height={16} className="text-slate-500 ml-[-7px]" />
          </div>
          {pricesFromPosition.priceUpper?.toSignificant(6)}
        </span>
      </div>
      <span className="text-xs flex items-center gap-1 text-gray-900 dark:text-slate-500">
        Current: {pool?.token0Price?.toSignificant(6)} {pool?.token0Price?.quoteCurrency.symbol} per{' '}
        {pool?.token0Price?.baseCurrency.symbol}
      </span>
    </div>
  )
}
